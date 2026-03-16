function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

function focusNode(event, d) {
  if (event) event.stopPropagation();

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
    d.fx = width / 2;
    d.fy = height / 2;

    // ✨ NOVA FEATURE: Aumentar bolinha ao clicar
    const r = nodeRadius(d);
    const enlargedRadius = r * 2.5; // 2.5x maior

    d3.selectAll(".node")
      .selectAll("circle")
      .transition()
      .duration(300)
      .attr("r", (node) => {
        if (node.id === d.id) {
          return enlargedRadius;
        }
        return nodeRadius(node);
      });

    // ✨ AUMENTAR SVG DA TÉCNICA também
    d3.selectAll(".node")
      .selectAll(".technique-image")
      .transition()
      .duration(300)
      .attr("width", (node) => {
        if (node.id === d.id) {
          return enlargedRadius * 2; // SVG também 2.5x maior
        }
        return nodeRadius(node) * 2;
      })
      .attr("height", (node) => {
        if (node.id === d.id) {
          return enlargedRadius * 2;
        }
        return nodeRadius(node) * 2;
      })
      .attr("x", (node) => {
        if (node.id === d.id) {
          return -enlargedRadius;
        }
        return -nodeRadius(node);
      })
      .attr("y", (node) => {
        if (node.id === d.id) {
          return -enlargedRadius;
        }
        return -nodeRadius(node);
      });

    // ✨ AUMENTAR FONTE E COLOCAR EM CAPS LOCK
    d3.selectAll(".label")
      .transition()
      .duration(300)
      .style("font-size", (node) => {
        if (node.id === d.id) {
          return "14px"; // Letra maior!
        }
        return "6px";
      })
      .style("text-transform", (node) => {
        if (node.id === d.id) {
          return "uppercase"; // CAPS LOCK!
        }
        return "none";
      });

    const hasProfileInfo = d["Área do design"] || d.isCategory;

    if (hasProfileInfo && typeof exibirPerfil === "function") {
      exibirPerfil(d);
      d3.select("#details-card").style("display", "block");
    } else {
      d3.select("#details-card").style("display", "none");
    }

    const neighbors = new Set();
    neighbors.add(d.id);
    graphData.links.forEach((link) => {
      if (link.source.id === d.id) neighbors.add(link.target.id);
      else if (link.target.id === d.id) neighbors.add(link.source.id);
    });

    nodeGroup
      .selectAll(".node")
      .transition()
      .duration(300)
      .style("opacity", (o) => (neighbors.has(o.id) ? 1 : 0.1));

    linkGroup
      .selectAll(".link")
      .transition()
      .duration(300)
      .style("opacity", (l) =>
        l.source.id === d.id || l.target.id === d.id ? 1 : 0.05
      );
  } else {
    d3.select("#details-card").style("display", "none");

    // Reseta o tamanho de todos os nós
    nodeGroup
      .selectAll(".node")
      .selectAll("circle")
      .transition()
      .duration(300)
      .attr("r", (node) => nodeRadius(node));

    // Reseta tamanho do SVG
    d3.selectAll(".node")
      .selectAll(".technique-image")
      .transition()
      .duration(300)
      .attr("width", (node) => nodeRadius(node) * 2)
      .attr("height", (node) => nodeRadius(node) * 2)
      .attr("x", (node) => -nodeRadius(node))
      .attr("y", (node) => -nodeRadius(node));

    // Reseta fonte e remove CAPS
    d3.selectAll(".label")
      .transition()
      .duration(300)
      .style("font-size", "6px")
      .style("text-transform", "none");

    // Reseta a opacidade de todos os nós
    nodeGroup.selectAll(".node").transition().duration(300).style("opacity", 1);

    // Reseta a opacidade de todos os links
    linkGroup
      .selectAll(".link")
      .transition()
      .duration(300)
      .style("opacity", 0.6);
  }

  // Reinicia a simulação
  if (simulation) {
    simulation.alpha(0.3).restart();
  }
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

// Função para exibir o CARD de Perfil
function exibirPerfil(designerData) {
  const nome = designerData.Nome || designerData.id;
  const areaDesign = designerData["Área do design"];
  const nasc = designerData["Data de nascimento"];
  const morte = designerData["Data de falecimento (se houver)"];
  const linkExterno = designerData["Links extras"];
  const minibio = designerData.Minibio;

  // Localização: Cidade > Estado > Local de nascimento (com trim para remover espaços)
  const localNascimento =
    (designerData.Cidade && designerData.Cidade.trim()) ||
    (designerData.Estado && designerData.Estado.trim()) ||
    (designerData["Local de nascimento"] &&
      designerData["Local de nascimento"].trim());

  // Mostrar o nome
  d3.select("#perfil-nome").text(nome);

  // Montar card com informações disponíveis desta pessoa específica
  const cardInfo = document.getElementById("card-info");
  if (cardInfo) {
    cardInfo.innerHTML = ""; // limpa o anterior

    // Adicionar Área se existir
    if (areaDesign && areaDesign.trim() !== "") {
      const pArea = document.createElement("p");
      const strongArea = document.createElement("strong");
      strongArea.textContent = "Área(s): ";
      pArea.appendChild(strongArea);
      pArea.appendChild(document.createTextNode(areaDesign.trim()));
      cardInfo.appendChild(pArea);
    }

    // Adicionar Local se existir
    if (localNascimento && localNascimento !== "") {
      const pLocal = document.createElement("p");
      const strongLocal = document.createElement("strong");
      strongLocal.textContent = "Local: ";
      pLocal.appendChild(strongLocal);
      pLocal.appendChild(document.createTextNode(localNascimento));
      cardInfo.appendChild(pLocal);
    }

    // Adicionar Vida se tiver data de nascimento
    if (nasc && !isNaN(nasc)) {
      const anoNascimento = Math.floor(nasc);
      const currentYear = new Date().getFullYear();

      let anosVida;
      if (morte && !isNaN(morte)) {
        const anoMorte = Math.floor(morte);
        anosVida = `${anoNascimento} - ${anoMorte} (${
          anoMorte - anoNascimento
        } anos)`;
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

  // Mostrar descrição apenas se existir
  const descEl = document.getElementById("perfil-descricao");
  if (descEl) {
    if (minibio && minibio.trim() !== "") {
      descEl.textContent = minibio;
      descEl.style.display = "block";
    } else {
      descEl.innerHTML = ""; // limpa mas não esconde
      descEl.style.display = "none";
    }
  }

  // Mostrar botão apenas se houver link válido
  const btnLink = d3.select("#btn-link-externo");
  if (linkExterno && linkExterno.startsWith("http")) {
    btnLink
      .attr("href", linkExterno)
      .attr("target", "_blank")
      .text("Acessar Portfólio")
      .style("display", "inline-block");
  } else {
    btnLink.style("display", "none");
  }
}
