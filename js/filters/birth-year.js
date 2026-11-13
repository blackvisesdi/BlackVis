// Datas vazias, "Desconhecido" e outros textos não representam um ano.
// A mesma leitura alimenta o slider e os modos Com dados/Sem dados/Ver todos.
function getBirthYear(node) {
  const raw = node["Data de nascimento"];
  if (raw == null || (typeof raw !== "string" && typeof raw !== "number")) return null;
  if (String(raw).trim() === "") return null;
  const year = Number(raw);
  return Number.isInteger(year) && year > 0 ? year : null;
}

// ===== SLIDER =====

const sliderMarginConfig = { top: 10, right: 10, bottom: 0, left: 10 };
const sliderWidthConfig = 300;

let xSlider = d3
  .scaleLinear()
  .domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT])
  .range([0, sliderWidthConfig])
  .clamp(true);

function initSlider(minYear, maxYear) {
  xSlider.domain([minYear, maxYear]);
  window._yearSliderResizeObserver?.disconnect();
  const sliderElement = document.getElementById("dual-slider");
  let sliderWidth = Math.max(
    100,
    (sliderElement?.getBoundingClientRect().width || sliderWidthConfig + sliderMarginConfig.left + sliderMarginConfig.right)
      - sliderMarginConfig.left - sliderMarginConfig.right
  );
  xSlider.range([0, sliderWidth]);
  window._sliderMin = minYear;
  window._sliderMax = maxYear;
  window.currentMin = minYear;
  window.currentMax = maxYear;
  window._yearSliderTouched = false;

  // Limpa slider anterior se existir
  d3.select("#dual-slider").selectAll("*").remove();

  const sliderSvgEl = d3
    .select("#dual-slider")
    .attr("viewBox", `0 0 ${sliderWidth + sliderMarginConfig.left + sliderMarginConfig.right} 30`)
    .attr(
      "width",
      sliderWidth + sliderMarginConfig.left + sliderMarginConfig.right
    )
    .attr("height", 30);

  // Gradientes
  const defs = sliderSvgEl.append("defs");

  const bgGrad = defs
    .append("linearGradient")
    .attr("id", "slider-track-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");
  bgGrad.append("stop").attr("offset", "6.25%").attr("stop-color", "#413F3F");
  bgGrad.append("stop").attr("offset", "32.2115%").attr("stop-color", "#A7A1A1");
  bgGrad.append("stop").attr("offset", "60.0962%").attr("stop-color", "#454343");

  const activeGrad = defs
    .append("linearGradient")
    .attr("id", "slider-track-active-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");
  activeGrad.append("stop").attr("offset", "6.25%").attr("stop-color", "#413F3F");
  activeGrad.append("stop").attr("offset", "32.2115%").attr("stop-color", "#A7A1A1");
  activeGrad.append("stop").attr("offset", "60.0962%").attr("stop-color", "#454343");

  const sliderSvg = sliderSvgEl
    .append("g")
    .attr("transform", `translate(${sliderMarginConfig.left}, 15)`);

  const g = sliderSvg.append("g").attr("class", "slider");

  // Track com gradiente (rect em vez de line)
  const trackGradientBg = g.append("rect")
    .attr("class", "track-gradient-bg")
    .attr("x", xSlider.range()[0])
    .attr("y", -14)
    .attr("width", xSlider.range()[1] - xSlider.range()[0])
    .attr("height", 28)
    .attr("fill", "url(#slider-track-gradient)")
    .attr("rx", 14)
    .attr("ry", 14);

  const trackLine = g.append("line")
    .attr("class", "track")
    .attr("x1", xSlider.range()[0])
    .attr("x2", xSlider.range()[1]);

  const trackActive = g
    .append("rect")
    .attr("class", "track-active")
    .attr("x", xSlider(window.currentMin))
    .attr("y", -14)
    .attr("width", xSlider(window.currentMax) - xSlider(window.currentMin))
    .attr("height", 28)
    .attr("rx", 14);

  // Os próprios anos são as alças do controle — não há bolinhas separadas.
  const yearHandleX = (year) =>
    Math.max(27, Math.min(sliderWidth - 27, xSlider(year)));
  const makeYearHandle = (name, value, onDrag) => {
    const handle = g
      .append("g")
      .attr("class", `year-handle year-handle-${name}`)
      .attr("transform", `translate(${yearHandleX(value)}, 0)`)
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", onDrag)
          .on("end", dragendedSlider)
      );
    handle.append("rect").attr("x", -27).attr("y", -14).attr("width", 54).attr("height", 28).attr("rx", 14);
    handle.append("text").attr("text-anchor", "middle").attr("dy", ".35em").text(value);
    return handle;
  };

  const handleMin = makeYearHandle("min", window.currentMin, draggedMin);
  const handleMax = makeYearHandle("max", window.currentMax, draggedMax);

  function dragendedSlider() {
    d3.select(this).classed("is-dragging", false);
  }
  function dragstarted() {
    d3.select(this).classed("is-dragging", true);
  }

  function draggedMin(event) {
    let v = Math.max(
      minYear,
      Math.min(window.currentMax - 1, xSlider.invert(event.x))
    );
    window.currentMin = Math.round(v);
    window._yearSliderTouched = true;
    updateVisuals();
    window.applyAllFilters();
  }

  function draggedMax(event) {
    let v = Math.min(
      maxYear,
      Math.max(window.currentMin + 1, xSlider.invert(event.x))
    );
    window.currentMax = Math.round(v);
    window._yearSliderTouched = true;
    updateVisuals();
    window.applyAllFilters();
  }

  function updateVisuals() {
    trackActive
      .attr("x", xSlider(window.currentMin))
      .attr("width", xSlider(window.currentMax) - xSlider(window.currentMin));
    d3.select("#value-min").text(window.currentMin);
    d3.select("#value-max").text(window.currentMax);
    handleMin.attr("transform", `translate(${yearHandleX(window.currentMin)}, 0)`).select("text").text(window.currentMin);
    handleMax.attr("transform", `translate(${yearHandleX(window.currentMax)}, 0)`).select("text").text(window.currentMax);
    const summary = document.getElementById("year-range-description");
    if (summary) {
      summary.innerHTML = `Clássicos: de ${minYear} até 1970<br>Contemporâneos: de 1970 até ${maxYear}`;
      summary.title = summary.textContent;
    }
  }
  updateVisuals();

  if (typeof ResizeObserver !== "undefined" && sliderElement) {
    window._yearSliderResizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(
        100,
        sliderElement.getBoundingClientRect().width - sliderMarginConfig.left - sliderMarginConfig.right
      );
      if (Math.abs(nextWidth - sliderWidth) < 1) return;
      sliderWidth = nextWidth;
      xSlider.range([0, sliderWidth]);
      sliderSvgEl
        .attr("viewBox", `0 0 ${sliderWidth + sliderMarginConfig.left + sliderMarginConfig.right} 30`)
        .attr("width", sliderWidth + sliderMarginConfig.left + sliderMarginConfig.right);
      trackGradientBg.attr("width", sliderWidth);
      trackLine.attr("x2", sliderWidth);
      updateVisuals();
    });
    window._yearSliderResizeObserver.observe(sliderElement);
  }

  // Expõe função de reset do slider para uso externo
  window._sliderReset = function () {
    window.currentMin = minYear;
    window.currentMax = maxYear;
    window._yearSliderTouched = false;
    updateVisuals();
  };

  window.applyAllFilters();
}

function setupYearPeriodControls() {
  const nationalityReset = document.getElementById("menu-reset");
  const yearReset = document.getElementById("year-reset");
  if (yearReset && nationalityReset) {
    yearReset.innerHTML = nationalityReset.innerHTML;
    yearReset.addEventListener("click", () => {
      closeCardForFilterChange();
      window.currentPeriod = "all";
      window._sliderReset?.();
      document.querySelectorAll(".year-period-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.period === "Todos");
      });
      window.applyAllFilters?.();
    });
  }
  document.querySelectorAll(".year-period-btn").forEach((button) => {
    button.addEventListener("click", () => {
      closeCardForFilterChange();
      const period = button.dataset.period;
      window.currentPeriod = period === "Todos" ? "all" : period;
      document.querySelectorAll(".year-period-btn").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      window.applyAllFilters?.();
    });
  });
  document.getElementById("year-info")?.addEventListener("click", () => {
    showToast("Arraste as extremidades para selecionar o intervalo de anos de nascimento.");
  });
}
