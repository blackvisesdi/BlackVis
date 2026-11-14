// Carrega os símbolos e os dados da página inicial.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const base = await window.getBlackvisApiBase();
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = `${base}/api/adinkras/icon?variant=home&name=blackvis`;
    document.querySelectorAll('[data-home-adinkra]').forEach((image) => {
      const variant = image.closest('.home-symbols') ? 'variant=home&' : '';
      image.src = `${base}/api/adinkras/icon?${variant}name=${encodeURIComponent(image.dataset.homeAdinkra)}`;
    });
  } catch (error) {
    console.warn('Não foi possível carregar os adinkras da página inicial.', error);
  }

  const dialog = document.getElementById('publication-dialog');
  document.getElementById('publications-grid')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-publication-video]');
    if (!button) return;
    const videoUrl = button.dataset.publicationVideo;
    const media = document.getElementById('publication-media');
    if (videoUrl && media) {
      try {
        const url = new URL(videoUrl);
        const driveId = url.hostname === 'drive.google.com'
          ? url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id')
          : null;
        const youtubeId = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)
          ? url.searchParams.get('v') : url.hostname === 'youtu.be' ? url.pathname.slice(1) : null;
        const source = driveId ? `https://drive.google.com/file/d/${driveId}/preview`
          : youtubeId && /^[\w-]{11}$/.test(youtubeId) ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : url.toString();
        if (url.protocol === 'https:' && ['drive.google.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) {
          const frame = document.createElement('iframe');
          frame.src = source;
          frame.title = 'Apresentação BlackVis';
          frame.allow = 'autoplay; fullscreen';
          frame.allowFullscreen = true;
          media.replaceChildren(frame);
        }
      } catch { /* Mantém a mensagem enquanto o link não estiver válido. */ }
    }
    if (media?.querySelector('iframe')) dialog?.showModal();
  });
  document.getElementById('publication-close')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => {
    document.getElementById('publication-media')?.replaceChildren();
  });

  document.querySelectorAll('[data-copy-citation]').forEach(button => button.addEventListener('click', async (event) => {
    const card = event.currentTarget.closest('article');
    const citation = `${card.querySelector('.home-citation').textContent.trim()} Disponível em: ${card.querySelector('a').href}`;
    try {
      await navigator.clipboard.writeText(citation);
      event.currentTarget.title = 'Referência copiada';
      event.currentTarget.setAttribute('aria-label', 'Referência copiada');
    } catch { event.currentTarget.title = 'Selecione o texto para copiar'; }
  }));
});
