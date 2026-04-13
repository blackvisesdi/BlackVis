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
// UTILS (de utils.js)
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
// COLORS (de colors.js)
// ============================================================
const CATEGORY_COLORS = {
  Serviço: "#F14505",
  Interação: "#D930AC",
  Produto: "#FFD417",
  Comunicação: "#0511F2",
  Teórico: "#22CC1D",
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
const PERSON_BRIGHTNESS = 1.2;

// ============================================================
// DESCRIÇÕES DE TÉCNICAS E ÁREAS
// ============================================================
const TECNICA_DESCRICOES = {
  "Design gráfico":               "Prática de combinar tipografia, fotografia, ilustração e layout para comunicação visual.",
  "Ilustração":                   "Criação de representações visuais para identificar, decorar ou complementar um conceito.",
  "Tipografia":                   "Criação de famílias e experimentos tipográficos.",
  "Direção de arte":              "Supervisão criativa do estilo visual e das imagens em projetos de mídia e publicidade.",
  "Produção audiovisual":         "Criação de imagens em movimento, incluindo filmes, vídeos.",
  "Fotografia":                   "Arte e prática de criar imagens através do registro da luz.",
  "Videografismo":                "Criação de imagens em movimento: motion design, efeitos especiais e animação.",
  "Design editorial":             "Estruturar conteúdo para publicação.",
  "Identidade visual":            "Criação de marcas e suas aplicações.",
  "Design de superfície":         "Desenho de padronagens e estampas corridas e aplicadas.",
  "Arte urbana":                  "Expressão artística no espaço urbano — grafite, murais e intervenções públicas.",
  "Design de objetos industriais":"Projeto de bens de consumo para produção em massa.",
  "Design de mobiliário":         "Projeto de móveis.",
  "Moda e têxtil":                "Projeto de tecidos, padronagens, roupas e figurinos.",
  "Escultura":                    "Criação de formas de arte tridimensionais manuais.",
  "Prática 3D":                   "Criação de arte tridimensional digital.",
  "Design de interiores":         "Organização de espaços internos.",
  "Design de adereços":           "Design de adornos como bolsas, sapatos, joias.",
  "Embalagem":                    "Estrutura tridimensional da embalagem com escolha de materiais e a ergonomia.",
  "UI Design de interface":       "Design da interface gráfica de produtos digitais.",
  "Programação":                  "Implementação técnica de projetos digitais usando linguagens de programação.",
  "Instalações interativas":      "Criação de ambientes que respondem à interação do usuário.",
  "Arte digital":                 "Criação de obras que respondem à interação do usuário.",
  "UX Experiência do usuário":    "Projetos de pesquisa, análise e conceituação de produtos digitais.",
  "Realidades mistas":            "Projetos em realidade virtual e aumentada.",
  "CX Experiência do Cliente":    "Planejamento das percepções e sentimentos de uma cliente em suas interações com uma empresa.",
  "Design para impacto social":   "Aplicação do design para resolver problemas sociais e serviços públicos complexos na promoção do bem-estar cívico.",
  "Branding":                     "Gestão estratégica da identidade de uma marca.",
  "Curadoria":                    "Experiência de visitação em projetos expográficos.",
  "Economia criativa":            "Se utiliza da criatividade para conceber novos modelos, oferecer soluções, proporcionar rentabilidade e lucro social.",
  "Educação":                     "Formação da próxima geração de designers e de instituições acadêmicas.",
  "Escrita e publicação":         "Autoria de textos críticos, histórico e teórico do design.",
  "Ativismo e justiça social":    "Uso do design como ferramenta para advocacy e mudança social.",
  "Relações étnico-raciais":      "Questionamento e desmantelamento das fundações eurocêntricas do design.",
  "Design e gênero":              "Ampliar as narrativas e questionar as hegemonias presentes no design.",
};

const AREA_DESCRICOES = {
  "Comunicação": "Área que reúne práticas visuais orientadas à transmissão de mensagens — design gráfico, tipografia, fotografia e produção audiovisual.",
  "Produto":     "Área focada na criação de objetos, vestuário e espaços físicos que unem função e estética.",
  "Interação":   "Área dedicada à criação de experiências digitais e interfaces entre pessoas e tecnologias.",
  "Serviço":     "Área que projeta experiências e sistemas orientados ao relacionamento entre pessoas e organizações.",
  "Teórico":     "Área que desenvolve conhecimento crítico, histórico e pedagógico sobre design e cultura visual.",
};

// Informações sobre os adinkras de cada área
const ADINKRA_INFO = {
  "Comunicação": {
    nome: "Funtumfunefu Denkyemfunefu",
    descricao: "Crocodilos siameses. Um símbolo de unidade na diversidade que dá um destino comum; compartilhamento; do provérbio, \"Funtumfrafu denkyemfrafu, wowo yafunu koro nanso wonya biribi a wofom efiri se aduane no de no yete no wo menetwitwie mu\", a saber, Funtumfrafu e Denkyemfrafu compartilham um estômago, mas quando conseguem algo (comida), eles se esforçam por isso porque a doçura da comida é sentida quando ela passa pela garganta.",
  },
  "Produto": {
    nome: "Kokuromotie",
    descricao: "Polegar. Símbolo de cooperação, participação, trabalho em equipe, indispensabilidade e harmonia. Do provérbio \"Yensiane yokokuromotie ho mmo po\", que significa \"Não se ignora o polegar para dar um no\". Qualquer pessoa que tente o exercício de dar um no sem os polegares rapidamente entenderá este provérbio.",
  },
  "Interação": {
    nome: "Ese ne Tekrema",
    descricao: "Dentes e língua. Símbolo de aperfeiçoamento, progresso, crescimento, necessidade de amizade e interdependência.",
  },
  "Serviço": {
    nome: "Owo Fôrum Adobe",
    descricao: "Uma cobra sobe em uma palmeira de ráfia. Um símbolo de engenhosidade, excelência, desempenho e realização do incomum ou impossível.",
  },
  "Teórico": {
    nome: "Sankofa",
    descricao: "Este coração estilizado com espirais é uma representação alternativa do símbolo Sankofa. As espirais representam o retorno ao passado, às raízes, para extrair lições para o presente e o futuro.",
  },
};

// Ícones das categorias (usados no filtro e nos nós do grafo)
const CATEGORY_ICON_PATH = {
  "Comunicação": "./assets/icons/comunica/Adinkra_Comunicação.png",
  "Produto":     "./assets/icons/produ/Adinkra-05.png",
  "Teórico":     "./assets/icons/teori/Adinkra_Teórico.png",
  "Interação":   "./assets/icons/intera/Adinkra_Interação.png",
  "Serviço":     "./assets/icons/servi/Adinkra_Serviço.png",
};

const color = d3.scaleOrdinal(d3.schemeCategory10);

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
