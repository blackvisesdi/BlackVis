// Atualiza as contagens dos filtros e do painel de dados.
function updateFilteredPeopleCount(nodes, visibleIds = null) {
  const count = new Set(nodes
    .filter((node) => !node.isCategory && !node.isTechnique && (!visibleIds || visibleIds.has(node.id)))
    .map((node) => node.id)).size;
  const element = document.getElementById("data-filtered-count");
  if (element) element.textContent = count;
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
  updateFilteredPeopleCount(nodes);
  // A contagem provisória fica somente na pesquisa por nome.
  document.getElementById("year-count").textContent = "0";
  document.querySelectorAll(".category-btn").forEach((button) => {
    const axis = button.dataset.value;
    const selectedInMenu = window.selectedCategories?.has(axis);
    const count = selectedInMenu
      ? peopleByAxis.get(axis)?.size || 0
      : techniquesByAxis.get(axis)?.size || 0;
    const countEl = button.querySelector(".menu-count");
    if (countEl) {
      countEl.textContent = count;
      countEl.style.opacity = count === 0 ? "0.6" : "1";
    }
  });

}
window._updateMenuCounts = updateMenuCounts;
