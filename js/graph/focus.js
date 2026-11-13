// Controla o foco do grafo e o painel de informações.
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
  window._focusNavigationHistory ??= [];
  if (d && !options.restoreHistory && (!d.isCategory || options.areaFromFilter)) {
    if (d.isCategory) {
      window._focusNavigationHistory = [];
    } else if (activeNode && activeNode.id !== d.id) {
      window._focusNavigationHistory.push({ id: activeNode.id, isCategory: !!activeNode.isCategory });
    }
  }
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
    if (options.closeCard && !options.preserveHistory) window._focusNavigationHistory = [];
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
    updateFilteredPeopleCount(graphData.nodes);

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
  updateFilteredPeopleCount(graphData.nodes, neighbors);

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
