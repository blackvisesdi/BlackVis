d3.json("data.json")
  .then((data) => {
    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(
      processedData.nodes,
      processedData.links
    );

    allNodes = processedData.nodes;
    allLinks = processedData.links;

    const designerNodes = allNodes.filter((d) => d["Data de nascimento"]);
    const minDataYear =
      d3.min(designerNodes, (d) => d["Data de nascimento"]) || YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, (d) => d["Data de nascimento"]) || YEAR_MAX_DEFAULT;

    currentMin = minDataYear;
    currentMax = maxDataYear;

    fillCategoryDropdown();

    drawForceGraph({ nodes: allNodes, links: allLinks });

    initSlider(minDataYear, maxDataYear);

    setupYearInputListeners(minDataYear, maxDataYear);

    const categories = allNodes
      .filter((d) => d.isCategory)
      .map((d) => d.id)
      .sort();
    setupCategoryFilter(categories);
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar data.json...", error);
  });

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

window.applyCategoryFilter = function (categoryName) {
  currentCategory = categoryName;

  let filteredNodes = [];
  if (currentCategory === "Todas") {
    filteredNodes = allNodes;
  } else {
    filteredNodes = allNodes.filter((d) => {
      if (d.isCategory && d.Nome === currentCategory) return true;

      if (!d.isCategory && d["Área do design"]) {
        const areas = d["Área do design"];

        if (typeof areas === "string") {
          return areas
            .split(",")
            .map((s) => s.trim())
            .includes(currentCategory);
        }
        if (areas === currentCategory) return true;
      }

      return false;
    });
  }

  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));

  const filteredLinks = allLinks.filter((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;

    return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
  });

  drawForceGraph({ nodes: filteredNodes, links: filteredLinks });
};
