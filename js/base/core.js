// NÚCLEO DA APLICAÇÃO
// Reúne constantes compartilhadas, estado mutável dos filtros e grupos D3.
// Deve ser carregado antes dos módulos de grafo, filtros e interface.

const VBOX_WIDTH = 950;
const VBOX_HEIGHT = 500;
const LABEL_OFFSET_ABOVE_PX = 6;
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
