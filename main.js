const VBOX_WIDTH = 950;
const VBOX_HEIGHT = 500;
const width = VBOX_WIDTH; 
const height = VBOX_HEIGHT; 

const svg = d3
  .select("#grafico-d3")
  
  .attr("viewBox", `0 0 ${VBOX_WIDTH} ${VBOX_HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const linkGroup = svg.append("g").attr("class", "links");
const nodeGroup = svg.append("g").attr("class", "nodes");
const labelGroup = svg.append("g").attr("class", "labels");

let simulation;
let graphData = { nodes: [], links: [] };
let allNodes = [];
let allLinks = [];
let focusedNode = null;

// Escalas
const color = d3.scaleOrdinal(d3.schemeCategory10);
let radiusScale = d3.scaleSqrt().range([8, 30]);

// --- 2. CONFIGURAÇÃO DO SLIDER DE INTERVALO ---
const YEAR_MIN_DEFAULT = 1900;
const YEAR_MAX_DEFAULT = new Date().getFullYear();

let currentMin = YEAR_MIN_DEFAULT;
let currentMax = YEAR_MAX_DEFAULT;

const sliderMargin = { top: 10, right: 30, bottom: 0, left: 30 };
const sliderWidth = 690;

const xSlider = d3
  .scaleLinear()
  .domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT])
  .range([0, sliderWidth])
  .clamp(true);

// --- 3. FUNÇÕES DE PRÉ-PROCESSAMENTO E CÁLCULO DE GRAU ---
function preprocessGraphData(data) {
  const originalNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const originalLinks = Array.isArray(data.links) ? data.links : [];

  const categoryNodes = new Map();
  const newLinks = [...originalLinks];

  const designerNodes = originalNodes.filter((d) => d["Área do design"]);

  designerNodes.forEach((dNode) => {
    const areaData = dNode["Área do design"];
    let areasToLink = [];

    if (Array.isArray(areaData)) {
      areasToLink = areaData;
    } else if (typeof areaData === "string" && areaData.includes(",")) {
      areasToLink = areaData.split(",").map((a) => a.trim());
    } else if (typeof areaData === "string") {
      areasToLink = [areaData.trim()];
    }

    areasToLink = areasToLink.filter((a) => a.length > 0);

    areasToLink.forEach((subArea) => {
      const categoryId = subArea;

      if (!categoryNodes.has(categoryId)) {
        categoryNodes.set(categoryId, {
          id: categoryId,
          Nome: categoryId,
          type: "category",
          isCategory: true,
        });
      }

      newLinks.push({
        source: dNode.id,
        target: categoryId,
        type: "category-link",
      });
    });
  });

  const finalNodes = [...originalNodes];

  categoryNodes.forEach((catNode) => {
    if (!originalNodes.some((n) => n.id === catNode.id)) {
      finalNodes.push(catNode);
    }
  });

  return {
    nodes: finalNodes,
    links: newLinks,
  };
}

function calculateNodeDegree(nodes, links) {
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  links.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;

    if (degreeMap.has(sourceId)) {
      degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
    }
    if (degreeMap.has(targetId)) {
      degreeMap.set(targetId, degreeMap.get(targetId) + 1);
    }
  });

  nodes.forEach((node) => {
    node.degree = degreeMap.get(node.id) || 0;
  });

  return nodes;
}

// --- 4. FUNÇÕES DE INTERAÇÃO (DRAG, FOCUS, PERFIL) ---

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
  if (event) event.stopPropagation(); // Essencial

  // Reseta o foco se clicar no mesmo nó
  if (focusedNode && focusedNode.id === d.id) {
    resetFocus(focusedNode);
    d3.select("#perfil-container").style("display", "none");
    focusedNode = null;
    return;
  }

  if (focusedNode) {
    resetFocus(focusedNode);
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
      d_node.id === d.id
        ? radiusScale(d.degree) * 1.5
        : radiusScale(d_node.degree)
    );

  labelGroup
    .selectAll(".label")
    .attr("fill-opacity", (d_label) => (neighbors.has(d_label.id) ? 1.0 : 0.3));

  // Exibição do Perfil (correção de bug anterior)
  const hasProfileInfo = d["Área do design"] || d.isCategory;

  if (hasProfileInfo) {
    exibirPerfil(d);
  } else {
    d3.select("#perfil-container").style("display", "none");
  }

 
  const offset = width * 0.2;
  d.fx = width / 2 + offset;
  d.fy = height / 2;
  simulation.alphaTarget(0.1).restart();
}

function resetFocus(d) {
  linkGroup.selectAll(".link").attr("stroke-opacity", 0.6);
  nodeGroup
    .selectAll(".node")
    .attr("fill-opacity", 1.0)
    .attr("stroke-width", 1.5)
    .attr("r", (d_node) => radiusScale(d_node.degree));
  labelGroup.selectAll(".label").attr("fill-opacity", 1.0);

  if (d) {
    d.fx = null;
    d.fy = null;
  }
  if (simulation) {
    simulation.alphaTarget(0).restart();
  }
  focusedNode = null;
}

// Função para exibir o CARD de Perfil (correção de bug anterior)
function exibirPerfil(designerData) {
  const container = d3.select("#perfil-container");

  const nome = designerData.Nome || designerData.id;
  const tecnicas =
    designerData.Técnicas ||
    (designerData.isCategory ? "Nó de Categoria" : "N/A");
  const minibio =
    designerData.Minibio ||
    (designerData.isCategory
      ? "Agrupa designers da área: " + designerData.id
      : "Sem descrição disponível.");

  d3.select("#perfil-nome").text(nome);
  d3.select("#perfil-tecnica").text(tecnicas);
  d3.select("#perfil-descricao").html(minibio);

  container.style("display", "block").style("opacity", 1);
}

d3.select("#fechar-perfil").on("click", () => {
  d3.select("#perfil-container").style("display", "none");
  resetFocus(focusedNode);
});

// ------------------------------------------------------------------
// FUNÇÃO PRINCIPAL DO GRÁFICO
// ------------------------------------------------------------------

function drawForceGraph(data) {
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  if (simulation) {
    simulation.stop();
  }

  const allDegrees = graphData.nodes.map((d) => d.degree);
  const minDegree = d3.min(allDegrees) || 1;
  const maxDegree = d3.max(allDegrees) || 1;
  radiusScale.domain([minDegree, maxDegree]);

  // Inicializa a simulação
  simulation = d3
    .forceSimulation(graphData.nodes)
    .force(
      "link",
      d3
        .forceLink(graphData.links)
        .id((d) => d.id)
        .distance(50)
    )
    .force("charge", d3.forceManyBody().strength(-100))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(1.0))
    // Colisão baseada no raio calculado
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => radiusScale(d.degree) + 5)
        .strength(0.7)
    );

  // Padrão D3: Data Join para Links
  const link = linkGroup
    .selectAll(".link")
    .data(graphData.links, (d) => d.source.id + "-" + d.target.id)
    .join("line")
    .attr("class", "link")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2);

  // Padrão D3: Data Join para Nós
  const node = nodeGroup
    .selectAll(".node")
    .data(graphData.nodes, (d) => d.id)
    .join("circle")
    .attr("class", "node")
    .attr("r", (d) => radiusScale(d.degree))
    .attr("fill", (d) =>
      d.isCategory ? "#a9a9a9" : color(d["Área do design"])
    )
    .call(drag(simulation))
    // CHAMADA AJUSTADA: Passa 'event' e 'd'
    .on("click", (event, d) => {
      focusNode(event, d);
    });

  // Padrão D3: Data Join para Rótulos
  const labels = labelGroup
    .selectAll(".label")
    .data(graphData.nodes, (d) => d.id)
    .join("text")
    .attr("class", "label")
    .text((d) => {
      if (d.isCategory) return d.Nome;
     
      return d.Nome ? d.Nome.split(" ")[0] : d.id.split(" ")[0];
    })
    
    .attr("text-anchor", "middle") // Centraliza horizontalmente
    .attr("dominant-baseline", "central") // Centraliza verticalmente
    .style("font-size", "6px") // Fonte menor para caber
    .style("pointer-events", "none")
    .attr("fill", "#FFF")
    .append("title")
    .text((d) => d.Nome || d.id); // Adiciona Tooltip para o nome completo

  // Função TICK da simulação
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node
      .attr("cx", (d) => {
        return (d.x = Math.max(
          radiusScale(d.degree),
          Math.min(width - radiusScale(d.degree), d.x)
        ));
      })
      .attr("cy", (d) => {
        return (d.y = Math.max(
          radiusScale(d.degree),
          Math.min(height - radiusScale(d.degree), d.y)
        ));
      });

    labels.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  simulation.alpha(0.5).restart();
}

// ------------------------------------------------------------------
// LÓGICA DE FILTRAGEM
// ------------------------------------------------------------------

function filterGraphData(minYear, maxYear) {
  const filteredNodes = allNodes.filter(
    (d) =>
      d.isCategory ||
      !d.AnoNascimento ||
      (d.AnoNascimento >= minYear && d.AnoNascimento <= maxYear)
  );

  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));

  const filteredLinks = allLinks.filter((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
  });

  const filteredGraph = { nodes: filteredNodes, links: filteredLinks };
  drawForceGraph(filteredGraph);
}

// ------------------------------------------------------------------
// FUNÇÃO PRINCIPAL DO SLIDER
// ------------------------------------------------------------------

function initSlider(minYear, maxYear) {
  xSlider.domain([minYear, maxYear]);
  currentMin = minYear;
  currentMax = maxYear;

  const sliderSvg = d3
    .select("#dual-slider")
    .attr("width", sliderWidth + sliderMargin.left + sliderMargin.right)
    .attr("height", 40)
    .append("g")
    .attr("transform", `translate(${sliderMargin.left}, 20)`);

  const g = sliderSvg.append("g").attr("class", "slider");
  g.append("line")
    .attr("class", "track")
    .attr("x1", xSlider.range()[0])
    .attr("x2", xSlider.range()[1]);
  const trackActive = g
    .append("line")
    .attr("class", "track-active")
    .attr("x1", xSlider(currentMin))
    .attr("x2", xSlider(currentMax));

  const handleMin = g
    .append("circle")
    .attr("class", "handle handle-min")
    .attr("r", 10)
    .attr("cx", xSlider(currentMin))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMin)
        .on("end", dragended)
    );
  const handleMax = g
    .append("circle")
    .attr("class", "handle handle-max")
    .attr("r", 10)
    .attr("cx", xSlider(currentMax))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMax)
        .on("end", dragended)
    );

  function dragstarted(event) {
    d3.select(this).attr("r", 12).attr("stroke", "darkred");
  }
  function dragended(event) {
    d3.select(this).attr("r", 10).attr("stroke", "#e74c3c");
  }
  function draggedMin(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue < minYear) newValue = minYear;
    if (newValue > currentMax - 1) newValue = currentMax - 1;
    currentMin = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(currentMin));
    updateVisuals();
    filterGraphData(currentMin, currentMax);
  }
  function draggedMax(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue > maxYear) newValue = maxYear;
    if (newValue < currentMin + 1) newValue = currentMin + 1;
    currentMax = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(currentMax));
    updateVisuals();
    filterGraphData(currentMin, currentMax);
  }
  function updateVisuals() {
    trackActive.attr("x1", xSlider(currentMin)).attr("x2", xSlider(currentMax));
    d3.select("#value-min").text(currentMin);
    d3.select("#value-max").text(currentMax);
  }
  updateVisuals();
}

// ------------------------------------------------------------------
// CARREGAMENTO DOS DADOS
// ------------------------------------------------------------------

d3.json("data.json")
  .then((data) => {
    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(
      processedData.nodes,
      processedData.links
    );

    allNodes = processedData.nodes;
    allLinks = processedData.links;

    const designerNodes = allNodes.filter((d) => d.AnoNascimento);
    const minDataYear =
      d3.min(designerNodes, (d) => d.AnoNascimento) || YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, (d) => d.AnoNascimento) || YEAR_MAX_DEFAULT;

    drawForceGraph({ nodes: allNodes, links: allLinks });
    initSlider(minDataYear, maxDataYear);

    document.getElementById("value-min").textContent = minDataYear;
    document.getElementById("value-max").textContent = maxDataYear;
  })
  .catch((error) => {
    console.error(
      "Erro fatal ao carregar data.json. O arquivo não foi encontrado (404) ou a estrutura está incorreta.",
      error
    );
  });
