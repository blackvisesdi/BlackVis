// Navegação superior e atualização do layout na mudança de tamanho.

function setupNavigation() {
  // O botão Início leva à página principal. O logo central continua resetando o grafo.
}

let _resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (window.applyAllFilters) window.applyAllFilters();
  }, 220);
});

document.addEventListener("DOMContentLoaded", setupNavigation);
