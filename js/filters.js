const sliderMargin = { top: 10, right: 10, bottom: 0, left: 10 };
const sliderWidth = 50;

const xSlider = d3
  .scaleLinear()
  .domain([YEAR_MIN_DEFAULT, YEAR_MAX_DEFAULT])
  .range([0, sliderWidth])
  .clamp(true);

function applyCategoryFilter(categoryName) {
  currentCategory = categoryName;

  filterGraphData(currentMin, currentMax);
}

function filterGraphData(minYear, maxYear) {
  const nodesFilteredByYear = allNodes.filter(
    (d) =>
      d.isCategory ||
      !d["Data de nascimento"] ||
      (d["Data de nascimento"] >= minYear && d["Data de nascimento"] <= maxYear)
  );

  const filteredNodes = nodesFilteredByYear.filter((d) => {
    if (currentCategory === "Todos") return true;

    if (d.isCategory && d.Nome === currentCategory) return true;

    if (!d.isCategory && d["Área do design"] === currentCategory) {
      return true;
    }

    return false;
  });

  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));

  const filteredLinks = allLinks.filter((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
  });

  const filteredGraph = {
    nodes: filteredNodes,
    links: filteredLinks,
  };

  drawForceGraph(filteredGraph);
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
  }

  // Função de "arrastar"
  function draggedMin(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue < minYear) newValue = minYear;
    if (newValue > currentMax - 1) newValue = currentMax - 1;
    currentMin = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(currentMin));
    updateVisuals();
    filterGraphData(currentMin, currentMax);
  }
  function draggedMax(event) {
    let newX = event.x;
    let newValue = xSlider.invert(newX);
    if (newValue > maxYear) newValue = maxYear;
    if (newValue < currentMin + 1) newValue = currentMin + 1;
    currentMax = Math.round(newValue);
    d3.select(this).attr("cx", xSlider(currentMax));
    updateVisuals();
    filterGraphData(currentMin, currentMax);
  }
  function updateVisuals() {
    trackActive.attr("x1", xSlider(currentMin)).attr("x2", xSlider(currentMax));
    d3.select("#value-min").text(currentMin);
    d3.select("#value-max").text(currentMax);
  }
  updateVisuals();
}
