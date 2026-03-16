d3.json("../data/data.json")
  .then((data) => {
    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(
      processedData.nodes,
      processedData.links
    );

    processedData.nodes = calculateSaturationLevel(processedData.nodes);
    allNodes = processedData.nodes;
    allLinks = processedData.links;

    // Usa +d para garantir que os valores sejam números antes de calcular min/max
    const designerNodes = allNodes.filter((d) => d["Data de nascimento"]);
    const minDataYear =
      d3.min(designerNodes, (d) => +d["Data de nascimento"]) ||
      YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, (d) => +d["Data de nascimento"]) ||
      YEAR_MAX_DEFAULT;

    window.currentMin = minDataYear;
    window.currentMax = maxDataYear;
    window.currentCategory = "all";
    window.currentNationality = "all";

    fillCategoryDropdown();

    initSlider(minDataYear, maxDataYear);

    setupYearInputListeners(minDataYear, maxDataYear);

    setupCategoryFilter();
    setupNationalityFilter();
    setupPeriodFilter();
    setupDesignerSearch();

    window.applyAllFilters();
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar data.json:", error);
    showToast("Erro ao carregar os dados.", "erro");
  });

function applyAllFilters() {
  const categoryFilter = window.currentCategory;
  const nationalityFilter = window.currentNationality;
  const periodFilter = window.currentPeriod;

  const minYear = window.currentMin;
  const maxYear = window.currentMax;

  let filteredNodes = allNodes;

  // --- FILTRO DE PESQUISA POR NOME ---
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

  if (searchTerm !== "") {
    // Designers que batem com a busca
    const matchSet = new Set(
      allNodes
        .filter((d) => !d.isCategory)
        .filter((d) => (d["Nome"] || "").toLowerCase().includes(searchTerm))
        .map((d) => d.id)
    );

    if (matchSet.size === 0) {
      showFeedback("Designer não encontrado", "erro");
      return;
    }

    filteredNodes = filteredNodes.filter((d) => {
      if (!d.isCategory) return matchSet.has(d.id);
      return allNodes.some((n) => {
        if (!matchSet.has(n.id)) return false;
        const areas = String(n["Área do design"] || "")
          .split(",")
          .map((s) => s.trim());
        return areas.includes(d.id);
      });
    });
  }

  // --- FILTRO DE CATEGORIA ---
  if (categoryFilter !== "all" && categoryFilter !== "Todas") {
    filteredNodes = filteredNodes.filter((d) => {
      if (d.isCategory && d.id === categoryFilter) return true;

      if (!d.isCategory && d["Área do design"]) {
        const areas =
          typeof d["Área do design"] === "string"
            ? d["Área do design"].split(",").map((s) => s.trim())
            : [d["Área do design"]];

        return areas.includes(categoryFilter);
      }
      return false;
    });
  }

  // --- FILTRO DE NACIONALIDADE ---
  if (nationalityFilter !== "all" && nationalityFilter !== "Todos") {
    filteredNodes = filteredNodes.filter((d) => {
      // Categorias e técnicas sempre aparecem
      if (d.isCategory || d.isTechnique) return true;

      // Filtra designers por nacionalidade
      return d["Nacionalidade"] === nationalityFilter;
    });
  }

  // --- FILTRO DE PERÍODO ---
  if (periodFilter !== "all" && periodFilter !== "Todos") {
    filteredNodes = filteredNodes.filter((d) => {
      // Categorias e técnicas sempre aparecem
      if (d.isCategory || d.isTechnique) return true;

      // Filtra designers por período
      return d["Período"] === periodFilter;
    });
  }

  // --- FILTRO DE DATA DE NASCIMENTO  ---
  filteredNodes = filteredNodes.filter((d) => {
    if (d.isCategory || !d["Data de nascimento"]) {
      return true;
    }

    const birthYear = +d["Data de nascimento"];
    return birthYear >= minYear && birthYear <= maxYear;
  });

  // --- FILTRAGEM DE LINKS ---
  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));
  const filteredLinks = allLinks.filter((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
  });

  // --- REDESENHO FINAL ---
  drawForceGraph({ nodes: filteredNodes, links: filteredLinks });
}

window.applyAllFilters = applyAllFilters;

window.applyCategoryFilter = function (categoryName) {
  currentCategory = categoryName; // Atualiza o estado
  applyAllFilters();
};

window.applyYearFilter = function (minYear, maxYear) {
  window.currentMin = minYear; // Atualiza o estado
  window.currentMax = maxYear; // Atualiza o estado
  applyAllFilters();
};

function fillCategoryDropdown() {
  const uniqueCategories = new Set(
    allNodes
      .filter((d) => !d.isCategory && d["Área do design"])
      .reduce((acc, d) => {
        const areaData = d["Área do design"];
        if (typeof areaData === "string") {
          return acc.concat(
            areaData
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
        }
        return acc;
      }, [])
  );

  const rawCategories = Array.from(uniqueCategories).filter(Boolean).sort();
  const categories = [
    { text: "Todas", value: "all" },
    ...rawCategories.map((c) => ({ text: c, value: c })),
  ];

  const select = d3.select("#category-filter");

  select
    .selectAll("option")
    .data(categories)
    .join("option")
    .attr("value", (d) => d.value)
    .text((d) => d.text);

  select.property("value", "all");
}

// Niveis de saturação das cores
function calculateSaturationLevel(nodes) {
  const allDegrees = nodes.map((d) => d.degree || 1);
  const maxDegree = d3.max(allDegrees) || 1;
  const minDegree = d3.min(allDegrees) || 1;

  // Se todos os graus forem iguais, usa o nível neutro (4)
  if (maxDegree === minDegree) {
    nodes.forEach((node) => {
      node.saturationLevel = 4;
    });

    return nodes;
  }

  // Mapeamento linear para 7 níveis: 1 (mais conexões) a 7 (menos conexões)
  const step = (maxDegree - minDegree) / 6;

  nodes.forEach((node) => {
    const degree = node.degree || 1; // corrigido: era linkCount
    let levelIndex = Math.floor((degree - minDegree) / step);
    let inverseIndex = 6 - levelIndex;
    let finalIndex = Math.max(0, Math.min(6, Math.round(inverseIndex)));
    node.saturationLevel = finalIndex + 1;
  });

  return nodes;
}
