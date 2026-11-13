// Mensagens de aviso, legendas e informações sobre os dados.

function showToast(msg, tipo = "info", anchorEl = null, centered = false, onClose = null) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 8px; font-size: 14px;
      font-family: Inter, sans-serif; z-index: 9999; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }

  const cores = {
    info: { bg: "#185FA5", text: "#fff" },
    erro: { bg: "#A32D2D", text: "#fff" },
    ok: { bg: "#3B6D11", text: "#fff" },
  };
  const c = cores[tipo] || cores.info;
  toast.innerHTML = "";
  const message = document.createElement("span");
  message.textContent = msg;
  toast.appendChild(message);
  toast.style.background = c.bg;
  toast.style.color = c.text;
  toast.style.border = "0";
  toast.style.boxShadow = "none";
  toast.style.padding = "10px 20px";
  toast.style.width = "auto";
  toast.style.height = "auto";
  toast.style.minHeight = "0";
  toast.style.display = "block";
  toast.style.textAlign = "left";

  if (toast._closeButton) toast._closeButton.remove();

  if (centered) {
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar mensagem");
    const closeIcon = document.createElement("img");
    closeIcon.src = "assets/icons/Botao close.svg";
    closeIcon.alt = "";
    closeButton.appendChild(closeIcon);
    closeButton.style.cssText = `
      position: absolute; top: 8px; right: 8px; width: 34px; height: 34px;
      padding: 0; border: 0; background: transparent; cursor: pointer;
      pointer-events: auto; display: grid; place-items: center;
    `;
    closeIcon.style.width = "34px";
    closeIcon.style.height = "34px";
    closeButton.addEventListener("click", () => {
      onClose?.();
      toast.style.opacity = "0";
      toast.style.pointerEvents = "none";
    });
    toast.appendChild(closeButton);
    toast._closeButton = closeButton;
    toast.style.width = "239px";
    toast.style.height = "162px";
    toast.style.minHeight = "162px";
    toast.style.display = "grid";
    toast.style.placeItems = "center";
    toast.style.textAlign = "center";
    toast.style.pointerEvents = "none";
    toast.style.background = "#232323";
    toast.style.color = "#CCCCCC";
    toast.style.border = "1px solid rgba(255,255,255,.14)";
    toast.style.borderRadius = "16px";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,.45)";
    toast.style.padding = "14px 22px";
    toast.style.left = "50%";
    toast.style.top = "50%";
    toast.style.bottom = "auto";
    toast.style.transform = "translate(-50%, -50%)";
  } else if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    toast.style.left = `${rect.left + rect.width / 2}px`;
    toast.style.top = `${Math.max(12, rect.top - 10)}px`;
    toast.style.bottom = "auto";
    toast.style.transform = "translate(-50%, -100%)";
  } else {
    toast.style.left = "50%";
    toast.style.top = "auto";
    toast.style.bottom = "24px";
    toast.style.transform = "translateX(-50%)";
  }

  toast.style.opacity = "1";
  toast.style.pointerEvents = centered ? "none" : "none";
  clearTimeout(toast._timeout);
  toast._timeout = centered
    ? null
    : setTimeout(() => {
        toast.style.opacity = "0";
      }, 3000);
}

const LEGEND_DEFAULT =
  "Passe o cursor sobre os elementos da interface para exibir explicações de uso.";

function setupDynamicLegend() {
  const popup = document.getElementById("legend-popup");
  const descEl = document.getElementById("bb-description");
  const helpButton = document.getElementById("menu-help");
  const closeButton = document.getElementById("legend-close");
  if (!popup || !descEl || !helpButton || !closeButton) return;

  helpButton.addEventListener("click", () => {
    descEl.textContent = LEGEND_DEFAULT;
    popup.hidden = false;
    document.body.classList.add("legend-open");
    helpButton.setAttribute("aria-expanded", "true");
    closeButton.focus({ preventScroll: true });
  });

  const closeLegend = () => {
    popup.hidden = true;
    document.body.classList.remove("legend-open");
    helpButton.setAttribute("aria-expanded", "false");
    descEl.textContent = LEGEND_DEFAULT;
    helpButton.focus({ preventScroll: true });
  };
  closeButton.addEventListener("click", closeLegend);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popup.hidden) closeLegend();
  });

  fetch("data/legend-descriptions.json?v=3")
    .then((r) => r.json())
    .then((descriptions) => {
      window._legendDescriptions = descriptions;

      function showDesc(key, area) {
        if (popup.hidden) return;
        const text = area ? descriptions[key]?.[area] : descriptions[key];
        if (typeof text !== "string") return;
        descEl.textContent = text;
      }

      function hideDesc() {
        if (!popup.hidden) descEl.textContent = LEGEND_DEFAULT;
      }

      const bindings = [
        { selector: "#nav-home", key: "home" },
        { selector: "#nav-sobre", key: "sobre" },
        { selector: "#nav-logo", key: "logo" },
        { selector: ".menu-nationality", key: "nationality" },
        { selector: ".nat-btn[data-value=Brasileira]", key: "nationalityBR" },
        { selector: ".nat-btn[data-value=Estrangeira]", key: "nationalityEXT" },
        { selector: ".menu-axes", key: "adinkras" },
        { selector: ".search-wrapper", key: "search" },
        { selector: ".year-filter-panel", key: "yearSlider" },
        ...["Comunicação", "Produto", "Teórico", "Interação", "Serviço"].map((area) => ({
          selector: `.menu-axes .category-btn[data-value="${area}"]`,
          key: "adinkraAreas",
          area,
          fallback: "adinkras",
        })),
      ];

      bindings.forEach(({ selector, key, area, fallback }) => {
        const targets = Array.from(document.querySelectorAll(selector));
        targets.forEach((target) => {
          target.addEventListener("mouseenter", () => showDesc(key, area));
          target.addEventListener("mouseleave", () => fallback ? showDesc(fallback) : hideDesc());
          target.addEventListener("focusin", () => showDesc(key, area));
          target.addEventListener("focusout", () => fallback ? showDesc(fallback) : hideDesc());
        });
      });
    })
    .catch(() => {});
}

function setupDataUpdatesPopup() {
  const infoButton = document.getElementById("nav-info");
  const updates = document.getElementById("nav-updates");
  const closeButton = document.getElementById("nav-updates-close");
  const minimizeButton = document.getElementById("nav-updates-minimize");
  const dragHandle = document.getElementById("nav-updates-drag");
  if (infoButton && updates && closeButton) {
    const closeUpdates = (restoreFocus = false) => {
      updates.hidden = true;
      infoButton.setAttribute("aria-expanded", "false");
      if (restoreFocus) infoButton.focus({ preventScroll: true });
    };
    infoButton.addEventListener("click", () => {
      if (!updates.hidden) {
        closeUpdates(true);
        return;
      }
      updates.hidden = false;
      infoButton.setAttribute("aria-expanded", String(!updates.hidden));
      closeButton.focus({ preventScroll: true });
    });
    closeButton.addEventListener("click", () => closeUpdates(true));
    minimizeButton?.addEventListener("click", () => {
      const collapsed = updates.classList.toggle("is-collapsed");
      minimizeButton.setAttribute("aria-expanded", String(!collapsed));
      minimizeButton.setAttribute("aria-label", collapsed ? "Expandir dados atualizados" : "Mostrar somente dados filtrados");
      minimizeButton.title = minimizeButton.getAttribute("aria-label");
    });
    let drag = null;
    const startDrag = (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const rect = updates.getBoundingClientRect();
      const parentRect = updates.offsetParent.getBoundingClientRect();
      updates.style.position = "absolute";
      updates.style.left = `${rect.left - parentRect.left}px`;
      updates.style.top = `${rect.top - parentRect.top}px`;
      updates.style.bottom = "auto";
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
    const moveDrag = (event) => {
      if (!drag) return;
      const left = Math.max(0, Math.min(innerWidth - updates.offsetWidth, event.clientX - drag.x));
      const top = Math.max(0, Math.min(innerHeight - updates.offsetHeight, event.clientY - drag.y));
      const parentRect = updates.offsetParent.getBoundingClientRect();
      updates.style.left = `${left - parentRect.left}px`;
      updates.style.top = `${top - parentRect.top}px`;
    };
    dragHandle?.addEventListener("pointerdown", startDrag);
    dragHandle?.addEventListener("pointermove", moveDrag);
    dragHandle?.addEventListener("pointerup", () => { drag = null; });
    dragHandle?.addEventListener("pointercancel", () => { drag = null; });
    updates.querySelector(".nav-updates-filtered")?.addEventListener("pointerdown", startDrag);
    updates.querySelector(".nav-updates-filtered")?.addEventListener("pointermove", moveDrag);
    updates.querySelector(".nav-updates-filtered")?.addEventListener("pointerup", () => { drag = null; });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !updates.hidden) {
        closeUpdates(true);
      }
    });
  }

}

document.addEventListener("DOMContentLoaded", () => {
  setupDynamicLegend();
  setupDataUpdatesPopup();
});
