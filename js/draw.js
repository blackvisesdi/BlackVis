// ============================================================
// DRAW.JS - renderizacao do grafo
// ============================================================

let _graphFirstDraw = true;

const FIXED_RADIUS_CATEGORY = 38;
const FIXED_RADIUS_TECHNIQUE = 43;
const MULT_PERSON = 0.45;
const MIN_RADIUS_PERSON = 6;
const COLLISION_PADDING = 6;
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
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  if (simulation) simulation.stop();

  const graphAreaEl = document.querySelector(".graph-area");
  const currentWidth = Math.min(graphAreaEl ? graphAreaEl.clientWidth : window.innerWidth, 2000);
  const currentHeight = Math.min(graphAreaEl ? graphAreaEl.clientHeight : window.innerHeight, 1200);

  svg.attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`);

  const allDegrees = graphData.nodes.map((node) => node.degree);
  radiusScale.domain([d3.min(allDegrees) || 1, d3.max(allDegrees) || 1]);

  graphData.nodes.forEach((node) => {
    if (node.isCategory && CATEGORY_POSITIONS[node.id]) {
      const position = CATEGORY_POSITIONS[node.id];
      node.fx = position.rx * currentWidth;
      node.fy = position.ry * currentHeight;
    } else if (node.isCategory) {
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

  simulation = d3.forceSimulation(graphData.nodes)
    .velocityDecay(0.38)
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
    .force("center", d3.forceCenter(currentWidth / 2, currentHeight / 2))
    .force("collide", d3.forceCollide().radius((node) => nodeRadius(node) + COLLISION_PADDING + (node.isTechnique ? 2 : 4)).iterations(4))
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
    .join("path")
    .attr("class", (node) => {
      const meta = localLinkMeta.get(node);
      return `link ${meta?.isPrimary ? "link-primary" : "link-secondary"}`;
    })
    .attr("fill", "none")
    .attr("stroke", (node) => localLinkMeta.get(node)?.color ?? "#999")
    .attr("stroke-opacity", 0)
    .attr("data-base-opacity", (node) => (localLinkMeta.get(node)?.isPrimary ? 0.8 : 0.5))
    .attr("stroke-width", (node) => {
      const meta = localLinkMeta.get(node);
      const mult = window.DBG_LINK_WIDTH_MULT || 1;
      if (!meta?.isPrimary) return 0.7 * mult;
      if (node.type === "technique-category-link") return 1.1 * mult;
      if (node.type === "person-technique-link") return 0.8 * mult;
      return 0.6 * mult;
    })
    .attr("stroke-linecap", "round");

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
    .join("g")
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

      // ── Técnica ativa: hover em pessoa conectada → ícone nat + nome abaixo ──
      if (activeNode?.isTechnique && !nodeData.isTechnique &&
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id) &&
          window.DBG_HOVER_NAMES !== false) {
        // Garante que o nó da pessoa está visível mesmo com fade global de nomes
        d3.select(event.currentTarget)
          .interrupt()
          .style("opacity", 1);
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(300)
          .style("opacity", 0);
        d3.select(event.currentTarget).selectAll(".node-nat-img")
          .interrupt()
          .transition().duration(300)
          .style("opacity", 1);
        const _rp = nodeRadius(nodeData);
        const _iw = Math.max(_rp * 2, 22);
        const _ih = _iw * (23 / 43);
        labelGroup.selectAll(".label")
          .filter((c) => c.id === nodeData.id)
          .attr("dy", `${_ih / 2 + 4}px`)
          .attr("dominant-baseline", "hanging")
          .style("font-size", `${window.DBG_PERSON_NAME_SIZE || 10}px`)
          .style("visibility", "visible")
          .style("pointer-events", "none")
          .text(nodeData.Nome || nodeData.id);
        return;
      }

      // ── Pessoa: swap círculo → ícone de nacionalidade + nome abaixo ──
      if (!nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        if (window.DBG_HOVER_NAMES !== false && !window.DBG_ALL_NAMES_VISIBLE) {
          d3.select(event.currentTarget).selectAll("circle")
            .interrupt()
            .transition().duration(300)
            .style("opacity", 0);
          d3.select(event.currentTarget).selectAll(".node-nat-img")
            .interrupt()
            .transition().duration(300)
            .style("opacity", 1);
          const _r = nodeRadius(nodeData);
          const _iconW = Math.max(_r * 2, 22);
          const _iconH = _iconW * (23 / 43);
          labelGroup.selectAll(".label")
            .filter((candidate) => candidate.id === nodeData.id)
            .attr("dy", `${_iconH / 2 + 4}px`)
            .attr("dominant-baseline", "hanging")
            .style("font-size", `${window.DBG_PERSON_NAME_SIZE || 10}px`)
            .style("visibility", "visible")
            .style("pointer-events", "none")
            .text(nodeData.Nome || nodeData.id);
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
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id)) {
        d3.select(event.currentTarget)
          .interrupt()
          .transition().duration(200)
          .style("opacity", 0);
        d3.select(event.currentTarget).selectAll(".node-nat-img")
          .interrupt()
          .transition().duration(200)
          .style("opacity", 0);
        return;
      }

      // ── Técnica ativa: restaura pessoa ao sair ─────────────────
      if (activeNode?.isTechnique && !nodeData.isTechnique &&
          _isPersonLinkedToTechnique(nodeData.id, activeNode.id) &&
          !window._areTechniqueNamesVisible(activeNode.id) &&
          !window.DBG_ALL_NAMES_VISIBLE) {
        const _natSel1 = window.selectedNationalities?.has(nodeData["Nacionalidade"]);
        d3.select(event.currentTarget).selectAll("circle")
          .interrupt()
          .transition().duration(300)
          .style("opacity", _natSel1 ? 0 : 0.92);
        d3.select(event.currentTarget).selectAll(".node-nat-img")
          .interrupt()
          .transition().duration(300)
          .style("opacity", _natSel1 ? 1 : 0);
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

      // ── Pessoa: restaura círculo, esconde ícone e nome ────────
      if (!nodeData.isTechnique && !(activeNode && activeNode.id === nodeData.id)) {
        if (!window.DBG_ALL_NAMES_VISIBLE) {
          const _natSel2 = window.selectedNationalities?.has(nodeData["Nacionalidade"]);
          d3.select(event.currentTarget).selectAll("circle")
            .interrupt()
            .transition().duration(300)
            .style("opacity", _natSel2 ? 0 : 0.92);
          d3.select(event.currentTarget).selectAll(".node-nat-img")
            .interrupt()
            .transition().duration(300)
            .style("opacity", _natSel2 ? 1 : 0);
          labelGroup.selectAll(".label")
            .filter((candidate) => candidate.id === nodeData.id)
            .attr("dy", `${nodeRadius(nodeData) + 6}px`)
            .attr("dominant-baseline", "hanging")
            .style("font-size", "9px")
            .style("visibility", "hidden")
            .style("pointer-events", "none")
            .text((candidate) => (candidate.Nome || candidate.id).split(" ")[0]);
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

  node.selectAll(".node-shape, .node-icon-img, .node-hitarea, .node-nat-img").remove();

  node.each(function(nodeData) {
    const r = nodeRadius(nodeData);
    const el = d3.select(this);

    if (nodeData.isCategory) {
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-hitarea")
        .attr("fill", "transparent")
        .attr("stroke", "transparent");

      const iconPath = CATEGORY_ICON_PATH[nodeData.id];
      if (iconPath) {
        el.append("image")
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
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-shape")
        .attr("fill", getNodeFillColor(nodeData))
        .attr("stroke", getNodeStrokeColor(nodeData))
        .attr("stroke-width", 1.5);

      const svgSource = window.getIconPath(nodeData.Nome);
      if (svgSource) {
        el.append("image")
          .attr("href", svgSource)
          .attr("class", "node-icon-img")
          .attr("width", r * 2)
          .attr("height", r * 2)
          .attr("x", -r)
          .attr("y", -r);
      }
      return;
    }

    const personFill = getNodeFillColor(nodeData);

    el.append("circle")
      .attr("r", r)
      .attr("class", "node-shape circle-shape person-circle")
      .attr("fill", personFill)
      .attr("stroke", "none")
      .style("opacity", 0.92);

    const natSrc = (nodeData["Nacionalidade"] || "") === "Brasileira"
      ? "./assets/icons/iconBR.svg"
      : "./assets/icons/iconEXT.svg";
    const natW = Math.max(r * 2, 22);
    const natH = natW * (23 / 43);
    el.append("image")
      .attr("href", natSrc)
      .attr("class", "node-nat-img")
      .attr("width", natW)
      .attr("height", natH)
      .attr("x", -natW / 2)
      .attr("y", -natH / 2)
      .style("opacity", 0)
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
    simulation.force("orbit", forceOrbit(graphData.links, 38, 0.9));
  } else {
    simulation.force("orbit", forceOrbit(graphData.links, 38, 0.9));
    node
      .style("opacity", 0)
      .transition()
      .duration(500)
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
    // Hover sobre o NOME → exibe ícone de nacionalidade da pessoa
    .on("mouseenter.natswap", (event, nodeData) => {
      const personEl = nodeGroup
        .selectAll(".node")
        .filter((cand) => cand.id === nodeData.id);
      personEl.interrupt().style("opacity", 1);
      personEl
        .selectAll("circle")
        .interrupt()
        .transition()
        .duration(160)
        .style("opacity", 0);
      const r = nodeRadius(nodeData);
      const iw = Math.max(r * 2 * 1.7, 30);
      const ih = iw * (23 / 43);
      personEl
        .selectAll(".node-nat-img")
        .interrupt()
        .transition()
        .duration(180)
        .attr("width", iw)
        .attr("height", ih)
        .attr("x", -iw / 2)
        .attr("y", -ih / 2)
        .style("opacity", 1);
    })
    .on("mouseleave.natswap", (event, nodeData) => {
      const personEl = nodeGroup
        .selectAll(".node")
        .filter((cand) => cand.id === nodeData.id);
      const r = nodeRadius(nodeData);
      const natSel = window.selectedNationalities?.has(nodeData["Nacionalidade"]);
      const techActive =
        activeNode &&
        activeNode.isTechnique &&
        _isPersonLinkedToTechnique(nodeData.id, activeNode.id);
      const showing =
        techActive && window._areTechniqueNamesVisible(activeNode.id);
      personEl
        .selectAll(".node-nat-img")
        .interrupt()
        .transition()
        .duration(180)
        .style("opacity", natSel ? 1 : 0);
      personEl
        .selectAll("circle")
        .interrupt()
        .transition()
        .duration(180)
        .attr("r", r)
        .style("opacity", (natSel || showing) ? 0 : 0.92);
      personEl
        .interrupt()
        .transition()
        .duration(180)
        .style("opacity", showing ? 0 : 1);
    });

  simulation.on("tick", () => {
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
        // Arco suave: sai da pessoa perpendicular, c2 na linha reta → retorna direto à técnica
        const nx = -dy / dist;
        const ny = dx / dist;
        const hook = Math.min(dist * 0.3, 30);
        const c1x = sx + nx * hook;
        const c1y = sy + ny * hook;
        const c2x = sx + dx * 0.7;
        const c2y = sy + dy * 0.7;
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

  let backgroundPointerDown = null;
  svg.on("pointerdown.background", (event) => {
    backgroundPointerDown = { x: event.clientX, y: event.clientY };
  });
  svg.on("pointerup.background", (event) => {
    if (!backgroundPointerDown) return;
    const moved = Math.hypot(event.clientX - backgroundPointerDown.x, event.clientY - backgroundPointerDown.y);
    backgroundPointerDown = null;
    if (moved > 5) return;
    if (!event.target.closest(".node")) focusNode(event, null);
  });

  simulation.alpha(0.9).restart();
}

function getNodeFillColor(node) {
  const baseHex = getBaseColorForNode(node);
  if (node.isCategory) return baseHex;
  if (!node.isTechnique) {
    // Pessoa: cor neutra #A8A8A8 com brilho 66%
    try { return d3.rgb("#A8A8A8").brighter(0.66).toString(); }
    catch (_e) { return "#A8A8A8"; }
  }
  try {
    return d3.rgb(baseHex).brighter(TECHNIQUE_BRIGHTNESS).toString();
  } catch (_error) {
    return baseHex;
  }
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
  return iconTec[name] || null;
};

window.getAreaIconPath = function(area) {
  return CATEGORY_ICON_PATH[area] || null;
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

  sel.each(function(nodeData) {
    const el = d3.select(this);
    el.text(null);

    const fullName = nodeData.Nome || nodeData.id;
    const words = fullName.split(" ");

    words.forEach((word, i) => {
      const normWord = normalizeKey(word);
      const prefix = i === 0 ? "" : " ";

      if (normWord.startsWith(searchTerm)) {
        if (prefix) el.append("tspan").attr("fill", "rgba(255,255,255,0.38)").attr("stroke", "none").text(prefix);
        el.append("tspan")
          .attr("font-weight", "700")
          .attr("fill", "#ffffff")
          .attr("stroke", "rgba(0,0,0,0.8)")
          .attr("stroke-width", "2.5px")
          .text(word.slice(0, searchLen));
        el.append("tspan")
          .attr("font-weight", "normal")
          .attr("fill", "rgba(255,255,255,0.38)")
          .attr("stroke", "none")
          .text(word.slice(searchLen));
      } else {
        el.append("tspan").attr("fill", "rgba(255,255,255,0.38)").attr("stroke", "none").text(prefix + word);
      }
    });
  })
    .attr("dy", (d) => `-${nodeRadius(d) + 8}px`)
    .attr("dominant-baseline", "auto")
    .style("font-size", `${window.DBG_PERSON_NAME_SIZE || 10}px`)
    .style("visibility", "visible");
};
