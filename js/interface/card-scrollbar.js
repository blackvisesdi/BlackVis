/* BARRA PADRÃO DOS CARDS — reproduz o trilho da nacionalidade.
 * O painel continua sendo a única área rolável. O trilho é seu irmão no DOM,
 * para permanecer fixo enquanto biografia e obras rolam juntas.
 */
(() => {
  const panel = document.querySelector('.info-panel');
  const card = document.getElementById('card');
  if (!panel || !card) return;
  const track = document.createElement('div');
  track.className = 'card-scrollbar';
  track.setAttribute('aria-hidden', 'true');
  track.hidden = true;
  const thumb = document.createElement('span');
  track.append(thumb);
  panel.after(track);
  let frame;
  function sync() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const maxScroll = panel.scrollHeight - panel.clientHeight;
      track.hidden = !panel.classList.contains('is-open') || maxScroll <= 1;
      if (track.hidden) return;
      const progress = Math.max(0, Math.min(1, panel.scrollTop / maxScroll));
      thumb.style.transform = `translateY(${progress * Math.max(0, track.clientHeight - 12)}px)`;
    });
  }
  panel.addEventListener('scroll', sync, { passive: true });
  panel.addEventListener('load', sync, true);
  const sizes = new ResizeObserver(sync);
  sizes.observe(panel);
  sizes.observe(card);
  new MutationObserver(sync).observe(card, { childList: true, subtree: true, attributes: true, characterData: true });
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
