// Uma mudança explícita de filtro encerra o perfil anterior, sem apagar a pesquisa.
function closeCardForFilterChange() {
  const input = document.getElementById("search-input");
  const selectedAreaId = activeNode?.isCategory &&
    window.selectedCategories?.has(activeNode.id) ? activeNode.id : null;
  if (window._searchProfileActive && input) input.value = window._searchProfileTerm || input.value;
  window._searchProfileActive = false;
  window._searchProfileTerm = "";
  window._pendingAreaCard = null;
  window._returnToAreaCardId = null;
  // Evita reiniciar/desfocar a simulação quando nenhum card está aberto.
  if (activeNode || document.querySelector('.info-panel')?.classList.contains('is-open')) {
    focusNode(null, null, { closeCard: true });
  }
  // O filtro altera as pessoas do eixo, mas a escolha do eixo continua ativa.
  // O motor reabre o card após montar o grafo com os resultados atualizados.
  if (selectedAreaId) {
    window._pendingAreaCard = selectedAreaId;
    window._categoryFilterFocusActive = true;
  }
}

function setupMenuControls() {
  document.getElementById("menu-reset")?.addEventListener("click", () => {
    closeCardForFilterChange();
    window.selectedNationalities?.clear();
    window.currentNationality = "all";
    window._lastFilterAction = null;
    resetLocationSelection();
    document.querySelectorAll(".nat-btn").forEach((button) => button.classList.remove("active"));
    renderLocationFilters();
    window.applyAllFilters?.();
  });
  document.getElementById("search-results-back")?.addEventListener("click", () => {
    const previousFocus = window._focusNavigationHistory?.pop();
    if (previousFocus) {
      // Rebuild the filtered graph first, removing any extra neighbors
      // introduced by the person's profile, then restore the previous card.
      focusNode(null, null, { closeCard: true, preserveHistory: true });
      window._returnToAreaCardId = null;
      window.applyAllFilters(true);
      const previousNode = graphData.nodes.find((node) => node.id === previousFocus.id);
      if (previousNode) {
        focusNode(null, previousNode, {
          areaFromFilter: previousFocus.isCategory,
          restoreHistory: true,
        });
      }
      return;
    }
    const searchInput = document.getElementById("search-input");
    const searchTerm = window._searchProfileTerm || searchInput?.value || "";
    const areaCard = document.getElementById("card-tec-area");
    const techniqueCard = activeNode?.isTechnique && areaCard?.classList.contains("technique-card");
    const returnToAreaCardId = window._returnToAreaCardId;
    const leavingAdinkraCard = activeNode?.isCategory && areaCard?.classList.contains("adinkra-card") &&
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
    axesReset.addEventListener("click", () => {
      closeCardForFilterChange();
      window.selectedCategories?.clear();
      window.selectedCategoryHighlights?.clear();
      window.currentCategory = "all";
      window._categoryFilterFocusActive = false;
      window._pendingAreaCard = null;
      window._lastFilterAction = null;
      document.querySelectorAll(".category-btn").forEach((button) => button.classList.remove("active"));
      window.applyAllFilters?.();
    });
  }
  setupYearPeriodControls();
  setupNameVisibilityControl();
}
