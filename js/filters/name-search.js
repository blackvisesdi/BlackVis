// Gerencia a pesquisa por nome e sua exibição no grafo.
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

function setupNameVisibilityControl() {
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
    event.currentTarget.title = visible ? "Oculta os nomes" : "Exibe os nomes";
  });
}
