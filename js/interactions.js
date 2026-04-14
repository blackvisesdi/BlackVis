// ============================================================
// INTERACTIONS.JS - Drag, foco e cards
// ============================================================

function drag(simulation) {
  let wasDragged = false;

  function dragstarted(event, d) {
    wasDragged = false;
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

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
  }

  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

let linkMeta = null;
const techniqueNamesVisibility = new Map();

window._setLinkMeta = function(m) { linkMeta = m; };
window._areTechniqueNamesVisible = function(techId) {
  return techniqueNamesVisibility.get(techId) === true;
};

// Exibe/oculta TODOS os nomes de pessoas de uma vez (botão global no painel de debug)
window._setAllNamesVisible = function(visible) {
  window.DBG_ALL_NAMES_VISIBLE = visible;
  const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;

  // Atualiza texto e posição imediatamente
  labelGroup.selectAll(".label")
    .interrupt()
    .text((node) => visible ? (node.Nome || node.id) : (node.Nome || node.id).split(" ")[0])
    .attr("dy", visible ? "0" : (node) => `${nodeRadius(node) + 6}px`)
    .attr("dominant-baseline", visible ? "middle" : "hanging")
    .style("font-size", visible ? nameSizePx : "9px")
    .style("visibility", visible ? "visible" : "hidden")
    .style("pointer-events", visible ? "all" : "none");

  // Fade dos círculos
  nodeGroup.selectAll(".node")
    .filter((node) => !node.isCategory && !node.isTechnique)
    .interrupt()
    .transition()
    .duration(350)
    .style("opacity", visible ? 0 : 0.92);
};

// ── Multi-seleção de categorias ──────────────────────────────
window.selectedCategoryHighlights = new Set();

function _renderCategoryHighlights() {
  const selected = window.selectedCategoryHighlights;

  if (selected.size === 0) {
    // Sem seleção: esconde só as linhas, todos os nós ficam visíveis
    linkGroup.selectAll(".link")
      .interrupt()
      .transition()
      .duration(220)
      .attr("stroke-opacity", 0);
    return;
  }

  // Vizinhos de 2 hops de todas as categorias selecionadas (para saber quais linhas mostrar)
  const allNeighbors = new Set();
  selected.forEach((catId) => {
    const catNode = graphData.nodes.find((n) => n.id === catId);
    if (catNode) _twohopNeighbors(catNode).forEach((id) => allNeighbors.add(id));
  });

  // Todos os nós ficam visíveis — sem dimming
  nodeGroup.selectAll(".node")
    .interrupt()
    .transition()
    .duration(220)
    .style("opacity", 1);

  // Só as linhas das categorias selecionadas aparecem
  linkGroup.selectAll(".link")
    .interrupt()
    .attr("stroke-opacity", (link) => {
      const srcId = _linkNodeId(link.source);
      const tgtId = _linkNodeId(link.target);
      if (link.type === "technique-category-link") {
        // Linha área→técnica: só se a área está selecionada
        return (selected.has(srcId) || selected.has(tgtId)) ? 0.72 : 0;
      }
      if (link.type === "person-technique-link") {
        // Linha técnica→pessoa: só se ambos os extremos são vizinhos de uma área selecionada
        return (allNeighbors.has(srcId) && allNeighbors.has(tgtId)) ? 0.28 : 0;
      }
      return 0;
    });
}

window._toggleCategoryHighlight = function(categoryId) {
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
    if (srcId === node.id) { neighbors.add(tgtId); firstHop.add(tgtId); }
    if (tgtId === node.id) { neighbors.add(srcId); firstHop.add(srcId); }
  });

  graphData.links.forEach((link) => {
    const srcId = _linkNodeId(link.source);
    const tgtId = _linkNodeId(link.target);
    if (firstHop.has(srcId)) neighbors.add(tgtId);
    if (firstHop.has(tgtId)) neighbors.add(srcId);
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
  labelGroup.selectAll(".label")
    .filter((node) => node.id === personId)
    .attr("dy", visible && fullName ? "0" : (node) => `${nodeRadius(node) + 6}px`)
    .attr("dominant-baseline", visible && fullName ? "middle" : "hanging")
    .style("font-size", visible && fullName ? nameSizePx : "9px")
    .style("visibility", visible ? "visible" : "hidden")
    .style("pointer-events", visible ? "all" : "none")
    .text((node) => fullName ? (node.Nome || node.id) : (node.Nome || node.id).split(" ")[0]);
}

function _highlightPersonInGraph(person, highlighted) {
  const factor = highlighted ? 1.85 : 1;
  nodeGroup.selectAll(".node")
    .filter((node) => node.id === person.id)
    .selectAll("circle")
    .transition()
    .duration(highlighted ? 140 : 180)
    .attr("r", nodeRadius(person) * factor);

  if (activeNode && activeNode.isTechnique && _isPersonLinkedToTechnique(person.id, activeNode.id)) {
    _setPersonLabelVisibility(person.id, highlighted, true);
    nodeGroup.selectAll(".node")
      .filter((node) => node.id === person.id)
      .transition()
      .duration(140)
      .style("opacity", highlighted ? 1 : (window._areTechniqueNamesVisible(activeNode.id) ? 0 : 0.92));
  }
}

function _showCard() {
  const panel = document.querySelector(".info-panel");
  if (panel) panel.classList.add("is-open");
}

function _hideCard() {
  const panel = document.querySelector(".info-panel");
  if (panel) panel.classList.remove("is-open");
  const techniqueAreaCard = document.getElementById("card-tec-area");
  const personCard = document.getElementById("card-pessoa");
  if (techniqueAreaCard) techniqueAreaCard.style.display = "none";
  if (personCard) personCard.style.display = "none";
}

function _restoreNodeSizes() {
  nodeGroup.selectAll(".node").each(function(node) {
    const el = d3.select(this);
    const r = nodeRadius(node);
    el.selectAll("circle")
      .interrupt()
      .style("opacity", null)   // limpa opacity inline presa
      .transition().duration(220).attr("r", r);
    el.selectAll(".node-icon-img").interrupt().transition().duration(220)
      .attr("width", r * 2)
      .attr("height", r * 2)
      .attr("x", -r)
      .attr("y", -r);
  });
}

function _resetGraphState() {
  if (window.selectedCategoryHighlights) window.selectedCategoryHighlights.clear();
  nodeGroup.selectAll(".node").interrupt().transition().duration(220).style("opacity", 1);
  labelGroup.selectAll(".label")
    .interrupt()
    .transition()
    .duration(180)
    .style("visibility", "hidden")
    .style("pointer-events", "none")
    .text((node) => (node.Nome || node.id).split(" ")[0]);
  linkGroup.selectAll(".link")
    .interrupt()
    .transition()
    .duration(220)
    .attr("stroke-opacity", 0);
}

function _setFocusedNodeScale(node) {
  if (node.isCategory) return;

  const baseRadius = nodeRadius(node);
  const focusRadius = baseRadius * 2.15;

  nodeGroup.selectAll(".node").each(function(candidate) {
    if (candidate.id !== node.id) return;
    const el = d3.select(this);
    el.selectAll("circle")
      .interrupt()
      .style("opacity", null)   // limpa opacity inline (pode estar 0 por hover de técnica)
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr("r", focusRadius);
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
  if (node.isCategory) {
    nodeGroup.selectAll(".node")
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

    labelGroup.selectAll(".label")
      .interrupt()
      .transition()
      .duration(180)
      .style("visibility", "hidden")
      .style("pointer-events", "none");
  } else if (node.isTechnique) {
    const showingNames = window._areTechniqueNamesVisible(node.id);

    nodeGroup.selectAll(".node")
      .interrupt()
      .transition()
      .duration(280)
      .style("opacity", (candidate) => {
        if (candidate.id === node.id) return 1;
        if (!neighbors.has(candidate.id)) return 0.05;
        if (!candidate.isCategory && !candidate.isTechnique) return showingNames ? 0 : 0.92;
        return 1;
      });

    const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;
    labelGroup.selectAll(".label")
      .interrupt()
      .text((candidate) =>
        showingNames && neighbors.has(candidate.id)
          ? (candidate.Nome || candidate.id)
          : (candidate.Nome || candidate.id).split(" ")[0])
      .attr("dy", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "0" : `${nodeRadius(candidate) + 6}px`)
      .attr("dominant-baseline", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "middle" : "hanging")
      .style("font-size", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? nameSizePx : "9px")
      .style("visibility", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "visible" : "hidden")
      .style("pointer-events", (candidate) =>
        showingNames && neighbors.has(candidate.id) ? "all" : "none");
  } else {
    nodeGroup.selectAll(".node")
      .interrupt()
      .transition()
      .duration(280)
      .style("opacity", (candidate) => neighbors.has(candidate.id) ? 1 : 0.08);

    labelGroup.selectAll(".label")
      .interrupt()
      .transition()
      .duration(180)
      .style("visibility", "hidden")
      .style("pointer-events", "none");
  }

  linkGroup.selectAll(".link")
    .attr("stroke-opacity", (link) => {
      const sourceId = _linkNodeId(link.source);
      const targetId = _linkNodeId(link.target);
      const meta = linkMeta ? linkMeta.get(link) : null;
      const isDirect = sourceId === node.id || targetId === node.id;
      const isVisibleNetwork = neighbors.has(sourceId) && neighbors.has(targetId);

      if (node.isCategory) {
        if (link.type === "technique-category-link" && isVisibleNetwork) return meta?.isPrimary ? 0.72 : 0.42;
        if (link.type === "person-technique-link" && isVisibleNetwork) return meta?.isPrimary ? 0.2 : 0.09;
        return 0;
      }

      if (node.isTechnique) {
        if (isDirect) {
          if (link.type === "technique-category-link") return 0.75;
          return meta?.isPrimary ? 0.78 : 0.28;
        }
        return 0;
      }

      if (isDirect) {
        if (link.type === "technique-category-link") return 0.18;
        return meta?.isPrimary ? 0.74 : 0.26;
      }

      return 0;
    });

  if (options.areaFromFilter && node.isCategory) {
    if (options.noCard) {
      _hideCard();
    } else {
      const connectedTechniques = graphData.nodes.filter((candidate) =>
        candidate.isTechnique && neighbors.has(candidate.id));
      exibirAreaCard(node, connectedTechniques);
      _showCard();
    }
    return;
  }

  if (node.isTechnique) {
    const connectedPeople = graphData.nodes.filter((candidate) =>
      !candidate.isCategory && !candidate.isTechnique && neighbors.has(candidate.id));
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

function focusNode(event, d, options = {}) {
  if (activeNode && (!d || activeNode.id !== d.id)) {
    if (!activeNode.isCategory) {
      activeNode.fx = null;
      activeNode.fy = null;
    }
    _restoreNodeSizes();
  }

  if (!d) {
    activeNode = null;
    _hideCard();
    _resetGraphState();
    if (simulation) simulation.alpha(0.06).restart();
    return;
  }

  if (d.isCategory && !options.areaFromFilter) {
    // Clique direto no grafo → multi-seleção de highlights (sem filtrar, sem card)
    window._toggleCategoryHighlight(d.id);
    return;
  }

  activeNode = d;

  nodeGroup.selectAll(".node")
    .filter((node) => node.id === d.id)
    .raise();

  const viewBox = svg.attr("viewBox").split(" ");
  const svgW = +viewBox[2] || window.innerWidth;
  const svgH = +viewBox[3] || window.innerHeight;

  if (!d.isCategory) {
    // Move para o canto superior-esquerdo para dar espaço ao card
    d.fx = svgW * 0.18;
    d.fy = svgH * 0.2;
    d.x = d.fx;
    d.y = d.fy;
  }

  _setFocusedNodeScale(d);
  const neighbors = d.isCategory ? _twohopNeighbors(d) : _neighborsForNode(d);
  _renderGraphFocus(d, neighbors, options);

  if (simulation) simulation.alpha(0.08).restart();
}

function exibirAreaCard(nodeData, techniques) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";

  const area = nodeData.Nome || nodeData.id;
  const adinkraInfo = (typeof ADINKRA_INFO !== "undefined" && ADINKRA_INFO[area]) || {};
  const areaDescription = AREA_DESCRICOES[area] || "";

  const aboutTitle = document.createElement("h2");
  aboutTitle.className = "card-ta-nome card-sobre-adinkra-titulo";
  aboutTitle.textContent = "Sobre o adinkra";
  container.appendChild(aboutTitle);

  if (adinkraInfo.nome) {
    const adinkraName = document.createElement("p");
    adinkraName.className = "card-adinkra-nome-inline";
    adinkraName.textContent = adinkraInfo.nome;
    container.appendChild(adinkraName);
  }

  const adinkraDescription = document.createElement("p");
  adinkraDescription.className = "card-desc";
  adinkraDescription.textContent = adinkraInfo.descricao || "-";
  container.appendChild(adinkraDescription);

  const areaTitle = document.createElement("h2");
  areaTitle.className = "card-ta-nome";
  areaTitle.textContent = area;
  container.appendChild(areaTitle);

  if (areaDescription) {
    const description = document.createElement("p");
    description.className = "card-desc";
    description.textContent = areaDescription;
    container.appendChild(description);
  }

  if (techniques.length > 0) {
    const tecTitle = document.createElement("p");
    tecTitle.className = "card-desc";
    tecTitle.style.fontWeight = "600";
    tecTitle.style.marginTop = "12px";
    tecTitle.textContent = "Técnicas";
    container.appendChild(tecTitle);

    const tecGrid = document.createElement("div");
    tecGrid.className = "names-grid";
    techniques
      .slice()
      .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
      .forEach((technique) => {
        const item = document.createElement("span");
        item.className = "names-grid-item";
        item.textContent = technique.Nome || technique.id;
        item.addEventListener("click", () => focusNode(null, technique));
        tecGrid.appendChild(item);
      });
    container.appendChild(tecGrid);
  }

}

function exibirListaPessoas(nodeData, designers) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";

  const techniqueId = nodeData.id;
  const techniqueName = nodeData.Nome || nodeData.id;
  const description = TECNICA_DESCRICOES[techniqueName] || "";
  const designerIds = new Set(designers.map((designer) => designer.id));

  if (!techniqueNamesVisibility.has(techniqueId)) {
    techniqueNamesVisibility.set(techniqueId, false);
  }

  const title = document.createElement("h2");
  title.className = "card-ta-nome";
  title.textContent = techniqueName;
  container.appendChild(title);

  if (description) {
    const descriptionEl = document.createElement("p");
    descriptionEl.className = "card-desc";
    descriptionEl.textContent = description;
    container.appendChild(descriptionEl);
  }

  const toggleButton = document.createElement("button");
  toggleButton.className = "nao-exibir-btn";
  toggleButton.textContent = techniqueNamesVisibility.get(techniqueId) ? "Nao exibir nomes" : "Exibir nomes";
  container.appendChild(toggleButton);

  const grid = document.createElement("div");
  grid.className = "names-grid";
  grid.style.display = techniqueNamesVisibility.get(techniqueId) ? "" : "none";

  if (designers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "card-desc";
    empty.textContent = "Nenhum designer conectado.";
    container.appendChild(empty);
  } else {
    designers
      .slice()
      .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
      .forEach((designer) => {
        const item = document.createElement("span");
        item.className = "names-grid-item";
        item.textContent = designer.Nome || designer.id;
        item.addEventListener("click", () => focusNode(null, designer));
        item.addEventListener("mouseenter", () => _highlightPersonInGraph(designer, true));
        item.addEventListener("mouseleave", () => _highlightPersonInGraph(designer, false));
        grid.appendChild(item);
      });

    container.appendChild(grid);
  }

  function syncTechniquePeopleView(showNames) {
    techniqueNamesVisibility.set(techniqueId, showNames);
    const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;

    nodeGroup.selectAll(".node")
      .filter((node) => !node.isCategory && !node.isTechnique && designerIds.has(node.id))
      .interrupt()
      .transition()
      .duration(350)
      .style("opacity", showNames ? 0 : 0.92);

    labelGroup.selectAll(".label")
      .filter((node) => designerIds.has(node.id))
      .interrupt()
      .text((node) => showNames ? (node.Nome || node.id) : (node.Nome || node.id).split(" ")[0])
      .attr("dy", showNames ? "0" : (node) => `${nodeRadius(node) + 6}px`)
      .attr("dominant-baseline", showNames ? "middle" : "hanging")
      .style("font-size", showNames ? nameSizePx : "9px")
      .style("visibility", showNames ? "visible" : "hidden")
      .style("pointer-events", showNames ? "all" : "none");
  }

  toggleButton.addEventListener("click", () => {
    const nextState = !techniqueNamesVisibility.get(techniqueId);
    toggleButton.textContent = nextState ? "Nao exibir nomes" : "Exibir nomes";
    grid.style.display = nextState ? "" : "none";
    syncTechniquePeopleView(nextState);
  });

  syncTechniquePeopleView(techniqueNamesVisibility.get(techniqueId));
}

function exibirPerfil(designerData) {
  document.getElementById("card-tec-area").style.display = "none";
  document.getElementById("card-pessoa").style.display = "block";

  const name = designerData.Nome || designerData.id;
  const birth = designerData["Data de nascimento"];
  const death = designerData["Data de falecimento (se houver)"];
  const miniBio = designerData.Minibio || "";
  const gender = designerData["Gênero"] || "";
  const location =
    (designerData.Cidade && String(designerData.Cidade).trim()) ||
    (designerData.Estado && String(designerData.Estado).trim()) ||
    (designerData["País"] && String(designerData["País"]).trim()) ||
    "";

  document.getElementById("card-p-nome").textContent = name;
  document.getElementById("card-p-local").textContent = location;

  const birthEl = document.getElementById("card-p-nasc");
  const ageEl = document.getElementById("card-p-idade");
  const ageField = document.getElementById("card-p-idade-campo");

  if (birth && !isNaN(birth)) {
    const birthYear = Math.floor(birth);
    const currentYear = new Date().getFullYear();
    if (death && !isNaN(death) && String(death).trim() !== "") {
      birthEl.textContent = `${birthYear} - ${Math.floor(death)}`;
      if (ageField) ageField.style.display = "none";
    } else {
      birthEl.textContent = String(birthYear);
      if (ageEl) ageEl.textContent = String(currentYear - birthYear);
      if (ageField) ageField.style.display = "";
    }
  } else {
    birthEl.textContent = "";
    if (ageField) ageField.style.display = "none";
  }

  const oldGenderField = document.getElementById("card-p-genero-campo");
  if (oldGenderField) oldGenderField.remove();
  if (gender) {
    const fields = document.querySelector("#card-pessoa .card-p-campos");
    const genderField = document.createElement("p");
    genderField.id = "card-p-genero-campo";
    genderField.className = "card-campo";
    genderField.innerHTML = `<span class="campo-label">Genero</span><span class="campo-valor">${gender}</span>`;
    fields.appendChild(genderField);
  }

  const techniquesEl = document.getElementById("card-p-tecnicas");
  techniquesEl.innerHTML = "";

  const techniques = (designerData["Técnicas"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const areaGroups = {};
  techniques.forEach((technique) => {
    const area = (nodeAreaMap && nodeAreaMap.get(`TEC_${technique}`)) || "Outro";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(technique);
  });

  Object.entries(areaGroups).forEach(([area, values]) => {
    if (area === "Outro") return;
    const row = document.createElement("div");
    row.className = "tec-row";

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
    names.textContent = values.join(" / ");
    row.appendChild(names);

    techniquesEl.appendChild(row);
  });

  const bioEl = document.getElementById("card-p-bio");
  bioEl.textContent = miniBio;
  bioEl.style.display = miniBio ? "block" : "none";

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
    const match = Object.entries(socialMap).find(([domain]) => url.includes(domain));
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
