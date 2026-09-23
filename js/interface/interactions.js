// INTERAÇÕES DO GRAFO
// Controla eventos, arraste, transições de foco, navegação e cards informativos.
// Coordena os módulos existentes; as regras visuais pertencem ao SCSS.

function drag(simulation) {
  let wasDragged = false;
  const previousPins = new WeakMap();
  let frozenNodes = [];

  function dragstarted(event, d) {
    wasDragged = false;
    previousPins.set(d, { fx: d.fx, fy: d.fy });
    // Isola o arraste: os outros nós ficam temporariamente fixos nas
    // posições atuais, evitando que a simulação propague o movimento pelo
    // grafo inteiro enquanto o usuário move apenas este nó.
    frozenNodes = simulation.nodes()
      .filter((node) => node !== d)
      .map((node) => ({ node, fx: node.fx, fy: node.fy }));
    frozenNodes.forEach(({ node }) => {
      node.fx = node.x;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;
    });
    d.fx = d.x;
    d.fy = d.y;
    d3.select(this).raise();
  }

  function dragged(event, d) {
    if (!wasDragged) {
      wasDragged = true;
      simulation.alphaTarget(0.15).restart();
    }
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    const previous = previousPins.get(d);
    // O arraste fixa temporariamente um nó livre; soltá-lo devolve seu
    // controle às ligações e colisões, com ou sem nomes visíveis.
    if (previous?.fx == null) d.fx = null;
    if (previous?.fy == null) d.fy = null;
    previousPins.delete(d);
    frozenNodes.forEach(({ node, fx, fy }) => {
      node.fx = fx ?? null;
      node.fy = fy ?? null;
      node.vx = 0;
      node.vy = 0;
    });
    frozenNodes = [];
    if (!event.active) simulation.alphaTarget(0);
    if (wasDragged) simulation.alpha(Math.max(simulation.alpha(), 0.04)).restart();
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

let linkMeta = null;
const techniqueNamesVisibility = new Map();

window._setLinkMeta = function (m) {
  linkMeta = m;
};
window._areTechniqueNamesVisible = function (techId) {
  return techniqueNamesVisibility.get(techId) === true;
};
window._hasActivePersonSelection = function () {
  return Boolean(activeNode && !activeNode.isCategory && !activeNode.isTechnique);
};

// Mostra os nomes no grafo normal. A força de colisão passa a usar a
// largura do nome como raio de segurança, afastando pessoas, técnicas e eixos.
window._setAllNamesVisible = function (visible, allowedIds = null) {
  window.DBG_ALL_NAMES_VISIBLE = visible;
  window.DBG_FOCUSED_CATEGORY_NAMES = Boolean(visible && activeNode?.isCategory);
  const fontSize = Math.min(window.DBG_PERSON_NAME_SIZE || 10, 11);
  const nameSizePx = `${fontSize}px`;
  let namedPeople = graphData.nodes.filter(
    (node) => !node.isCategory && !node.isTechnique
  );

  // Ao focar uma técnica, o botão de nomes mostra somente as pessoas
  // conectadas diretamente a ela — não o restante do grafo.
  if (visible && activeNode?.isTechnique) {
    const connectedPeople = new Set();
    graphData.links.forEach((link) => {
      if (link.type !== "person-technique-link") return;
      const sourceId = _linkNodeId(link.source);
      const targetId = _linkNodeId(link.target);
      if (sourceId === activeNode.id) connectedPeople.add(targetId);
      if (targetId === activeNode.id) connectedPeople.add(sourceId);
    });
    namedPeople = namedPeople.filter((person) => connectedPeople.has(person.id));
  }
  if (visible && allowedIds) {
    namedPeople = namedPeople.filter((person) => allowedIds.has(person.id));
  }

  const namedPeopleIds = new Set(namedPeople.map((person) => person.id));

  // No foco de um adinkra, o nome acompanha a extremidade do conjunto:
  // pessoas na metade direita recebem o texto à direita e pessoas na metade
  // esquerda recebem o texto à esquerda. A referência é o adinkra, não a
  // técnica, para evitar rótulos voltando para o centro.
  const techniqueByPerson = new Map();
  if (visible && activeNode?.isCategory) {
    graphData.links.forEach((link) => {
      if (link.type !== "person-technique-link") return;
      const sourceId = _linkNodeId(link.source);
      const targetId = _linkNodeId(link.target);
      const source = graphData.nodes.find((node) => node.id === sourceId);
      const target = graphData.nodes.find((node) => node.id === targetId);
      const person = source && !source.isCategory && !source.isTechnique ? source : target;
      const technique = person === source ? target : source;
      if (person && technique?.isTechnique && !techniqueByPerson.has(person.id)) {
        techniqueByPerson.set(person.id, technique);
      }
    });
  }

  graphData.nodes.forEach((node) => {
    node.__labelVisible = visible && namedPeopleIds.has(node.id);
    if (node.__labelVisible && activeNode?.isCategory) {
      const technique = techniqueByPerson.get(node.id);
      const dx = node.x - activeNode.x;
      const dy = node.y - activeNode.y;
      // Mantém a técnica como referência para pessoas ainda sem posição,
      // mas o lado final sempre é decidido pelo centro do adinkra.
      const referenceX = Number.isFinite(dx) && dx !== 0
        ? dx
        : technique ? node.x - technique.x : 1;
      node.__labelSide = referenceX >= 0 ? "right" : "left";
    } else {
      node.__labelSide = null;
    }
  });

  labelGroup
    .selectAll(".label")
    .interrupt()
    .text((node) =>
      visible && namedPeopleIds.has(node.id)
        ? node.Nome || node.id
        : (node.Nome || node.id).split(" ")[0]
    )
    .transition()
    .duration(480)
    .ease(d3.easeCubicOut)
    .attr("dx", (node) => {
      const side = node.__labelSide;
      if (side === "right") return `${nodeRadius(node) + 7}px`;
      if (side === "left") return `-${nodeRadius(node) + 7}px`;
      return "0";
    })
    .attr("dy", (node) => {
      const side = node.__labelSide;
      if (side === "bottom") return `${nodeRadius(node) + 7}px`;
      if (side === "top") return `-${nodeRadius(node) + LABEL_OFFSET_ABOVE_PX}px`;
      return activeNode?.isCategory ? "0" : `${nodeRadius(node) + 6}px`;
    })
    .attr("text-anchor", (node) => node.__labelSide === "right" ? "start" : node.__labelSide === "left" ? "end" : "middle")
    .attr("dominant-baseline", (node) => {
      if (node.__labelSide === "bottom") return "hanging";
      if (node.__labelSide === "top") return "auto";
      return activeNode?.isCategory ? "middle" : "hanging";
    })
    .style("font-size", visible ? nameSizePx : "9px")
    .style("visibility", (node) =>
      visible && namedPeopleIds.has(node.id) ? "visible" : "hidden"
    )
    .style("pointer-events", (node) =>
      visible && namedPeopleIds.has(node.id) ? "all" : "none"
    );

  if (!simulation) return;
  simulation
    .force("all-names-technique-avoidance", null)
    .force(
      "named-people-spread",
      null
    )
    .force("collide")
    .initialize(simulation.nodes());
  // No foco do adinkra, a colisão precisa vencer o puxão radial que mantém
  // as pessoas ao redor das técnicas. O ajuste só vale enquanto os nomes
  // completos estão visíveis nessa visualização.
  const focusedCategoryNames = Boolean(visible && activeNode?.isCategory);
  simulation.velocityDecay(
    focusedCategoryNames ? 0.52 : visible && allowedIds ? 0.78 : visible ? 0.68 : 0.38
  );
  simulation.alphaDecay(visible && allowedIds ? 0.02 : visible ? 0.018 : 0.028);
  simulation
    .alpha(focusedCategoryNames ? 0.24 : visible && allowedIds ? 0.14 : visible ? 0.09 : 0.12)
    .alphaTarget(0)
    .restart();
};

// ── Multi-seleção de categorias ───────────────────────────────
window.selectedCategoryHighlights = new Set();
window._personCategoryHighlights = new Set();

function _setPersonCategoryHighlights(areas = []) {
  window._personCategoryHighlights = new Set(areas);
  document.querySelectorAll(".category-btn").forEach((button) => {
    const isConnected = window._personCategoryHighlights.has(button.dataset.value);
    const isRealFilter = window.selectedCategories?.has(button.dataset.value);
    button.classList.toggle(
      "person-connected",
      isConnected
    );
    button.dataset.personConnected = isConnected ? "true" : "false";
    // A folha responsiva já define exatamente a borda colorida do estado
    // .active. Usamos esse estado só visualmente, sem alterar o filtro real.
    if (isConnected) button.classList.add("active");
    else if (!isRealFilter) button.classList.remove("active");
  });
}
window._setPersonCategoryHighlights = _setPersonCategoryHighlights;

function _renderCategoryHighlights() {
  const selected = window.selectedCategoryHighlights;

  if (selected.size === 0) {
    // Sem seleção: esconde só as linhas, todos os nós ficam visíveis
    linkGroup
      .selectAll(".link")
      .interrupt()
      .transition()
      .duration(220)
      .attr("stroke-opacity", (link) =>
        window._hasActiveMenuFilter && window._linkOpacity
          ? window._linkOpacity(link)
          : 0
      );
    return;
  }

  // Vizinhos de 2 hops de todas as categorias selecionadas (para saber quais linhas mostrar)
  const allNeighbors = new Set();
  selected.forEach((catId) => {
    const catNode = graphData.nodes.find((n) => n.id === catId);
    if (catNode)
      _twohopNeighbors(catNode).forEach((id) => allNeighbors.add(id));
  });

  // Todos os nós ficam visíveis — sem dimming
  nodeGroup
    .selectAll(".node")
    .interrupt()
    .transition()
    .duration(220)
    .style("opacity", 1);

  // Só as linhas das categorias selecionadas aparecem
  linkGroup
    .selectAll(".link")
    .interrupt()
    .attr("stroke-opacity", (link) => {
      const srcId = _linkNodeId(link.source);
      const tgtId = _linkNodeId(link.target);
      const baseOp = window._linkOpacity ? window._linkOpacity(link) : 0.6;
      if (link.type === "technique-category-link") {
        return selected.has(srcId) || selected.has(tgtId) ? baseOp : 0;
      }
      if (link.type === "person-technique-link") {
        return allNeighbors.has(srcId) && allNeighbors.has(tgtId) ? baseOp : 0;
      }
      return 0;
    });
}

window._toggleCategoryHighlight = function (categoryId) {
  // Limpa foco de nó individual se houver
  if (activeNode && !activeNode.isCategory) {
    activeNode.fx = null;
    activeNode.fy = null;
    _restoreNodeSizes();
    activeNode = null;
    _hideCard();
  }

  if (window.selectedCategoryHighlights.has(categoryId)) {
    window.selectedCategoryHighlights.delete(categoryId);
  } else {
    window.selectedCategoryHighlights.add(categoryId);
  }

  _renderCategoryHighlights();
  // Clicar diretamente no ícone só destaca as ligações. A organização
  // radial é exclusiva do filtro de adinkra, não deste destaque local.
  if (simulation) {
    simulation.force("category-petals", null);
  }
  // A troca de adinkra pode limpar os labels junto do foco anterior.
  // Se o modo de nomes está ativo, restaura os nomes da seleção atual
  // para que o estado visual acompanhe o botão.
  if (window.DBG_ALL_NAMES_VISIBLE) {
    window._setAllNamesVisible?.(true);
  }
  window._updateMenuCounts?.(graphData.nodes, graphData.links);
};

function _linkNodeId(v) {
  return typeof v === "object" ? v.id : v;
}

function _neighborsForNode(node) {
  const neighbors = new Set([node.id]);
  graphData.links.forEach((link) => {
    const sourceId = _linkNodeId(link.source);
    const targetId = _linkNodeId(link.target);
    if (sourceId === node.id) neighbors.add(targetId);
    if (targetId === node.id) neighbors.add(sourceId);
  });
  return neighbors;
}

// 2 hops: útil para categorias (categoria → técnicas → pessoas)
function _twohopNeighbors(node) {
  const neighbors = new Set([node.id]);
  const firstHop = new Set();

  graphData.links.forEach((link) => {
    const srcId = _linkNodeId(link.source);
    const tgtId = _linkNodeId(link.target);
    if (srcId === node.id) {
      neighbors.add(tgtId);
      firstHop.add(tgtId);
    }
    if (tgtId === node.id) {
      neighbors.add(srcId);
      firstHop.add(srcId);
    }
  });

  graphData.links.forEach((link) => {
    const srcId = _linkNodeId(link.source);
    const tgtId = _linkNodeId(link.target);
    if (firstHop.has(srcId)) neighbors.add(tgtId);
    if (firstHop.has(tgtId)) neighbors.add(srcId);
  });

  return neighbors;
}

// Vizinhos de uma pessoa: as técnicas dela (1 salto) + o eixo/adinkra
// de cada uma dessas técnicas (technique-category-link). Diferente de
// _twohopNeighbors, NÃO inclui outras pessoas que usam a mesma
// técnica — só o eixo, que é o que a pessoa focada precisa mostrar.
function _neighborsForPersonWithAreas(node) {
  const neighbors = _neighborsForNode(node);
  const techniqueIds = new Set([...neighbors].filter((id) => id !== node.id));

  graphData.links.forEach((link) => {
    if (link.type !== "technique-category-link") return;
    const srcId = _linkNodeId(link.source);
    const tgtId = _linkNodeId(link.target);
    if (techniqueIds.has(srcId)) neighbors.add(tgtId);
  });

  return neighbors;
}

function _isPersonLinkedToTechnique(personId, techniqueId) {
  return graphData.links.some((link) => {
    if (link.type !== "person-technique-link") return false;
    const sourceId = _linkNodeId(link.source);
    const targetId = _linkNodeId(link.target);
    return (
      (sourceId === personId && targetId === techniqueId) ||
      (sourceId === techniqueId && targetId === personId)
    );
  });
}

function _setPersonLabelVisibility(personId, visible, fullName = false) {
  const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;
  labelGroup
    .selectAll(".label")
    .filter((node) => node.id === personId)
    .attr(
      "dy",
      visible && fullName
        ? "0"
        : (node) => `-${nodeRadius(node) + LABEL_OFFSET_ABOVE_PX}px`
    )
    .attr("dominant-baseline", visible && fullName ? "middle" : "auto")
    .style("font-size", visible && fullName ? nameSizePx : "9px")
    .style("visibility", visible ? "visible" : "hidden")
    .style("pointer-events", visible ? "all" : "none")
    .text((node) =>
      fullName ? node.Nome || node.id : (node.Nome || node.id).split(" ")[0]
    );
}

function _highlightPersonInGraph(person, highlighted) {
  const factor = highlighted ? 1.12 : 1;
  const personSel = nodeGroup
    .selectAll(".node")
    .filter((node) => node.id === person.id);
  const r = nodeRadius(person);
  const techActive =
    activeNode &&
    activeNode.isTechnique &&
    _isPersonLinkedToTechnique(person.id, activeNode.id);

  if (techActive) {
    const showingNames = window._areTechniqueNamesVisible(activeNode.id);

    if (highlighted) {
      personSel.interrupt().style("opacity", 1);
      const iw = Math.max(r * 2 * factor, 26);
      const ih = iw * (23 / 43);
      const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;
      labelGroup
        .selectAll(".label")
        .filter((node) => node.id === person.id)
        .attr("dx", showingNames
          ? (person.__labelSide === "left" ? `-${r + 7}px` : `${r + 7}px`)
          : "0")
        .attr("dy", showingNames ? "0" : `${ih / 2 + 6}px`)
        .attr("text-anchor", showingNames
          ? (person.__labelSide === "left" ? "end" : "start")
          : "middle")
        .attr("dominant-baseline", showingNames ? "middle" : "hanging")
        .style("font-size", nameSizePx)
        .style("visibility", "visible")
        .style("pointer-events", "none")
        .text((node) => node.Nome || node.id);
      personSel
        .selectAll(".node-nat-img")
        .interrupt()
        .transition()
        .duration(180)
        .attr("width", iw)
        .attr("height", ih)
        .attr("x", -iw / 2)
        .attr("y", -ih / 2)
        .style("opacity", 1);
    } else {
      // Restaura ao estado anterior ao hover: se nomes estavam visíveis, mantém o label
      _setPersonLabelVisibility(person.id, showingNames, showingNames);
      personSel
        .interrupt()
        .transition()
        .duration(180)
        .style("opacity", 0.92);
      if (!person.__cardNatHover && !person.__nodeNatHover) {
        personSel
          .selectAll(".node-nat-img")
          .interrupt()
          .transition()
          .duration(180)
          .style("opacity", 0);
      }
    }
    return;
  }

  // Caso normal: apenas aumenta o raio
  personSel
    .selectAll("circle")
    .transition()
    .duration(highlighted ? 140 : 180)
    .attr("r", r * factor);
}

// Reserva a largura real do painel, inclusive durante a animação de abertura.
const cardPanel = document.querySelector(".info-panel");
if (cardPanel) {
  new ResizeObserver(() => {
    const graphArea = document.querySelector(".graph-area");
    if (!graphArea) return;
    const reserved = cardPanel.classList.contains("is-open")
      ? cardPanel.getBoundingClientRect().width + 12 : 0;
    graphArea.style.right = `${reserved}px`;
    window._resizeGraphViewport?.();
  }).observe(cardPanel);
}

function _showCard() {
  const panel = document.querySelector(".info-panel");
  if (panel) panel.classList.add("is-open");
  // Todos os cards compartilham o retorno ao grafo ou à pesquisa de origem.
  const backButton = document.getElementById("search-results-back");
  if (backButton) {
    backButton.hidden = false;
    backButton.setAttribute("aria-label", window._searchProfileActive
      ? "Voltar aos resultados da pesquisa" : "Voltar à visualização do grafo");
  }
}

function _hideCard() {
  const panel = document.querySelector(".info-panel");
  const searchBackButton = document.getElementById("search-results-back");
  if (searchBackButton) searchBackButton.hidden = true;
  if (panel) panel.classList.remove("is-open");
  const techniqueAreaCard = document.getElementById("card-tec-area");
  const personCard = document.getElementById("card-pessoa");
  if (techniqueAreaCard) techniqueAreaCard.style.display = "none";
  if (personCard) personCard.style.display = "none";
}

function _restoreNodeSizes() {
  nodeGroup.selectAll(".node").each(function (node) {
    // Desliga as flags de zoom e nome visível: a colisão (draw.js)
    // volta a tratar esse nó com o raio normal.
    node.__focusZoomActive = false;
    node.__focusScale = null;
    node.__labelVisible = false;
    const el = d3.select(this);
    const r = nodeRadius(node);
    el.selectAll("circle")
      .interrupt()
      .transition()
      .duration(220)
      .attr("r", r)
      .style("opacity", !node.isCategory && !node.isTechnique ? 0.92 : null);
    el.selectAll(".node-icon-img")
      .interrupt()
      .transition()
      .duration(220)
      .attr("width", r * 2)
      .attr("height", r * 2)
      .attr("x", -r)
      .attr("y", -r);
    el.selectAll(".node-nat-img")
      .interrupt()
      .transition()
      .duration(220)
      .style("opacity", 0);
  });
}

function _resetGraphState() {
  if (window.selectedCategoryHighlights)
    window.selectedCategoryHighlights.clear();
  window._focusInteractiveIds = null;
  nodeGroup
    .selectAll(".node, .node > *")
    .style("pointer-events", null)
    .attr("pointer-events", null);
  labelGroup.selectAll(".label")
    .style("pointer-events", null)
    .attr("pointer-events", null);
  _restoreNodeSizes();
  if (simulation) simulation.force("collide").initialize(simulation.nodes());
  nodeGroup
    .selectAll(".node")
    .interrupt()
    .transition()
    .duration(220)
    .style("opacity", 1)
    .style("pointer-events", "all");
  // Em modo de busca os labels são gerenciados por _applySearchLabels
  if (!window._currentSearchTerm && !window.DBG_ALL_NAMES_VISIBLE) {
    labelGroup
      .selectAll(".label")
      .interrupt()
      .transition()
      .duration(180)
      .style("visibility", "hidden")
      .style("pointer-events", "none")
      .text((node) => (node.Nome || node.id).split(" ")[0]);
  }
  linkGroup
    .selectAll(".link")
    .interrupt()
    .transition()
    .duration(220)
    .attr("stroke-opacity", (link) => {
      // Filtros do Menu mantêm o caminho completo das conexões visível.
      if (window._hasActiveMenuFilter)
        return window._linkOpacity ? window._linkOpacity(link) : 0.6;

      // Se nenhum filtro de área está ativo, o estado de repouso é
      // sem nenhuma linha visível — igual já era antes.
      const selectedCats = window.selectedCategories;
      if (!selectedCats || selectedCats.size === 0) return 0;

      // Com filtro de área ativo, o estado de repouso é "linhas dessa
      // área visíveis" — sem isso, desfocar uma pessoa deixava tudo
      // parecendo desconectado, mesmo com o filtro ainda ligado.
      const sourceId = _linkNodeId(link.source);
      const targetId = _linkNodeId(link.target);
      const meta = linkMeta ? linkMeta.get(link) : null;
      const baseOp = meta?.isPrimary ? 0.8 : 0.5;

      if (link.type === "technique-category-link" && selectedCats.has(targetId))
        return baseOp;
      if (link.type === "person-technique-link") {
        const techNode = graphData.nodes.find((n) => n.id === targetId);
        const techArea = techNode && techNode["Área do design"];
        return techArea && selectedCats.has(techArea) ? baseOp : 0;
      }
      return 0;
    });
}

function _setFocusedNodeScale(node) {
  if (node.isCategory) return;

  const baseRadius = nodeRadius(node);
  const focusScale = node.isTechnique ? FOCUS_ZOOM_SCALE : 1.2;
  const focusRadius = baseRadius * focusScale;
  // Avisa a colisão (draw.js) que esse nó está visualmente ampliado,
  // pra ela usar o raio grande e nenhum outro nó ficar por baixo dele.
  node.__focusZoomActive = true;
  node.__focusScale = focusScale;
  if (simulation) simulation.force("collide").initialize(simulation.nodes());

  nodeGroup.selectAll(".node").each(function (candidate) {
    if (candidate.id !== node.id) return;
    const el = d3.select(this);
    const isPerson = !node.isCategory && !node.isTechnique;
    el.selectAll("circle")
      .interrupt()
      .style("opacity", isPerson ? 0 : null)
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr("r", focusRadius);
    if (isPerson) {
      const natW = Math.max(focusRadius * 2, 22);
      const natH = natW * (23 / 43);
      el.selectAll(".node-nat-img")
        .interrupt()
        .transition()
        .duration(300)
        .ease(d3.easeCubicOut)
        .attr("width", natW)
        .attr("height", natH)
        .attr("x", -natW / 2)
        .attr("y", -natH / 2)
        .style("opacity", 1);
    } else {
      el.selectAll(".node-nat-img").interrupt().style("opacity", 0);
    }
    el.selectAll(".node-icon-img")
      .interrupt()
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr("width", focusRadius * 2)
      .attr("height", focusRadius * 2)
      .attr("x", -focusRadius)
      .attr("y", -focusRadius);
  });
}

function _renderGraphFocus(node, neighbors, options = {}) {
  // Reset de segurança: garante que nenhum nó fica com pointer-events
  // travado em "none" (herdado de um foco de pessoa anterior, que
  // desliga interação dos rebaixados) ao entrar num foco de categoria
  // ou técnica, que não redefinem isso por conta própria.
  nodeGroup.selectAll(".node").style("pointer-events", "all");

  if (node.isCategory) {
    nodeGroup
      .selectAll(".node")
      .interrupt()
      .transition()
      .duration(280)
      .style("opacity", (candidate) => {
        if (candidate.id === node.id) return 1;
        if (!neighbors.has(candidate.id)) return 0.06;
        if (candidate.isTechnique) return 1;
        if (!candidate.isCategory && !candidate.isTechnique) return 0.75; // pessoas visíveis
        return 1;
      });

    labelGroup
      .selectAll(".label")
      .interrupt()
      .transition()
      .duration(180)
      .style("visibility", "hidden")
      .style("pointer-events", "none");
  } else if (node.isTechnique) {
    const showingNames = window._areTechniqueNamesVisible(node.id);

    nodeGroup
      .selectAll(".node")
      .interrupt()
      .transition()
      .duration(280)
      .style("opacity", (candidate) => {
        if (candidate.id === node.id) return 1;
        if (!neighbors.has(candidate.id)) return 0.05;
        if (!candidate.isCategory && !candidate.isTechnique)
          return showingNames ? 0 : 0.92;
        return 1;
      })
      .each(function (candidate) {
        // Avisa a colisão (draw.js) quais nós estão mostrando o nome
        // completo agora, pra ela reservar espaço do tamanho do texto
        // em vez do tamanho da bolinha.
        candidate.__labelVisible = !!(
          showingNames && neighbors.has(candidate.id)
        );
      });
    if (simulation) simulation.force("collide").initialize(simulation.nodes());

    const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;
    labelGroup
      .selectAll(".label")
      .interrupt()
      .text((candidate) =>
        showingNames && neighbors.has(candidate.id)
          ? candidate.Nome || candidate.id
          : (candidate.Nome || candidate.id).split(" ")[0]
      )
      .attr("dy", (candidate) =>
        showingNames && neighbors.has(candidate.id)
          ? "0"
          : `${nodeRadius(candidate) + 6}px`
      )
      .attr("dominant-baseline", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "middle" : "hanging"
      )
      .style("font-size", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? nameSizePx : "9px"
      )
      .style("visibility", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "visible" : "hidden"
      )
      .style("pointer-events", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "all" : "none"
      );
  } else {
    nodeGroup
      .selectAll(".node")
      .interrupt()
      .transition()
      .duration(280)
      .style("opacity", (candidate) => (neighbors.has(candidate.id) ? 1 : 0.08))
      // Pessoas "rebaixadas" (não-vizinhas da pessoa focada) ficam sem
      // interação de mouse: estão quase invisíveis e não devem reagir
      // a hover/clique nesse estado.
      .style("pointer-events", (candidate) =>
        neighbors.has(candidate.id) ? "all" : "none"
      );

    labelGroup
      .selectAll(".label")
      .interrupt()
      .transition()
      .duration(180)
      .style("visibility", "hidden")
      .style("pointer-events", "none");
  }

  linkGroup.selectAll(".link").attr("stroke-opacity", (link) => {
    const sourceId = _linkNodeId(link.source);
    const targetId = _linkNodeId(link.target);
    const meta = linkMeta ? linkMeta.get(link) : null;
    const isDirect = sourceId === node.id || targetId === node.id;
    const isVisibleNetwork = neighbors.has(sourceId) && neighbors.has(targetId);

    const baseOp = meta?.isPrimary ? 0.8 : 0.5;

    if (node.isCategory) {
      if (link.type === "technique-category-link" && isVisibleNetwork)
        return baseOp;
      if (link.type === "person-technique-link" && isVisibleNetwork)
        return baseOp;
      return 0;
    }

    if (node.isTechnique) {
      if (isDirect) return baseOp;
      return 0;
    }

    // Pessoa focada: além do link direto dela com a técnica, mostra
    // também o link técnica → eixo, já que o eixo agora é vizinho
    // dela (_neighborsForPersonWithAreas) — senão o ícone do eixo
    // aparecia "flutuando" sem linha nenhuma o conectando à técnica.
    if (link.type === "technique-category-link" && isVisibleNetwork)
      return baseOp;
    if (isDirect) return baseOp;

    return 0;
  });

  // Aplica visuais de nationalidade sobre o foco (se filtro ativo)
  if (
    window.selectedNationalities?.size > 0 &&
    typeof window._applyNatVisuals === "function"
  ) {
    window._applyNatVisuals();
  }

  if (options.areaFromFilter && node.isCategory) {
    window._categoryFilterFocusActive = true;
    window._returnToAreaCardId = null;
    if (options.noCard) {
      _hideCard();
    } else {
      const connectedTechniques = graphData.nodes.filter(
        (candidate) => candidate.isTechnique && neighbors.has(candidate.id)
      );
      exibirAreaCard(node, connectedTechniques);
      _showCard();
    }
    // O foco do eixo esconde labels para a visualização padrão. Quando o
    // botão de nomes já estiver ligado, mostra novamente somente os nomes
    // presentes neste grafo filtrado.
    if (window.DBG_ALL_NAMES_VISIBLE) {
      window._setAllNamesVisible?.(true);
    }
    return;
  }

  if (node.isTechnique) {
    const connectedPeople = graphData.nodes.filter(
      (candidate) =>
        !candidate.isCategory &&
        !candidate.isTechnique &&
        neighbors.has(candidate.id)
    );
    exibirListaPessoas(node, connectedPeople);
    _showCard();
    return;
  }

  if (!node.isCategory) {
    exibirPerfil(node);
    _showCard();
    return;
  }

  _hideCard();
}

function _clearBouquetForce() {
  simulation?.force("link")?.strength(link => link.type === "person-technique-link" ? 0.62 : link.type === "technique-category-link" ? 0.52 : 0.5);
  if (!simulation) return;
  simulation.velocityDecay(0.58);
  simulation.force("focus-bouquet", null);
  // Restaura orbit e center padrões
  if (typeof forceOrbit === "function") {
    simulation.force("orbit", forceOrbit(graphData.links, 68, 0.9, 20));
  }
  const graphAreaEl = document.querySelector(".graph-area");
  const w = Math.min(
    graphAreaEl ? graphAreaEl.clientWidth : window.innerWidth,
    2000
  );
  const h = Math.min(
    graphAreaEl ? graphAreaEl.clientHeight : window.innerHeight,
    1200
  );
  if (!window._categoryFilterFocusActive) {
    graphData.nodes.forEach((node) => {
      const position = node.isCategory && CATEGORY_POSITIONS[node.id];
      if (position) {
        node.fx = position.rx * w;
        node.fy = position.ry * h;
        node.x = node.fx;
        node.y = node.fy;
      }
    });
  }
  simulation.force(
    "x",
    d3.forceX((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) {
        return CATEGORY_POSITIONS[node.id].rx * w;
      }
      return w / 2;
    }).strength((node) => (node.isCategory && CATEGORY_POSITIONS[node.id] ? 0.8 : 0.1))
  );
  simulation.force(
    "y",
    d3.forceY((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) {
        return CATEGORY_POSITIONS[node.id].ry * h;
      }
      return h / 2;
    }).strength((node) => (node.isCategory && CATEGORY_POSITIONS[node.id] ? 0.8 : 0.1))
  );
  simulation.force("center", d3.forceCenter(w / 2, h / 2));
}

function _radialFocusForce(focused, R1, R2, strength = 1.5) {
  // Layout radial 360° ao redor do nó focado
  // R1 = raio dos vizinhos diretos; R2 = raio das pessoas (estendendo-se para fora a partir das técnicas)
  return function (alpha) {
    if (focused.x == null) return;
    const namedCategoryFocus = focused.isCategory && window.DBG_ALL_NAMES_VISIBLE;

    // Vizinhos diretos
    const direct = [];
    graphData.links.forEach((link) => {
      const sId =
        typeof link.source === "object" ? link.source.id : link.source;
      const tId =
        typeof link.target === "object" ? link.target.id : link.target;
      if (sId === focused.id) direct.push(link.target);
      else if (tId === focused.id) direct.push(link.source);
    });

    // Foco em PESSOA: o eixo/adinkra fica a 2 saltos dela (pessoa →
    // técnica → eixo), então não entra no laço acima. Adiciona aqui
    // pra ele também ganhar um lugar no layout radial, em vez de ficar
    // solto sem posição organizada.
    if (!focused.isCategory && !focused.isTechnique) {
      const techIds = new Set(
        direct.filter((n) => n.isTechnique).map((n) => n.id)
      );
      graphData.links.forEach((link) => {
        if (link.type !== "technique-category-link") return;
        const sourceNode = link.source;
        const targetNode = link.target;
        const sourceId =
          typeof sourceNode === "object" ? sourceNode.id : sourceNode;
        if (
          techIds.has(sourceId) &&
          !direct.some(
            (n) =>
              n.id ===
              (typeof targetNode === "object" ? targetNode.id : targetNode)
          )
        ) {
          direct.push(targetNode);
        }
      });
    }

    if (direct.length === 0) return;

    const isPersonFocus = !focused.isCategory && !focused.isTechnique;
    // No foco de um adinkra, a distribuição adaptativa já começa ativa.
    // Assim, quando os nomes forem revelados, a organização já estará preparada.
    const isAdaptiveCategoryLayout = focused.isCategory;
    const peopleCountByTechnique = new Map();
    if (focused.isCategory) {
      graphData.links.forEach((link) => {
        if (link.type !== "person-technique-link") return;
        const sourceId = _linkNodeId(link.source);
        const targetId = _linkNodeId(link.target);
        const techniqueId = direct.some((node) => node.id === sourceId)
          ? sourceId
          : direct.some((node) => node.id === targetId) ? targetId : null;
        if (techniqueId) {
          peopleCountByTechnique.set(
            techniqueId,
            (peopleCountByTechnique.get(techniqueId) || 0) + 1
          );
        }
      });
    }

    // No foco de uma pessoa, apenas as técnicas ocupam o primeiro anel.
    // Os adinkras ficam no anel seguinte, preservando a hierarquia visual.
    const radialDirect = isPersonFocus
      ? direct.filter((node) => !node.isCategory)
      : direct;

    // Com nomes ativos, as técnicas mais populosas começam no alto e
    // recebem uma fatia angular maior do buquê.
    radialDirect.sort((a, b) => {
      if (isAdaptiveCategoryLayout) {
        const countDiff = (peopleCountByTechnique.get(b.id) || 0) - (peopleCountByTechnique.get(a.id) || 0);
        if (countDiff !== 0) return countDiff;
      }
      return a.id < b.id ? -1 : 1;
    });

    const angleByNode = new Map();
    const angleSpanByNode = new Map();
    const weightOf = (node) => isAdaptiveCategoryLayout
      ? Math.max(1, Math.sqrt((peopleCountByTechnique.get(node.id) || 0) + 1))
      : 1;
    const totalWeight = radialDirect.reduce((sum, node) => sum + weightOf(node), 0);
    // A técnica mais populosa começa à direita, onde o anel externo tem
    // mais espaço horizontal para acomodar os nomes. Antes ela começava no
    // topo e concentrava o maior grupo em uma faixa vertical estreita.
    const firstSpan = isAdaptiveCategoryLayout && radialDirect.length
      ? (2 * Math.PI * weightOf(radialDirect[0])) / totalWeight
      : 0;
    // Compensa meia largura do primeiro setor para que seu centro fique
    // exatamente na lateral direita, e não abaixo dela.
    let cursor = isAdaptiveCategoryLayout ? -firstSpan / 2 : 0;

    radialDirect.forEach((node, i) => {
      const span = (2 * Math.PI * weightOf(node)) / totalWeight;
      const angle = isAdaptiveCategoryLayout ? cursor + span / 2 : i * ((2 * Math.PI) / radialDirect.length);
      cursor += isAdaptiveCategoryLayout ? span : 0;
      angleByNode.set(node.id, angle);
      angleSpanByNode.set(node.id, span);
      const tx = focused.x + Math.cos(angle) * R1;
      const ty = focused.y + Math.sin(angle) * R1;
      node.vx += (tx - node.x) * alpha * strength;
      node.vy += (ty - node.y) * alpha * strength;
    });

    if (isPersonFocus) {
      const connectedCategories = direct.filter((node) => node.isCategory);
      connectedCategories.forEach((category, index) => {
        const linkedTechniqueAngles = [];
        graphData.links.forEach((link) => {
          if (link.type !== "technique-category-link") return;
          const sourceId = _linkNodeId(link.source);
          const targetId = _linkNodeId(link.target);
          const techniqueId = sourceId === category.id ? targetId : targetId === category.id ? sourceId : null;
          if (techniqueId && angleByNode.has(techniqueId)) {
            linkedTechniqueAngles.push(angleByNode.get(techniqueId));
          }
        });
        const angle = linkedTechniqueAngles.length
          ? linkedTechniqueAngles.reduce((sum, value) => sum + value, 0) / linkedTechniqueAngles.length
          : index * ((2 * Math.PI) / Math.max(1, connectedCategories.length));
        const categoryRadius = R1 + R2;
        const tx = focused.x + Math.cos(angle) * categoryRadius;
        const ty = focused.y + Math.sin(angle) * categoryRadius;
        category.vx += (tx - category.x) * alpha * strength;
        category.vy += (ty - category.y) * alpha * strength;
      });
    }

    // Para foco em ÁREA: pessoas estendem-se para fora, a partir de suas técnicas, em forma de raios
    if (focused.isCategory) {
      const techNodes = direct.filter((n) => n.isTechnique);
      const techIds = new Set(techNodes.map((n) => n.id));
      const peopleByTech = new Map();
      const assignedPeople = new Set();
      const graphAreaEl = document.querySelector(".graph-area");
      const layoutWidth = Math.min(
        graphAreaEl?.clientWidth || window.innerWidth,
        2000
      );
      const layoutHeight = Math.min(
        graphAreaEl?.clientHeight || window.innerHeight,
        1200
      );
      const edgeMargin = 88;

      graphData.links.forEach((link) => {
        if (link.type !== "person-technique-link") return;
        const sId =
          typeof link.source === "object" ? link.source.id : link.source;
        const tId =
          typeof link.target === "object" ? link.target.id : link.target;
        let techId = null;
        let personNode = null;
        if (techIds.has(sId)) {
          techId = sId;
          personNode = link.target;
        } else if (techIds.has(tId)) {
          techId = tId;
          personNode = link.source;
        }
        if (
          !techId ||
          !personNode ||
          personNode.isCategory ||
          personNode.isTechnique ||
          assignedPeople.has(personNode.id)
        )
          return;
        assignedPeople.add(personNode.id);
        if (!peopleByTech.has(techId)) peopleByTech.set(techId, []);
        peopleByTech.get(techId).push(personNode);
      });

      peopleByTech.forEach((people, techId) => {
        const techNode = techNodes.find((n) => n.id === techId);
        const techAngle = angleByNode.get(techId);
        if (!techNode || techAngle === undefined) return;
        const SPREAD = isAdaptiveCategoryLayout
          ? Math.min(Math.PI * 0.95, Math.max(Math.PI * 0.42, (angleSpanByNode.get(techId) || Math.PI * 0.45) * 0.82))
          : Math.PI * 0.45; // ±40°
        people.sort((a, b) => (a.id < b.id ? -1 : 1));
        people.forEach((p, i) => {
          const t = people.length === 1 ? 0.5 : i / (people.length - 1);
          const a = techAngle - SPREAD / 2 + t * SPREAD;
          // A pessoa fica no anel externo do adinkra, e não apenas a R2 da
          // técnica. Assim a hierarquia fica estável: centro → técnica → pessoa.
          const outerRadius = R1 + R2;
          // Alterna a distância para que os nomes não formem uma fileira
          // única: uma pessoa fica um pouco mais perto e a próxima um pouco
          // mais longe, repetindo o padrão ao longo do grupo.
          const stagger = i % 2 === 0 ? -20 : 20;
          const personRadius = outerRadius + stagger;
          const px = Math.max(
            edgeMargin,
            Math.min(layoutWidth - edgeMargin, focused.x + Math.cos(a) * personRadius)
          );
          const py = Math.max(
            edgeMargin,
            Math.min(layoutHeight - edgeMargin, focused.y + Math.sin(a) * personRadius)
          );
          const personStrength = namedCategoryFocus ? strength * 0.9 : strength * 0.85;
          p.vx += (px - p.x) * alpha * personStrength;
          p.vy += (py - p.y) * alpha * personStrength;
        });
      });
    }
  };
}

// Raio do "buquê": distância dos vizinhos diretos até o nó focado.
// Mesmo valor pra pessoa, técnica e categoria — clicar em qualquer
// tipo de nó dá a mesma sensação de "vai pro centro, conexões
// distribuídas ao redor", em vez de cada tipo ter seu próprio raio.
const BOUQUET_RADIUS_RATIO = 0.32;
const BOUQUET_RADIUS_MIN_PX = 180;

function _applyBouquetForce(node, _neighbors, svgW, svgH) {
  if (!simulation) return;
  const isTechniqueFocus = node.isTechnique;

  // Ao trocar de foco, os nós já carregam velocidade da simulação anterior.
  // No foco de técnica isso causava a sensação de que todas as bolinhas
  // saíam correndo. Começamos essa reorganização quase sem inércia.
  if (isTechniqueFocus) {
    graphData.nodes.forEach((candidate) => {
      candidate.vx = (candidate.vx || 0) * 0.08;
      candidate.vy = (candidate.vy || 0) * 0.08;
    });
    simulation.velocityDecay(0.82);
  }
  // No foco de eixo, muitas ligações de pessoas puxavam as técnicas para
  // um lado e venciam o anel. O anel organiza as técnicas; as linhas continuam
  // presentes, mas sua atração fica secundária apenas nesta visualização.
  simulation.force("link")?.strength(link => node.isCategory
    ? (link.type === "person-technique-link" ? 0.025 : 0.06)
    : isTechniqueFocus
      ? (link.type === "person-technique-link" ? 0.26 : link.type === "technique-category-link" ? 0.3 : 0.25)
      : (link.type === "person-technique-link" ? 0.62 : link.type === "technique-category-link" ? 0.52 : 0.5));
  simulation.force("category-petals", null);
  if (node.isCategory) {
    graphData.nodes.forEach(candidate => {
      if (candidate.isTechnique) { candidate.fx = null; candidate.fy = null; }
    });
  }
  simulation.force("orbit", null);
  simulation.force("center", null);
  simulation.force("x", null);
  simulation.force("y", null);

  const minDim = Math.min(svgW, svgH);
  const categoryRadiusRatio = node.isCategory
    ? BOUQUET_RADIUS_RATIO * 0.84
    : BOUQUET_RADIUS_RATIO;
  const R1 = Math.min(
    Math.max(minDim * categoryRadiusRatio, BOUQUET_RADIUS_MIN_PX),
    Math.max(100, minDim / 2 - 65)
  );
  // No foco de adinkra, deixa o anel externo um pouco mais distante das
  // técnicas para abrir espaço visual entre as bolinhas e os rótulos.
  const R2 = node.isCategory
    ? Math.max(minDim * 0.19, 105)
    : Math.max(minDim * 0.14, 70);

  const isCategoryFocus = node.isCategory;
  simulation.force(
    "focus-bouquet",
    _radialFocusForce(
      node,
      R1,
      R2,
      isCategoryFocus ? 1.4 : isTechniqueFocus ? 0.42 : 1.2
    )
  );
  simulation
    // A técnica recebe um impulso menor para evitar que as pessoas
    // "corram" para o novo arranjo ao abrir o card.
    .alpha(isCategoryFocus ? 0.4 : isTechniqueFocus ? 0.12 : 0.62)
    .alphaTarget(isCategoryFocus ? 0.045 : isTechniqueFocus ? 0.018 : 0.08)
    .restart();
  clearTimeout(window.__bouquetCool);
  window.__bouquetCool = setTimeout(() => {
    if (simulation) simulation.alphaTarget(0);
  }, isCategoryFocus ? 2600 : isTechniqueFocus ? 3600 : 2200);
}

function focusNode(event, d, options = {}) {
  if (d?.isTechnique) {
    // Guarda a origem apenas quando a técnica foi aberta a partir de um
    // adinkra. Assim uma origem antiga nunca contamina outra navegação.
    window._returnToAreaCardId = activeNode?.isCategory ? activeNode.id : null;
  }
  if (activeNode && (!d || activeNode.id !== d.id)) {
    window._setPersonNatFocus?.(activeNode, false);
  }
  if (activeNode && (!d || activeNode.id !== d.id)) {
    if (
      activeNode.isCategory &&
      typeof CATEGORY_POSITIONS !== "undefined" &&
      CATEGORY_POSITIONS[activeNode.id]
    ) {
      const pos = CATEGORY_POSITIONS[activeNode.id];
      const vb = svg.attr("viewBox").split(" ");
      const w = +vb[2] || window.innerWidth;
      const h = +vb[3] || window.innerHeight;
      activeNode.fx = pos.rx * w;
      activeNode.fy = pos.ry * h;
    } else if (!window._currentSearchTerm) {
      // Em modo de busca mantém os pins do layout em grade
      activeNode.fx = null;
      activeNode.fy = null;
    }
    _restoreNodeSizes();
  }

  if (!d) {
    _setPersonCategoryHighlights();
    window._focusInteractiveIds = null;
    window.DBG_TECHNIQUE_NAMES_VISIBLE = false;
    // Sair de qualquer card encerra também a preferência temporária de
    // nomes usada no card do adinkra.
    window._setAllNamesVisible?.(false);
    const namesButton = document.getElementById("toggle-all-names");
    namesButton?.classList.remove("active");
    namesButton?.setAttribute("aria-pressed", "false");
    namesButton?.setAttribute("aria-label", "Mostrar todos os nomes");
    // Fechamento explícito não deve reabrir um card pendente do filtro.
    if (options.closeCard) window._pendingAreaCard = null;
    window._lastDeselectedId = activeNode ? activeNode.id : null;
    window._lastDeselectedAt = Date.now();
    activeNode = null;
    window._focusExpansionActive = false;

    const selectedCats = window.selectedCategories;
    if (selectedCats && selectedCats.size > 0 && !options.closeCard) {
      // Reaproveita o MESMO mecanismo usado quando o adinkra é
      // selecionado pela primeira vez (_pendingAreaCard), pra garantir
      // que o estado depois de desfocar fica idêntico ao estado
      // original — mesmas conexões visíveis, mesmo card de área aberto.
      window._pendingAreaCard = [...selectedCats][0];
      applyAllFilters();
      return;
    }

    window._categoryFilterFocusActive = false;

    _hideCard();
    _resetGraphState();
    _clearBouquetForce();
    if (simulation) simulation.alphaTarget(0).alpha(0.4).restart();
    // Re-aplica labels e visuais de busca ao desfocar
    if (window._currentSearchTerm) {
      if (typeof window._applySearchLabels === "function")
        window._applySearchLabels(window._currentSearchTerm);
      if (typeof window._applyNatVisuals === "function")
        window._applyNatVisuals();
    }
    return;
  }

  if (d.isCategory && !options.areaFromFilter) {
    // No grafo, o adinkra destaca as técnicas conectadas. A seleção
    // pelo Menu é o caminho que filtra pessoas.
    window._toggleCategoryHighlight(d.id);
    return;
  }

  // A seleção individual prioriza a leitura do foco: sai do modo que
  // mostra todos os nomes antes de organizar a visualização da pessoa.
  if (!d.isCategory && window.DBG_ALL_NAMES_VISIBLE) {
    window._setAllNamesVisible?.(false);
    const namesButton = document.getElementById("toggle-all-names");
    namesButton?.classList.remove("active");
    namesButton?.setAttribute("aria-pressed", "false");
    namesButton?.setAttribute("aria-label", "Mostrar todos os nomes");
  }

  // Ao clicar em uma pessoa encontrada pela busca, troca para a mesma
  // visualização de perfil usada fora da busca: pessoa, técnicas, eixos e
  // todas as conexões reais da pessoa ficam visíveis. O termo fica guardado
  // para a seta restaurar os resultados depois.
  if (window._currentSearchTerm && !d.isCategory && !d.isTechnique) {
    window._searchProfileTerm =
      document.getElementById("search-input")?.value || window._currentSearchTerm;
    window._searchProfileActive = true;
    window._currentSearchTerm = "";

    const profileIds =
      typeof _fullNeighborhoodOf === "function"
        ? _fullNeighborhoodOf(d.id)
        : new Set([d.id]);
    const profileNodes = allNodes.filter((node) => profileIds.has(node.id));
    const profileLinks = allLinks.filter((link) => {
      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;
      return profileIds.has(source) && profileIds.has(target);
    });

    window._hasActiveMenuFilter = true;
    drawForceGraph({ nodes: profileNodes, links: profileLinks }, true);
  }

  activeNode = d;
  if (!d.isCategory && !d.isTechnique) {
    window._setPersonNatFocus?.(d, true);
  }

  // Exceção de foco (item c): se a pessoa tem técnica/eixo de fora do
  // filtro de área ativo, o grafo atual não tem esses nós desenhados.
  // Recalcula incluindo a vizinhança completa dela antes de continuar
  // — só faz esse redesenho mais caro quando realmente falta algo,
  // pra não pesar em cliques normais onde nada muda.
  if (
    !d.isCategory &&
    !d.isTechnique &&
    typeof _personNeedsFullNeighborhoodExpansion === "function" &&
    _personNeedsFullNeighborhoodExpansion(d.id)
  ) {
    applyAllFilters();
    // Marca que o grafo foi ampliado pra além do filtro por causa
    // dessa pessoa — usado ao desfocar, pra saber que precisa
    // encolher de volta ao conjunto filtrado puro.
    window._focusExpansionActive = true;
  }

  nodeGroup
    .selectAll(".node")
    .filter((node) => node.id === d.id)
    .raise();

  const viewBox = svg.attr("viewBox").split(" ");
  const svgW = +viewBox[2] || window.innerWidth;
  const svgH = +viewBox[3] || window.innerHeight;

  // Pessoa fica à esquerda para abrir espaço para técnicas e adinkras.
  // Técnicas e adinkras continuam centrados na área do grafo.
  d.fx = d.isCategory || d.isTechnique ? svgW * 0.42 : svgW * 0.36;
  d.fy = svgH * 0.5;
  d.x = d.fx;
  d.y = d.fy;

  _setFocusedNodeScale(d);
  const neighbors = d.isCategory
    ? _twohopNeighbors(d)
    : d.isTechnique
    ? _neighborsForNode(d)
    : _neighborsForPersonWithAreas(d);

  // Em uma visualização focada, nós que ficaram apenas no fundo não podem
  // capturar cliques. Somente o foco e sua vizinhança real permanecem
  // interativos.
  nodeGroup
    .selectAll(".node")
    .style("pointer-events", (candidate) =>
      neighbors.has(candidate.id) ? "all" : "none"
    )
    .attr("pointer-events", (candidate) =>
      neighbors.has(candidate.id) ? "all" : "none"
    );
  nodeGroup.selectAll(".node > *")
    .style("pointer-events", function () {
      const owner = this.parentNode?.__data__;
      return owner && neighbors.has(owner.id) ? "all" : "none";
    })
    .attr("pointer-events", function () {
      const owner = this.parentNode?.__data__;
      return owner && neighbors.has(owner.id) ? "all" : "none";
    });
  window._focusInteractiveIds = new Set(neighbors);
  labelGroup
    .selectAll(".label")
    .style("pointer-events", (candidate) =>
      neighbors.has(candidate.id) ? "all" : "none"
    );

  // O eixo/adinkra fica fixo (fx/fy) no canto dele quando não está em
  // foco, pra ter um "lar" estável. Isso faz a força radial abaixo
  // ignorá-lo completamente quando ele vira vizinho de uma técnica ou
  // pessoa — sem desafixar aqui, ele ficaria sempre parado no mesmo
  // lugar, mesmo entrando no buquê de outro nó.
  if (!d.isCategory) {
    graphData.nodes.forEach((candidate) => {
      if (candidate.isCategory && neighbors.has(candidate.id)) {
        candidate.fx = null;
        candidate.fy = null;
      }
    });
  }

  _applyBouquetForce(d, neighbors, svgW, svgH);
  _renderGraphFocus(d, neighbors, options);

  if (simulation) {
    simulation
      .alpha(d.isCategory ? 0.34 : d.isTechnique ? 0.12 : 0.5)
      .alphaTarget(d.isTechnique ? 0.018 : d.isCategory ? 0.045 : 0.08)
      .restart();
  }
}

function _applyCategoryColors(container, area) {
  const card = document.getElementById("card");
  const c1 =
    (typeof CATEGORY_COLORS !== "undefined" && CATEGORY_COLORS[area]) ||
    "#CCCCCC";
  const c55 =
    (typeof CATEGORY_COLORS_55 !== "undefined" && CATEGORY_COLORS_55[area]) ||
    c1;
  const c30 =
    (typeof CATEGORY_COLORS_30 !== "undefined" && CATEGORY_COLORS_30[area]) ||
    c1;
  [container, card].filter(Boolean).forEach((el) => {
    el.style.setProperty("--cat-color", c1);
    el.style.setProperty("--cat-color-55", c55);
    el.style.setProperty("--cat-color-30", c30);
  });
}

function exibirAreaCard(nodeData, techniques) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  // Cada novo adinkra começa com os nomes ocultos, sem herdar o estado do card anterior.
  window._setAllNamesVisible?.(false);
  const namesButton = document.getElementById("toggle-all-names");
  namesButton?.classList.remove("active");
  namesButton?.setAttribute("aria-pressed", "false");
  namesButton?.setAttribute("aria-label", "Mostrar todos os nomes");
  container.innerHTML = "";
  container.className = "adinkra-card";

  const area = nodeData.Nome || nodeData.id;
  _applyCategoryColors(container, area);
  const adinkraInfo =
    (typeof ADINKRA_INFO !== "undefined" && ADINKRA_INFO[area]) || {};
  const connectedTechniques = techniques.filter((technique) =>
    graphData.links.some((link) => {
      if (link.type !== "person-technique-link") return false;
      const source = _linkNodeId(link.source);
      const target = _linkNodeId(link.target);
      return source === technique.id || target === technique.id;
    })
  );

  const topLayout = document.createElement("div");
  topLayout.className = "adinkra-card-top-layout";
  const leftColumn = document.createElement("div");
  leftColumn.className = "adinkra-card-left-column";
  const adinkraName = document.createElement("h2");
  adinkraName.className = "adinkra-card-title";
  adinkraName.textContent = adinkraInfo.nome || area;
  leftColumn.appendChild(adinkraName);
  const adinkraDescription = document.createElement("p");
  adinkraDescription.className = "adinkra-card-description";
  adinkraDescription.textContent = adinkraInfo.descricao || "";
  const rightColumn = document.createElement("div");
  rightColumn.className = "adinkra-card-right-column";
  rightColumn.appendChild(adinkraDescription);
  const areaDescription = document.createElement("p");
  areaDescription.className = "adinkra-card-description adinkra-area-description";
  areaDescription.textContent =
    (typeof AREA_DESCRICOES !== "undefined" && AREA_DESCRICOES[area]) || "";
  rightColumn.appendChild(areaDescription);
  topLayout.append(leftColumn, rightColumn);

  const axisBlock = document.createElement("div");
  axisBlock.className = "adinkra-axis-block";
  const axisHeader = document.createElement("div");
  axisHeader.className = "adinkra-section-header";
  const axisTitle = document.createElement("span");
  axisTitle.textContent = `Eixo ${area}`;
  const axisCount = document.createElement("small");
  axisCount.textContent = connectedTechniques.length;
  axisHeader.append(axisTitle, axisCount);
  axisBlock.appendChild(axisHeader);

  const techniqueGrid = document.createElement("div");
  techniqueGrid.className = "adinkra-techniques-grid";
  connectedTechniques
    .slice()
    .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
    .forEach((technique) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-technique-tag";
      item.textContent = technique.Nome || technique.id;
      item.addEventListener("click", () => focusNode(null, technique));
      techniqueGrid.appendChild(item);
    });
  axisBlock.appendChild(techniqueGrid);
  leftColumn.appendChild(axisBlock);
  container.appendChild(topLayout);

  // Designers conectados a esta área
  const connectedPeopleSet = new Set();
  techniques.forEach((tec) => {
    graphData.links.forEach((link) => {
      if (link.type !== "person-technique-link") return;
      const srcId = _linkNodeId(link.source);
      const tgtId = _linkNodeId(link.target);
      if (srcId === tec.id) {
        const p = graphData.nodes.find(
          (n) => n.id === tgtId && !n.isCategory && !n.isTechnique
        );
        if (p) connectedPeopleSet.add(p);
      }
      if (tgtId === tec.id) {
        const p = graphData.nodes.find(
          (n) => n.id === srcId && !n.isCategory && !n.isTechnique
        );
        if (p) connectedPeopleSet.add(p);
      }
    });
  });

  const sortedPeople = [...connectedPeopleSet].sort((a, b) =>
    (a.Nome || "").localeCompare(b.Nome || "", "pt")
  );
  if (sortedPeople.length > 0) {
    const peopleHeader = document.createElement("div");
    peopleHeader.className = "adinkra-section-header adinkra-designers-header";
    const peopleTitle = document.createElement("span");
    peopleTitle.textContent = "Designers";
    const peopleCount = document.createElement("small");
    peopleCount.textContent = sortedPeople.length;
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "adinkra-names-toggle";
    toggleBtn.setAttribute("aria-label", "Mostrar nomes dos designers no grafo");
    toggleBtn.innerHTML = '<img class="adinkra-eye-off" src="assets/icons/ver-nomes-off.svg" alt=""><img class="adinkra-eye-on" src="assets/icons/ver-nomes-on.svg" alt="">';
    peopleHeader.append(peopleTitle, peopleCount, toggleBtn);
    container.appendChild(peopleHeader);

    const peopleGrid = document.createElement("div");
    peopleGrid.className = "adinkra-designers-grid";
    sortedPeople.forEach((person) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-designer-tag";
      item.textContent = person.Nome || person.id;
      item.addEventListener("click", () => focusNode(null, person));
      item.addEventListener("mouseenter", () => window._setPersonNatHover?.(person, true));
      item.addEventListener("mouseleave", () => window._setPersonNatHover?.(person, false));
      peopleGrid.appendChild(item);
    });
    container.appendChild(peopleGrid);

    let open = false;
    peopleGrid.hidden = true;
    toggleBtn.classList.remove("is-visible");
    toggleBtn.setAttribute("aria-label", "Mostrar nomes dos designers no grafo");
    const designerIds = new Set(sortedPeople.map((person) => person.id));
    const setDesignerNamesVisible = (visible) => {
      window._setAllNamesVisible?.(visible, designerIds);
    };
    const toggle = () => {
      open = !open;
      setDesignerNamesVisible(open);
      peopleGrid.hidden = !open;
      toggleBtn.setAttribute("aria-label", open ? "Ocultar nomes dos designers no grafo" : "Mostrar nomes dos designers no grafo");
      toggleBtn.classList.toggle("is-visible", open);
    };
    toggleBtn.addEventListener("click", toggle);
  }
}

function exibirListaPessoas(nodeData, designers) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";
  container.className = "adinkra-card technique-card";

  const techniqueId = nodeData.id;
  const techniqueName = nodeData.Nome || nodeData.id;
  const description = TECNICA_DESCRICOES[techniqueName] || "";
  const designerIds = new Set(designers.map((designer) => designer.id));

  const techArea =
    (typeof nodeAreaMap !== "undefined" && nodeAreaMap.get(techniqueId)) ||
    null;
  if (techArea) _applyCategoryColors(container, techArea);

  if (!techniqueNamesVisibility.has(techniqueId)) {
    techniqueNamesVisibility.set(techniqueId, false);
  }

  const topLayout = document.createElement("div");
  topLayout.className = "adinkra-card-top-layout";
  const leftColumn = document.createElement("div");
  leftColumn.className = "adinkra-card-left-column";
  const title = document.createElement("h2");
  title.className = "adinkra-card-title";
  title.textContent = techniqueName;
  leftColumn.appendChild(title);

  const rightColumn = document.createElement("div");
  rightColumn.className = "adinkra-card-right-column";
  const descriptionEl = document.createElement("p");
  descriptionEl.className = "adinkra-card-description";
  descriptionEl.textContent = description;
  rightColumn.appendChild(descriptionEl);
  topLayout.append(leftColumn, rightColumn);

  container.appendChild(topLayout);

  const peopleHeader = document.createElement("div");
  peopleHeader.className = "adinkra-section-header adinkra-designers-header";
  const peopleTitle = document.createElement("span");
  peopleTitle.textContent = "Designers";
  const peopleCount = document.createElement("small");
  peopleCount.textContent = designers.length;
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "adinkra-names-toggle";
  toggleButton.innerHTML = '<img class="adinkra-eye-off" src="assets/icons/ver-nomes-off.svg" alt=""><img class="adinkra-eye-on" src="assets/icons/ver-nomes-on.svg" alt="">';
  peopleHeader.append(peopleTitle, peopleCount, toggleButton);
  container.appendChild(peopleHeader);

  const grid = document.createElement("div");
  grid.className = "adinkra-designers-grid";
  const initialNamesVisible = techniqueNamesVisibility.get(techniqueId);
  grid.hidden = !initialNamesVisible;
  designers
    .slice()
    .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
    .forEach((designer) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-designer-tag";
      item.textContent = designer.Nome || designer.id;
      item.addEventListener("click", () => focusNode(null, designer));
      item.addEventListener("mouseenter", () => {
        window._setPersonNatHover?.(designer, true);
        _highlightPersonInGraph(designer, true);
      });
      item.addEventListener("mouseleave", () => {
        window._setPersonNatHover?.(designer, false);
        _highlightPersonInGraph(designer, false);
      });
      grid.appendChild(item);
    });
  if (designers.length === 0) {
    const empty = document.createElement("span");
    empty.className = "adinkra-designer-tag";
    empty.textContent = "Nenhum designer conectado";
    grid.appendChild(empty);
  }
  container.appendChild(grid);

  function syncTechniquePeopleView(showNames) {
    techniqueNamesVisibility.set(techniqueId, showNames);
    window.DBG_TECHNIQUE_NAMES_VISIBLE = showNames;
    const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;

    nodeGroup
      .selectAll(".node")
      .filter(
        (node) =>
          !node.isCategory && !node.isTechnique && designerIds.has(node.id)
      )
      .interrupt()
      .transition()
      .duration(350)
      .style("opacity", 0.92)
      .each(function (node) {
        // Mesmo aviso pra colisão: aqui o nome fica visível pra todo
        // mundo da lista, não só pros vizinhos hovered.
        node.__labelVisible = showNames;
        node.__labelSide = showNames
          ? (node.x >= activeNode.x ? "right" : "left")
          : null;
      });
    if (simulation) simulation.force("collide").initialize(simulation.nodes());

    labelGroup
      .selectAll(".label")
      .filter((node) => designerIds.has(node.id))
      .interrupt()
      .text((node) =>
        showNames ? node.Nome || node.id : (node.Nome || node.id).split(" ")[0]
      )
      .attr("dx", (node) => {
        if (!showNames) return "0";
        return node.__labelSide === "left"
          ? `-${nodeRadius(node) + 7}px`
          : `${nodeRadius(node) + 7}px`;
      })
      .attr("dy", showNames ? "0" : (node) => `${nodeRadius(node) + 6}px`)
      .attr("text-anchor", showNames ? (node) => node.__labelSide === "left" ? "end" : "start" : "middle")
      .attr("dominant-baseline", showNames ? "middle" : "hanging")
      .style("font-size", showNames ? nameSizePx : "9px")
      .style("visibility", showNames ? "visible" : "hidden")
      .style("pointer-events", showNames ? "all" : "none");

    // Aumenta o raio do bouquet ao exibir nomes para reduzir sobreposição de labels
    if (simulation && activeNode?.isTechnique) {
      const graphAreaEl = document.querySelector(".graph-area");
      const svgW = Math.min(
        graphAreaEl?.clientWidth || window.innerWidth,
        2000
      );
      const svgH = Math.min(
        graphAreaEl?.clientHeight || window.innerHeight,
        1200
      );
      const minDim = Math.min(svgW, svgH);
      // Mesmo raio base do foco normal (BOUQUET_RADIUS_RATIO/MIN_PX),
      // com um acréscimo extra quando os nomes completos estão
      // visíveis, pra dar mais espaço e reduzir sobreposição de labels.
      const R1 = showNames
        ? Math.max(
            minDim * (BOUQUET_RADIUS_RATIO - 0.02),
            BOUQUET_RADIUS_MIN_PX + 20
          )
        : Math.max(minDim * BOUQUET_RADIUS_RATIO, BOUQUET_RADIUS_MIN_PX);
      const R2 = Math.max(minDim * 0.14, 70);
      simulation.force(
        "focus-bouquet",
        _radialFocusForce(activeNode, R1, R2, showNames ? 1.4 : 1.6)
      );
      simulation.alpha(0.48).restart();
      clearTimeout(window.__bouquetCool);
      window.__bouquetCool = setTimeout(() => {
        if (simulation) simulation.alphaTarget(0);
      }, 2200);
    }
  }

  toggleButton.addEventListener("click", () => {
    const nextState = !techniqueNamesVisibility.get(techniqueId);
    grid.hidden = !nextState;
    toggleButton.classList.toggle("is-visible", nextState);
    toggleButton.setAttribute("aria-label", nextState ? "Ocultar nomes dos designers" : "Mostrar nomes dos designers");
    syncTechniquePeopleView(nextState);
  });

  toggleButton.setAttribute("aria-label", initialNamesVisible ? "Ocultar nomes dos designers" : "Mostrar nomes dos designers");
  toggleButton.classList.toggle("is-visible", Boolean(initialNamesVisible));

  syncTechniquePeopleView(techniqueNamesVisibility.get(techniqueId));
}

function exibirPerfil(designerData) {
  const personCard = document.getElementById("card-pessoa");
  document.getElementById("card-tec-area").style.display = "none";
  personCard.style.display = "block";

  const personAreas = String(designerData["Área do design"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (personAreas[0]) _applyCategoryColors(personCard, personAreas[0]);

  const name = designerData.Nome || designerData.id;
  const birth = designerData["Data de nascimento"];
  const death = designerData["Data de falecimento (se houver)"];
  const miniBio = designerData.Minibio || "";
  const location =
    (designerData.Cidade && String(designerData.Cidade).trim()) ||
    (designerData.Estado && String(designerData.Estado).trim()) ||
    (designerData["País"] && String(designerData["País"]).trim()) ||
    "";

  document.getElementById("card-p-nome").textContent = name;
  const locations = document.getElementById("card-p-local");
  locations.replaceChildren();
  const nationality = designerData.Nacionalidade === "Brasileira" ? "Brasileiro" : "Estrangeiro";
  [designerData.Nacionalidade ? nationality : "", designerData.Região || designerData.Continente, location]
    .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index)
    .forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "profile-tag";
      tag.textContent = value;
      locations.appendChild(tag);
    });
  // Links de pastas não são imagens: só URLs diretas geram uma foto no perfil.
  const photo = personCard.querySelector(".card-p-foto");
  photo.replaceChildren();
  const photoUrl = String(designerData["Foto de perfil"] || "").trim();
  photo.setAttribute("aria-label", "Foto não disponível");
  if (/^https?:\/\/[^\s]+\.(png|jpe?g|webp)(\?.*)?$/i.test(photoUrl)) {
    const img = document.createElement("img");
    img.alt = name;
    img.src = photoUrl;
    img.addEventListener("error", () => img.remove());
    photo.appendChild(img);
    photo.setAttribute("aria-label", `Foto de ${name}`);
  }

  const birthEl = document.getElementById("card-p-nasc");
  if (birth && !isNaN(birth)) {
    const birthYear = Math.floor(birth);
    birthEl.textContent = death && !isNaN(death) && String(death).trim() !== ""
      ? `${birthYear}-${Math.floor(death)}`
      : String(birthYear);
  } else {
    birthEl.textContent = "Desconhecido";
  }

  const oldGenderField = document.getElementById("card-p-genero-campo");
  if (oldGenderField) oldGenderField.remove();
  const gender = designerData["Gênero"] || "";
  if (gender) {
    const fields = document.querySelector("#card-pessoa .card-p-campos");
    const genderField = document.createElement("p");
    genderField.id = "card-p-genero-campo";
    genderField.className = "card-campo";
    genderField.textContent = gender;
    fields.appendChild(genderField);
  }

  const techniquesEl = document.getElementById("card-p-tecnicas");
  techniquesEl.innerHTML = "";

  const techniques = (designerData["Técnicas"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Marca no menu os adinkras correspondentes às técnicas desta pessoa.
  // É apenas um destaque visual; não altera os filtros ativos do grafo.
  const connectedAreas = new Set(personAreas);
  techniques.forEach((technique) => {
    const area = nodeAreaMap && nodeAreaMap.get(`TEC_${technique}`);
    if (area) connectedAreas.add(area);
  });
  _setPersonCategoryHighlights([...connectedAreas]);

  const areaGroups = {};
  techniques.forEach((technique) => {
    const area =
      (nodeAreaMap && nodeAreaMap.get(`TEC_${technique}`)) || "Outro";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(technique);
  });

  Object.entries(areaGroups).forEach(([area, values]) => {
    if (area === "Outro") return;
    values.forEach((technique) => {
    const row = document.createElement("div");
    row.className = "tec-row";
    row.style.setProperty("--technique-color", CATEGORY_COLORS[area] || "#8c8787");

    const iconPath = window.getAreaIconPath(area);
    if (iconPath) {
      const img = document.createElement("img");
      img.src = iconPath;
      img.className = "tec-area-icon";
      img.alt = area;
      row.appendChild(img);
    }

    const names = document.createElement("span");
    names.className = "tec-names";
    names.textContent = technique;
    row.appendChild(names);

    techniquesEl.appendChild(row);
    });
  });

  const bioEl = document.getElementById("card-p-bio");
  bioEl.textContent = miniBio;
  bioEl.style.display = miniBio ? "block" : "none";
  window.loadPersonWorks(designerData);

  const oldSocialLinks = document.getElementById("card-p-social");
  if (oldSocialLinks) oldSocialLinks.remove();

  const socialMap = {
    "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn",
    "twitter.com": "Twitter",
    "x.com": "Twitter",
    "behance.net": "Behance",
    "facebook.com": "Facebook",
    "youtube.com": "YouTube",
    "vimeo.com": "Vimeo",
  };

  const socialLinks = (designerData["Redes sociais"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));

  const extraLinks = (designerData["Links extras"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));

  const buttons = [...socialLinks, ...extraLinks].map((url) => {
    const match = Object.entries(socialMap).find(([domain]) =>
      url.includes(domain)
    );
    return { url, label: match ? match[1] : "Portfolio" };
  });

  const deduped = [];
  const seenLabels = new Set();
  buttons.forEach((button) => {
    if (seenLabels.has(button.label)) return;
    seenLabels.add(button.label);
    deduped.push(button);
  });

  if (deduped.length > 0) {
    const socialWrap = document.createElement("div");
    socialWrap.id = "card-p-social";
    socialWrap.className = "card-social-links";

    deduped.forEach(({ url, label }) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "card-social-link";
      link.textContent = label;
      socialWrap.appendChild(link);
    });

    bioEl.insertAdjacentElement("afterend", socialWrap);
  }
}
