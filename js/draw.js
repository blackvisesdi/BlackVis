// ============================================================
// DRAW.JS — Renderização do Grafo de Forças
// ============================================================

// ===== SIZING CONSTANTS =====

const MULT_CATEGORY  = 2.2;  // categorias — maiores
const MULT_TECHNIQUE = 1.3;  // técnicas — intermediárias
const MULT_PERSON    = 0.65; // pessoas — bem menores

const MIN_RADIUS_CATEGORY  = 28;
const MIN_RADIUS_TECHNIQUE = 14;
const MIN_RADIUS_PERSON    = 7;

const COLLISION_PADDING = 6;

// ===== NODE RADIUS =====

function nodeRadius(d) {
  const base = Math.max(radiusScale(d.degree || 1), 1);

  if (d.isCategory) return Math.max(base * MULT_CATEGORY,  MIN_RADIUS_CATEGORY);
  if (d.isTechnique) return Math.max(base * MULT_TECHNIQUE, MIN_RADIUS_TECHNIQUE);
  return Math.max(base * MULT_PERSON, MIN_RADIUS_PERSON);
}

// ===== FORCE GRAPH =====

function drawForceGraph(data, centerNodes = false) {
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  if (simulation) simulation.stop();

  const currentWidth  = Math.min(window.innerWidth,  2000);
  const currentHeight = Math.min(window.innerHeight, 1200);

  svg.attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`);

  const allDegrees = graphData.nodes.map((d) => d.degree);
  radiusScale.domain([d3.min(allDegrees) || 1, d3.max(allDegrees) || 1]);

  simulation = d3
    .forceSimulation(graphData.nodes)
    .force("link",    d3.forceLink(graphData.links).id((d) => d.id).distance(120))
    .force("charge",  d3.forceManyBody().strength(-180))
    .force("center",  d3.forceCenter(currentWidth / 2, currentHeight / 2))
    .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + COLLISION_PADDING))
    .force("x", d3.forceX(currentWidth  / 2).strength(centerNodes ? 0.25 : 0.15))
    .force("y", d3.forceY(currentHeight / 2).strength(centerNodes ? 0.25 : 0.15));

  if (centerNodes) {
    graphData.nodes.forEach((d) => {
      d.x  = currentWidth  / 2 + (Math.random() - 0.5) * 80;
      d.y  = currentHeight / 2 + (Math.random() - 0.5) * 80;
      d.vx = 0;
      d.vy = 0;
    });
  }

  // Mapa id→nó para resolver cores dos links
  const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));

  // Pré-computa cor + importância para cada link (evita recalcular por attr)
  const nodeAreas = (n) =>
    String(n?.["Área do design"] || "").split(",").map((s) => s.trim()).filter(Boolean);

  const linkMeta = new Map();
  graphData.links.forEach((l) => {
    const srcId = typeof l.source === "object" ? l.source.id : l.source;
    const tgtId = typeof l.target === "object" ? l.target.id : l.target;
    const src = nodeById.get(srcId);
    const tgt = nodeById.get(tgtId);

    // Cor: determinada pelo destino (técnica ou categoria) — assim todas as
    // linhas que chegam a um eixo têm a cor daquele eixo, independente da origem
    const color = tgt ? getBaseColorForNode(tgt) : "#999";

    // Importância: links da área primária da pessoa são mais evidentes
    let isPrimary = true;
    const isPersonLink = l.type === "person-technique-link" || l.type === "person-category-fallback-link";
    if (isPersonLink) {
      const person = (src && !src.isCategory && !src.isTechnique) ? src : tgt;
      const other  = person === src ? tgt : src;
      if (person && other) {
        const areas = nodeAreas(person);
        if (areas.length > 1) {
          // área do nó conectado (categoria usa o próprio id como área)
          const otherArea = other.isCategory ? other.id : nodeAreas(other)[0];
          isPrimary = otherArea === areas[0];
        }
      }
    }

    linkMeta.set(l, { color, isPrimary });
  });

  // Links
  const link = linkGroup
    .selectAll(".link")
    .data(graphData.links, (d) => d.source.id + "-" + d.target.id)
    .join("line")
    .attr("class", "link")
    .attr("stroke",         (d) => linkMeta.get(d)?.color   ?? "#999")
    .attr("stroke-opacity", (d) => linkMeta.get(d)?.isPrimary ? 0.55 : 0.18)
    .attr("stroke-width",   (d) => linkMeta.get(d)?.isPrimary ? 1.5  : 0.8);

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
      if (moved > 5) return; // foi drag, ignorar
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

      if (d.isTechnique && !(activeNode && activeNode.id === d.id)) {
        const r = nodeRadius(d);
        d3.select(event.currentTarget).selectAll("circle")
          .transition().duration(150).attr("r", r * 1.6);
        d3.select(event.currentTarget).selectAll(".technique-image")
          .transition().duration(150)
          .attr("width", r * 3.2).attr("height", r * 3.2)
          .attr("x", -r * 1.6).attr("y", -r * 1.6);
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

      if (d.isTechnique && !(activeNode && activeNode.id === d.id)) {
        const r = nodeRadius(d);
        d3.select(event.currentTarget).selectAll("circle")
          .transition().duration(150).attr("r", r);
        d3.select(event.currentTarget).selectAll(".technique-image")
          .transition().duration(150)
          .attr("width", r * 2).attr("height", r * 2)
          .attr("x", -r).attr("y", -r);
      }
    });

  node.selectAll(".node-shape").remove();

  node.each(function (d) {
    const r      = nodeRadius(d);
    const el     = d3.select(this);
    const fill   = getNodeFillColor(d);
    const stroke = getNodeStrokeColor(d);

    if (d.isTechnique) {
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-background-circle")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5);

      const svgSource = window.getIconPath(d.Nome) || "../assets/icons/default.svg";
      el.append("image")
        .attr("href", svgSource)
        .attr("class", "node-shape technique-image")
        .attr("width", r * 2).attr("height", r * 2)
        .attr("x", -r).attr("y", -r);
    } else {
      el.append("circle")
        .attr("r", r)
        .attr("class", "node-shape circle-shape")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", d.isCategory ? 1.5 : 0.5);
    }
  });

  // Rótulos
  const labels = labelGroup
    .selectAll(".label")
    .data(graphData.nodes, (d) => d.id)
    .join("text")
    .attr("class", "label")
    .text((d) => {
      if (d.isCategory) return d.Nome;
      return d.Nome ? d.Nome.split(" ")[0] : d.id.split(" ")[0];
    })
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-size", "6px")
    .style("pointer-events", "none")
    .append("title")
    .text((d) => d.Nome || d.id);

  // Tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node
      .each(function (d) {
        const r = nodeRadius(d);
        d.x = Math.max(r, Math.min(currentWidth  - r, d.x));
        d.y = Math.max(r, Math.min(currentHeight - r, d.y));
      })
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    labels.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Fechar card ao clicar no fundo (usa pointerup para não conflitar com D3 drag)
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
  "Colagem":                      "./assets/icons/comunica/",
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
