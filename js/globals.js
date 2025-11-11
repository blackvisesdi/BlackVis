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


let radiusScale = d3.scaleSqrt().range([8, 30]);

// --- CONFIGURAÇÃO DO SLIDER DE INTERVALO ---
const YEAR_MIN_DEFAULT = 1900;
const YEAR_MAX_DEFAULT = new Date().getFullYear();

let currentMin = YEAR_MIN_DEFAULT;
let currentMax = YEAR_MAX_DEFAULT;