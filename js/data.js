// ============================================================
// DATA.JS — Pré-processamento, Filtros e Carregamento
// ============================================================

// Categorias válidas (Arte não aparece na visualização)
const VALID_CATEGORIES = ["Comunicação", "Produto", "Teórico", "Interação", "Serviço"];
// Técnicas sem SVG que não devem ser exibidas
const HIDDEN_TECHNIQUES = ["Colagem"];

// ===== PRÉ-PROCESSAMENTO =====

function preprocessGraphData(data) {
  // Aceita array plano OU {nodes, links}
  const originalNodes = Array.isArray(data)
    ? data
    : (Array.isArray(data.nodes) ? data.nodes : []);
  const originalLinks = Array.isArray(data)
    ? []
    : (Array.isArray(data.links) ? data.links : []);

  // Garante que cada nó tem campo id (usa Nome como fallback)
  originalNodes.forEach((n) => {
    if (!n.id) n.id = n.Nome || String(Math.random());
  });

  const categoryNodes = new Map();
  const techniqueNodes = new Map();
  const newLinks = [...originalLinks];

  const DESIGN_AREA_KEY = "Área do design";
  const TECHNIQUES_KEY  = "Técnicas";

  const designerNodes = originalNodes.filter(
    (d) => d[DESIGN_AREA_KEY] || d[TECHNIQUES_KEY]
  );

  designerNodes.forEach((dNode) => {
    const areaData = dNode[DESIGN_AREA_KEY];
    let areas = [];
    if (typeof areaData === "string") {
      areas = areaData
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && VALID_CATEGORIES.includes(a));
    }

    const tecnicasData = dNode[TECHNIQUES_KEY];
    let tecnicas = [];
    if (typeof tecnicasData === "string") {
      tecnicas = tecnicasData
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !HIDDEN_TECHNIQUES.includes(t));
    }

    let isLinkedViaTechnique = false;

    tecnicas.forEach((tecnicaName) => {
      isLinkedViaTechnique = true;
      const techniqueId = `TEC_${tecnicaName}`;

      if (!techniqueNodes.has(tecnicaName)) {
        techniqueNodes.set(tecnicaName, {
          id: techniqueId,
          Nome: tecnicaName,
          type: "technique",
          isTechnique: true,
          "Área do design": areas[0] || "Geral",
        });
      }

      newLinks.push({ source: dNode.id, target: techniqueId, type: "person-technique-link" });

      if (areas.length > 0) {
        areas.forEach((subArea) => {
          const categoryId = subArea;
          if (!categoryNodes.has(categoryId)) {
            categoryNodes.set(categoryId, {
              id: categoryId,
              Nome: categoryId,
              type: "category",
              isCategory: true,
            });
          }
          const linkKey = `${techniqueId}-${categoryId}`;
          if (!newLinks.some((l) => l.linkKey === linkKey)) {
            newLinks.push({ source: techniqueId, target: categoryId, type: "technique-category-link", linkKey });
          }
        });
      }
    });

    if (!isLinkedViaTechnique && areas.length > 0) {
      const categoryId = areas[0];
      newLinks.push({ source: dNode.id, target: categoryId, type: "person-category-fallback-link" });
      if (!categoryNodes.has(categoryId)) {
        categoryNodes.set(categoryId, { id: categoryId, Nome: categoryId, type: "category", isCategory: true });
      }
    }
  });

  const finalNodes = [...originalNodes];
  categoryNodes.forEach((catNode) => {
    if (!originalNodes.some((n) => n.id === catNode.id)) finalNodes.push(catNode);
  });
  techniqueNodes.forEach((techNode) => {
    if (!originalNodes.some((n) => n.id === techNode.id)) finalNodes.push(techNode);
  });

  return { nodes: finalNodes, links: newLinks.filter((l) => !l.linkKey || true) };
}

function calculateNodeDegree(nodes, links) {
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  links.forEach((link) => {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    if (degreeMap.has(sourceId)) degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
    if (degreeMap.has(targetId)) degreeMap.set(targetId, degreeMap.get(targetId) + 1);
  });

  nodes.forEach((node) => { node.degree = degreeMap.get(node.id) || 0; });
  return nodes;
}

function calculateSaturationLevel(nodes) {
  const allDegrees = nodes.map((d) => d.degree || 1);
  const maxDegree = d3.max(allDegrees) || 1;
  const minDegree = d3.min(allDegrees) || 1;

  if (maxDegree === minDegree) {
    nodes.forEach((node) => { node.saturationLevel = 4; });
    return nodes;
  }

  const step = (maxDegree - minDegree) / 6;
  nodes.forEach((node) => {
    const degree = node.degree || 1;
    let levelIndex = Math.floor((degree - minDegree) / step);
    let inverseIndex = 6 - levelIndex;
    node.saturationLevel = Math.max(0, Math.min(6, Math.round(inverseIndex))) + 1;
  });
  return nodes;
}

// ===== SLIDER =====

const sliderMarginConfig = { top: 10, right: 10, bottom: 0, left: 10 };
const sliderWidthConfig = 100;

let xSlider = d3.scaleLinear().domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT]).range([0, sliderWidthConfig]).clamp(true);

function initSlider(minYear, maxYear) {
  xSlider.domain([minYear, maxYear]);
  window.currentMin = minYear;
  window.currentMax = maxYear;

  // Limpa slider anterior se existir
  d3.select("#dual-slider").selectAll("*").remove();

  const sliderSvgEl = d3.select("#dual-slider")
    .attr("width", sliderWidthConfig + sliderMarginConfig.left + sliderMarginConfig.right)
    .attr("height", 30);

  // Gradiente clássico (esquerda) → contemporâneo (direita)
  const defs = sliderSvgEl.append("defs");
  const grad = defs.append("linearGradient")
    .attr("id", "slider-track-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");
  grad.append("stop").attr("offset", "0%")
    .attr("stop-color", "#0d0700").attr("stop-opacity", 1);
  grad.append("stop").attr("offset", "50%")
    .attr("stop-color", "#6b4c1e").attr("stop-opacity", 1);
  grad.append("stop").attr("offset", "100%")
    .attr("stop-color", "#f5d07a").attr("stop-opacity", 1);

  const sliderSvg = sliderSvgEl
    .append("g")
    .attr("transform", `translate(${sliderMarginConfig.left}, 16)`);

  const g = sliderSvg.append("g").attr("class", "slider");

  // Track com gradiente (rect em vez de line)
  g.append("rect")
    .attr("class", "track-gradient-bg")
    .attr("x", xSlider.range()[0])
    .attr("y", -1)
    .attr("width", xSlider.range()[1] - xSlider.range()[0])
    .attr("height", 2)
    .attr("fill", "url(#slider-track-gradient)")
    .attr("rx", 1);

  g.append("line").attr("class", "track").attr("x1", xSlider.range()[0]).attr("x2", xSlider.range()[1]);

  const trackActive = g.append("line").attr("class", "track-active")
    .attr("x1", xSlider(window.currentMin)).attr("x2", xSlider(window.currentMax));

  const handleMin = g.append("circle").attr("class", "handle handle-min").attr("r", 5).attr("cx", xSlider(window.currentMin)).attr("cy", 0)
    .call(d3.drag().on("start", dragstarted).on("drag", draggedMin).on("end", dragendedSlider));

  const handleMax = g.append("circle").attr("class", "handle handle-max").attr("r", 5).attr("cx", xSlider(window.currentMax)).attr("cy", 0)
    .call(d3.drag().on("start", dragstarted).on("drag", draggedMax).on("end", dragendedSlider));

  function dragendedSlider() { d3.select(this).attr("stroke", null); }
  function dragstarted() { d3.select(this).attr("r", 5).attr("stroke", "darkred"); }

  function draggedMin(event) {
    let v = Math.max(minYear, Math.min(window.currentMax - 1, xSlider.invert(event.x)));
    window.currentMin = Math.round(v);
    d3.select(this).attr("cx", xSlider(window.currentMin));
    updateVisuals();
    window.applyAllFilters();
  }

  function draggedMax(event) {
    let v = Math.min(maxYear, Math.max(window.currentMin + 1, xSlider.invert(event.x)));
    window.currentMax = Math.round(v);
    d3.select(this).attr("cx", xSlider(window.currentMax));
    updateVisuals();
    window.applyAllFilters();
  }

  function updateVisuals() {
    trackActive.attr("x1", xSlider(window.currentMin)).attr("x2", xSlider(window.currentMax));
    d3.select("#value-min").text(window.currentMin);
    d3.select("#value-max").text(window.currentMax);
  }
  updateVisuals();

  // Expõe função de reset do slider para uso externo
  window._sliderReset = function () {
    window.currentMin = minYear;
    window.currentMax = maxYear;
    handleMin.attr("cx", xSlider(minYear));
    handleMax.attr("cx", xSlider(maxYear));
    updateVisuals();
  };

  window.applyAllFilters();
}

// ===== SETUP DE LISTENERS =====

function setupCategoryFilter() {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (window.currentCategory === val) {
        window.currentCategory = "all";
        btn.classList.remove("active");
      } else {
        document.querySelectorAll(".category-btn").forEach((b) => b.classList.remove("active"));
        window.currentCategory = val;
        btn.classList.add("active");
      }
      window.applyAllFilters();
    });
  });
  if (DEBUG) console.log("Listener de categoria configurado.");
}

function setupNationalityFilter() {
  document.querySelectorAll(".nat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (window.currentNationality === val) {
        window.currentNationality = "all";
        btn.classList.remove("active");
      } else {
        document.querySelectorAll(".nat-btn").forEach((b) => b.classList.remove("active"));
        window.currentNationality = val;
        btn.classList.add("active");
      }
      window.applyAllFilters();
    });
  });
  if (DEBUG) console.log("Listener de nacionalidade configurado.");
}


function setupDesignerSearch() {
  const searchEl = document.getElementById("search-input");
  if (!searchEl) return;
  d3.select("#search-input").on("input", function () {
    window.applyAllFilters();
  });
  if (DEBUG) console.log("Listener de pesquisa configurado.");
}

function setupLogoReset() {
  const navCenter = document.querySelector(".nav-center");
  if (!navCenter) return;
  navCenter.style.cursor = "pointer";
  navCenter.style.pointerEvents = "all";
  navCenter.addEventListener("click", () => {
    // Reseta filtros
    window.currentCategory = "all";
    window.currentNationality = "all";
    document.querySelectorAll(".category-btn, .nat-btn").forEach((b) => b.classList.remove("active"));
    // Limpa busca
    const searchEl = document.getElementById("search-input");
    if (searchEl) searchEl.value = "";
    // Reseta slider
    if (window._sliderReset) window._sliderReset();
    // Fecha card
    if (typeof focusNode === "function") focusNode(null, null);
    // Redesenha
    window.applyAllFilters(true);
  });
}

// ===== CARREGAMENTO DOS DADOS =====

d3.json("data/data.json")
  .then((data) => {
    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(processedData.nodes, processedData.links);
    processedData.nodes = calculateSaturationLevel(processedData.nodes);
    allNodes = processedData.nodes;
    allLinks = processedData.links;

    buildColorMaps(allNodes, allLinks);

    const designerNodes = allNodes.filter((d) => d["Data de nascimento"]);
    const minDataYear = d3.min(designerNodes, (d) => +d["Data de nascimento"]) || YEAR_MIN_DEFAULT;
    const maxDataYear = d3.max(designerNodes, (d) => +d["Data de nascimento"]) || YEAR_MAX_DEFAULT;

    window.currentMin = minDataYear;
    window.currentMax = maxDataYear;
    window.currentCategory = "all";
    window.currentNationality = "all";
    window.currentPeriod = "all";

    initSlider(minDataYear, maxDataYear);
    setupCategoryFilter();
    setupNationalityFilter();
    setupDesignerSearch();
    setupLogoReset();

    window.applyAllFilters();
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar data.json:", error);
    showToast("Erro ao carregar os dados.", "erro");
  });

// ===== APPLY ALL FILTERS =====

function applyAllFilters(centerNodes = false) {
  const searchTerm = normalizeKey(document.getElementById("search-input")?.value || "");
  const isNameSearch = searchTerm !== "";

  let filteredNodes;

  switch (true) {

    // ── Busca por nome: mostra APENAS pessoas que batem ──
    case isNameSearch: {
      const matched = allNodes.filter((d) => {
        if (d.isCategory || d.isTechnique) return false;
        return normalizeKey(d.Nome || "").split(" ").some((part) => part.startsWith(searchTerm));
      });

      if (matched.length === 0) {
        showToast("Designer não encontrado", "erro");
        return;
      }

      filteredNodes = matched;
      break;
    }

    // ── Visualização normal: aplica filtros encadeados ──
    default: {
      filteredNodes = [...allNodes];

      const categoryFilter    = window.currentCategory;
      const nationalityFilter = window.currentNationality;
      const periodFilter      = window.currentPeriod;
      const minYear           = window.currentMin;
      const maxYear           = window.currentMax;

      // Filtro de categoria
      if (categoryFilter !== "all" && categoryFilter !== "Todas") {
        const techsInCategory = new Set(
          allLinks
            .filter((l) => {
              const t = typeof l.target === "object" ? l.target.id : l.target;
              return t === categoryFilter && l.type === "technique-category-link";
            })
            .map((l) => (typeof l.source === "object" ? l.source.id : l.source))
        );

        filteredNodes = filteredNodes.filter((d) => {
          switch (true) {
            case d.isCategory:  return d.id === categoryFilter;
            case d.isTechnique: return techsInCategory.has(d.id);
            default: {
              const areas = String(d["Área do design"] || "").split(",").map((s) => s.trim());
              return areas.includes(categoryFilter);
            }
          }
        });
      }

      // Filtro de nacionalidade
      if (nationalityFilter !== "all" && nationalityFilter !== "Todos") {
        filteredNodes = filteredNodes.filter((d) => {
          if (d.isCategory || d.isTechnique) return true;
          return d["Nacionalidade"] === nationalityFilter;
        });
      }

      // Filtro de período
      if (periodFilter !== "all" && periodFilter !== "Todos") {
        filteredNodes = filteredNodes.filter((d) => {
          if (d.isCategory || d.isTechnique) return true;
          return d["Período"] === periodFilter;
        });
      }

      // Filtro de ano de nascimento
      filteredNodes = filteredNodes.filter((d) => {
        if (d.isCategory || d.isTechnique) return true;
        if (!d["Data de nascimento"]) return true;
        const birthYear = +d["Data de nascimento"];
        return birthYear >= minYear && birthYear <= maxYear;
      });

      break;
    }
  }

  // ── Filtragem de links ──
  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));
  const filteredLinks = allLinks.filter((link) => {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;
    return filteredNodeIds.has(src) && filteredNodeIds.has(tgt);
  });

  // ── Remove qualquer nó órfão (sem conexão após filtrar) ──
  if (!isNameSearch) {
    const connectedIds = new Set();
    filteredLinks.forEach((l) => {
      connectedIds.add(typeof l.source === "object" ? l.source.id : l.source);
      connectedIds.add(typeof l.target === "object" ? l.target.id : l.target);
    });

    const neverConnected = new Set(
      allNodes
        .filter((d) => !d.isCategory && !d.isTechnique)
        .filter((d) => !allLinks.some((l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          return s === d.id || t === d.id;
        }))
        .map((d) => d.id)
    );

    const keptByCategory = new Set(
      window.currentCategory !== "all" && window.currentCategory !== "Todas"
        ? filteredNodes.filter((d) => !d.isCategory && !d.isTechnique).map((d) => d.id)
        : []
    );

    filteredNodes = filteredNodes.filter(
      (d) => connectedIds.has(d.id) || neverConnected.has(d.id) || keptByCategory.has(d.id)
    );
  }

  drawForceGraph({ nodes: filteredNodes, links: filteredLinks }, isNameSearch || centerNodes);
}

window.applyAllFilters = applyAllFilters;

