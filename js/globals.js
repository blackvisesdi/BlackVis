const VBOX_WIDTH = 950;
const VBOX_HEIGHT = 500;

// --- CONFIGURAÇÃO DO SLIDER DE INTERVALO ---
const YEAR_MIN_DEFAULT = 1900;
const YEAR_MAX_DEFAULT = new Date().getFullYear();

const AppState = {
  currentMin: null,
  currentMax: null,
  currentCategory: "all",
  currentNationality: "all",
  currentPeriod: "all",
  activeNode: null,

  set(key, value) {
    this[key] = value;
  },
  get(key) {
    return this[key];
  },
};

const svg = d3
  .select("#grafico-d3")
  .attr("viewBox", `0 0 ${VBOX_WIDTH} ${VBOX_HEIGHT}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "100%");

const linkGroup = svg.append("g").attr("class", "links");
const nodeGroup = svg.append("g").attr("class", "nodes");
const labelGroup = svg.append("g").attr("class", "labels");

let simulation;
let graphData = { nodes: [], links: [] };
let allNodes = [];
let allLinks = [];
let activeNode = null;

let radiusScale = d3.scaleSqrt().range([8, 30]);

const DEBUG = location.hostname === "localhost" || location.hostname === "";

function showToast(msg, tipo = "info") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 8px; font-size: 14px;
      font-family: sans-serif; z-index: 9999; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  const cores = {
    info: { bg: "#185FA5", text: "#fff" },
    erro: { bg: "#A32D2D", text: "#fff" },
    ok: { bg: "#3B6D11", text: "#fff" },
  };
  const c = cores[tipo] || cores.info;
  toast.textContent = msg;
  toast.style.background = c.bg;
  toast.style.color = c.text;
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}

// --- DEFINIR PROPRIEDADES GLOBAIS ---
Object.defineProperty(window, "currentMin", {
  get: () => AppState.get("currentMin"),
  set: (v) => AppState.set("currentMin", v),
  configurable: true,
});

Object.defineProperty(window, "currentMax", {
  get: () => AppState.get("currentMax"),
  set: (v) => AppState.set("currentMax", v),
  configurable: true,
});

Object.defineProperty(window, "currentCategory", {
  get: () => AppState.get("currentCategory"),
  set: (v) => AppState.set("currentCategory", v),
  configurable: true,
});

Object.defineProperty(window, "currentNationality", {
  get: () => AppState.get("currentNationality"),
  set: (v) => AppState.set("currentNationality", v),
  configurable: true,
});

Object.defineProperty(window, "currentPeriod", {
  get: () => AppState.get("currentPeriod"),
  set: (v) => AppState.set("currentPeriod", v),
  configurable: true,
});

// ============================================================
// UTILS 
// ============================================================
function normalizeKey(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const getId = (v) => (typeof v === "object" ? v.id : v);

// ============================================================
// COLORS
// ============================================================
const CATEGORY_COLORS = {
  Serviço: "#E55E2D",
  Interação: "#E51792",
  Produto: "#FACB32",
  Comunicação: "#226AFF",
  Teórico: "#45CC3E",
};

// Cores secundárias por categoria (saturação 55% - textos grandes)
const CATEGORY_COLORS_55 = {
  Serviço: "#E58967",
  Interação: "#E578BA",
  Produto: "#FADA71",
  Comunicação: "#628CD9",
  Teórico: "#56B250",
};

// Cores terciárias por categoria (saturação 30% - textos menores)
const CATEGORY_COLORS_30 = {
  Serviço: "#E1AF9D",
  Interação: "#CC8FB3",
  Produto: "#FAE8AF",
  Comunicação: "#98AFD9",
  Teórico: "#92CC8F",
};
const FALLBACK_COLOR = "#fff";

const SATURATION_PALETTE = {
  LARANJA: { 1:"#F75E40",2:"#F88D53",3:"#F7B064",4:"#F8A579",5:"#F9B18D",6:"#FABCA0",7:"#FBECD3" },
  ROSA:    { 1:"#C0157A",2:"#D1299A",3:"#DF4DB4",4:"#E872C4",5:"#EF96D3",6:"#F5B8E2",7:"#FAD9F0" },
  AMARELO: { 1:"#FFDE4C",2:"#FFE25E",3:"#FFE572",4:"#FFEB82",5:"#FFED93",6:"#FFF1A5",7:"#FFF2B7" },
  AZUL:    { 1:"#3F47F6",2:"#555AF7",3:"#666C78",4:"#797EF9",5:"#8C91F9",6:"#9FA3FA",7:"#B2B5FB" },
  VERDE:   { 1:"#54D850",2:"#65DC62",3:"#76E073",4:"#87E485",5:"#99E796",6:"#AAEBAB",7:"#BBEEB9" },
};

const CATEGORY_PALETTE_MAP = {
  Serviço: "LARANJA",
  Interação: "ROSA",
  Produto: "AMARELO",
  Comunicação: "AZUL",
  Teórico: "VERDE",
};

const TECHNIQUE_BRIGHTNESS = 0.6;

// TECNICA_DESCRICOES, AREA_DESCRICOES e ADINKRA_INFO são carregados
// a partir de data/areas.json pelo data.js e expostos em window.

// Ícones das categorias (usados no filtro e nos nós do grafo)
const CATEGORY_ICON_PATH = {
  "Comunicação": "./assets/icons/comunica/Adinkra_Comunicação.png",
  "Produto":     "./assets/icons/produ/Adinkra-05.png",
  "Teórico":     "./assets/icons/teori/Adinkra_Teórico.png",
  "Interação":   "./assets/icons/intera/Adinkra_Interação.png",
  "Serviço":     "./assets/icons/servi/Adinkra_Serviço.png",
};

const axisColorsNormalized = {};
Object.keys(CATEGORY_COLORS).forEach((k) => {
  axisColorsNormalized[normalizeKey(k)] = CATEGORY_COLORS[k];
});

let nodeAreaMap = new Map();
let inferredPersonArea = new Map();

function buildColorMaps(nodes, links) {
  nodeAreaMap = new Map();
  inferredPersonArea = new Map();

  nodes.forEach((n) => {
    if (n.isCategory) {
      nodeAreaMap.set(n.id, n.id);
    } else if (n.isTechnique && n["Área do design"]) {
      nodeAreaMap.set(n.id, n["Área do design"]);
    } else if (n["Área do design"]) {
      nodeAreaMap.set(n.id, n["Área do design"]);
    }
  });

  links.forEach((l) => {
    const s = getId(l.source);
    const t = getId(l.target);
    const nodeS = nodes.find((n) => n.id === s);
    const nodeT = nodes.find((n) => n.id === t);

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
  let areaName = null;

  if (node.isCategory) {
    areaName = node.id;
  } else {
    areaName = node["Área do design"] || inferredPersonArea.get(node.id) || nodeAreaMap.get(node.id);
  }

  if (node.isCategory) {
    const paletteName = CATEGORY_PALETTE_MAP[areaName];
    if (paletteName && SATURATION_PALETTE[paletteName]) return SATURATION_PALETTE[paletteName][1];
    return FALLBACK_COLOR;
  }

  const paletteName = CATEGORY_PALETTE_MAP[areaName];
  const saturationLevel = node.saturationLevel || 4;

  if (paletteName && SATURATION_PALETTE[paletteName]) {
    return SATURATION_PALETTE[paletteName][Math.max(1, Math.min(7, saturationLevel))] || FALLBACK_COLOR;
  }
  return FALLBACK_COLOR;
}

// ============================================================
// CONFIGURAÇÕES DE VISUALIZAÇÃO
// ============================================================
window.selectedCategories = new Set();

window.DBG_TECH_RADIUS_MULT = 1.0;
window.DBG_AREA_RADIUS_MULT = 1.0;
window.DBG_LINK_WIDTH_MULT = 2.09;
window.DBG_HOVER_NAMES = true;
window.DBG_PERSON_NAME_SIZE = 14;
window.DBG_ALL_NAMES_VISIBLE = false;
