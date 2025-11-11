// Multiplicadores de tamanho por tipo
const MULT_CATEGORY = 1.6; // categorias — maiores
const MULT_TECHNIQUE = 0.9; // técnicas — intermediárias
const MULT_PERSON = 0.45; // pessoas — bem menores

const MIN_RADIUS_CATEGORY = 18;
const MIN_RADIUS_TECHNIQUE = 8;
const MIN_RADIUS_PERSON = 4;

const COLLISION_PADDING = 6;


function nodeRadius(d) {

  const base = Math.max(radiusScale(d.degree || 1), 1);

  let r;
  if (d.isCategory) {
    r = base * MULT_CATEGORY;
    r = Math.max(r, MIN_RADIUS_CATEGORY);
  } else if (d.isTechnique) {
    r = base * MULT_TECHNIQUE;
    r = Math.max(r, MIN_RADIUS_TECHNIQUE);
  } else {
    // pessoa (ou outros)
    r = base * MULT_PERSON;
    r = Math.max(r, MIN_RADIUS_PERSON);
  }

  return r;
}

function drawForceGraph(data) {
  graphData.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  graphData.links = Array.isArray(data.links) ? data.links : [];

  // Para a simulação anterior
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

        // Define a distancia um do outro
        .distance(50)
    )
    // Impede que todos se amontoem no centro
    .force("charge", d3.forceManyBody().strength(-100))

    // "Gravidade"
    .force("center", d3.forceCenter(width / 2, height / 2).strength(1.0))

    // Colisão baseada no raio calculado
    .force("collide",
      d3
        .forceCollide()
        .radius((d) => nodeRadius(d) + COLLISION_PADDING).strength(0.9)
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
   
    .join("g")
    .attr("class", "node")
    .call(drag(simulation))
    .on("click", (event, d) => {
      if (d.isTechnique && window.applyTechniqueFilter) {
        window.applyTechniqueFilter(d.Nome);
      }
      if (typeof focusNode === "function") {
        focusNode(event, d);
      }
    });

  node.selectAll(".node-shape").remove();

  node.each(function (d) {
    const r = nodeRadius(d);
    const element = d3.select(this);
    const fill = getNodeFillColor(d);
    const stroke = getNodeStrokeColor(d);

    if (d.isTechnique) {
      element
        .append("circle")
        .attr("r", r)
        .attr("class", "node-background-circle")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5);

      // TODO: TESTE | Pegar um svg de cada
      const svgSource = "../assets/Ilustração.svg";
      const size = r * 2;

      element
        .append("image")
        .attr("xlink:href", svgSource)
        .attr("class", "node-shape technique-image")
        .attr("width", size)
        .attr("height", size)
        .attr("x", -r)
        .attr("y", -r);
    } else {
      element
        .append("circle")
        .attr("r", r)
        .attr("class", "node-shape circle-shape")
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5);
    }
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

  // Função TICK da simulação (loop da animação)
  simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node
        .each(function(d) {
                  const r = nodeRadius(d); 
                  d.x = Math.max(r, Math.min(width - r, d.x));
                  d.y = Math.max(r, Math.min(height - r, d.y));
              })
              .attr("transform", (d) => `translate(${d.x},${d.y})`);

          labels.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  simulation.alpha(0.5).restart();
}


function getNodeFillColor(d) {
  const baseHex = getBaseColorForNode(d);

  if (d.isCategory) {
    return baseHex;
  }
  if (d.isTechnique) {
    try {
      return d3.rgb(baseHex).brighter(TECHNIQUE_BRIGHTNESS).toString();
    } catch (e) {
      return baseHex;
    }
  }
  // Pessoa
  try {
    return d3.rgb(baseHex).brighter(PERSON_BRIGHTNESS).toString();
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