// UTILITÁRIOS COMPARTILHADOS DA INTERFACE
// Contém funções reutilizadas por vários módulos, sem controlar o estado da aplicação.
// Deve permanecer independente para ser carregado logo após o core.js.

function showToast(msg, tipo = "info", anchorEl = null) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 8px; font-size: 14px;
      font-family: sans-serif; z-index: 9999; pointer-events: none;
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
  toast.textContent = msg;
  toast.style.background = c.bg;
  toast.style.color = c.text;

  if (anchorEl) {
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
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}
