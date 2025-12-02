d3.json("data.json")
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
      d3.min(designerNodes, (d) => +d["Data de nascimento"]) || YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, (d) => +d["Data de nascimento"]) || YEAR_MAX_DEFAULT;

    window.currentMin = minDataYear;
    window.currentMax = maxDataYear;
    window.currentCategory = "Todos";

    fillCategoryDropdown();

    initSlider(minDataYear, maxDataYear);
    
    setupYearInputListeners(minDataYear, maxDataYear);

    setupCategoryFilter();

    window.applyAllFilters();
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar data.json...", error);
  });

  function applyAllFilters() {
    const categoryFilter = window.currentCategory || "Todos";
    const minYear = window.currentMin;
    const maxYear = window.currentMax;
    const searchTerm = window.currentSearchTerm;

    let filteredNodes = allNodes;

    
    // --- FILTRO DE CATEGORIA ---
    if (categoryFilter !== "Todos") {
      filteredNodes = filteredNodes.filter((d) => {
        if (d.isCategory && d.id === categoryFilter)
          return true;

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

  window.applyCategoryFilter = function (categoryName) {
    currentCategory = categoryName; // Atualiza o estado
    applyAllFilters(); // Chama a mestra para aplicar todos os filtros
  };

  window.applyYearFilter = function (minYear, maxYear) {
    currentMin = minYear; // Atualiza o estado
    currentMax = maxYear; // Atualiza o estado
    applyAllFilters(); // Chama a mestra para aplicar todos os filtros
  };

function fillCategoryDropdown() {
  const uniqueCategories = new Set(
    allNodes
      .filter((d) => !d.isCategory && d["Área do design"])
      .reduce((accumulator, d) => {
        const areaData = d["Área do design"];

        if (typeof areaData === "string") {
          const areas = areaData
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean); // Remove strings vazias
          return accumulator.concat(areas);
        }
        if (Array.isArray(areaData)) {
          return accumulator.concat(
            areaData.map((s) => s.trim()).filter(Boolean)
          );
        }
        if (typeof areaData === "string" && areaData.length > 0) {
          return accumulator.concat([areaData.trim()]);
        }

        return accumulator;
      }, [])
  );

  const rawCategories = Array.from(uniqueCategories).filter(Boolean).sort();
  const categories = ["Todas", ...rawCategories];

  const select = d3.select("#category-select");

  select
    .selectAll("option")
    .data(categories)
    .join("option")
    .attr("value", (d) => d)
    .text((d) => d);

  select.property("value", "Todas");
  console.log("Filtro de Categoria preenchido:", categories);
}

// Niveis de saturação das cores
function calculateSaturationLevel(nodes) {
  const allDegrees = nodes.map((d) => d.linkCount || 1);
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
  const degreeRange = maxDegree - minDegree;
  const step = degreeRange / 6;

  nodes.forEach((node) => {
    const degree = node.linkCount || 1;
    let levelIndex = Math.floor((degree - minDegree) / step);
    let inverseIndex = 6 - levelIndex;

    // Arredonda para o índice inteiro (0, 1, 2, ..., 6)
    let finalIndex = Math.round(inverseIndex);

    // 2. Garante o Limite: O índice deve estar entre 0 e 6 (para 7 níveis)
    finalIndex = Math.max(0, Math.min(6, finalIndex));

    // 3. Mapeia o Índice (0-6) para o Nível de Saturação (1-7)
    // Se o finalIndex é 0 (mais conexões), saturationLevel é 1.
    // Se o finalIndex é 6 (menos conexões), saturationLevel é 7.
    node.saturationLevel = finalIndex + 1;
  });

  return nodes;
}