// ===== SETUP DE LISTENERS =====

function setupCategoryFilter() {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.selectCategoryFilter(btn.dataset.value, true);
    });
  });
  if (DEBUG) console.log("Listener de categoria configurado.");
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
    window._lastFilterAction = null;
    window.currentCategory = "all";
    window._categoryFilterFocusActive = false;
    window._pendingAreaCard = null;
    if (typeof focusNode === "function") focusNode(null, null);
  } else {
    window._lastFilterAction = () => window.selectCategoryFilter(categoryValue, false);
    window.currentCategory = categoryValue;
    window._categoryFilterFocusActive = true;
    window._pendingAreaCard = openCard ? categoryValue : null;
  }

  window.applyAllFilters();
};
