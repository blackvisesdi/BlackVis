// ============================================================
// DRAW.JS — Renderização do Grafo de Forças
// ============================================================

// ===== SIZING CONSTANTS =====

const FIXED_RADIUS_CATEGORY  = 38;
const FIXED_RADIUS_TECHNIQUE = 24;
const MULT_PERSON    = 0.20;
const MIN_RADIUS_PERSON    = 3;
const COLLISION_PADDING = 2;

// Posições fixas iniciais das categorias — baseadas na referência visual
const CATEGORY_POSITIONS = {
  "Comunicação": { rx: 0.53, ry: 0.53 },
  "Produto":     { rx: 0.71, ry: 0.23 },
  "Interação":   { rx: 0.27, ry: 0.34 },
  "Teórico":     { rx: 0.26, ry: 0.65 },
  "Serviço":     { rx: 0.86, ry: 0.53 },
};

// ===== NODE RADIUS =====

function nodeRadius(d) {
  if (d.isCategory)  return FIXED_RADIUS_CATEGORY;
  if (d.isTechnique) return FIXED_RADIUS_TECHNIQUE;
  const base = Math.max(radiusScale(d.degree || 1), 1);
  return Math.max(base * MULT_PERSON, MIN_RADIUS_PERSON);
}

// ===== CUSTOM ORBIT FORCE =====
// Distribui pessoas em órbita uniforme ao redor de suas técnicas

function forceOrbit(links, orbitRadius = 58, strength = 0.65) {
  let nodeById = new Map();
  // person.id → { tech, angle, totalInOrbit, indexInOrbit }
  let orbitMap = new Map();

  function buildMap() {
    orbitMap = new Map();
    // Agrupa pessoas por técnica âncora
    const techPersons = new Map(); // techId → [personId, ...]
    links.forEach((l) => {
      if (l.type !== "person-technique-link") return;
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      const src = nodeById.get(srcId);
      const tgt = nodeById.get(tgtId);
      if (!src || !tgt) return;
      const person = (!src.isCategory && !src.isTechnique) ? src : tgt;
      const tech   = person === src ? tgt : src;
      if (!person || !tech || person.isCategory || person.isTechnique) return;
      // Primeira técnica como âncora
      if (!orbitMap.has(person.id)) {
        if (!techPersons.has(tech.id)) techPersons.set(tech.id, []);
        techPersons.get(tech.id).push(person.id);
        orbitMap.set(person.id, { tech, angle: 0 });
      }
    });

    // Distribui ângulos uniformemente por técnica
    techPersons.forEach((personIds, _techId) => {
      const n = personIds.length;
      personIds.forEach((pid, i) => {
        const entry = orbitMap.get(pid);
        if (entry) entry.angle = (2 * Math.PI * i) / n;
      });
    });
  }

  function force(alpha) {
    orbitMap.forEach(({ tech, angle }, personId) => {
      const person = nodeById.get(personId);
      if (!person || tech.x == null) return;

      // Posição alvo na órbita
      const tx = tech.x + Math.cos(angle) * orbitRadius;
      const ty = tech.y + Math.sin(angle) * orbitRadius;

      person.vx += (tx - person.x) * alpha * strength;
      person.vy += (ty - person.y) * alpha * strength;
    });
  }

  force.initialize = function(nodes) {
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    buildMap();
  };

  return force;
}

// ===== FORCE GRAPH =====

function drawForceGraph(data, centerNodes = false) {
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  if (simulation) simulation.stop();

  const graphAreaEl = document.querySelector(".graph-area");
  const currentWidth  = Math.min(graphAreaEl ? graphAreaEl.clientWidth  : window.innerWidth,  2000);
  const currentHeight = Math.min(graphAreaEl ? graphAreaEl.clientHeight : window.innerHeight, 1200);

  svg.attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`);

  const allDegrees = graphData.nodes.map((d) => d.degree);
  radiusScale.domain([d3.min(allDegrees) || 1, d3.max(allDegrees) || 1]);

  // Posições fixas para categorias
  graphData.nodes.forEach((d) => {
    if (d.isCategory && CATEGORY_POSITIONS[d.id]) {
      const pos = CATEGORY_POSITIONS[d.id];
      d.fx = pos.rx * currentWidth;
      d.fy = pos.ry * currentHeight;
    } else if (d.isCategory) {
      d.fx = null;
      d.fy = null;
    }
  });

  if (centerNodes) {
    graphData.nodes.forEach((d) => {
      if (!d.isCategory) {
        d.x  = currentWidth  / 2 + (Math.random() - 0.5) * 80;
        d.y  = currentHeight / 2 + (Math.random() - 0.5) * 80;
        d.vx = 0;
        d.vy = 0;
      }
    });
  }

  simulation = d3
    .forceSimulation(graphData.nodes)
    .force("link",
      d3.forceLink(graphData.links)
        .id((d) => d.id)
        .distance((l) => {
          if (l.type === "technique-category-link") return 130;
          if (l.type === "person-technique-link")   return 70;
          return 100;
        })
        .strength((l) => {
          if (l.type === "person-technique-link") return 0.9;
          if (l.type === "technique-category-link") return 0.5;
          return 0.4;
        })
    )
    .force("orbit",   forceOrbit(graphData.links, 55, 0.7))
    .force("charge",  d3.forceManyBody().strength(-600))
    .force("center",  d3.forceCenter(currentWidth / 2, currentHeight / 2))
    .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + COLLISION_PADDING))
    .force("x", d3.forceX((d) => {
      if (d.isCategory && CATEGORY_POSITIONS[d.id]) return CATEGORY_POSITIONS[d.id].rx * currentWidth;
      const period = d["Período"] || "";
      if (period.toLowerCase().includes("cl")) return currentWidth * 0.30;
      if (period.toLowerCase().includes("cont")) return currentWidth * 0.70;
      return currentWidth / 2;
    }).strength((d) => {
      if (d.isCategory && CATEGORY_POSITIONS[d.id]) return 0.8;
      const period = d["Período"] || "";
      if (period.toLowerCase().includes("cl") || period.toLowerCase().includes("cont")) return 0.05;
      return 0.1;
    }))
    .force("y", d3.forceY((d) => {
      if (d.isCategory && CATEGORY_POSITIONS[d.id]) return CATEGORY_POSITIONS[d.id].ry * currentHeight;
      return currentHeight / 2;
    }).strength((d) => {
      if (d.isCategory && CATEGORY_POSITIONS[d.id]) return 0.8;
      return 0.1;
    }));

  // Pré-computa metadados dos links
  const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
  const nodeAreas = (n) =>
    String(n?.["Área do design"] || "").split(",").map((s) => s.trim()).filter(Boolean);

  const linkMeta = new Map();
  graphData.links.forEach((l) => {
    const srcId = typeof l.source === "object" ? l.source.id : l.source;
    const tgtId = typeof l.target === "object" ? l.target.id : l.target;
    const src = nodeById.get(srcId);
    const tgt = nodeById.get(tgtId);

    // Links de pessoa → branco semitransparente; técnica→categoria → cor da categoria
    let color;
    if (l.type === "technique-category-link") {
      color = tgt ? getBaseColorForNode(tgt) : "#999";
    } else {
      color = "rgba(220,220,220,0.5)";
    }

    let isPrimary = true;
    if (l.type === "person-technique-link" || l.type === "person-category-fallback-link") {
      const person = (src && !src.isCategory && !src.isTechnique) ? src : tgt;
      const other  = person === src ? tgt : src;
      if (person && other) {
        const areas = nodeAreas(person);
        if (areas.length > 1) {
          const otherArea = other.isCategory ? other.id : nodeAreas(other)[0];
          isPrimary = otherArea === areas[0];
        }
      }
    }

    linkMeta.set(l, { color, isPrimary });
  });

  if (typeof window._setLinkMeta === "function") window._setLinkMeta(linkMeta);

  // Links — coloridos (técnica→categoria) aparecem por padrão; pessoa→técnica invisíveis
  const link = linkGroup
    .selectAll(".link")
    .data(graphData.links, (d) => {
      const s = typeof d.source === "object" ? d.source.id : d.source;
      const t = typeof d.target === "object" ? d.target.id : d.target;
      return s + "-" + t;
    })
    .join("line")
    .attr("class", "link")
    .attr("stroke",         (d) => linkMeta.get(d)?.color   ?? "#999")
    .attr("stroke-opacity", (d) => d.type === "technique-category-link" ? 0.45 : 0)
    .attr("stroke-width",   (d) => {
      const m = linkMeta.get(d);
      if (d.type === "technique-category-link") return m?.isPrimary ? 0.8 : 0.4;
      return 0.6;
    });

  // Nós
  const node = nodeGroup
    .selectAll(".node")
    .data(
      [...graphData.nodes].sort((a, b) => {
        const rank = (n) => (n.isCategory ? 0 : n.isTechnique ? 1 : 2);
        const rankDiff = rank(a) - rank(b);
        return rankDiff !== 0 ? rankDiff : (b.degree || 0) - (a.degree || 0);
      }),
      (d) => d.id
    )
    .join("g")
    .attr("class", "node")
    .order()
    .call(drag(simulation))
    .on("pointerdown.nodeclick", (event, d) => {
      d._pd = { x: event.clientX, y: event.clientY };
    })
    .on("pointerup.nodeclick", (event, d) => {
      if (!d._pd) return;
      const moved = Math.hypot(event.clientX - d._pd.x, event.clientY - d._pd.y);
      d._pd = null;
      if (moved > 5) return;
      event.stopPropagation();
      if (activeNode && activeNode.id === d.id) {
        focusNode(event, null);
      } else {
        focusNode(event, d);
      }
    })
    .on("mouseover", (event, d) => {
      let tip = document.getElementById("node-tooltip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "node-tooltip";
        tip.style.cssText = "position:fixed;display:none;background:rgba(0,0,0,0.85);color:#e8dcc8;padding:5px 10px;border-radius:4px;font-size:12px;pointer-events:none;z-index:200;white-space:nowrap;";
        document.body.appendChild(tip);
      }
      tip.textContent = d.Nome || d.id;
      tip.style.display = "block";
      tip.style.left = (event.clientX + 14) + "px";
      tip.style.top  = (event.clientY - 10) + "px";

      if (!activeNode) {
        linkGroup.selectAll(".link")
          .transition().duration(180).ease(d3.easeCubicOut)
          .attr("stroke-opacity", (l) => {
            const s = typeof l.source === "object" ? l.source.id : l.source;
            const t = typeof l.target === "object" ? l.target.id : l.target;
            if (s === d.id || t === d.id) {
              return l.type === "technique-category-link" ? 0.92 : 0.6;
            }
            return 0;
          });
      }

      if (d.isTechnique && !(activeNode && activeNode.id === d.id)) {
        const r = nodeRadius(d);
        d3.select(event.currentTarget).selectAll("circle")
          .transition().duration(250).attr("r", r * 2.2);
        d3.select(event.currentTarget).selectAll(".node-icon-img")
          .transition().duration(250)
          .attr("width", r * 4.4).attr("height", r * 4.4)
          .attr("x", -r * 2.2).attr("y", -r * 2.2);
      }
    })
    .on("mousemove", (event) => {
      const tip = document.getElementById("node-tooltip");
      if (tip) {
        tip.style.left = (event.clientX + 14) + "px";
        tip.style.top  = (event.clientY - 10) + "px";
      }
    })
    .on("mouseout", (event, d) => {
      const tip = document.getElementById("node-tooltip");
      if (tip) tip.style.display = "none";

      if (!activeNode) {
        linkGroup.selectAll(".link")
          .transition().duration(280).ease(d3.easeCubicIn)
          .attr("stroke-opacity", (l) => l.type === "technique-category-link" ? 0.45 : 0);
      }

      if (d.isTechnique && !(activeNode && activeNode.id === d.id)) {
        const r = nodeRadius(d);
        d3.select(event.currentTarget).selectAll("circle")
          .transition().duration(250).attr("r", r);
        d3.select(event.currentTarget).selectAll(".node-icon-img")
          .transition().duration(250)
          .attr("width", r * 2).attr("height", r * 2)
          .attr("x", -r).attr("y", -r);
      }
    });

  node.selectAll(".node-shape, .node-icon-img, .node-hitarea").remove();

  node.each(function (d) {
    const r   = nodeRadius(d);
    const el  = d3.select(this);

    if (d.isCategory) {
      // Círculo invisível (física + hover)
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-hitarea")
        .attr("fill", "transparent")
        .attr("stroke", "transparent");
      // Ícone adinkra
      const iconPath = CATEGORY_ICON_PATH[d.id];
      if (iconPath) {
        el.append("image")
          .attr("href", iconPath)
          .attr("class", "node-icon-img")
          .attr("width", r * 2).attr("height", r * 2)
          .attr("x", -r).attr("y", -r);
      }
    } else if (d.isTechnique) {
      const fill   = getNodeFillColor(d);
      const stroke = getNodeStrokeColor(d);
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-shape")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5);
      const svgSource = window.getIconPath(d.Nome);
      if (svgSource) {
        el.append("image")
          .attr("href", svgSource)
          .attr("class", "node-icon-img")
          .attr("width", r * 2).attr("height", r * 2)
          .attr("x", -r).attr("y", -r);
      }
    } else {
      // Pessoa — bolinha branca sólida
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-shape circle-shape person-circle")
        .attr("fill", "#ffffff")
        .attr("stroke", "none");
    }
  });

  // Entrada dos nós — fade-in de opacidade + grow do shape interno
  node
    .style("opacity", 0)
    .transition()
    .duration(900)
    .delay((d, i) => Math.min(i * 8, 600))
    .ease(d3.easeCubicOut)
    .style("opacity", 1);

  node.each(function(d, i) {
    const el    = d3.select(this);
    const delay = Math.min(i * 8, 600);
    const r     = nodeRadius(d);
    el.selectAll("circle.node-shape, circle.node-hitarea, circle.person-circle")
      .attr("r", 0)
      .transition().duration(800).delay(delay)
      .ease(d3.easeBackOut.overshoot(1.4))
      .attr("r", r);
    el.selectAll(".node-icon-img")
      .attr("width", 0).attr("height", 0).attr("x", 0).attr("y", 0)
      .transition().duration(800).delay(delay)
      .ease(d3.easeBackOut.overshoot(1.2))
      .attr("width", r * 2).attr("height", r * 2)
      .attr("x", -r).attr("y", -r);
  });

  // Rótulos — todos os nós no labelGroup
  const labels = labelGroup
    .selectAll(".label")
    .data(graphData.nodes, (d) => d.id)
    .join("text")
    .attr("class", (d) => "label" + ((!d.isCategory && !d.isTechnique) ? " label-person" : ""))
    .text((d) => {
      if (d.isCategory) return d.Nome || d.id;
      if (d.isTechnique) return d.Nome || d.id;
      const nome = d.Nome || d.id;
      return nome.split(" ")[0];
    })
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("dy", (d) => d.isTechnique ? (nodeRadius(d) + 12) + "px" : "0")
    .style("font-size", (d) => d.isTechnique ? "10px" : (d.isCategory ? "8px" : "6px"))
    .style("fill", (d) => d.isTechnique ? "#e8dcc8" : "rgba(255,255,255,0.6)")
    .style("visibility", (d) => d.isTechnique ? "visible" : "hidden")
    .style("pointer-events", (d) => d.isTechnique ? "all" : "none")
    .style("stroke", "transparent")
    .style("stroke-width", "18px")
    .style("cursor", "pointer");

  // Clique nos rótulos visíveis → foca o nó correspondente
  labels
    .on("pointerdown.labelclick", (event, d) => {
      d._lpd = { x: event.clientX, y: event.clientY };
    })
    .on("pointerup.labelclick", (event, d) => {
      if (!d._lpd) return;
      const moved = Math.hypot(event.clientX - d._lpd.x, event.clientY - d._lpd.y);
      d._lpd = null;
      if (moved > 5) return;
      event.stopPropagation();
      focusNode(event, d);
    });

  // Tooltip nativo — separado para não contaminar a seleção `labels`
  labels.selectAll("title").remove();
  labels.append("title").text((d) => d.Nome || d.id);

  // Tick
  simulation.on("tick", () => {
    link.each(function(d) {
      const dx   = d.target.x - d.source.x;
      const dy   = d.target.y - d.source.y;
      const dist = Math.hypot(dx, dy) || 1;
      const gap  = 22;
      const rs   = nodeRadius(d.source) + gap;
      const rt   = nodeRadius(d.target) + gap;
      d3.select(this)
        .attr("x1", d.source.x + (dx / dist) * rs)
        .attr("y1", d.source.y + (dy / dist) * rs)
        .attr("x2", d.target.x - (dx / dist) * rt)
        .attr("y2", d.target.y - (dy / dist) * rt);
    });

    node
      .each(function (d) {
        const r = nodeRadius(d);
        d.x = Math.max(r, Math.min(currentWidth  - r, d.x));
        d.y = Math.max(r, Math.min(currentHeight - r, d.y));
      })
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    labels.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Fechar card ao clicar no fundo
  let _bgPd = null;
  svg.on("pointerdown.background", (e) => { _bgPd = { x: e.clientX, y: e.clientY }; });
  svg.on("pointerup.background", (event) => {
    if (!_bgPd) return;
    const moved = Math.hypot(event.clientX - _bgPd.x, event.clientY - _bgPd.y);
    _bgPd = null;
    if (moved > 5) return;
    if (!event.target.closest(".node")) focusNode(event, null);
  });

  simulation.alpha(0.5).restart();
}

// ===== NODE COLORS =====

function getNodeFillColor(d) {
  const baseHex = getBaseColorForNode(d);
  if (d.isCategory) return baseHex;
  try {
    const brightness = d.isTechnique ? TECHNIQUE_BRIGHTNESS : PERSON_BRIGHTNESS;
    return d3.rgb(baseHex).brighter(brightness).toString();
  } catch (e) {
    return baseHex;
  }
}

function getNodeStrokeColor(d) {
  const baseHex = getBaseColorForNode(d);
  try {
    return d3.rgb(baseHex).darker(1).toString();
  } catch (e) {
    return "#333";
  }
}

// ===== ICONS =====

const iconTec = {
  "Design gráfico":               "./assets/icons/comunica/designGrafico.svg",
  "Ilustração":                   "./assets/icons/comunica/ilustracao.svg",
  "Tipografia":                   "./assets/icons/comunica/tipografia.svg",
  "Direção de arte":              "./assets/icons/comunica/DirecaoArte.svg",
  "Produção audiovisual":         "./assets/icons/comunica/producaoAudiovisual.svg",
  "Fotografia":                   "./assets/icons/comunica/fotografia.svg",
  "Videografismo":                "./assets/icons/comunica/videografismo.svg",
  "Design editorial":             "./assets/icons/comunica/designEditorial.svg",
  "Identidade visual":            "./assets/icons/comunica/identidadeVisual.svg",
  "Design de superfície":         "./assets/icons/comunica/designSuperficie.svg",
  "Arte urbana":                  "./assets/icons/comunica/arteUrbana.svg",
  "Design de objetos industriais":"./assets/icons/produ/designObjetos.svg",
  "Design de mobiliário":         "./assets/icons/produ/designMobiliario.svg",
  "Moda e têxtil":                "./assets/icons/produ/modaTextil.svg",
  "Escultura":                    "./assets/icons/produ/escultura.svg",
  "Prática 3D":                   "./assets/icons/produ/praticas3d.svg",
  "Design de interiores":         "./assets/icons/produ/designInteriores.svg",
  "Design de adereços":           "./assets/icons/produ/designAderecos.svg",
  "Embalagem":                    "./assets/icons/produ/embalagem.svg",
  "UI Design de interface":       "./assets/icons/intera/desingInterface.svg",
  "Programação":                  "./assets/icons/intera/programacao.svg",
  "Instalações interativas":      "./assets/icons/intera/instalacoesInterativas.svg",
  "Arte digital":                 "./assets/icons/intera/arteDigital.svg",
  "UX Experiência do usuário":    "./assets/icons/intera/experienciaUsuario.svg",
  "Realidades mistas":            "./assets/icons/intera/realidadesMistas.svg",
  "CX Experiência do Cliente":    "./assets/icons/servi/CX (Experiência do Cliente) .svg",
  "Design para impacto social":   "./assets/icons/servi/Design para Impacto Social.svg",
  "Branding":                     "./assets/icons/servi/Branding.svg",
  "Curadoria":                    "./assets/icons/servi/Curadoria.svg",
  "Economia criativa":            "./assets/icons/servi/Economia criativa.svg",
  "Educação":                     "./assets/icons/teori/educacacao.svg",
  "Escrita e publicação":         "./assets/icons/teori/escritaPublicacao.svg",
  "Ativismo e justiça social":    "./assets/icons/teori/AtivismoJustica.svg",
  "Relações étnico-raciais":      "./assets/icons/teori/relacoesEtinico.svg",
  "Design e gênero":              "./assets/icons/teori/designGenero.svg",
};

window.getIconPath = function (name) {
  return iconTec[name] || null;
};

window.getAreaIconPath = function (area) {
  return CATEGORY_ICON_PATH[area] || null;
};
