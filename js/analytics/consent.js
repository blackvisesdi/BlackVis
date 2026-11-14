// Interface de consentimento; a escolha pode ser revista pelo tutorial.
(() => {
  // O navegador usa title para explicar ícones que já possuem nome acessível.
  document.querySelectorAll("button[aria-label]:not([title])").forEach((button) => {
    button.title = button.getAttribute("aria-label");
  });
  document.querySelectorAll("button.nat-btn, button.category-btn").forEach((button) => {
    const label = button.textContent.replace(/^\s*\d+\s*/, "").trim();
    button.title = `Filtrar por ${label}`;
  });
  const analytics = window.blackvisAnalytics;
  const banner = document.getElementById("cookie-banner");
  const settings = document.getElementById("cookie-settings");
  const choice = document.getElementById("cookie-analytics-choice");
  const firstChoice = analytics?.readChoice();
  let opener;
  banner.hidden = firstChoice === "accepted" || firstChoice === "rejected";
  if (!banner.hidden) requestAnimationFrame(() => document.getElementById("cookie-reject")?.focus({ preventScroll: true }));

  function closeSettings() {
    if (settings.hidden) return;
    settings.hidden = true;
    opener?.focus({ preventScroll: true });
  }
  function select(accepted) {
    analytics?.setChoice(accepted);
    banner.hidden = true;
    closeSettings();
  }

  document.getElementById("cookie-accept").addEventListener("click", () => select(true));
  document.getElementById("cookie-reject").addEventListener("click", () => select(false));
  document.querySelectorAll("[data-open-cookie-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      opener = button;
      choice.checked = analytics?.readChoice() === "accepted";
      settings.hidden = false;
      choice.focus();
    });
  });
  document.getElementById("cookie-save").addEventListener("click", () => select(choice.checked));
  document.getElementById("cookie-settings-close").addEventListener("click", closeSettings);
  if (new URLSearchParams(window.location.search).has("cookies")) {
    const url = new URL(window.location.href);
    url.searchParams.delete("cookies");
    history.replaceState(history.state, "", url);
    banner.hidden = true;
    settings.hidden = false;
    choice.checked = firstChoice === "accepted";
    requestAnimationFrame(() => choice.focus({ preventScroll: true }));
  }
  settings.addEventListener("click", (event) => { if (event.target === settings) closeSettings(); });
  document.addEventListener("keydown", (event) => {
    if (!banner.hidden && settings.hidden && event.key === "Tab") {
      const controls = [...banner.querySelectorAll("a[href], button")];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (settings.hidden) return;
    if (event.key === "Escape") closeSettings();
    if (event.key === "Tab") {
      const controls = [...settings.querySelectorAll("input, button, a[href]")];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
