// ===== CONFIGURAÇÃO DO SLIDER =====

const sliderMarginConfig = { top: 10, right: 10, bottom: 0, left: 10 };
const sliderWidthConfig = 100;

let xSlider = d3
  .scaleLinear()
  .domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT])
  .range([0, sliderWidthConfig])
  .clamp(true);

// ===== FILTROS DE CATEGORIA =====

function applyCategoryFilter(categoryName) {
  currentCategory = categoryName;
  window.applyAllFilters();
}

// ===== FILTROS DE NACIONALIDADE =====

function applyNationalityFilter(nationality) {
  window.currentNationality = nationality;
  window.applyAllFilters();
}

// ===== FILTROS DE PERÍODO =====

function applyPeriodFilter(period) {
  window.currentPeriod = period;
  window.applyAllFilters();
}

// ===== FILTROS DE ANOS =====

function filterGraphData(minYear, maxYear) {
  window.currentMin = minYear;
  window.currentMax = maxYear;

  window.applyAllFilters();
}

// ===== INICIALIZAR SLIDER =====

function initSlider(minYear, maxYear) {
  xSlider.domain([minYear, maxYear]);
  window.currentMin = minYear;
  window.currentMax = maxYear;

  const sliderSvg = d3
    .select("#dual-slider")
    .attr(
      "width",
      sliderWidthConfig + sliderMarginConfig.left + sliderMarginConfig.right
    )
    .attr("height", 5)
    .append("g")
    .attr("transform", `translate(${sliderMarginConfig.left}, 25)`);

  const g = sliderSvg.append("g").attr("class", "slider");
  g.append("line")
    .attr("class", "track")
    .attr("x1", xSlider.range()[0])
    .attr("x2", xSlider.range()[1]);

  const trackActive = g
    .append("line")
    .attr("class", "track-active")
    .attr("x1", xSlider(window.currentMin))
    .attr("x2", xSlider(window.currentMax));

  // Bolinha esquerda
  const handleMin = g
    .append("circle")
    .attr("class", "handle handle-min")
    .attr("r", 5)
    .attr("cx", xSlider(window.currentMin))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMin)
        .on("end", dragended)
    );
  // Bolinha direita
  const handleMax = g
    .append("circle")
    .attr("class", "handle handle-max")
    .attr("r", 5)
    .attr("cx", xSlider(window.currentMax))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", draggedMax)
        .on("end", dragended)
    );

  function dragended() {
    d3.select(this).attr("stroke", null);
  }

  function dragstarted(event) {
    d3.select(this).attr("r", 5).attr("stroke", "darkred");
  }

  function draggedMin(event) {
    let newValue = xSlider.invert(event.x);
    newValue = Math.max(minYear, Math.min(window.currentMax - 1, newValue));
    window.currentMin = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(window.currentMin));
    updateVisuals();
    window.applyAllFilters();
  }

  function draggedMax(event) {
    let newValue = xSlider.invert(event.x);
    newValue = Math.min(maxYear, Math.max(window.currentMin + 1, newValue));
    window.currentMax = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(window.currentMax));
    updateVisuals();
    window.applyAllFilters();
  }

  function updateVisuals() {
    trackActive
      .attr("x1", xSlider(window.currentMin))
      .attr("x2", xSlider(window.currentMax));
    d3.select("#value-min").text(window.currentMin);
    d3.select("#value-max").text(window.currentMax);
  }
  updateVisuals();

  window.applyAllFilters();
}

// ===== SETUP DE LISTENERS =====

function setupCategoryFilter(categories) {
  // Seleciona o elemento dropdown
  d3.select("#category-filter").on("change", function () {
    const selectedCategory = this.value;

    applyCategoryFilter(selectedCategory);
  });

  if (DEBUG) console.log("Listener de categoria configurado.");
}

function setupNationalityFilter() {
  // Seleciona o elemento dropdown de nacionalidade
  d3.select("#nationality-filter").on("change", function () {
    const selectedNationality = this.value;

    applyNationalityFilter(selectedNationality);
  });

  if (DEBUG) console.log("Listener de nacionalidade configurado.");
}

function setupPeriodFilter() {
  // Seleciona o elemento dropdown de período
  d3.select("#period-filter").on("change", function () {
    const selectedPeriod = this.value;

    applyPeriodFilter(selectedPeriod);
  });

  if (DEBUG) console.log("Listener de período configurado.");
}

function setupYearInputListeners(minDataYear, maxDataYear) {
  const minEl = document.getElementById("year-min-input");
  const maxEl = document.getElementById("year-max-input");

  if (minEl) {
    minEl.value = minDataYear;
    d3.select("#year-min-input").on("change", function () {
      window.currentMin = +this.value;
      window.applyAllFilters();
    });
  }

  if (maxEl) {
    maxEl.value = maxDataYear;
    d3.select("#year-max-input").on("change", function () {
      window.currentMax = +this.value;
      window.applyAllFilters();
    });
  }

  if (DEBUG) console.log("Listeners de input de ano configurados.");
}

function setupDesignerSearch() {
  const searchEl = document.getElementById("search-input");
  if (!searchEl) return;

  d3.select("#search-input").on("keyup", function () {
    window.applyAllFilters();
  });

  if (DEBUG) console.log("Listener de pesquisa configurado.");
}
