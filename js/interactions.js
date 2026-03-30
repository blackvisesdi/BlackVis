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
      simulation.alphaTarget(0.3).restart();
    }
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // nó fica fixo onde foi solto
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

// ===== FOCUS =====

function focusNode(event, d) {

  // Lógica para liberar o nó anterior e atualizar o estado (activeNode)
  if (activeNode && (!d || activeNode.id !== d.id)) {
    activeNode.fx = null;
    activeNode.fy = null;
    // Retornar ao tamanho normal
    d3.selectAll(".node")
      .selectAll("circle")
      .transition()
      .duration(300)
      .attr("r", (node) => nodeRadius(node));
    d3.selectAll(".node")
      .selectAll(".technique-image")
      .transition()
      .duration(300)
      .attr("width", (node) => nodeRadius(node) * 2)
      .attr("height", (node) => nodeRadius(node) * 2)
      .attr("x", (node) => -nodeRadius(node))
      .attr("y", (node) => -nodeRadius(node));
    d3.selectAll(".label")
      .transition()
      .duration(300)
      .style("font-size", "6px")
      .style("text-transform", "none");
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
    d.fx = centerX;
    d.fy = centerY;
    d.x  = centerX; // move imediatamente sem esperar a física
    d.y  = centerY;

    const r = nodeRadius(d);
    const enlargedRadius = r * 2.5; 

    d3.selectAll(".node")
      .selectAll("circle")
      .transition()
      .duration(300)
      .attr("r", (node) => (node.id === d.id ? enlargedRadius : nodeRadius(node)));

    d3.selectAll(".node")
      .selectAll(".technique-image")
      .transition()
      .duration(300)
      .attr("width",  (node) => (node.id === d.id ? enlargedRadius * 2 : nodeRadius(node) * 2))
      .attr("height", (node) => (node.id === d.id ? enlargedRadius * 2 : nodeRadius(node) * 2))
      .attr("x",      (node) => (node.id === d.id ? -enlargedRadius    : -nodeRadius(node)))
      .attr("y",      (node) => (node.id === d.id ? -enlargedRadius    : -nodeRadius(node)));

    d3.selectAll(".label")
      .transition()
      .duration(300)
      .style("font-size",      (node) => (node.id === d.id ? "14px"      : "6px"))
      .style("text-transform", (node) => (node.id === d.id ? "uppercase" : "none"));

    const hasProfileInfo = d["Área do design"] || d.isCategory;
    if (hasProfileInfo && typeof exibirPerfil === "function") {
      exibirPerfil(d);
      d3.select("#card").style("display", "flex");
    } else {
      d3.select("#card").style("display", "none");
    }

    const neighbors = new Set([d.id]);
    graphData.links.forEach((link) => {
      if (link.source.id === d.id) neighbors.add(link.target.id);
      else if (link.target.id === d.id) neighbors.add(link.source.id);
    });

    nodeGroup.selectAll(".node")
      .transition().duration(300)
      .style("opacity", (o) => (neighbors.has(o.id) ? 1 : 0.1));

    linkGroup.selectAll(".link")
      .transition().duration(300)
      .style("opacity", (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.05));

  } else {
    d3.select("#card").style("display", "none");

    nodeGroup.selectAll(".node").selectAll("circle")
      .transition().duration(300)
      .attr("r", (node) => nodeRadius(node));

    d3.selectAll(".node").selectAll(".technique-image")
      .transition().duration(300)
      .attr("width",  (node) => nodeRadius(node) * 2)
      .attr("height", (node) => nodeRadius(node) * 2)
      .attr("x",      (node) => -nodeRadius(node))
      .attr("y",      (node) => -nodeRadius(node));

    d3.selectAll(".label")
      .transition().duration(300)
      .style("font-size", "6px")
      .style("text-transform", "none");

    nodeGroup.selectAll(".node").transition().duration(300).style("opacity", 1);
    linkGroup.selectAll(".link").transition().duration(300).style("opacity", 0.6);
  }

  if (simulation) simulation.alpha(0.5).restart();
}

function resetFocus(d) {
  linkGroup.selectAll(".link").attr("stroke-opacity", 0.6);
  nodeGroup
    .selectAll(".node")
    .attr("fill-opacity", 1.0)
    .attr("stroke-width", 1.5)
    .attr("r", (d_node) => nodeRadius(d_node));
  labelGroup.selectAll(".label").attr("fill-opacity", 1.0);

  if (d) {
    d.fx = null;
    d.fy = null;
  }
  if (simulation) simulation.alpha(0.3).restart();

  focusedNode = null;
  activeNode = null;
}

// ===== CARD DE PERFIL =====

function exibirPerfil(designerData) {
  const nome = designerData.Nome || designerData.id;
  const areaDesign = designerData["Área do design"];
  const nasc = designerData["Data de nascimento"];
  const morte = designerData["Data de falecimento (se houver)"];
  const linkExterno = designerData["Links extras"];
  const minibio = designerData.Minibio;

  // Localização: Cidade > Estado > Local de nascimento
  const localNascimento =
    (designerData.Cidade && designerData.Cidade.trim()) ||
    (designerData.Estado && designerData.Estado.trim()) ||
    (designerData["Local de nascimento"] && designerData["Local de nascimento"].trim());

  d3.select("#perfil-nome").text(nome);

  const cardInfo = document.getElementById("card-info");
  if (cardInfo) {
    cardInfo.innerHTML = "";

    if (areaDesign && areaDesign.trim() !== "") {
      const pArea = document.createElement("p");
      const strongArea = document.createElement("strong");
      strongArea.textContent = "Área(s): ";
      pArea.appendChild(strongArea);
      pArea.appendChild(document.createTextNode(areaDesign.trim()));
      cardInfo.appendChild(pArea);
    }

    if (localNascimento && localNascimento !== "") {
      const pLocal = document.createElement("p");
      const strongLocal = document.createElement("strong");
      strongLocal.textContent = "Local: ";
      pLocal.appendChild(strongLocal);
      pLocal.appendChild(document.createTextNode(localNascimento));
      cardInfo.appendChild(pLocal);
    }

    if (nasc && !isNaN(nasc)) {
      const anoNascimento = Math.floor(nasc);
      const currentYear = new Date().getFullYear();

      let anosVida;
      if (morte && !isNaN(morte)) {
        const anoMorte = Math.floor(morte);
        anosVida = `${anoNascimento} - ${anoMorte} (${anoMorte - anoNascimento} anos)`;
      } else {
        anosVida = `${anoNascimento} (${currentYear - anoNascimento} anos)`;
      }

      const pVida = document.createElement("p");
      const strongVida = document.createElement("strong");
      strongVida.textContent = "Vida: ";
      pVida.appendChild(strongVida);
      pVida.appendChild(document.createTextNode(anosVida));
      cardInfo.appendChild(pVida);
    }
  }

  const descEl = document.getElementById("perfil-descricao");
  if (descEl) {
    if (minibio && minibio.trim() !== "") {
      descEl.textContent = minibio;
      descEl.style.display = "block";
    } else {
      descEl.innerHTML = "";
      descEl.style.display = "none";
    }
  }

  const btnLink = d3.select("#btn-link-externo");
  if (linkExterno && linkExterno.startsWith("http")) {
    btnLink
      .attr("href", linkExterno)
      .attr("target", "_blank")
      .attr("rel", "noopener noreferrer")
      .text("Acessar Portfólio")
      .style("display", "inline-block");
  } else {
    btnLink.style("display", "none");
  }
}
