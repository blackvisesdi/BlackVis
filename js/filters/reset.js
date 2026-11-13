// Reinicia a visualização e os filtros solicitados.
function setupLogoReset() {
  const navCenter = document.querySelector(".nav-center");
  if (!navCenter) return;
  navCenter.style.cursor = "pointer";
  navCenter.style.pointerEvents = "all";
  window.resetFilters = () => {
    window._focusNavigationHistory = [];
    window._lastFilterAction = null;
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
