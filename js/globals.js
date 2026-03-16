const VBOX_WIDTH = 950;
const VBOX_HEIGHT = 500;
const width = VBOX_WIDTH;
const height = VBOX_HEIGHT;

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
let focusedNode = null;

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
