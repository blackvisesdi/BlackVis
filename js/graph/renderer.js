// ============================================================
// DRAW.JS - renderizacao do grafo
// ============================================================

let _graphFirstDraw = true;

const FIXED_RADIUS_CATEGORY = 38;
const FIXED_RADIUS_TECHNIQUE = 43;
const MULT_PERSON = 0.45;
const MIN_RADIUS_PERSON = 6;
const COLLISION_PADDING = 6;
// Ampliação usada ao selecionar uma pessoa ou técnica em interactions.js.
const FOCUS_ZOOM_SCALE = 2.15;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const CATEGORY_POSITIONS = {
  "Comunicação": { rx: 0.53, ry: 0.53 },
  "Produto": { rx: 0.71, ry: 0.23 },
  "Interação": { rx: 0.27, ry: 0.34 },
  "Teórico": { rx: 0.26, ry: 0.65 },
  "Serviço": { rx: 0.86, ry: 0.53 },
};

function getNodeField(node, fieldName) {
  const normalizedTarget = normalizeKey(fieldName);
  const directValue = node?.[fieldName];
  if (directValue != null && directValue !== "") return directValue;
  const matchedKey = Object.keys(node || {}).find((key) => normalizeKey(key) === normalizedTarget);
  return matchedKey ? node[matchedKey] : "";
}

function nodeRadius(node) {
  if (node.isCategory) return FIXED_RADIUS_CATEGORY * (window.DBG_AREA_RADIUS_MULT || 1);
  if (node.isTechnique) return FIXED_RADIUS_TECHNIQUE * (window.DBG_TECH_RADIUS_MULT || 1);
  if (window._currentSearchTerm) return 14; // tamanho uniforme no modo de busca
  const base = Math.max(radiusScale(node.degree || 1), 1);
  return Math.max(base * MULT_PERSON, MIN_RADIUS_PERSON);
}

function buildTechniquePersonMap(links, nodeById) {
  const techniquePeople = new Map();

  links.forEach((link) => {
    if (link.type !== "person-technique-link") return;
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    const source = nodeById.get(sourceId);
    const target = nodeById.get(targetId);
    if (!source || !target) return;

    const person = (!source.isCategory && !source.isTechnique) ? source : target;
    const technique = person === source ? target : source;
    if (!person || !technique || person.isCategory || person.isTechnique) return;

    if (!techniquePeople.has(technique.id)) techniquePeople.set(technique.id, []);
    const group = techniquePeople.get(technique.id);
    if (!group.includes(person.id)) group.push(person.id);
  });

  return techniquePeople;
}

function createSunflowerLayout(personIds, nodeById, minRadius = 48, spacing = 18) {
  return personIds.map((personId, index) => {
    const person = nodeById.get(personId);
    const personRadius = person ? nodeRadius(person) : MIN_RADIUS_PERSON;
    if (person) person.__sunflowerIndex = index;
    return {
      personId,
      angle: index * GOLDEN_ANGLE,
      radius: minRadius + Math.sqrt(index + 1) * spacing + personRadius * 0.9,
    };
  });
}

function forceOrbit(links, orbitRadius = 58, strength = 0.65, spacing = 10) {
  let nodeById = new Map();
  let orbitMap = new Map();

  function buildMap() {
    orbitMap = new Map();
    const techniquePeople = buildTechniquePersonMap(links, nodeById);

    techniquePeople.forEach((personIds, techniqueId) => {
      const technique = nodeById.get(techniqueId);
      createSunflowerLayout(personIds, nodeById, orbitRadius, spacing).forEach(({ personId, angle, radius }) => {
        orbitMap.set(personId, { technique, angle, radius });
      });
    });
  }

  function force(alpha) {
    orbitMap.forEach(({ technique, angle, radius }, personId) => {
      const person = nodeById.get(personId);
      if (!person || !technique || technique.x == null) return;

      const targetX = technique.x + Math.cos(angle) * radius;
      const targetY = technique.y + Math.sin(angle) * radius;

      person.vx += (targetX - person.x) * alpha * strength;
      person.vy += (targetY - person.y) * alpha * strength;
    });
  }

  force.initialize = function(nodes) {
    nodeById = new Map(nodes.map((node) => [node.id, node]));
    buildMap();
  };

  return force;
}


function drawForceGraph(data, centerNodes = false) {
  const motionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  if (simulation) simulation.stop();

  const graphAreaEl = document.querySelector(".graph-area");
  let currentWidth = Math.min(graphAreaEl ? graphAreaEl.clientWidth : window.innerWidth, 2000);
  let currentHeight = Math.min(graphAreaEl ? graphAreaEl.clientHeight : window.innerHeight, 1200);

  // Redimensiona a simulação existente sem perder o foco nem recriar os nós.
  window._resizeGraphViewport = function () {
    const width = Math.max(1, Math.min(graphAreaEl.clientWidth, 2000));
    const height = Math.max(1, Math.min(graphAreaEl.clientHeight, 1200));
    if (width === currentWidth && height === currentHeight) return;
    graphData.nodes.forEach((item) => {
      item.x *= width / currentWidth;
      item.y *= height / currentHeight;
      if (item.fx != null) item.fx *= width / currentWidth;
      if (item.fy != null) item.fy *= height / currentHeight;
    });
    currentWidth = width;
    currentHeight = height;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    if (activeNode) {
      const focusX = activeNode.isCategory || activeNode.isTechnique ? width / 2 : width * 0.36;
      activeNode.fx = activeNode.x = focusX;
      activeNode.fy = activeNode.y = height / 2;
      _applyBouquetForce(activeNode, null, width, height);
    } else {
      simulation.force("center", d3.forceCenter(width / 2, height / 2));
    }
    simulation.alpha(0.25).restart();
  };

  svg.attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`);

  const allDegrees = graphData.nodes.map((node) => node.degree);
  radiusScale.domain([d3.min(allDegrees) || 1, d3.max(allDegrees) || 1]);

  graphData.nodes.forEach((node) => {
    if (node.isCategory) {
      if (CATEGORY_POSITIONS[node.id]) {
        node.fx = CATEGORY_POSITIONS[node.id].rx * currentWidth;
        node.fy = CATEGORY_POSITIONS[node.id].ry * currentHeight;
        node.x = node.fx;
        node.y = node.fy;
        node.vx = 0;
        node.vy = 0;
      } else {
        node.fx = null;
        node.fy = null;
      }
    } else if (!window._currentSearchTerm) {
      // Limpa pins de buscas anteriores ao voltar ao modo normal
      node.fx = null;
      node.fy = null;
    }
  });

  if (centerNodes) {
    graphData.nodes.forEach((node) => {
      if (!node.isCategory) {
        node.x = currentWidth / 2 + (Math.random() - 0.5) * 80;
        node.y = currentHeight / 2 + (Math.random() - 0.5) * 80;
        node.vx = 0;
        node.vy = 0;
      }
    });
  }

  const isFirstDraw = _graphFirstDraw;
  const nameMeasure = document.createElement('canvas').getContext('2d');
  const nameWidths = new Map();
  function namedBounds(item) {
    // Técnicas crescem 40% no hover: essa área também precisa ficar livre.
    const scale = item.__focusZoomActive ? (item.__focusScale || FOCUS_ZOOM_SCALE) : (item.isTechnique ? 1.4 : 1);
    const radius = nodeRadius(item) * scale + 6;
    const box = { left: -radius, right: radius, top: -radius, bottom: radius };
    if (item.__labelVisible && !item.isCategory && !item.isTechnique) {
      const size = Math.min(window.DBG_PERSON_NAME_SIZE || 10, 11);
      const label = labelGroup.selectAll('.label').filter(d => d.id === item.id).node();
      const family = label ? getComputedStyle(label).fontFamily : 'serif';
      const key = `${size}:${family}:${item.Nome || item.id}`;
      if (!nameWidths.has(key)) {
        nameMeasure.font = `700 ${size}px ${family}`;
        nameWidths.set(key, nameMeasure.measureText(item.Nome || item.id).width);
      }
      const half = nameWidths.get(key) / 2 + 7;
      const side = item.__labelSide;
      if (side === "right") {
        box.right = Math.max(box.right, radius + nameWidths.get(key) + 7);
      } else if (side === "left") {
        box.left = Math.min(box.left, -radius - nameWidths.get(key) - 7);
      } else if (side === "bottom") {
        box.bottom = Math.max(box.bottom, radius + size * 1.4 + 7);
      } else {
        box.left = Math.min(box.left, -half);
        box.right = Math.max(box.right, half);
        box.bottom = Math.max(box.bottom, radius + size * 1.4 + 7);
      }
    }
    return box;
  }

  simulation = d3.forceSimulation(graphData.nodes)
    .velocityDecay(isFirstDraw ? 0.38 : 0.58)
    .alphaDecay(0.028)
    .force(
      "link",
      d3.forceLink(graphData.links)
        .id((node) => node.id)
        .distance((link) => {
          if (link.type === "technique-category-link") return 105;
          if (link.type === "person-technique-link") return 58;
          return 80;
        })
        .strength((link) => {
          if (link.type === "person-technique-link") return 0.62;
          if (link.type === "technique-category-link") return 0.52;
          return 0.5;
        })
    )
    .force("charge", d3.forceManyBody().strength((node) => (node.isCategory ? -1200 : node.isTechnique ? -480 : -180)))
    // A centralização padrão translada todo o conjunto em um único tick.
    // Após filtrar, mantém continuidade e aproxima o centro gradualmente.
    .force("center", d3.forceCenter(currentWidth / 2, currentHeight / 2).strength(isFirstDraw ? 1 : 0.025))
    .force("collide", d3.forceCollide().radius((node) => nodeRadius(node) * (node.__focusZoomActive ? (node.__focusScale || FOCUS_ZOOM_SCALE) : (node.isTechnique ? 1.4 : 1)) + COLLISION_PADDING + 4).iterations(6))
    .force("x", d3.forceX((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) return CATEGORY_POSITIONS[node.id].rx * currentWidth;
      const period = String(getNodeField(node, "Período") || getNodeField(node, "Periodo") || "");
      if (period.toLowerCase().includes("cl")) return currentWidth * 0.3;
      if (period.toLowerCase().includes("cont")) return currentWidth * 0.7;
      return currentWidth / 2;
    }).strength((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) return 0.8;
      const period = String(getNodeField(node, "Período") || getNodeField(node, "Periodo") || "");
      if (period.toLowerCase().includes("cl") || period.toLowerCase().includes("cont")) return 0.05;
      return 0.1;
    }))
    .force("y", d3.forceY((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) return CATEGORY_POSITIONS[node.id].ry * currentHeight;
      return currentHeight / 2;
    }).strength((node) => {
      if (node.isCategory && CATEGORY_POSITIONS[node.id]) return 0.8;
      return 0.1;
    }));

  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
  const nodeAreas = (node) =>
    String(getNodeField(node, "Área do design") || getNodeField(node, "Area do design") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const localLinkMeta = new Map();
  graphData.links.forEach((link) => {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    const source = nodeById.get(sourceId);
    const target = nodeById.get(targetId);

    let isPrimary = true;
    let techniqueArea = null;

    if (link.type === "person-technique-link" || link.type === "person-category-fallback-link") {
      const person = (source && !source.isCategory && !source.isTechnique) ? source : target;
      const other = person === source ? target : source;
      if (person && other) {
        const personPrimaryArea = nodeAreas(person)[0];
        if (personPrimaryArea) {
          const otherArea = other.isCategory
            ? other.id
            : (getNodeField(other, "Área do design") || getNodeField(other, "Area do design"));
          isPrimary = !otherArea || otherArea === personPrimaryArea;
        }
        if (other?.isTechnique) techniqueArea = getNodeField(other, "Área do design") || getNodeField(other, "Area do design");
      }
    }

    let color;
    if (link.type === "technique-category-link") {
      try {
        color = d3.color(target ? getBaseColorForNode(target) : "#999")?.formatHex() || "#999";
      } catch (_error) {
        color = "#999";
      }
    } else if (link.type === "person-technique-link") {
      color = "#a8a8a8";
    } else {
      color = "#dcdcdc";
    }

    localLinkMeta.set(link, { color, isPrimary });
  });

  if (typeof window._setLinkMeta === "function") window._setLinkMeta(localLinkMeta);

  window._linkOpacity = function(link) {
    const meta = localLinkMeta.get(link);
    return meta?.isPrimary ? 0.8 : 0.5;
  };

  const link = linkGroup
    .selectAll(".link")
    .data(graphData.links, (node) => {
      const sourceId = typeof node.source === "object" ? node.source.id : node.source;
      const targetId = typeof node.target === "object" ? node.target.id : node.target;
      return `${sourceId}-${targetId}`;
    })
    .join(
      enter => enter.append("path").attr("stroke-opacity", 0),
      update => update.interrupt(),
      exit => exit.interrupt().transition().duration(motionDuration).attr("stroke-opacity", 0).remove()
    )
    .attr("class", (node) => {
      const meta = localLinkMeta.get(node);
      return `link ${meta?.isPrimary ? "link-primary" : "link-secondary"}`;
    })
    .attr("fill", "none")
    .attr("stroke", (node) => localLinkMeta.get(node)?.color ?? "#999")
    .attr("data-base-opacity", (node) => (localLinkMeta.get(node)?.isPrimary ? 0.8 : 0.5))
    .attr("stroke-width", (node) => {
      const meta = localLinkMeta.get(node);
      const mult = window.DBG_LINK_WIDTH_MULT || 1;
      if (!meta?.isPrimary) return 0.7 * mult;
      if (node.type === "technique-category-link") return 1.1 * mult;
      if (node.type === "person-technique-link") return 0.8 * mult;
      return 0.6 * mult;
    })
    .attr("stroke-linecap", "round")
    // O estado geral começa sem conexões visíveis; filtros e focos aplicam
    // suas próprias opacidades depois que o grafo é desenhado.
    .attr("stroke-opacity", (linkData) =>
      window._hasActiveMenuFilter && window._linkOpacity
        ? window._linkOpacity(linkData)
        : 0
    );

  const node = nodeGroup
    .selectAll(".node")
    .data(
      [...graphData.nodes].sort((a, b) => {
        const rank = (candidate) => (candidate.isCategory ? 0 : candidate.isTechnique ? 1 : 2);
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        if (!a.isCategory && !a.isTechnique && !b.isCategory && !b.isTechnique) {
          return (a.__sunflowerIndex || 0) - (b.__sunflowerIndex || 0);
        }
        return (b.degree || 0) - (a.degree || 0);
      }),
      (nodeData) => nodeData.id
    )
    .join(
      enter => enter.append("g").style("opacity", 0),
      update => update.interrupt(),
      exit => exit.interrupt().style("pointer-events", "none")
        .transition().duration(motionDuration).style("opacity", 0).remove()
    )
    .style("pointer-events", null)
    .attr("class", "node")
    .order()
    .call(drag(simulation))
    .on("pointerdown.nodeclick", (event, nodeData) => {
      nodeData._pd = { x: event.clientX, y: event.clientY };
    })
    .on("pointerup.nodeclick", (event, nodeData) => {
      if (!nodeData._pd) return;
      const moved = Math.hypot(event.clientX - nodeData._pd.x, event.clientY - nodeData._pd.y);
      nodeData._pd = null;
      if (moved > 5) return;
      // Nós apagados ao fundo não podem abrir outro foco.
      if (window._focusInteractiveIds && !window._focusInteractiveIds.has(nodeData.id)) {
        return;
      }
      event.stopPropagation();
      if (activeNode && activeNode.id === nodeData.id) {
        focusNode(event, null);
      } else {
        focusNode(event, nodeData);
      }
    })
    .on("mouseover", (event, nodeData) => {
      // ── Área de design: mostra linhas de ligação ──────────────
      if (nodeData.isCategory) {
        if (!activeNode && !window.selectedCategoryHighlights.has(nodeData.id)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return (link.type === "technique-category-link") &&
                     (srcId === nodeData.id || tgtId === nodeData.id);
            })
            .interrupt()
            .transition().duration(180)
            .attr("stroke-opacity", (link) => window._linkOpacity(link));
        }
        return;
      }

      // ── Técnica ativa: hover em pessoa conectada → nome + destaque ──
      if (activeNode?.isTechnique && !nodeData.isTechnique &&
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id) &&
          window.DBG_HOVER_NAMES !== false) {
        nodeData.__nodeNatHover = true;
        setPersonNatHover(nodeData, true);
        d3.select(event.currentTarget)
          .interrupt()
          .style("opacity", 1);
        const _rp = nodeRadius(nodeData);
        labelGroup.selectAll(".label")
          .filter((c) => c.id === nodeData.id)
          .attr("dx", window.DBG_TECHNIQUE_NAMES_VISIBLE
            ? (nodeData.__labelSide === "left" ? `-${_rp + 7}px` : `${_rp + 7}px`)
            : "0")
          .attr("dy", window.DBG_TECHNIQUE_NAMES_VISIBLE ? "0" : `${_rp * 1.5 + 4}px`)
          .attr("text-anchor", window.DBG_TECHNIQUE_NAMES_VISIBLE
            ? (nodeData.__labelSide === "left" ? "end" : "start")
            : "middle")
          .attr("dominant-baseline", window.DBG_TECHNIQUE_NAMES_VISIBLE ? "middle" : "hanging")
          .style("font-size", `${window.DBG_PERSON_NAME_SIZE || 10}px`)
          .style("visibility", "visible")
          .style("pointer-events", "none")
          .text(nodeData.Nome || nodeData.id);
        return;
      }

      // ── Guard: ignora hover imediatamente após desfocar o mesmo nó ──
      if (!nodeData.isTechnique && !nodeData.isCategory &&
          window._lastDeselectedId === nodeData.id &&
          Date.now() - (window._lastDeselectedAt || 0) < 400) {
        window._lastDeselectedId = null;
        return;
      }

      // ── Pessoa: hover ──────────────────────────────────────────
      if (!nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        nodeData.__nodeNatHover = true;
        if (!window._currentSearchTerm) setPersonNatHover(nodeData, true);
        const _rHov = nodeRadius(nodeData);
        const _natFilterActive = window.selectedNationalities?.size > 0;

        if (_natFilterActive && !window._currentSearchTerm && !nodeData.__cardNatHover) {
          // Nat filter ativo: swap círculo → bandeirinha
          d3.select(event.currentTarget).selectAll("circle")
            .interrupt().transition().duration(150).style("opacity", 0);
          const _nw = Math.max(_rHov * 2.4, 24);
          const _nh = _nw * (23 / 43);
          d3.select(event.currentTarget).selectAll(".node-nat-img")
            .interrupt().transition().duration(150)
            .attr("width", _nw).attr("height", _nh)
            .attr("x", -_nw / 2).attr("y", -_nh / 2)
            .style("opacity", 1);
        } else if (!window._currentSearchTerm && !nodeData.__cardNatHover) {
          // Sem filtro nat: apenas cresce o círculo
          d3.select(event.currentTarget).selectAll("circle")
            .interrupt().transition().duration(150)
            .attr("r", _rHov * 1.3).style("opacity", 0.92);
        }

        if (window.DBG_HOVER_NAMES !== false && !window.DBG_ALL_NAMES_VISIBLE && !window._currentSearchTerm) {
          labelGroup.selectAll(".label")
            .filter((candidate) => candidate.id === nodeData.id)
            .attr("dy", `${_rHov + 4}px`)
            .attr("dominant-baseline", "hanging")
            .style("font-size", `${window.DBG_PERSON_NAME_SIZE || 10}px`)
            .style("visibility", "visible")
            .style("pointer-events", "none")
            .text(nodeData.Nome || nodeData.id);
        }

        // Na busca, somente a bolinha recebe destaque; o texto não muda de lugar.
        if (window._currentSearchTerm) {
          const _sr = nodeRadius(nodeData);
          d3.select(event.currentTarget).selectAll("circle")
            .interrupt()
            .transition().duration(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
            .ease(d3.easeCubicOut)
            .attr("r", _sr * 1.12)
            .style("opacity", 1);
          // O rótulo mantém o destaque das letras digitadas e sua posição.
        }

        if (!activeNode && !(window.selectedCategoryHighlights && window.selectedCategoryHighlights.size > 0)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return srcId === nodeData.id || tgtId === nodeData.id;
            })
            .interrupt()
            .transition().duration(180)
            .attr("stroke-opacity", (link) => window._linkOpacity(link));
        }
      }

      // ── Técnica: expande bolinha + mostra linhas ───────────────
      if (nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        const r = nodeRadius(nodeData);
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(400)
          .attr("r", r * 1.4);
        d3.select(event.currentTarget).selectAll(".node-icon-img")
          .interrupt()
          .transition().duration(400)
          .attr("width", r * 2.8)
          .attr("height", r * 2.8)
          .attr("x", -r * 1.4)
          .attr("y", -r * 1.4);

        if (!activeNode && !(window.selectedCategoryHighlights && window.selectedCategoryHighlights.size > 0)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return srcId === nodeData.id || tgtId === nodeData.id;
            })
            .interrupt()
            .transition().duration(200)
            .attr("stroke-opacity", (link) => window._linkOpacity(link));
        }
      }
    })
    .on("mouseout", (event, nodeData) => {
      if (!nodeData.isTechnique && !nodeData.isCategory) {
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
        nodeData.__nodeNatHover = false;
        setPersonNatHover(nodeData, false);
      }
      // ── Área de design: esconde linhas ────────────────────────
      if (nodeData.isCategory) {
        if (!activeNode && !window.selectedCategoryHighlights.has(nodeData.id)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return (link.type === "technique-category-link") &&
                     (srcId === nodeData.id || tgtId === nodeData.id);
            })
            .interrupt()
            .transition().duration(220)
            .attr("stroke-opacity", 0);
        }
        return;
      }

      // ── Técnica ativa com nomes visíveis: volta nó para opacity 0 ──
      if (activeNode?.isTechnique && !nodeData.isTechnique &&
          window._areTechniqueNamesVisible?.(activeNode.id) &&
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id) &&
          !nodeData.__cardNatHover) {
        d3.select(event.currentTarget)
          .interrupt()
          .transition().duration(200)
          .style("opacity", 0.92);
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(200)
          .attr("r", nodeRadius(nodeData))
          .style("opacity", 0.92);
        return;
      }

      // ── Técnica ativa: restaura pessoa ao sair ─────────────────
      if (activeNode?.isTechnique && !nodeData.isTechnique &&
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id) &&
          !window._areTechniqueNamesVisible(activeNode.id) &&
          !window.DBG_ALL_NAMES_VISIBLE) {
        const _natSel1 = window.selectedNationalities?.has(nodeData["Nacionalidade"]);
        const _natActive1 = window.selectedNationalities?.size > 0;
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(300)
          .attr("r", nodeRadius(nodeData))
          .style("opacity", (_natActive1 && _natSel1) ? 0 : 0.92);
        d3.select(event.currentTarget).selectAll(".node-nat-img")
          .interrupt()
          .transition().duration(300)
          .style("opacity", (_natActive1 && _natSel1) ? 1 : 0);
        labelGroup.selectAll(".label")
          .filter((c) => c.id === nodeData.id)
          .attr("dy", `${nodeRadius(nodeData) + 6}px`)
          .attr("dominant-baseline", "hanging")
          .style("font-size", "9px")
          .style("visibility", "hidden")
          .style("pointer-events", "none")
          .text((c) => (c.Nome || c.id).split(" ")[0]);
        return;
      }

      // ── Pessoa: restaura círculo / ícone nat ao sair ────────────
      if (!nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        const _isNatFiltered = window.selectedNationalities?.has(nodeData["Nacionalidade"]);
        const _natActive2 = window.selectedNationalities?.size > 0;
        if (!window.DBG_ALL_NAMES_VISIBLE) {
          // Modo de busca: restaura círculo e label compacto do nó
          if (window._currentSearchTerm) {
            const _sr2 = nodeRadius(nodeData);
            d3.select(event.currentTarget).selectAll("circle")
              .interrupt()
              .transition().duration(180)
              .attr("r", _sr2)
              .style("opacity", (_natActive2 && _isNatFiltered) ? 0 : 0.92);
            d3.select(event.currentTarget).selectAll(".node-nat-img")
              .interrupt().transition().duration(180).style("opacity", (_natActive2 && _isNatFiltered) ? 1 : 0);
            // Não recria nem desloca o nome ao encerrar o hover.
          } else {
            // Modo normal: esconde label e restaura círculo/nat
            labelGroup.selectAll(".label")
              .filter((candidate) => candidate.id === nodeData.id)
              .attr("dy", (candidate) => `${nodeRadius(candidate) + 6}px`)
              .attr("dominant-baseline", "hanging")
              .style("font-size", "9px")
              .style("visibility", "hidden")
              .style("pointer-events", "none")
              .text((candidate) => (candidate.Nome || candidate.id).split(" ")[0]);
            d3.select(event.currentTarget).selectAll("circle")
              .interrupt().transition().duration(200)
              .attr("r", nodeRadius(nodeData))
              .style("opacity", (_natActive2 && _isNatFiltered) ? 0 : 0.92);
            d3.select(event.currentTarget).selectAll(".node-nat-img")
              .interrupt().transition().duration(200).style("opacity", (_natActive2 && _isNatFiltered) ? 1 : 0);
          }
        }

        if (!activeNode && !(window.selectedCategoryHighlights && window.selectedCategoryHighlights.size > 0)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return srcId === nodeData.id || tgtId === nodeData.id;
            })
            .interrupt()
            .transition().duration(220)
            .attr("stroke-opacity", 0);
        }
      }

      // ── Técnica: restaura tamanho + esconde linhas ─────────────
      if (nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        const r = nodeRadius(nodeData);
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(400)
          .attr("r", r);
        d3.select(event.currentTarget).selectAll(".node-icon-img")
          .interrupt()
          .transition().duration(400)
          .attr("width", r * 2)
          .attr("height", r * 2)
          .attr("x", -r)
          .attr("y", -r);

        if (!activeNode && !(window.selectedCategoryHighlights && window.selectedCategoryHighlights.size > 0)) {
          linkGroup.selectAll(".link")
            .filter((link) => {
              const srcId = _linkNodeId(link.source);
              const tgtId = _linkNodeId(link.target);
              return srcId === nodeData.id || tgtId === nodeData.id;
            })
            .interrupt()
            .transition().duration(220)
            .attr("stroke-opacity", 0);
        }
      }
    });

  // Reutiliza as formas e imagens: não descarrega ícones a cada filtro.

  node.each(function(nodeData) {
    const r = nodeRadius(nodeData);
    const el = d3.select(this);

    if (nodeData.isCategory) {
      el.selectAll("circle.node-hitarea").data([nodeData]).join("circle").interrupt()
        .attr("r", r)
        .attr("class", "node-hitarea")
        .attr("fill", "transparent")
        .attr("stroke", "transparent");

      const iconPath = CATEGORY_ICON_PATH[nodeData.id];
      if (iconPath) {
        el.selectAll("image.node-icon-img").data([nodeData]).join("image").interrupt()
          .attr("href", iconPath)
          .attr("class", "node-icon-img")
          .attr("width", r * 2)
          .attr("height", r * 2)
          .attr("x", -r)
          .attr("y", -r);
      }
      return;
    }

    if (nodeData.isTechnique) {
      const svgSource = window.getIconPath(nodeData.Nome);
      const shape = el.selectAll("circle.node-shape").data([nodeData]).join("circle").interrupt()
        .attr("r", r)
        .attr("class", "node-shape")
        .attr("fill", svgSource && !nodeData.__iconReady ? "transparent" : getNodeFillColor(nodeData))
        .attr("stroke", svgSource && !nodeData.__iconReady ? "transparent" : getNodeStrokeColor(nodeData))
        .attr("stroke-width", 1.5);

      el.style("visibility", svgSource && !nodeData.__iconReady ? "hidden" : "visible");

      if (svgSource) {
        const icon = el.selectAll("image.node-icon-img").data([nodeData]).join("image").interrupt()
          .attr("href", svgSource)
          .attr("class", "node-icon-img")
          .attr("width", r * 2)
          .attr("height", r * 2)
          .attr("x", -r)
          .attr("y", -r)
          .style("opacity", nodeData.__iconReady ? 1 : 0)
          .on("load.technique-icon", function() {
            nodeData.__iconReady = true;
            shape.attr("fill", getNodeFillColor(nodeData)).attr("stroke", getNodeStrokeColor(nodeData));
            el.style("visibility", "visible");
            d3.select(this).style("opacity", 1);
          })
          .on("error.technique-icon", function() {
            const localSource = iconTec[nodeData.Nome];
            if (localSource && this.getAttribute("href") !== localSource) {
              this.setAttribute("href", localSource);
            } else {
              nodeData.__iconReady = true;
              shape.attr("fill", getNodeFillColor(nodeData)).attr("stroke", getNodeStrokeColor(nodeData));
              el.style("visibility", "visible");
            }
          });
      }
      return;
    }

    const personFill = getNodeFillColor(nodeData);

    el.selectAll("circle.person-circle").data([nodeData]).join("circle").interrupt()
      .attr("r", r)
      .attr("class", "node-shape circle-shape person-circle")
      .attr("fill", personFill)
      .attr("stroke", "none")
      .style("opacity", function() { return this.style.opacity || "0.92"; });

    const natSrc = (nodeData["Nacionalidade"] || "") === "Brasileira"
      ? "./assets/icons/iconBR.svg"
      : "./assets/icons/iconEXT.svg";
    const natW = Math.max(r * 2, 22);
    const natH = natW * (23 / 43);
    el.selectAll("image.node-nat-img").data([nodeData]).join("image").interrupt()
      .attr("href", natSrc)
      .attr("class", "node-nat-img")
      .attr("width", natW)
      .attr("height", natH)
      .attr("x", -natW / 2)
      .attr("y", -natH / 2)
      .style("opacity", function() { return this.style.opacity || "0"; })
      .style("pointer-events", "none");
  });

  if (isFirstDraw) {
    _graphFirstDraw = false;
    node.style("opacity", 0)
      .transition()
      .duration(800)
      .delay((_, index) => Math.min(index * 10, 500))
      .ease(d3.easeCubicOut)
      .style("opacity", 1);

    node.each(function(nodeData, index) {
      const el = d3.select(this);
      const delay = Math.min(index * 10, 500);
      const r = nodeRadius(nodeData);
      el.selectAll("circle.node-shape, circle.node-hitarea, circle.person-circle")
        .attr("r", 0)
        .transition()
        .duration(700)
        .delay(delay)
        .ease(d3.easeCubicOut)
        .attr("r", r);
      el.selectAll(".node-icon-img")
        .attr("width", 0)
        .attr("height", 0)
        .attr("x", 0)
        .attr("y", 0)
        .transition()
        .duration(700)
        .delay(delay)
        .ease(d3.easeCubicOut)
        .attr("width", r * 2)
        .attr("height", r * 2)
        .attr("x", -r)
        .attr("y", -r);
    });

    // Orbit force desde o início para manter pessoas em volta de sua técnica
    simulation.force("orbit", forceOrbit(graphData.links, 68, 0.9, 20));
  } else {
    simulation.force("orbit", forceOrbit(graphData.links, 68, 0.9, 20));
    node
      .interrupt()
      .transition()
      .duration(motionDuration)
      .ease(d3.easeSinOut)
      .style("opacity", 1);
  }

  const labels = labelGroup
    .selectAll(".label")
    .data(graphData.nodes.filter((nodeData) => !nodeData.isCategory && !nodeData.isTechnique), (nodeData) => nodeData.id)
    .join("text")
    .attr("class", "label label-person")
    .text((nodeData) => (nodeData.Nome || nodeData.id).split(" ")[0])
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "hanging")
    .attr("dy", (nodeData) => `${nodeRadius(nodeData) + 6}px`)
    .style("font-size", "9px")
    .style("fill", "rgba(255,255,255,0.9)")
    .style("visibility", "hidden")
    .style("pointer-events", "none")
    .style("stroke", "rgba(0,0,0,0.72)")
    .style("stroke-width", "2.5px")
    .style("paint-order", "stroke");

  const setPersonNatHover = (nodeData, hovered) => {
    nodeData.__cardNatHover = hovered;
    const activeHover = Boolean(
      nodeData.__cardNatHover || nodeData.__nodeNatHover || nodeData.__nodeNatFocus
    );
    const personEl = nodeGroup.selectAll(".node").filter((cand) => cand.id === nodeData.id);
    const r = nodeRadius(nodeData);
    if (activeHover) {
      personEl.interrupt().style("opacity", 1);
      personEl.selectAll("circle.person-circle")
        .interrupt()
        .transition().duration(160)
        .attr("r", r * 1.12)
        .style("opacity", 0);
      personEl.selectAll(".node-nat-img")
        .interrupt()
        .transition().duration(160)
        .attr("width", Math.max(r * 2, 22) * 1.12)
        .attr("height", Math.max(r * 2, 22) * 1.12 * (23 / 43))
        .attr("x", -Math.max(r * 2, 22) * 1.12 / 2)
        .attr("y", -Math.max(r * 2, 22) * 1.12 * (23 / 43) / 2)
        .style("opacity", 1);
      return;
    }
    personEl.selectAll("circle.person-circle")
      .interrupt()
      .transition().duration(180)
      .attr("r", r)
      .style("opacity", 0.92);
    personEl.selectAll(".node-nat-img")
      .interrupt()
      .transition().duration(180)
      .style("opacity", 0);
  };
  window._setPersonNatHover = setPersonNatHover;
  window._setPersonNatFocus = (nodeData, focused) => {
    nodeData.__nodeNatFocus = Boolean(focused);
    setPersonNatHover(nodeData, false);
  };

  labels
    .on("pointerdown.labelclick", (event, nodeData) => {
      nodeData._lpd = { x: event.clientX, y: event.clientY };
    })
    .on("pointerup.labelclick", (event, nodeData) => {
      if (!nodeData._lpd) return;
      const moved = Math.hypot(
        event.clientX - nodeData._lpd.x,
        event.clientY - nodeData._lpd.y
      );
      nodeData._lpd = null;
      if (moved > 5) return;
      event.stopPropagation();
      focusNode(event, nodeData);
    })
    // Hover sobre o nome: troca temporariamente a bolinha pelo ícone de nacionalidade.
    .on("mouseenter.natswap", (event, nodeData) => {
      setPersonNatHover(nodeData, true);
    })
    .on("mouseleave.natswap", (event, nodeData) => {
      setPersonNatHover(nodeData, false);
    });

  // Colisão por último: atração e órbitas não anulam sua correção no mesmo tick.
  simulation.force("name-collision", forceNameCollision(namedBounds, () => ({ width: currentWidth, height: currentHeight, retention: 1 - simulation.velocityDecay() })));
  simulation.on("tick", () => {
    // Limita antes de desenhar as ligações, incluindo o raio ampliado do foco.
    graphData.nodes.forEach((item) => {
      if (window.DBG_ALL_NAMES_VISIBLE && !window._currentSearchTerm) {
        const box = namedBounds(item);
        item.x = Math.max(-box.left, Math.min(currentWidth - box.right, item.x));
        item.y = Math.max(-box.top, Math.min(currentHeight - box.bottom, item.y));
        return;
      }
      const radius = nodeRadius(item) * (item.__focusZoomActive ? (item.__focusScale || FOCUS_ZOOM_SCALE) : 1) + 8;
      const rx = Math.min(radius, currentWidth / 2);
      const ry = Math.min(radius, currentHeight / 2);
      item.x = Math.max(rx, Math.min(currentWidth - rx, item.x));
      item.y = Math.max(ry, Math.min(currentHeight - ry, item.y));
    });
    link.each(function(linkData) {
      const dx = linkData.target.x - linkData.source.x;
      const dy = linkData.target.y - linkData.source.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sourceRadius = nodeRadius(linkData.source);
      const targetRadius = nodeRadius(linkData.target);

      const sx = linkData.source.x + (dx / dist) * sourceRadius;
      const sy = linkData.source.y + (dy / dist) * sourceRadius;
      const tx = linkData.target.x - (dx / dist) * targetRadius;
      const ty = linkData.target.y - (dy / dist) * targetRadius;

      const meta = localLinkMeta.get(linkData);
      const isSecondary = meta && !meta.isPrimary;

      let d;
      if (isSecondary) {
        const nx = -dy / dist;
        const ny = dx / dist;
        const isActive = activeNode != null;
        const hook = isActive ? Math.min(dist * 0.55, 80) : Math.min(dist * 0.38, 45);
        const c1x = sx + nx * hook;
        const c1y = sy + ny * hook;
        const c2x = sx + dx * 0.65;
        const c2y = sy + dy * 0.65;
        d = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
      } else {
        d = `M${sx},${sy} L${tx},${ty}`;
      }

      d3.select(this).attr("d", d);
    });

    node
      .each(function(nodeData) {
        const r = nodeRadius(nodeData);
        nodeData.x = Math.max(r, Math.min(currentWidth - r, nodeData.x));
        nodeData.y = Math.max(r, Math.min(currentHeight - r, nodeData.y));
      })
      .attr("transform", (nodeData) => `translate(${nodeData.x},${nodeData.y})`);

    labels.attr("transform", (nodeData) => `translate(${nodeData.x},${nodeData.y})`);
  });

  // A saída da visualização fica restrita ao botão de retorno. Clicar no
  // espaço vazio não desfoca mais o card nem altera o estado dos filtros.
  svg.on("pointerdown.background pointerup.background pointercancel.background", null);

  simulation.alpha(isFirstDraw ? 0.9 : 0.1).restart();
}

function getNodeFillColor(node) {
  const baseHex = getBaseColorForNode(node);
  if (node.isCategory) return baseHex;
  if (!node.isTechnique) {
    // Em modo de busca: usa nível 1 (cor mais saturada da área)
    if (window._currentSearchTerm) {
      const rawArea = node["Área do design"] || inferredPersonArea.get(node.id) || nodeAreaMap.get(node.id);
      const areaName = String(rawArea || "").split(",")[0].trim();
      const paletteName = CATEGORY_PALETTE_MAP[areaName];
      return (paletteName && SATURATION_PALETTE[paletteName]) ? SATURATION_PALETTE[paletteName][1] : baseHex;
    }
    // Modo normal: cor neutra #A8A8A8 com brilho 66%
    try { return d3.rgb("#A8A8A8").brighter(0.66).toString(); }
    catch (_e) { return "#A8A8A8"; }
  }
  const rawArea = node["Área do design"] || inferredPersonArea.get(node.id) || nodeAreaMap.get(node.id);
  const areaName = String(rawArea || "").split(",")[0].trim();
  return CATEGORY_COLORS[areaName] || baseHex;
}

function getNodeStrokeColor(node) {
  const baseHex = getBaseColorForNode(node);
  try {
    return d3.rgb(baseHex).darker(1).toString();
  } catch (_error) {
    return "#333";
  }
}

const iconTec = {
  "Design gráfico": "./assets/icons/comunica/designGrafico.svg",
  "Ilustração": "./assets/icons/comunica/ilustracao.svg",
  "Tipografia": "./assets/icons/comunica/tipografia.svg",
  "Direção de arte": "./assets/icons/comunica/DirecaoArte.svg",
  "Produção audiovisual": "./assets/icons/comunica/producaoAudiovisual.svg",
  "Fotografia": "./assets/icons/comunica/fotografia.svg",
  "Videografismo": "./assets/icons/comunica/videografismo.svg",
  "Design editorial": "./assets/icons/comunica/designEditorial.svg",
  "Identidade visual": "./assets/icons/comunica/identidadeVisual.svg",
  "Design de superfície": "./assets/icons/comunica/designSuperficie.svg",
  "Arte urbana": "./assets/icons/comunica/arteUrbana.svg",
  "Design de objetos industriais": "./assets/icons/produ/designObjetos.svg",
  "Design de mobiliário": "./assets/icons/produ/designMobiliario.svg",
  "Moda e têxtil": "./assets/icons/produ/modaTextil.svg",
  "Escultura": "./assets/icons/produ/escultura.svg",
  "Prática 3D": "./assets/icons/produ/praticas3d.svg",
  "Design de interiores": "./assets/icons/produ/designInteriores.svg",
  "Design de adereços": "./assets/icons/produ/designAderecos.svg",
  "Embalagem": "./assets/icons/produ/embalagem.svg",
  "UI Design de interface": "./assets/icons/intera/desingInterface.svg",
  "Programação": "./assets/icons/intera/programacao.svg",
  "Instalações interativas": "./assets/icons/intera/instalacoesInterativas.svg",
  "Arte digital": "./assets/icons/intera/arteDigital.svg",
  "UX Experiência do usuário": "./assets/icons/intera/experienciaUsuario.svg",
  "Realidades mistas": "./assets/icons/intera/realidadesMistas.svg",
  "CX Experiência do Cliente": "./assets/icons/servi/CX (Experiência do Cliente) .svg",
  "Design para impacto social": "./assets/icons/servi/Design para Impacto Social.svg",
  "Branding": "./assets/icons/servi/Branding.svg",
  "Curadoria": "./assets/icons/servi/Curadoria.svg",
  "Economia criativa": "./assets/icons/servi/Economia criativa.svg",
  "Educação": "./assets/icons/teori/educacacao.svg",
  "Escrita e publicação": "./assets/icons/teori/escritaPublicacao.svg",
  "Ativismo e justiça social": "./assets/icons/teori/AtivismoJustica.svg",
  "Relações étnico-raciais": "./assets/icons/teori/relacoesEtinico.svg",
  "Design e gênero": "./assets/icons/teori/designGenero.svg",
};

window.getIconPath = function(name) {
  const apiBase = window.BLACKVIS_API_RUNTIME_BASE || window.BLACKVIS_API_URL;
  if (apiBase) {
    return `${apiBase.replace(/\/$/, '')}/api/techniques/icon?name=${encodeURIComponent(name)}`;
  }
  return iconTec[name] || null;
};

window.getAreaIconPath = function(area) {
  return CATEGORY_ICON_PATH[area] || null;
};

window._setupSearchLayout = function(matched) {
  if (!simulation || !matched || matched.length === 0) return;
  const vb = svg.attr("viewBox")?.split(" ") || [];
  const w = +vb[2] || 950;
  const h = +vb[3] || 500;

  // Agrupa por área e ordena alfabeticamente dentro de cada grupo
  const AREA_ORDER = ["Comunicação", "Interação", "Produto", "Serviço", "Teórico"];
  const groups = {};
  matched.forEach((node) => {
    const area = String(node["Área do design"] || "").split(",")[0].trim() || "Outro";
    if (!groups[area]) groups[area] = [];
    groups[area].push(node);
  });
  const sortedAreas = Object.keys(groups).sort((a, b) => {
    const ia = AREA_ORDER.indexOf(a), ib = AREA_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "pt");
  });
  sortedAreas.forEach((area) => {
    groups[area].sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"));
  });

  const SEARCH_R   = 14;
  // Reserva a largura do nome completo, inclusive no hover em negrito.
  // O antigo intervalo de 72px só comportava nomes abreviados.
  const measure = document.createElement("canvas").getContext("2d");
  const sampleLabel = labelGroup.select(".label").node();
  const family = sampleLabel ? getComputedStyle(sampleLabel).fontFamily : "serif";
  measure.font = `700 11px ${family}`;
  const PAD_X = Math.max(72, ...matched.map((node) =>
    Math.ceil(measure.measureText(node.Nome || node.id).width) + 24
  ));
  const LABEL_H    = 20;
  const BAND_H     = SEARCH_R * 2 + LABEL_H + 16; // fileira reta + espaço para label abaixo
  const GROUP_GAP  = 32; // espaço extra entre grupos de área

  const maxPerBand = Math.max(1, Math.floor(w * 0.90 / PAD_X));

  // Calcula altura total para centralizar
  let totalH = 0;
  sortedAreas.forEach((area, ai) => {
    const numBands = Math.ceil(groups[area].length / maxPerBand);
    totalH += numBands * BAND_H;
    if (ai < sortedAreas.length - 1) totalH += GROUP_GAP;
  });

  let curY = (h - totalH) / 2 + BAND_H / 2;

  sortedAreas.forEach((area, ai) => {
    const persons = groups[area];
    const numBands = Math.ceil(persons.length / maxPerBand);

    persons.forEach((node, i) => {
      const band        = Math.floor(i / maxPerBand);
      const posInBand   = i % maxPerBand;
      const countInBand = Math.min(maxPerBand, persons.length - band * maxPerBand);

      const rowW   = countInBand * PAD_X;
      const startX = (w - rowW) / 2 + PAD_X / 2;

      node.fx = startX + posInBand * PAD_X;
      node.fy = curY + band * BAND_H; // fileira reta, sem zigzag
      node.x  = node.fx;
      node.y  = node.fy;
      node.vx = 0;
      node.vy = 0;
    });

    curY += numBands * BAND_H + (ai < sortedAreas.length - 1 ? GROUP_GAP : 0);
  });

  simulation.force("x", null);
  simulation.force("y", null);
  simulation.force("center", null);
  simulation.force("orbit", null);
  simulation.force("charge", d3.forceManyBody().strength(-8));
  simulation.alpha(0.1).restart();
};

window._applyNatVisuals = function() {
  const selected = window.selectedNationalities;
  nodeGroup.selectAll(".node").each(function(nodeData) {
    if (nodeData.isCategory || nodeData.isTechnique) return;
    const el = d3.select(this);
    const isHighlighted = selected && selected.size > 0 && selected.has(nodeData["Nacionalidade"]);
    if (isHighlighted) {
      const r = nodeRadius(nodeData);
      const iw = Math.max(r * 2, 22);
      const ih = iw * (23 / 43);
      el.selectAll("circle")
        .interrupt()
        .transition().duration(200)
        .style("opacity", 0);
      el.selectAll(".node-nat-img")
        .interrupt()
        .attr("width", iw).attr("height", ih)
        .attr("x", -iw / 2).attr("y", -ih / 2)
        .transition().duration(200)
        .style("opacity", 1);
    } else {
      el.selectAll("circle")
        .interrupt()
        .transition().duration(200)
        .style("opacity", 0.92);
      el.selectAll(".node-nat-img")
        .interrupt()
        .transition().duration(200)
        .style("opacity", 0);
    }
  });
};

window._applySearchLabels = function(searchTerm) {
  const sel = labelGroup.selectAll(".label");
  if (!searchTerm) {
    sel.each(function(d) {
      const el = d3.select(this);
      el.text(null);
      el.text((d.Nome || d.id).split(" ")[0]);
    })
      .attr("dy", (d) => `${nodeRadius(d) + 6}px`)
      .attr("dominant-baseline", "hanging")
      .style("font-size", "9px")
      .style("visibility", "hidden");
    return;
  }

  const searchLen = searchTerm.length;

  // A busca seleciona pessoas; o rótulo sempre preserva o nome completo.
  sel.each(function(nodeData) {
    const el = d3.select(this);
    el.text(null);

    const fullName = nodeData.Nome || nodeData.id;
    const words = fullName.split(" ");
    const matchIdx = words.findIndex((w) => normalizeKey(w).startsWith(searchTerm));
    const matchWord = fullName;
    const matchStart = matchIdx >= 0 ? words.slice(0, matchIdx).join(" ").length + (matchIdx > 0 ? 1 : 0) : 0;

    if (matchIdx >= 0) {
      el.append("tspan")
        .attr("font-weight", "normal")
        .attr("fill", "rgba(255,255,255,0.75)")
        .attr("stroke", "none")
        .text(fullName.slice(0, matchStart));
      el.append("tspan")
        .attr("font-weight", "700")
        .attr("fill", "#ffffff")
        .attr("stroke", "rgba(0,0,0,0.8)")
        .attr("stroke-width", "2.5px")
        .text(matchWord.slice(matchStart, matchStart + searchLen));
      el.append("tspan")
        .attr("font-weight", "normal")
        .attr("fill", "rgba(255,255,255,0.75)")
        .attr("stroke", "none")
        .text(matchWord.slice(matchStart + searchLen));
    } else {
      el.append("tspan")
        .attr("fill", "rgba(255,255,255,0.75)")
        .attr("stroke", "none")
        .text(matchWord);
    }
  })
    .attr("dy", (d) => `${nodeRadius(d) + 4}px`)
    .attr("dominant-baseline", "hanging")
    .style("font-size", "11px")
    .style("visibility", "visible");
};
