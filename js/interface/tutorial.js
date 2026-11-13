// Tutorial da navegação superior. A legenda breve do rodapé continua independente.
function setupTutorial() {
  const trigger = document.getElementById('nav-tutorial');
  const panel = document.getElementById('tutorial-panel');
  const backdrop = document.getElementById('tutorial-backdrop');
  const closeButton = document.getElementById('tutorial-close');
  if (!trigger || !panel || !backdrop || !closeButton) return;

  async function loadIcons() {
    try {
      const base = await window.getBlackvisApiBase();
      panel.querySelectorAll('[data-tutorial-icon]').forEach((image) => {
        const name = image.dataset.tutorialIcon;
        const src = `${base}/api/adinkras/icon?name=${encodeURIComponent(name)}`;
        if (image.getAttribute('src') !== src) image.src = src;
      });
    } catch {
      // O texto do tutorial permanece disponível se a API estiver offline.
    }
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    backdrop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({ preventScroll: true });
  }

  function open() {
    if (!panel.hidden) return;
    if (!document.getElementById('legend-popup')?.hidden) document.getElementById('legend-close')?.click();
    if (!document.getElementById('nav-updates')?.hidden) document.getElementById('nav-updates-close')?.click();
    backdrop.hidden = false;
    panel.hidden = false;
    panel.scrollTop = 0;
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });
    void loadIcons();
  }

  trigger.addEventListener('click', () => panel.hidden ? open() : close());
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !document.getElementById('cookie-settings')?.hidden) return;
    const controls = [...panel.querySelectorAll('button, a[href]')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });
}

document.addEventListener('DOMContentLoaded', setupTutorial);
