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
