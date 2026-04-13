// ============================================================
// INTERACTIONS.JS — Drag, Foco e Card de Perfil
// ============================================================

// ===== DRAG BEHAVIOR =====

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

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

// linkMeta exposto por draw.js
let linkMeta = null;
window._setLinkMeta = function(m) { linkMeta = m; };

// ===== FOCUS =====

function focusNode(event, d) {

  // Libera nó anterior
  if (activeNode && (!d || activeNode.id !== d.id)) {
    if (!activeNode.isCategory) {
      activeNode.fx = null;
      activeNode.fy = null;
    }
    _restoreNodeSizes();
  }

  const isFocado = !!d;
  activeNode = isFocado ? d : null;

  if (isFocado) {
    nodeGroup.selectAll(".node")
      .filter((o) => o.id === d.id)
      .raise();

    const vb = svg.attr("viewBox").split(" ");
    const centerX = (+vb[2] || window.innerWidth)  / 2;
    const centerY = (+vb[3] || window.innerHeight) / 2;

    if (!d.isCategory) {
      d.fx = centerX;
      d.fy = centerY;
      d.x  = centerX;
      d.y  = centerY;
    }

    // Tamanho do nó focado — categorias não crescem
    const r = nodeRadius(d);
    const enlargedRadius = r * 2.5;

    if (!d.isCategory) {
      nodeGroup.selectAll(".node").each(function(o) {
        const el = d3.select(this);
        if (o.id === d.id) {
          // Pulse: escala rápido → acomoda suave
          el.selectAll("circle")
            .transition().duration(150).ease(d3.easeQuadOut).attr("r", r * 1.9)
            .transition().duration(550).ease(d3.easeElasticOut.period(0.45)).attr("r", enlargedRadius);
          el.selectAll(".node-icon-img")
            .transition().duration(150).ease(d3.easeQuadOut)
            .attr("width", r * 3.8).attr("height", r * 3.8).attr("x", -r * 1.9).attr("y", -r * 1.9)
            .transition().duration(550).ease(d3.easeElasticOut.period(0.45))
            .attr("width", enlargedRadius * 2).attr("height", enlargedRadius * 2)
            .attr("x", -enlargedRadius).attr("y", -enlargedRadius);
        }
      });
    }

    // Vizinhos diretos
    const neighbors = new Set([d.id]);
    graphData.links.forEach((link) => {
      const ls = typeof link.source === "object" ? link.source.id : link.source;
      const lt = typeof link.target === "object" ? link.target.id : link.target;
      if (ls === d.id) neighbors.add(lt);
      else if (lt === d.id) neighbors.add(ls);
    });

    // Opacidade dos nós + labels — comportamento separado por tipo de nó focado
    if (d.isCategory) {
      // Categoria focada: técnicas visíveis sem label, pessoas como pontos
      nodeGroup.selectAll(".node").transition().duration(700)
        .style("opacity", (o) => {
          if (o.id === d.id) return 1;
          if (!neighbors.has(o.id)) return 0.05;
          if (!o.isCategory && !o.isTechnique) return 0.35;
          return 1;
        });

      labelGroup.selectAll(".label").transition().duration(700)
        .style("visibility", "hidden")
        .style("pointer-events", "none");

    } else if (d.isTechnique) {
      // Técnica focada: círculos de pessoas somem, nomes aparecem como labels
      nodeGroup.selectAll(".node").transition().duration(700)
        .style("opacity", (o) => {
          if (o.id === d.id) return 1;
          if (!neighbors.has(o.id)) return 0.05;
          if (!o.isCategory && !o.isTechnique) return 0;
          return 1;
        });

      labelGroup.selectAll(".label").transition().duration(700)
        .style("visibility", (o) =>
          (!o.isCategory && !o.isTechnique && neighbors.has(o.id)) ? "visible" : "hidden")
        .style("pointer-events", (o) =>
          (!o.isCategory && !o.isTechnique && neighbors.has(o.id)) ? "all" : "none")
        .style("font-size", "10px")
        .text((o) => {
          if (!o.isCategory && !o.isTechnique && neighbors.has(o.id)) return o.Nome || o.id;
          return (o.Nome || o.id).split(" ")[0];
        });

    } else {
      // Pessoa focada: destaca vizinhos, sem labels
      nodeGroup.selectAll(".node").transition().duration(700)
        .style("opacity", (o) => neighbors.has(o.id) ? 1 : 0.08);

      labelGroup.selectAll(".label").transition().duration(700)
        .style("visibility", "hidden")
        .style("pointer-events", "none");
    }

    // Links
    linkGroup.selectAll(".link").transition().duration(700)
      .attr("stroke-opacity", (l) => {
        const ls = typeof l.source === "object" ? l.source.id : l.source;
        const lt = typeof l.target === "object" ? l.target.id : l.target;
        if (ls === d.id || lt === d.id) {
          return l.type === "technique-category-link" ? 0.85 : 0.4;
        }
        return l.type === "technique-category-link" ? 0.12 : 0.01;
      });

    // Painel
    if (d.isCategory) {
      const connectedTecnicas = graphData.nodes.filter((o) =>
        o.isTechnique && neighbors.has(o.id)
      );
      exibirAreaCard(d, connectedTecnicas);
    } else if (d.isTechnique) {
      const connectedDesigners = graphData.nodes.filter((o) =>
        !o.isCategory && !o.isTechnique && neighbors.has(o.id)
      );
      exibirListaPessoas(d, connectedDesigners);
    } else {
      exibirPerfil(d);
    }
    _showCard("all");

  } else {
    _hideCard();
    _restoreNodeSizes();
    nodeGroup.selectAll(".node").transition().duration(700).style("opacity", 1);
    labelGroup.selectAll(".label").transition().duration(700)
      .style("visibility", (o) => o.isTechnique ? "visible" : "hidden")
      .style("pointer-events", (o) => o.isTechnique ? "all" : "none")
      .style("font-size", (o) => o.isTechnique ? "10px" : (o.isCategory ? "8px" : "6px"))
      .attr("dy", (o) => o.isTechnique ? (nodeRadius(o) + 12) + "px" : "0")
      .text((o) => {
        if (o.isCategory || o.isTechnique) return o.Nome || o.id;
        return (o.Nome || o.id).split(" ")[0];
      });
    linkGroup.selectAll(".link").transition().duration(700)
      .attr("stroke-opacity", (l) => l.type === "technique-category-link" ? 0.45 : 0);
  }

  if (simulation) simulation.alpha(0.1).restart();
}

function _restoreNodeSizes() {
  nodeGroup.selectAll(".node").each(function(node) {
    const el = d3.select(this);
    const r = nodeRadius(node);
    el.selectAll("circle").transition().duration(500).attr("r", r);
    el.selectAll(".node-icon-img").transition().duration(500)
      .attr("width", r * 2).attr("height", r * 2)
      .attr("x", -r).attr("y", -r);
  });
}

function _showCard(mode) {
  const panel = document.querySelector(".info-panel");
  if (panel) panel.classList.add("is-open");
}

function _hideCard() {
  const panel = document.querySelector(".info-panel");
  if (panel) panel.classList.remove("is-open");
  const taEl = document.getElementById("card-tec-area");
  const pEl  = document.getElementById("card-pessoa");
  if (taEl) taEl.style.display = "none";
  if (pEl)  pEl.style.display  = "none";
}

// ===== CARD DE ÁREA (categoria focada) =====

function exibirAreaCard(nodeData, tecnicas) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";

  const area = nodeData.Nome || nodeData.id;
  const adinkraInfo = (typeof ADINKRA_INFO !== "undefined" && ADINKRA_INFO[area]) || {};
  const areaDesc    = AREA_DESCRICOES[area] || "";

  // 1. Título "Sobre o adinkra" (h2 Bellucci — sempre exibido)
  const sobreH2 = document.createElement("h2");
  sobreH2.className = "card-ta-nome card-sobre-adinkra-titulo";
  sobreH2.textContent = "Sobre o adinkra";
  container.appendChild(sobreH2);

  // 2. Texto explicando o adinkra
  if (adinkraInfo.nome) {
    const nomeEl = document.createElement("p");
    nomeEl.className = "card-adinkra-nome-inline";
    nomeEl.textContent = adinkraInfo.nome;
    container.appendChild(nomeEl);
  }
  const descAdinkra = document.createElement("p");
  descAdinkra.className = "card-desc";
  descAdinkra.textContent = adinkraInfo.descricao || "—";
  container.appendChild(descAdinkra);

  // 3. Título com o nome da área do design (h2 Bellucci)
  const h2Area = document.createElement("h2");
  h2Area.className = "card-ta-nome";
  h2Area.textContent = area;
  container.appendChild(h2Area);

  // 4. Texto sobre a área
  if (areaDesc) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = areaDesc;
    container.appendChild(p);
  }

  // 5. Técnicas conectadas
  if (tecnicas.length > 0) {
    const grid = document.createElement("div");
    grid.className = "names-grid";
    tecnicas
      .slice()
      .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
      .forEach((tec) => {
        const span = document.createElement("span");
        span.className = "names-grid-item";
        span.textContent = tec.Nome || tec.id;
        span.addEventListener("click", () => focusNode(null, tec));
        grid.appendChild(span);
      });
    container.appendChild(grid);
  }
  // Sem botão "Não exibir" para áreas
}

// ===== LISTA DE PESSOAS (técnica focada) =====

let _tecShowNames = true; // estado do toggle

function exibirListaPessoas(nodeData, designers) {
  _tecShowNames = true; // reset ao abrir nova técnica
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";

  const nome = nodeData.Nome || nodeData.id;
  const desc  = TECNICA_DESCRICOES[nome] || "";
  const designerIds = new Set(designers.map((d) => d.id));

  // Nome da técnica
  const h2 = document.createElement("h2");
  h2.className = "card-ta-nome";
  h2.textContent = nome;
  container.appendChild(h2);

  // Descrição
  if (desc) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = desc;
    container.appendChild(p);
  }

  // Nomes das pessoas
  if (designers.length === 0) {
    const empty = document.createElement("p");
    empty.style.cssText = "color:#666;font-size:11px;";
    empty.textContent = "Nenhum designer conectado.";
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "names-grid";
  designers
    .slice()
    .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
    .forEach((designer) => {
      const span = document.createElement("span");
      span.className = "names-grid-item";
      span.textContent = designer.Nome || designer.id;
      span.addEventListener("click", () => focusNode(null, designer));
      grid.appendChild(span);
    });
  container.appendChild(grid);

  // Estado inicial: nomes visíveis (labels SVG + grid no painel)
  // Botão toggle: "Não exibir" → esconde nomes / "Exibir nomes" → mostra nomes
  let showingNames = true;

  const btn = document.createElement("button");
  btn.className = "nao-exibir-btn";
  btn.textContent = "Não exibir";
  btn.onclick = () => {
    showingNames = !showingNames;
    btn.textContent = showingNames ? "Não exibir" : "Exibir nomes";
    grid.style.display = showingNames ? "" : "none";

    if (showingNames) {
      // Mostrar nomes: sumir círculos, exibir labels
      nodeGroup.selectAll(".node")
        .filter((o) => !o.isCategory && !o.isTechnique && designerIds.has(o.id))
        .transition().duration(400).style("opacity", 0);
      labelGroup.selectAll(".label")
        .filter((o) => !o.isCategory && !o.isTechnique && designerIds.has(o.id))
        .transition().duration(400)
        .style("visibility", "visible").style("pointer-events", "all");
    } else {
      // Mostrar bolinhas: exibir círculos, esconder labels
      nodeGroup.selectAll(".node")
        .filter((o) => !o.isCategory && !o.isTechnique && designerIds.has(o.id))
        .transition().duration(400).style("opacity", 0.85);
      labelGroup.selectAll(".label")
        .filter((o) => !o.isCategory && !o.isTechnique && designerIds.has(o.id))
        .transition().duration(400)
        .style("visibility", "hidden").style("pointer-events", "none");
    }
  };
  container.appendChild(btn);
}

// ===== CARD DE PERFIL (pessoa focada) =====

function exibirPerfil(designerData) {
  document.getElementById("card-tec-area").style.display = "none";
  document.getElementById("card-pessoa").style.display   = "block";

  const nome    = designerData.Nome || designerData.id;
  const nasc    = designerData["Data de nascimento"];
  const morte   = designerData["Data de falecimento (se houver)"];
  const minibio = designerData.Minibio || "";
  const local   =
    (designerData.Cidade  && String(designerData.Cidade).trim())  ||
    (designerData.Estado  && String(designerData.Estado).trim())  ||
    (designerData.País    && String(designerData.País).trim())    || "";

  // Nome
  document.getElementById("card-p-nome").textContent = nome;

  // Data de nascimento + idade
  const nascEl   = document.getElementById("card-p-nasc");
  const idadeEl  = document.getElementById("card-p-idade");
  const idadeCampo = document.getElementById("card-p-idade-campo");
  if (nasc && !isNaN(nasc)) {
    const anoNasc = Math.floor(nasc);
    const currentYear = new Date().getFullYear();
    if (morte && !isNaN(morte) && String(morte).trim() !== "") {
      nascEl.textContent = `${anoNasc} — ${Math.floor(morte)}`;
      if (idadeCampo) idadeCampo.style.display = "none";
    } else {
      nascEl.textContent = String(anoNasc);
      if (idadeEl) idadeEl.textContent = String(currentYear - anoNasc);
      if (idadeCampo) idadeCampo.style.display = "";
    }
  } else {
    nascEl.textContent = "";
    if (idadeCampo) idadeCampo.style.display = "none";
  }

  // Local
  document.getElementById("card-p-local").textContent = local;

  // Técnicas agrupadas por área
  const tecEl = document.getElementById("card-p-tecnicas");
  tecEl.innerHTML = "";

  const tecnicas = (designerData["Técnicas"] || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  // Agrupa por área usando nodeAreaMap
  const areaGroups = {};
  tecnicas.forEach(tec => {
    const area = (nodeAreaMap && nodeAreaMap.get("TEC_" + tec)) || "Outro";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(tec);
  });

  Object.entries(areaGroups).forEach(([area, tecs]) => {
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

    const namesSpan = document.createElement("span");
    namesSpan.className = "tec-names";
    namesSpan.textContent = tecs.join(" / ");
    row.appendChild(namesSpan);

    tecEl.appendChild(row);
  });

  // Bio
  const bioEl = document.getElementById("card-p-bio");
  bioEl.textContent = minibio;
  bioEl.style.display = minibio ? "block" : "none";

  // Link externo
  const linkExterno = designerData["Links extras"] || "";
  const primeiroLink = linkExterno.split(",").map(s => s.trim()).find(s => s.startsWith("http"));
  const btnLink = document.getElementById("btn-link-externo");
  if (btnLink) {
    if (primeiroLink) {
      btnLink.href    = primeiroLink;
      btnLink.target  = "_blank";
      btnLink.rel     = "noopener noreferrer";
      btnLink.textContent = "Acessar Portfólio";
      btnLink.style.display = "inline-block";
    } else {
      btnLink.style.display = "none";
    }
  }
}
