const CATEGORY_COLORS = {
  Serviço: "#F14505",
  Interação: "#D930AC",
  Produto: "#FFD417",
  Comunicação: "#0511F2",
  Teórico: "#22CC1D",
};
const FALLBACK_COLOR = "#fff"; // Cor para nós "órfãos"

const SATURATION_PALETTE = {
  LARANJA: {
    1: "#F75E40",
    2: "#F88D53",
    3: "#F7B064",
    4: "#F8A579",
    5: "#F9B18D",
    6: "#FABCA0",
    7: "#FBECD3",
  },
  ROSA: {
    1: "#E241BE",
    2: "#E37C5C",
    3: "#E8B5C8",
    4: "#E9D022",
    5: "#E5DA0B",
    6: "#F0B00F",
    7: "#FAC0E5",
  },
  AMARELO: {
    1: "#FFDE4C",
    2: "#FFE25E",
    3: "#FFE572",
    4: "#FFEB82",
    5: "#FFED93",
    6: "#FFF1A5",
    7: "#FFF2B7",
  },
  AZUL: {
    1: "#3F47F6",
    2: "#555AF7",
    3: "#666C78",
    4: "#797EF9",
    5: "#8C91F9",
    6: "#9FA3FA",
    7: "#B2B5FB",
  },
  VERDE: {
    1: "#54D850",
    2: "#65DC62",
    3: "#76E073",
    4: "#87E485",
    5: "#99E796",
    6: "#AAEBAB",
    7: "#BBEEB9",
  },
};

const CATEGORY_PALETTE_MAP = {
  Serviço: "LARANJA",
  Interação: "ROSA",
  Produto: "AMARELO",
  Comunicação: "AZUL",
  Teórico: "VERDE",
};


// Escalas
const color = d3.scaleOrdinal(d3.schemeCategory10);

const axisColorsNormalized = {};
Object.keys(CATEGORY_COLORS).forEach((k) => {
  axisColorsNormalized[normalizeKey(k)] = CATEGORY_COLORS[k];
});


// Esses mapas serão preenchidos após carregar dados
let nodeAreaMap = new Map();
let inferredPersonArea = new Map();


function buildColorMaps(nodes, links) {
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
  // 1. Encontra a Área/Categoria Principal 

  let areaKey = null; // Armazenará a chave normalizada da área
  let areaName = null; // Armazenará o nome da área (ex: "Serviço")

  if (node.isCategory) {
    areaName = node.id;
  } else {
    areaName =
      node["Área do design"] ||
      inferredPersonArea.get(node.id) ||
      nodeAreaMap.get(node.id);
  }

  if (areaName) {
    areaKey = normalizeKey(areaName) || FALLBACK_COLOR;
  }

  // 2. Se for uma Categoria, use a cor mais escura/saturada (nível 1)
  if (node.isCategory) {
    const paletteName = CATEGORY_PALETTE_MAP[areaName];
    if (paletteName && SATURATION_PALETTE[paletteName]) {
      return SATURATION_PALETTE[paletteName][1]; // Nível 1 é a cor base mais escura
    }
    return FALLBACK_COLOR;
  }
  const paletteName = CATEGORY_PALETTE_MAP[areaName];

  const saturationLevel = node.saturationLevel || 4;

  if (paletteName && SATURATION_PALETTE[paletteName]) {
    // Note que Math.max e Math.min estão na mesma linha do return
    return (
      SATURATION_PALETTE[paletteName][
        Math.max(1, Math.min(7, saturationLevel))
      ] || FALLBACK_COLOR
    );
  }

  return FALLBACK_COLOR;
}