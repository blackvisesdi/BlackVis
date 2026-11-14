// Aplica os filtros de nacionalidade e atualiza suas descrições.
function _setLegendDesc(text) {
  const el = document.getElementById("bb-description");
  if (!el) return;
  el.textContent = text;
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
  return (window._legendDescriptions && window._legendDescriptions[key]) || "";
}

window.selectedNationalities = new Set();
window.locationFilter = null;
window._lastFilterAction = null;
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

// Location options depend on the other filters, but not on the current
// location selection: sibling countries must remain available to select.
function getLocationFilterPeople(nationality) {
  const searchTerm = normalizeKey(document.getElementById("search-input")?.value || "");
  const selectedCats = window.selectedCategories;
  const techniqueIds = new Set();
  const peopleIds = new Set();
  if (!searchTerm && selectedCats?.size) {
    allLinks.forEach((link) => {
      if (link.type !== "technique-category-link") return;
      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;
      if (selectedCats.has(target)) techniqueIds.add(source);
      if (selectedCats.has(source)) techniqueIds.add(target);
    });
    allLinks.forEach((link) => {
      if (link.type !== "person-technique-link") return;
      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;
      if (techniqueIds.has(source)) peopleIds.add(target);
      if (techniqueIds.has(target)) peopleIds.add(source);
    });
  }
  return allNodes.filter((node) => {
    if (node.isCategory || node.isTechnique || node.Nacionalidade !== nationality) return false;
    if (searchTerm) {
      return normalizeKey(node.Nome || "").split(" ").some((part) => part.startsWith(searchTerm));
    }
    if (selectedCats?.size && !peopleIds.has(node.id)) return false;
    const year = getBirthYear(node);
    if (window.currentPeriod === "Com dados" && year === null) return false;
    if (window.currentPeriod === "Sem dados" && year !== null) return false;
    if (window._yearSliderTouched &&
        (year === null || year < window.currentMin || year > window.currentMax)) return false;
    return true;
  });
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
  const people = getLocationFilterPeople(nationality);
  const availableGroups = new Set(people.map((node) => node[groupField]).filter(Boolean));
  const availableDetails = new Set(people.map((node) => node[detailField]).filter(Boolean));
  // A selection that disappeared after a change of axis/year cannot remain
  // invisibly active and keep the graph empty.
  selection.groups.forEach((group) => {
    if (!availableGroups.has(group)) selection.groups.delete(group);
  });
  selection.details.forEach((detail) => {
    if (!availableDetails.has(detail)) selection.details.delete(detail);
  });
  selection.expanded.forEach((group) => {
    if (!availableGroups.has(group)) selection.expanded.delete(group);
  });
  syncLocationFilter(groupField, detailField);
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
        <div class="location-group-header">
          <button class="location-group-button${selectedGroup ? " active has-reset" : ""}${expanded ? " expanded" : ""}" type="button" aria-expanded="${expanded}">
            <span>${groupLabel}</span><span class="location-chevron">⌄</span>
          </button>
          ${selectedGroup ? `<button class="location-group-reset" type="button" aria-label="Limpar filtro de ${groupLabel}" title="Limpar filtro de ${groupLabel}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 11a7 7 0 1 1-2.1-5M19 4v5h-5"/></svg></button>` : ""}
        </div>
        <div class="location-options" ${expanded ? "" : "hidden"}></div>`;
      const clearGroup = ({ keepExpanded = false } = {}) => {
        selection.groups.delete(group);
        if (!keepExpanded) selection.expanded.delete(group);
        entries.forEach((entry) => selection.details.delete(entry));
        syncLocationFilter(groupField, detailField);
      };
      item.querySelector(".location-group-button").addEventListener("click", () => {
        closeCardForFilterChange();
        if (selectedGroup) {
          clearGroup();
        } else {
          selection.groups.add(group);
          selection.expanded.add(group);
        }
        syncLocationFilter(groupField, detailField);
        window._lastFilterAction = selectedGroup
          ? null
          : () => {
              selection.groups.delete(group);
              selection.expanded.delete(group);
              entries.forEach((entry) => selection.details.delete(entry));
              syncLocationFilter(groupField, detailField);
              renderLocationFilters();
              window.applyAllFilters();
            };
        renderLocationFilters();
        window.applyAllFilters();
      });
      item.querySelector(".location-group-reset")?.addEventListener("click", () => {
        closeCardForFilterChange();
        clearGroup({ keepExpanded: true });
        window._lastFilterAction = null;
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
          window._lastFilterAction = selectedDetail
            ? null
            : () => {
                selection.details.delete(entry);
                if (!selection.details.size) selection.groups.delete(group);
                syncLocationFilter(groupField, detailField);
                renderLocationFilters();
                window.applyAllFilters();
              };
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
        window._lastFilterAction = null;
      } else {
        window.selectedNationalities.add(val);
        window._lastFilterAction = () => {
          window.selectedNationalities.delete(val);
          window.currentNationality = window.selectedNationalities.size
            ? [...window.selectedNationalities][0]
            : "all";
          resetLocationSelection(
            window.selectedNationalities.size === 1 ? [...window.selectedNationalities][0] : null
          );
          document.querySelectorAll(".nat-btn").forEach((button) =>
            button.classList.toggle("active", window.selectedNationalities.has(button.dataset.value))
          );
          renderLocationFilters();
          window.applyAllFilters();
        };
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
