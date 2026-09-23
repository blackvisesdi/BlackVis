// MENSAGENS DA INTERFACE
// Carrega descrições exibidas ao passar o mouse e conecta atualizações responsivas
// ao motor de filtros. Este módulo não controla dados nem renderização do grafo.

const LEGEND_DEFAULT =
  "BlackVIS é uma visualização de designers negros brasileiros e estrangeiros, conectando pessoas, técnicas e áreas do design.";

function setupDynamicLegend() {
  fetch("data/legend-descriptions.json")
    .then((r) => r.json())
    .then((descriptions) => {
      window._legendDescriptions = descriptions;
      const descEl = document.getElementById("bb-description");
      if (!descEl) return;

      descEl.textContent = LEGEND_DEFAULT;

      function showDesc(key) {
        const text = descriptions[key];
        if (!text) return;
        descEl.innerHTML = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
      }

      function hideDesc() {
        descEl.textContent = LEGEND_DEFAULT;
      }

      const bindings = [
        { selector: ".nav-link:first-child", key: "home" },
        { selector: ".nav-link:last-child", key: "sobre" },
        { selector: "#nav-logo", key: "logo" },
        { selector: ".nat-btn", key: "nationality", multiple: true },
        { selector: ".category-btn", key: "adinkras", multiple: true },
        { selector: ".search-wrapper", key: "search" },
        { selector: "#year-slider", key: "yearSlider" },
      ];

      bindings.forEach(({ selector, key, multiple }) => {
        const targets = multiple
          ? Array.from(document.querySelectorAll(selector))
          : [document.querySelector(selector)].filter(Boolean);
        targets.forEach((target) => {
          target.addEventListener("mouseenter", () => showDesc(key));
          target.addEventListener("mouseleave", hideDesc);
        });
      });
    })
    .catch(() => {});
}

let _resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (window.applyAllFilters) window.applyAllFilters();
  }, 220);
});

document.addEventListener("DOMContentLoaded", setupDynamicLegend);
