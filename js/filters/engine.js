// MOTOR DE FILTROS
// Normaliza os dados de origem, cria nós derivados, coordena todos os filtros
// e envia o conjunto final de nós e ligações para o renderizador.
// Interface pública: window.applyAllFilters(). Carregar após os módulos auxiliares.

// Categorias válidas (Arte não aparece na visualização)
const VALID_CATEGORIES = [
  "Comunicação",
  "Produto",
  "Teórico",
  "Interação",
  "Serviço",
];
// Técnicas sem SVG que não devem ser exibidas
const HIDDEN_TECHNIQUES = ["Colagem"];

// Datas vazias, "Desconhecido" e outros textos não representam um ano.
// A mesma leitura alimenta o slider e os modos Com dados/Sem dados/Ver todos.
function getBirthYear(node) {
  const raw = node["Data de nascimento"];
  if (raw == null || (typeof raw !== "string" && typeof raw !== "number")) return null;
  if (String(raw).trim() === "") return null;
  const year = Number(raw);
  return Number.isInteger(year) && year > 0 ? year : null;
}

// ===== PRÉ-PROCESSAMENTO =====

function preprocessGraphData(data) {
  // Aceita array plano OU {nodes, links}
  const originalNodes = Array.isArray(data)
    ? data
    : Array.isArray(data.nodes)
    ? data.nodes
    : [];
  const originalLinks = Array.isArray(data)
    ? []
    : Array.isArray(data.links)
    ? data.links
    : [];

  // Garante que cada nó tem campo id (usa Nome como fallback)
  originalNodes.forEach((n) => {
    if (!n.id) n.id = n.Nome || String(Math.random());
  });

  const categoryNodes = new Map();
  const techniqueNodes = new Map();
  const newLinks = [...originalLinks];

  const DESIGN_AREA_KEY = "Área do design";
  const TECHNIQUES_KEY = "Técnicas";

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

      // Área canônica da técnica (de areas.json tem prioridade)
      const canonicalArea =
        (window._techniqueAreaMap &&
          window._techniqueAreaMap.get(tecnicaName)) ||
        areas[0] ||
        "Geral";

      if (!techniqueNodes.has(tecnicaName)) {
        techniqueNodes.set(tecnicaName, {
          id: techniqueId,
          Nome: tecnicaName,
          type: "technique",
          isTechnique: true,
          "Área do design": canonicalArea,
        });
      }

      newLinks.push({
        source: dNode.id,
        target: techniqueId,
        type: "person-technique-link",
      });

      // Cada técnica conecta apenas à sua área canônica
      if (VALID_CATEGORIES.includes(canonicalArea)) {
        const categoryId = canonicalArea;
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
          newLinks.push({
            source: techniqueId,
            target: categoryId,
            type: "technique-category-link",
            linkKey,
          });
        }
      }
    });

    if (!isLinkedViaTechnique && areas.length > 0) {
      const categoryId = areas[0];
      newLinks.push({
        source: dNode.id,
        target: categoryId,
        type: "person-category-fallback-link",
      });
      if (!categoryNodes.has(categoryId)) {
        categoryNodes.set(categoryId, {
          id: categoryId,
          Nome: categoryId,
          type: "category",
          isCategory: true,
        });
      }
    }
  });

  const finalNodes = [...originalNodes];
  categoryNodes.forEach((catNode) => {
    if (!originalNodes.some((n) => n.id === catNode.id))
      finalNodes.push(catNode);
  });
  techniqueNodes.forEach((techNode) => {
    if (!originalNodes.some((n) => n.id === techNode.id))
      finalNodes.push(techNode);
  });

  return {
    nodes: finalNodes,
    links: newLinks.filter((l) => !l.linkKey || true),
  };
}

function calculateNodeDegree(nodes, links) {
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  links.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    if (degreeMap.has(sourceId))
      degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
    if (degreeMap.has(targetId))
      degreeMap.set(targetId, degreeMap.get(targetId) + 1);
  });

  nodes.forEach((node) => {
    node.degree = degreeMap.get(node.id) || 0;
  });
  return nodes;
}

function calculateSaturationLevel(nodes) {
  const allDegrees = nodes.map((d) => d.degree || 1);
  const maxDegree = d3.max(allDegrees) || 1;
  const minDegree = d3.min(allDegrees) || 1;

  if (maxDegree === minDegree) {
    nodes.forEach((node) => {
      node.saturationLevel = 4;
    });
    return nodes;
  }

  const step = (maxDegree - minDegree) / 6;
  nodes.forEach((node) => {
    const degree = node.degree || 1;
    let levelIndex = Math.floor((degree - minDegree) / step);
    let inverseIndex = 6 - levelIndex;
    node.saturationLevel =
      Math.max(0, Math.min(6, Math.round(inverseIndex))) + 1;
  });
  return nodes;
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
  window._sliderMin = minYear;
  window._sliderMax = maxYear;
  window.currentMin = minYear;
  window.currentMax = maxYear;

  // Limpa slider anterior se existir
  d3.select("#dual-slider").selectAll("*").remove();

  const sliderSvgEl = d3
    .select("#dual-slider")
    .attr(
      "width",
      sliderWidthConfig + sliderMarginConfig.left + sliderMarginConfig.right
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
  g.append("rect")
    .attr("class", "track-gradient-bg")
    .attr("x", xSlider.range()[0])
    .attr("y", -14)
    .attr("width", xSlider.range()[1] - xSlider.range()[0])
    .attr("height", 28)
    .attr("fill", "url(#slider-track-gradient)")
    .attr("rx", 14)
    .attr("ry", 14);

  g.append("line")
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
    Math.max(27, Math.min(sliderWidthConfig - 27, xSlider(year)));
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
    updateVisuals();
    window.applyAllFilters();
  }

  function draggedMax(event) {
    let v = Math.min(
      maxYear,
      Math.max(window.currentMin + 1, xSlider.invert(event.x))
    );
    window.currentMax = Math.round(v);
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
      if (window.currentMax <= 1970) {
        summary.textContent = `Clássicos: de ${window.currentMin} até ${window.currentMax}`;
      } else if (window.currentMin >= 1970) {
        summary.textContent = `Contemporâneos: de ${window.currentMin} até ${window.currentMax}`;
      } else {
        summary.textContent = "";
      }
    }
  }
  updateVisuals();

  // Expõe função de reset do slider para uso externo
  window._sliderReset = function () {
    window.currentMin = minYear;
    window.currentMax = maxYear;
    updateVisuals();
  };

  window.applyAllFilters();
}

// ===== SETUP DE LISTENERS =====

function setupCategoryFilter() {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.selectCategoryFilter(btn.dataset.value, true);
    });
  });
  if (DEBUG) console.log("Listener de categoria configurado.");
}

function _setLegendDesc(htmlOrText) {
  const el = document.getElementById("bb-description");
  if (!el) return;
  if (htmlOrText.includes("<")) el.innerHTML = htmlOrText;
  else el.textContent = htmlOrText;
}
window._setLegendDesc = _setLegendDesc;

function _natLegendFor(val) {
  const key =
    val === "Brasileira"
      ? "nationalityBR"
      : val === "Estrangeira"
      ? "nationalityEXT"
      : null;
  if (!key) return null;
  const raw =
    (window._legendDescriptions && window._legendDescriptions[key]) || "";
  return raw.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
}

window.selectedNationalities = new Set();
window.locationFilter = null;
window.locationSelection = {
  nationality: null,
  groups: new Set(),
  details: new Set(),
  expanded: new Set(),
};

function resetLocationSelection(nationality = null) {
  window.locationSelection = { nationality, groups: new Set(), details: new Set(), expanded: new Set() };
  window.locationFilter = null;
}

function syncLocationFilter(groupField, detailField) {
  const selection = window.locationSelection;
  if (selection.details.size) window.locationFilter = { field: detailField, values: new Set(selection.details) };
  else if (selection.groups.size) window.locationFilter = { field: groupField, values: new Set(selection.groups) };
  else window.locationFilter = null;
}

function syncLocationScrollbar(container) {
  const viewport = container.closest(".location-filter-viewport");
  const thumb = viewport?.querySelector(".location-scrollbar-thumb");
  if (!thumb) return;
  const scrollable = container.scrollHeight > container.clientHeight + 1;
  viewport.classList.toggle("is-scrollable", scrollable);
  if (!scrollable) return;
  const trackHeight = container.clientHeight;
  const thumbHeight = Math.max(12, Math.min(18, (trackHeight * trackHeight) / container.scrollHeight));
  const maxTop = trackHeight - thumbHeight;
  const maxScroll = container.scrollHeight - trackHeight;
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.transform = `translateY(${maxScroll ? (container.scrollTop / maxScroll) * maxTop : 0}px)`;
}

function renderLocationFilters() {
  const container = document.getElementById("location-filters");
  if (!container) return;

  const nationality = window.selectedNationalities?.size === 1
    ? [...window.selectedNationalities][0]
    : null;
  if (!nationality) {
    container.hidden = true;
    container.replaceChildren();
    document.body.classList.remove("has-location-filter");
    return;
  }

  const isBrazilian = nationality === "Brasileira";
  const groupField = isBrazilian ? "Região" : "Continente";
  const detailField = isBrazilian ? "Estado" : "País";
  const prefix = isBrazilian ? "Região" : "";
  let selection = window.locationSelection;
  if (selection.nationality !== nationality) {
    resetLocationSelection(nationality);
    selection = window.locationSelection;
  }
  const people = allNodes.filter(
    (node) => !node.isCategory && !node.isTechnique && node["Nacionalidade"] === nationality
  );
  const defaultOrder = isBrazilian
    ? ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]
    : ["África", "América do Norte", "América do Sul", "Europa", "Oceania"];
  const groups = [...new Set(people.map((node) => node[groupField]).filter(Boolean))].sort(
    (a, b) => (defaultOrder.indexOf(a) < 0 ? 99 : defaultOrder.indexOf(a)) -
      (defaultOrder.indexOf(b) < 0 ? 99 : defaultOrder.indexOf(b)) || a.localeCompare(b, "pt")
  );

  container.hidden = false;
  container.className = `location-filters ${isBrazilian ? "is-brazilian" : "is-foreign"}`;
  document.body.classList.add("has-location-filter");
  const groupItems = groups.map((group) => {
      const entries = [...new Set(
        people.filter((node) => node[groupField] === group).map((node) => node[detailField]).filter(Boolean)
      )].sort();
      const groupLabel = prefix ? `${prefix} ${group}` : group;
      const item = document.createElement("div");
      item.className = "location-group";
      const selectedGroup = selection.groups.has(group);
      const expanded = selection.expanded.has(group);
      item.innerHTML = `
        <button class="location-group-button${selectedGroup ? " active" : ""}${expanded ? " expanded" : ""}" type="button" aria-expanded="${expanded}">
          <span>${groupLabel}</span><span class="location-chevron">⌄</span>
        </button>
        <div class="location-options" ${expanded ? "" : "hidden"}></div>`;
      item.querySelector(".location-group-button").addEventListener("click", () => {
        closeCardForFilterChange();
        if (selectedGroup) {
          selection.groups.delete(group);
          selection.expanded.delete(group);
          entries.forEach((entry) => selection.details.delete(entry));
        } else {
          selection.groups.add(group);
          selection.expanded.add(group);
        }
        syncLocationFilter(groupField, detailField);
        renderLocationFilters();
        window.applyAllFilters();
      });
      const options = item.querySelector(".location-options");
      entries.forEach((entry) => {
        const button = document.createElement("button");
        const selectedDetail = selection.details.has(entry);
        button.className = `location-option${selectedDetail ? " active" : ""}`;
        button.type = "button";
        button.textContent = entry;
        button.addEventListener("click", () => {
          closeCardForFilterChange();
          if (selectedDetail) selection.details.delete(entry);
          else selection.details.add(entry);
          selection.groups.add(group);
          selection.expanded.add(group);
          syncLocationFilter(groupField, detailField);
          renderLocationFilters();
          window.applyAllFilters();
        });
        options.append(button);
      });
      return item;
    });
  container.replaceChildren(...groupItems);
  container.addEventListener("scroll", () => syncLocationScrollbar(container), { passive: true });
  requestAnimationFrame(() => syncLocationScrollbar(container));
}

function setupNationalityFilter() {
  document.querySelectorAll(".nat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeCardForFilterChange();
      const val = btn.dataset.value;
      if (window.selectedNationalities.has(val)) {
        window.selectedNationalities.delete(val);
      } else {
        window.selectedNationalities.add(val);
      }
      document.querySelectorAll(".nat-btn").forEach((button) =>
        button.classList.toggle("active", window.selectedNationalities.has(button.dataset.value))
      );
      // Keep legacy currentNationality in sync for other code that reads it
      if (window.selectedNationalities.size === 1) {
        window.currentNationality = [...window.selectedNationalities][0];
      } else {
        window.currentNationality =
          window.selectedNationalities.size === 0 ? "all" : "both";
      }
      if (window.selectedNationalities.size === 0) {
        _setLegendDesc(LEGEND_DEFAULT);
      } else if (window.selectedNationalities.size === 1) {
        _setLegendDesc(
          _natLegendFor([...window.selectedNationalities][0]) || LEGEND_DEFAULT
        );
      } else {
        _setLegendDesc(LEGEND_DEFAULT);
      }
      resetLocationSelection(
        window.selectedNationalities.size === 1 ? [...window.selectedNationalities][0] : null
      );
      renderLocationFilters();
      window.applyAllFilters();
    });
  });
  if (DEBUG) console.log("Listener de nacionalidade configurado.");
}

window.selectCategoryFilter = function (categoryValue, openCard = true) {
  if (window.selectedCategoryHighlights)
    window.selectedCategoryHighlights.clear();

  const isSameCategory = window.currentCategory === categoryValue;

  if (window.selectedCategories) {
    window.selectedCategories.clear();
    if (!isSameCategory) window.selectedCategories.add(categoryValue);
  }

  document.querySelectorAll(".category-btn").forEach((button) => {
    button.classList.toggle(
      "active",
      !isSameCategory && button.dataset.value === categoryValue
    );
  });

  if (isSameCategory) {
    window.currentCategory = "all";
    window._categoryFilterFocusActive = false;
    window._pendingAreaCard = null;
    if (typeof focusNode === "function") focusNode(null, null);
  } else {
    window.currentCategory = categoryValue;
    window._categoryFilterFocusActive = true;
    window._pendingAreaCard = openCard ? categoryValue : null;
  }

  window.applyAllFilters();
};

function setupDesignerSearch() {
  const searchEl = document.getElementById("search-input");
  if (!searchEl) return;
  const updateSearchLine = () => {
    const wrapper = searchEl.closest(".search-wrapper");
    if (!wrapper) return;
    if (!searchEl.value) {
      wrapper.style.setProperty("--search-line-width", "236px");
      return;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = getComputedStyle(searchEl).font;
    const textWidth = Math.ceil(context.measureText(searchEl.value).width + 2);
    wrapper.style.setProperty("--search-line-width", `${Math.min(236, Math.max(8, textWidth))}px`);
  };
  d3.select("#search-input").on("input", function () {
    updateSearchLine();
    const wrapper = searchEl.closest(".search-wrapper");
    wrapper?.classList.toggle("has-search-value", Boolean(this.value.trim()));
    window.applyAllFilters();
  });
  updateSearchLine();
  searchEl.closest(".search-wrapper")?.classList.toggle(
    "has-search-value",
    Boolean(searchEl.value.trim())
  );
  if (DEBUG) console.log("Listener de pesquisa configurado.");
}

function updateMenuCounts(nodes, links) {
  const people = nodes.filter((node) => !node.isCategory && !node.isTechnique);
  const peopleByAxis = new Map(VALID_CATEGORIES.map((axis) => [axis, new Set()]));
  const techniquesByAxis = new Map(VALID_CATEGORIES.map((axis) => [axis, new Set()]));
  const axesByTechnique = new Map();

  links.forEach((link) => {
    if (link.type !== "technique-category-link") return;
    const source = String(typeof link.source === "object" ? link.source.id : link.source);
    const target = String(typeof link.target === "object" ? link.target.id : link.target);
    const techniqueId = source.startsWith("TEC_") ? source : target;
    const axis = source.startsWith("TEC_") ? target : source;
    if (!axesByTechnique.has(techniqueId)) axesByTechnique.set(techniqueId, new Set());
    axesByTechnique.get(techniqueId).add(axis);
    if (techniquesByAxis.has(axis)) techniquesByAxis.get(axis).add(techniqueId);
  });

  links.forEach((link) => {
    if (link.type !== "person-technique-link") return;
    const source = String(typeof link.source === "object" ? link.source.id : link.source);
    const target = String(typeof link.target === "object" ? link.target.id : link.target);
    const personId = source.startsWith("TEC_") ? target : source;
    const techniqueId = source.startsWith("TEC_") ? source : target;
    (axesByTechnique.get(techniqueId) || []).forEach((axis) => {
      if (peopleByAxis.has(axis)) peopleByAxis.get(axis).add(personId);
    });
  });

  links.forEach((link) => {
    if (link.type !== "person-category-fallback-link") return;
    const source = typeof link.source === "object" ? link.source.id : link.source;
    const target = typeof link.target === "object" ? link.target.id : link.target;
    const axis = VALID_CATEGORIES.includes(source) ? source : target;
    const personId = axis === source ? target : source;
    if (peopleByAxis.has(axis)) peopleByAxis.get(axis).add(personId);
  });

  // Contador de Nacionalidade ficará fixo durante os testes visuais do Menu.
  document.getElementById("nationality-count").textContent = "000";
  document.getElementById("axes-count").textContent = "000";
  document.getElementById("search-count").textContent = people.length;
  // A contagem provisória fica somente na pesquisa por nome.
  document.getElementById("year-count").textContent = "0";
  document.querySelectorAll(".category-btn").forEach((button) => {
    const axis = button.dataset.value;
    const selectedInMenu = window.selectedCategories?.has(axis);
    const count = selectedInMenu
      ? peopleByAxis.get(axis)?.size || 0
      : techniquesByAxis.get(axis)?.size || 0;
    const countEl = button.querySelector(".menu-count");
    if (countEl) countEl.textContent = count;
  });

}
window._updateMenuCounts = updateMenuCounts;

// Uma mudança explícita de filtro encerra o perfil anterior, sem apagar a pesquisa.
function closeCardForFilterChange() {
  const input = document.getElementById("search-input");
  if (window._searchProfileActive && input) input.value = window._searchProfileTerm || input.value;
  window._searchProfileActive = false;
  window._searchProfileTerm = "";
  window._pendingAreaCard = null;
  window._returnToAreaCardId = null;
  // Evita reiniciar/desfocar a simulação quando nenhum card está aberto.
  if (activeNode || document.querySelector('.info-panel')?.classList.contains('is-open')) {
    focusNode(null, null, { closeCard: true });
  }
}

function setupMenuControls() {
  document.getElementById("menu-reset")?.addEventListener("click", () => window.resetFilters?.());
  document.getElementById("search-results-back")?.addEventListener("click", () => {
    const searchInput = document.getElementById("search-input");
    const searchTerm = window._searchProfileTerm || searchInput?.value || "";
    const areaCard = document.getElementById("card-tec-area");
    const techniqueCard = areaCard?.classList.contains("technique-card");
    const returnToAreaCardId = window._returnToAreaCardId;
    const leavingAdinkraCard = areaCard?.classList.contains("adinkra-card") &&
      !areaCard.classList.contains("technique-card");

    // Quando a técnica foi aberta a partir de um adinkra filtrado, a seta
    // deve voltar para esse mesmo card, mantendo o filtro de área ativo.
    // O foco pendente é aplicado depois que o grafo filtrado é reconstruído.
    if (techniqueCard && returnToAreaCardId) {
      window._searchProfileTerm = "";
      window._searchProfileActive = false;
      if (searchInput) searchInput.value = searchTerm;
      window._currentSearchTerm = normalizeKey(searchTerm);
      window._pendingAreaCard = null;
      if (typeof focusNode === "function") focusNode(null, null, { closeCard: true });
      window._pendingAreaCard = returnToAreaCardId;
      window._returnToAreaCardId = null;
      window.applyAllFilters?.(true);
      return;
    }

    // O retorno de um card de adinkra encerra também o filtro que abriu o
    // card. Sem isso, o próximo clique combinava filtro de área com destaque
    // manual e fazia conexões de outras áreas reaparecerem.
    if (leavingAdinkraCard) {
      window.currentCategory = "all";
      window.selectedCategories?.clear();
      window.selectedCategoryHighlights?.clear();
      window._categoryFilterFocusActive = false;
      window._returnToAreaCardId = null;
      document.querySelectorAll(".category-btn").forEach((button) => {
        button.classList.remove("active");
      });
    }

    // Fecha qualquer card, preserva os filtros e restaura a pesquisa, se houver.
    // Não usa o desfoco padrão, que reabriria o card do adinkra selecionado.
    window._searchProfileTerm = "";
    window._searchProfileActive = false;
    if (searchInput) searchInput.value = searchTerm;
    window._currentSearchTerm = normalizeKey(searchTerm);
    window._pendingAreaCard = null;
    if (typeof focusNode === "function") focusNode(null, null, { closeCard: true });
    window.applyAllFilters?.(true);
  });
  const axesReset = document.getElementById("axes-reset");
  const nationalityReset = document.getElementById("menu-reset");
  if (axesReset && nationalityReset) {
    axesReset.innerHTML = nationalityReset.innerHTML;
    axesReset.addEventListener("click", () => window.resetFilters?.());
  }
  const yearReset = document.getElementById("year-reset");
  if (yearReset && nationalityReset) {
    yearReset.innerHTML = nationalityReset.innerHTML;
    yearReset.addEventListener("click", () => {
      closeCardForFilterChange();
      window.currentPeriod = "all";
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
  document.getElementById("menu-help")?.addEventListener("click", () => {
    showToast("Use os filtros para combinar nacionalidade, eixo, nome e ano de nascimento.");
  });
  document.getElementById("toggle-all-names")?.addEventListener("click", (event) => {
    if (window._hasActivePersonSelection?.()) {
      showToast(
        "Feche a pessoa selecionada antes de mostrar todos os nomes.",
        "info",
        document.querySelector(".search-wrapper")
      );
      return;
    }
    const visible = !window.DBG_ALL_NAMES_VISIBLE;
    window._setAllNamesVisible?.(visible);
    event.currentTarget.classList.toggle("active", visible);
    event.currentTarget.setAttribute("aria-pressed", String(visible));
    event.currentTarget.setAttribute(
      "aria-label",
      visible ? "Ocultar todos os nomes" : "Mostrar todos os nomes"
    );
  });
  document.getElementById("year-info")?.addEventListener("click", () => {
    showToast("Arraste as extremidades para selecionar o intervalo de anos de nascimento.");
  });
}

function setupLogoReset() {
  const navCenter = document.querySelector(".nav-center");
  if (!navCenter) return;
  navCenter.style.cursor = "pointer";
  navCenter.style.pointerEvents = "all";
  window.resetFilters = () => {
    window._setAllNamesVisible?.(false);
    const namesButton = document.getElementById("toggle-all-names");
    namesButton?.classList.remove("active");
    namesButton?.setAttribute("aria-pressed", "false");
    namesButton?.setAttribute("aria-label", "Mostrar todos os nomes");
    // Reseta filtros
    window.currentCategory = "all";
    window.currentNationality = "all";
    window.currentPeriod = "all";
    if (window.selectedNationalities) window.selectedNationalities.clear();
    resetLocationSelection();
    renderLocationFilters();
    if (window.selectedCategories) window.selectedCategories.clear();
    document
      .querySelectorAll(".category-btn, .nat-btn")
      .forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".year-period-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.period === "Todos");
    });
    // Limpa busca
    const searchEl = document.getElementById("search-input");
    if (searchEl) searchEl.value = "";
    // Reseta slider
    if (window._sliderReset) window._sliderReset();
    window._pendingAreaCard = null;
    // Fecha card
    if (typeof focusNode === "function") focusNode(null, null);
    // Redesenha
    window.applyAllFilters(true);
  };
  navCenter.addEventListener("click", window.resetFilters);
}

// ===== CARREGAMENTO DOS DADOS =====

async function loadDesignersFromApi() {
  const base = await window.getBlackvisApiBase();
  window.BLACKVIS_API_RUNTIME_BASE = base;
  const response = await fetch(`${base}/api/designers`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados das pessoas.");
  return body.designers || [];
}

Promise.all([d3.json("data/areas.json"), loadDesignersFromApi()])
  .then(([areasData, data]) => {
    // Constrói mapa técnica → área canônica a partir de areas.json
    const techniqueAreaMap = new Map();
    const areaTechniqueOrder = new Map();
    const tecnicaDescricoes = {};
    const areaDescricoes = {};
    const adinkraInfo = {};

    areasData.forEach((areaEntry) => {
      areaTechniqueOrder.set(
        areaEntry.area,
        areaEntry.tecnicas.map((tec) => tec.nome)
      );
      areaEntry.tecnicas.forEach((tec) => {
        techniqueAreaMap.set(tec.nome, areaEntry.area);
        tecnicaDescricoes[tec.nome] = tec.descricao || "";
      });
      areaDescricoes[areaEntry.area] = areaEntry.descricao || "";
      if (areaEntry.adinkra) adinkraInfo[areaEntry.area] = areaEntry.adinkra;
    });

    window._techniqueAreaMap = techniqueAreaMap;
    window._areaTechniqueOrder = areaTechniqueOrder;
    // Expõe como globais para uso em interactions.js
    window.TECNICA_DESCRICOES = tecnicaDescricoes;
    window.AREA_DESCRICOES = areaDescricoes;
    window.ADINKRA_INFO = adinkraInfo;

    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(
      processedData.nodes,
      processedData.links
    );
    processedData.nodes = calculateSaturationLevel(processedData.nodes);
    allNodes = processedData.nodes;
    allLinks = processedData.links;

    buildColorMaps(allNodes, allLinks);

    const designerNodes = allNodes.filter((d) => !d.isCategory && !d.isTechnique && getBirthYear(d) !== null);
    const minDataYear =
      d3.min(designerNodes, getBirthYear) ||
      YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, getBirthYear) ||
      YEAR_MAX_DEFAULT;

    window.currentMin = minDataYear;
    window.currentMax = maxDataYear;
    window.currentCategory = "all";
    window.currentNationality = "all";
    window.currentPeriod = "all";

    initSlider(minDataYear, maxDataYear);
    setupCategoryFilter();
    setupNationalityFilter();
    renderLocationFilters();
    setupDesignerSearch();
    setupLogoReset();
    setupMenuControls();

    window.applyAllFilters();
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar dados:", error);
    showToast("Erro ao carregar os dados.", "erro");
  });

// ===== APPLY ALL FILTERS =====

// Todas as técnicas e eixos de uma pessoa, direto de allLinks (sem
// filtro nenhum aplicado). Usada pela exceção de foco em pessoa: ao
// focar alguém, ela sempre traz sua vizinhança completa, mesmo que o
// filtro de área ativo excluísse parte dela.
function _fullNeighborhoodOf(personId) {
  const ids = new Set([personId]);
  const directNeighbors = new Set();

  allLinks.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s === personId) {
      ids.add(t);
      directNeighbors.add(t);
    }
    if (t === personId) {
      ids.add(s);
      directNeighbors.add(s);
    }
  });

  // Segundo salto: o eixo/categoria de cada técnica encontrada, pra
  // aparecer o eixo junto, não só a técnica isolada.
  allLinks.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (directNeighbors.has(s)) ids.add(t);
    if (directNeighbors.has(t)) ids.add(s);
  });

  return ids;
}

// Verifica se algum vizinho real da pessoa (em allLinks, sem filtro)
// está faltando no grafo atualmente desenhado. Só quando falta algo
// vale a pena recalcular o grafo inteiro — evita redesenhar tudo em
// todo clique de pessoa, só quando a exceção do filtro realmente
// precisa entrar em ação.
function _personNeedsFullNeighborhoodExpansion(personId) {
  const currentIds = new Set(graphData.nodes.map((n) => n.id));
  return allLinks.some((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s !== personId && t !== personId) return false;
    const otherId = s === personId ? t : s;
    return !currentIds.has(otherId);
  });
}

function applyAllFilters(centerNodes = false) {
  const rawSearchTerm = document.getElementById("search-input")?.value || "";
  const searchTerm = normalizeKey(rawSearchTerm);
  const isNameSearch = searchTerm !== "";

  let filteredNodes;

  switch (true) {
    // ── Busca por nome: sempre global — ignora filtro de área ──
    case isNameSearch: {
      let searchPool = allNodes.filter((d) => !d.isCategory && !d.isTechnique);

      const natSel = window.selectedNationalities;
      if (natSel && natSel.size > 0) {
        searchPool = searchPool.filter((d) => natSel.has(d["Nacionalidade"]));
      }

      const matched = searchPool.filter((d) =>
        normalizeKey(d.Nome || "")
          .split(" ")
          .some((part) => part.startsWith(searchTerm))
      );

      if (matched.length === 0) {
        showToast("Designer não encontrado", "erro", document.querySelector(".search-wrapper"));
        return;
      }

      filteredNodes = [...matched];
      window._searchMatched = matched;

      const legendHtml = `Exibindo resultados para "<strong>${rawSearchTerm}</strong>". Encontramos <strong>${
        matched.length
      } designer${
        matched.length !== 1 ? "s" : ""
      }</strong> correspondentes à sua busca.`;
      _setLegendDesc(legendHtml);

      window._currentSearchTerm = searchTerm;
      break;
    }

    // ── Visualização normal: filtros combináveis + exceção de foco ──
    default: {
      const categoryFilter = window.currentCategory;
      const nationalityFilter = window.currentNationality;
      const periodFilter = window.currentPeriod;
      const minYear = window.currentMin;
      const maxYear = window.currentMax;
      const selectedCats = window.selectedCategories;
      const areaFilterActive = !!(selectedCats && selectedCats.size > 0);

      const techsInCategories = areaFilterActive
        ? new Set(
            allLinks
              .filter((l) => {
                const t = typeof l.target === "object" ? l.target.id : l.target;
                return (
                  selectedCats.has(t) && l.type === "technique-category-link"
                );
              })
              .map((l) =>
                typeof l.source === "object" ? l.source.id : l.source
              )
          )
        : null;
      // Para o filtro de eixo, a fonte de verdade são os links reais:
      // pessoa → técnica → eixo. O campo "Área do design" pode listar
      // interesses/contextos adicionais e não deve criar uma conexão visual.
      const peopleInSelectedCategories = areaFilterActive
        ? new Set(
            allLinks.flatMap((link) => {
              if (link.type !== "person-technique-link") return [];
              const source = typeof link.source === "object" ? link.source.id : link.source;
              const target = typeof link.target === "object" ? link.target.id : link.target;
              if (techsInCategories.has(source)) return [target];
              if (techsInCategories.has(target)) return [source];
              return [];
            })
          )
        : null;

      // Cada filtro descreve só duas coisas: "está ativo?" e "essa
      // pessoa bate?". Um nó passa se, pra TODO filtro ativo, ele bate
      // — não importa quantos estejam ligados ao mesmo tempo, porque é
      // sempre uma intersecção (E lógico). Pra adicionar um filtro novo
      // no futuro (ex: gênero), basta uma entrada aqui, sem mexer em
      // mais nada — inclusive resolve o filtro de nacionalidade, que
      // antes só funcionava dentro do modo de busca.
      const FILTER_DEFINITIONS = {
        area: {
          isActive: () => areaFilterActive,
          matches: (node) => peopleInSelectedCategories.has(node.id),
        },
        nationality: {
          isActive: () =>
            window.selectedNationalities &&
            window.selectedNationalities.size > 0,
          matches: (node) =>
            window.selectedNationalities.has(node["Nacionalidade"]),
        },
        location: {
          isActive: () => Boolean(window.locationFilter),
          matches: (node) => {
            const filter = window.locationFilter;
            return filter.values
              ? filter.values.has(node[filter.field])
              : node[filter.field] === filter.value;
          },
        },
        period: {
          isActive: () => periodFilter !== "all" && periodFilter !== "Todos",
          matches: (node) => {
            const hasBirthYear = getBirthYear(node) !== null;
            return periodFilter === "Com dados" ? hasBirthYear : !hasBirthYear;
          },
        },
        birthYear: {
          // Sempre "ativo", mas nunca bloqueia quem não tem a data
          // preenchida — mantém o comportamento já existente.
          isActive: () => true,
          matches: (node) => {
            const birthYear = getBirthYear(node);
            if (birthYear === null) return true;
            return birthYear >= minYear && birthYear <= maxYear;
          },
        },
      };

      function personMatchesActiveFilters(node) {
        return Object.values(FILTER_DEFINITIONS).every(
          (filter) => !filter.isActive() || filter.matches(node)
        );
      }

      // A visualização parte das pessoas que passaram por TODOS os
      // filtros. Técnicas e eixos só entram quando existe uma ligação
      // real com esse conjunto. Isso evita eixos/tecnicas vazios e faz
      // o clique no adinkra e no Menu operarem sobre a mesma rede.
      const visiblePeople = allNodes.filter(
        (node) => !node.isCategory && !node.isTechnique && personMatchesActiveFilters(node)
      );
      const visibleIds = new Set(visiblePeople.map((node) => node.id));
      const visibleTechniqueIds = new Set();

      allLinks.forEach((link) => {
        const source = typeof link.source === "object" ? link.source.id : link.source;
        const target = typeof link.target === "object" ? link.target.id : link.target;
        if (link.type === "person-technique-link") {
          if (visibleIds.has(source)) visibleTechniqueIds.add(target);
          if (visibleIds.has(target)) visibleTechniqueIds.add(source);
        }
        if (link.type === "person-category-fallback-link") {
          if (visibleIds.has(source)) visibleIds.add(target);
          if (visibleIds.has(target)) visibleIds.add(source);
        }
      });

      visibleTechniqueIds.forEach((id) => visibleIds.add(id));
      allLinks.forEach((link) => {
        if (link.type !== "technique-category-link") return;
        const source = typeof link.source === "object" ? link.source.id : link.source;
        const target = typeof link.target === "object" ? link.target.id : link.target;
        if (visibleTechniqueIds.has(source)) visibleIds.add(target);
        if (visibleTechniqueIds.has(target)) visibleIds.add(source);
      });

      filteredNodes = allNodes.filter((node) => visibleIds.has(node.id));

      window._currentSearchTerm = "";
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
        .filter(
          (d) =>
            !allLinks.some((l) => {
              const s = typeof l.source === "object" ? l.source.id : l.source;
              const t = typeof l.target === "object" ? l.target.id : l.target;
              return s === d.id || t === d.id;
            })
        )
        .map((d) => d.id)
    );

    const keptByCategory = new Set(
      window.selectedCategories && window.selectedCategories.size > 0
        ? filteredNodes
            .filter((d) => !d.isCategory && !d.isTechnique)
            .map((d) => d.id)
        : []
    );

    filteredNodes = filteredNodes.filter(
      (d) =>
        connectedIds.has(d.id) ||
        neverConnected.has(d.id) ||
        keptByCategory.has(d.id)
    );
  }

  if (!isNameSearch) window._searchMatched = null;

  // Em qualquer filtro ativo, as linhas fazem parte do resultado: não
  // escondemos as conexões que explicam por que cada pessoa apareceu.
  window._hasActiveMenuFilter = Boolean(
    isNameSearch ||
      window.selectedCategories?.size ||
      window.selectedNationalities?.size ||
      window.locationFilter ||
      (window.currentPeriod && window.currentPeriod !== "all" && window.currentPeriod !== "Todos") ||
      window.currentMin !== window._sliderMin ||
      window.currentMax !== window._sliderMax
  );

  updateMenuCounts(filteredNodes, filteredLinks);

  drawForceGraph(
    { nodes: filteredNodes, links: filteredLinks },
    isNameSearch || centerNodes
  );

  if (
    isNameSearch &&
    window._searchMatched &&
    typeof window._setupSearchLayout === "function"
  ) {
    window._setupSearchLayout(window._searchMatched);
  }

  if (typeof window._applySearchLabels === "function") {
    window._applySearchLabels(window._currentSearchTerm || "");
  }
  if (typeof window._applyNatVisuals === "function") {
    window._applyNatVisuals();
  }

  if (window._pendingAreaCard && typeof focusNode === "function") {
    // Clicar no filtro → abre card
    const areaNode = filteredNodes.find(
      (node) => node.isCategory && node.id === window._pendingAreaCard
    );
    if (areaNode) {
      focusNode(null, areaNode, { areaFromFilter: true });
    }
    window._pendingAreaCard = null;
  }

  // O grafo recriado recebe rótulos novos. Restaura a preferência do olho
  // depois da busca e do foco, inclusive ao remover o último filtro de eixo.
  // Usa apenas as pessoas do grafo filtrado, sem incluir resultados externos.
  if (!isNameSearch && window.DBG_ALL_NAMES_VISIBLE) {
    window._setAllNamesVisible?.(true);
  }
}

window.applyAllFilters = applyAllFilters;
