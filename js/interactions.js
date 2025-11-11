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

  // Reseta o foco se clicar no mesmo nó
  if (focusedNode && focusedNode.id === d.id) {
    resetFocus(focusedNode);
    focusedNode = null;
    return;
  }

  focusedNode = d;

  const neighbors = new Set();
  const adjacentLinks = [];
  neighbors.add(d.id);

  graphData.links.forEach((link) => {
    if (link.source.id === d.id) {
      neighbors.add(link.target.id);
      adjacentLinks.push(link);
    } else if (link.target.id === d.id) {
      neighbors.add(link.source.id);
      adjacentLinks.push(link);
    }
  });

  // Efeitos visuais de foco
  linkGroup
    .selectAll(".link")
    .attr("stroke-opacity", (l) => (adjacentLinks.includes(l) ? 1.0 : 0.3));

  nodeGroup
    .selectAll(".node")
    .attr("fill-opacity", (d_node) => (neighbors.has(d_node.id) ? 1.0 : 0.3))
    .attr("stroke-width", (d_node) => (d_node.id === d.id ? 3 : 1.5))
    .attr("r", (d_node) =>
      d_node.id === d.id ? nodeRadius(d) * 1.5 : nodeRadius(d_node)
    );

  labelGroup
    .selectAll(".label")
    .attr("fill-opacity", (d_label) => (neighbors.has(d_label.id) ? 1.0 : 0.3));

  // Exibição do Perfil
  const hasProfileInfo = d["Área do design"] || d.isCategory;

  if (hasProfileInfo) {
    exibirPerfil(d);
  } else {
    d3.select("#card").style("display", "none");
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
  if (simulation) {
    simulation.alphaTarget(0).restart();
  }
  focusedNode = null;
  d3.select("#card").style("display", "none");
}

// Função para exibir o CARD de Perfil
function exibirPerfil(designerData) {
  const container = d3.select("#card");

  const nome = designerData.Nome || designerData.id;
  const areaDesign = designerData["Área do design"];

  
  const nasc = designerData["Data de nascimento"];
  const morte = designerData["Data de falecimento (se houver)"];
  const linkExterno = designerData["Links extras"];
  const localNascimento =
    designerData.Cidade ||
    designerData.Estado ||
    designerData["Local de nascimento"] ||
    "Não informado";
  const minibio =
    designerData.Minibio ||
    (designerData.isCategory
      ? "Agrupa designers da área: " + designerData.id
      : "Sem descrição disponível.");

  const currentYear = new Date().getFullYear();

  // Formatação do Período de Vida (NASCIMENTO - MORTE (IDADE)) ---
  let anosVida;

  if (nasc && !isNaN(nasc)) {
    const anoNascimento = Math.floor(nasc);
    let idade;

    if (morte && !isNaN(nasc)) {
      // Caso MORTO: Exemplo: 1989 - 2000 (X anos)
      const anoMorte = Math.floor(morte);
      idade = anoMorte - anoNascimento;
      anosVida = `${anoNascimento} - ${anoMorte} (${idade} anos)`;
    } else {
      // Caso VIVO: Exemplo: 1989 (X anos)
      idade = currentYear - anoNascimento;
      anosVida = `${anoNascimento} (${idade} anos)`;
    }
  } else {
    // Caso não tenha Data de Nascimento
    anosVida = "Indisponível";
  }
  
  d3.select("#perfil-nome").text(nome);

  // d3.select("#perfil-tecnica").text(tecnicas);
  d3.select("#card-info").html(`
    <p><strong>Área(s):</strong> ${areaDesign}</p>
    <p><strong>Local:</strong> ${localNascimento}</p>
    <p><strong>Vida:</strong> ${anosVida}</p>
  `);

  d3.select("#perfil-descricao").html(minibio);

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

// d3.select("#fechar-perfil").on("click", () => {
//   d3.select("#card").style("display", "none");
//   if (focusedNode) {
//     resetFocus(focusedNode);
//   }
// });
