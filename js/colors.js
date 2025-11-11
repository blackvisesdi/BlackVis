const CATEGORY_COLORS = {
  Serviço: "#F14505",
  Interação: "#D930AC",
  Produto: "#FFD417",
  Comunicação: "#0511F2",
  Teórico: "#22CC1D",
};
const FALLBACK_COLOR = "#a9a9a9"; // Cor para nós "órfãos"
//TODO: Resolver o gradiente das cores dos filhos


// Escalas
const color = d3.scaleOrdinal(d3.schemeCategory10);

const axisColorsNormalized = {};
Object.keys(CATEGORY_COLORS).forEach((k) => {
  axisColorsNormalized[normalizeKey(k)] = CATEGORY_COLORS[k];
});


// Esses mapas serão preenchidos após carregar dados
let nodeAreaMap = new Map();
let inferredPersonArea = new Map();


function buildColorMaps() {
  // limpa
  nodeAreaMap = new Map();
  inferredPersonArea = new Map();

  allNodes.forEach((n) => {
    if (n.isCategory) {
      nodeAreaMap.set(n.id, n.id);
    } else if (n.isTechnique && n["Área do design"]) {
      nodeAreaMap.set(n.id, n["Área do design"]);
    } else if (n["Área do design"]) {
      nodeAreaMap.set(n.id, n["Área do design"]);
    }
  });

  allLinks.forEach((l) => {
    const s = getId(l.source);
    const t = getId(l.target);

    const nodeS = allNodes.find((n) => n.id === s);
    const nodeT = allNodes.find((n) => n.id === t);

    if (nodeAreaMap.has(t) && !(nodeS && nodeS.isCategory)) {
      const area = nodeAreaMap.get(t);
      if (area && !inferredPersonArea.has(s)) inferredPersonArea.set(s, area);
    }
    if (nodeAreaMap.has(s) && !(nodeT && nodeT.isCategory)) {
      const area = nodeAreaMap.get(s);
      if (area && !inferredPersonArea.has(t)) inferredPersonArea.set(t, area);
    }
  });
}

function getBaseColorForNode(node) {
  if (node.isCategory) {
    const key = normalizeKey(node.id);
    return axisColorsNormalized[key] || FALLBACK_COLOR;
  }

  const areaFromNode = node["Área do design"];
  if (areaFromNode) {
    const key = normalizeKey(areaFromNode);
    if (axisColorsNormalized[key]) return axisColorsNormalized[key];
  }

  const inferred = inferredPersonArea.get(node.id);
  if (inferred) {
    const key = normalizeKey(inferred);
    if (axisColorsNormalized[key]) return axisColorsNormalized[key];
  }

  if (nodeAreaMap.has(node.id)) {
    const area = nodeAreaMap.get(node.id);
    const key = normalizeKey(area);
    if (axisColorsNormalized[key]) return axisColorsNormalized[key];
  }

  return FALLBACK_COLOR;
}