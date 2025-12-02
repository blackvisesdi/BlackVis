const sliderMargin = { top: 10, right: 10, bottom: 0, left: 10 };
const sliderWidth = 50;

const xSlider = d3
  .scaleLinear()
  .domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT])
  .range([0, sliderWidth])
  .clamp(true);

function applyCategoryFilter(categoryName) {
  currentCategory = categoryName; ;

  window.applyAllFilters();
}

function filterGraphData(minYear, maxYear) {
  currentMin = minYear;
  currentMax = maxYear; 

  window.applyAllFilters();
}

function initSlider(minYear, maxYear) {
  xSlider.domain([minYear, maxYear]);
  currentMin = minYear;
  currentMax = maxYear;

  const sliderSvg = d3
    .select("#dual-slider")
    .attr("width", sliderWidth + sliderMargin.left + sliderMargin.right)
    .attr("height", 40)
    .append("g")
    .attr("transform", `translate(${sliderMargin.left}, 20)`);

  const g = sliderSvg.append("g").attr("class", "slider");
  g.append("line")
    .attr("class", "track")
    .attr("x1", xSlider.range()[0])
    .attr("x2", xSlider.range()[1]);

  const trackActive = g
    .append("line")
    .attr("class", "track-active")
    .attr("x1", xSlider(currentMin))
    .attr("x2", xSlider(currentMax));

  const handleMin = g
    .append("circle")
    .attr("class", "handle handle-min")
    .attr("r", 5)
    .attr("cx", xSlider(currentMin))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMin)
        .on("end", dragended)
    );
  const handleMax = g
    .append("circle")
    .attr("class", "handle handle-max")
    .attr("r", 5)
    .attr("cx", xSlider(currentMax))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMax)
        .on("end", dragended)
    );

  function dragstarted(event) {
    d3.select(this).attr("r", 5).attr("stroke", "darkred");
  }
  function dragended(event) {
    // d3.select(this).attr("r", 5).attr("stroke", "#e74c3c");
  } // Função de "arrastar"

  function draggedMin(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue < minYear) newValue = minYear;
    if (newValue > window.currentMax - 1) newValue = window.currentMax - 1;
    
    window.currentMin = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(window.currentMin));
    updateVisuals();
    
    window.applyAllFilters();
  }
  function draggedMax(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue > maxYear) newValue = maxYear;
    if (newValue < window.currentMin + 1) newValue = window.currentMin + 1;
    
    window.currentMax = Math.round(newValue);
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

  window.applyAllFilters();
}

function setupCategoryFilter(categories) {
  // Seleciona o elemento dropdown
  d3.select("#category-select").on("change", function () {
    const selectedCategory = this.value;
    
    applyCategoryFilter(selectedCategory);
  });

  console.log("Listener de Categoria configurado.");
}

function setupYearInputListeners(minDataYear, maxDataYear) {
  // 1. Inicializa o estado visual e global das caixas de texto
  d3.select("#year-min-input").property("value", minDataYear);
  d3.select("#year-max-input").property("value", maxDataYear);

  d3.select("#year-min-input").on("change", function () {
    let newMin = +this.value;
    window.currentMin = newMin;
    window.applyAllFilters();
  });

  d3.select("#year-max-input").on("change", function () {
    let newMax = +this.value;

    window.currentMax = newMax;
    window.applyAllFilters();
  });
  console.log("Listeners de Input de Ano configurados.");
}

function setupDesignerSearch() {
  d3.select("#designer-search-input").on("keyup", function () {
    const searchTerm = this.value.toLowerCase().trim();

    // 🚨 1. Atualiza o estado global
    window.currentSearchTerm = searchTerm;

    // 🚨 2. Chama a função mestra para refiltrar
    window.applyAllFilters();
  });

  console.log("Listener de Pesquisa de Designer configurado.");
}