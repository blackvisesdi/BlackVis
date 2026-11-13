// Cores, ícones e rótulos usados pelo renderizador.

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

window.getIconPath = function(name) {
  const apiBase = window.BLACKVIS_API_RUNTIME_BASE || window.BLACKVIS_API_URL;
  if (!apiBase) return null;
  return `${apiBase.replace(/\/$/, '')}/api/techniques/icon?name=${encodeURIComponent(name)}`;
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
  const family = sampleLabel ? getComputedStyle(sampleLabel).fontFamily : '"Inter", sans-serif';
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
  // Ao voltar de um card, o reset pode ter agendado uma transição para
  // esconder os rótulos. Interrompe-a antes de restaurar os resultados.
  const sel = labelGroup.selectAll(".label").interrupt();
  if (!searchTerm) {
    sel.each(function(d) {
      const el = d3.select(this);
      el.text(null);
      el.text((d.Nome || d.id).split(" ")[0]);
    })
      .attr("dy", (d) => `${nodeRadius(d) + 6}px`)
      .attr("dominant-baseline", "hanging")
      .style("font-size", "9px")
      .style("visibility", "hidden")
      .style("pointer-events", "none");
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
    .style("visibility", "visible")
    .style("pointer-events", "all");
};
