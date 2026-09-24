/* OBRAS DO PERFIL — carrega miniaturas remotas, sem interferir no grafo.
 * Cancela a consulta anterior ao trocar de pessoa, evitando obras no perfil errado.
 * O serviço local usa a porta 5501; em produção, a API deve apontar ao servidor.
 */
(() => {
  let pending;
  window.loadPersonWorks = async person => {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const section = document.getElementById('card-p-works');
    const list = section.querySelector('.card-p-work-list');
    list.replaceChildren();
    section.hidden = false;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    list.append(status);
    if (!person?.id) { status.textContent = 'Nenhuma pasta de obras cadastrada.'; return; }
    status.textContent = 'Carregando obras…';
    try {
      const base = await window.getBlackvisApiBase();
      const response = await fetch(`${base}/api/works?person=${encodeURIComponent(person.id)}`, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as obras.');
      if (controller.signal.aborted) return;
      list.replaceChildren();
      if (!body.files.length) {
        status.textContent = 'Nenhuma imagem encontrada nesta pasta.';
        list.append(status);
      }
      for (const file of body.files) {
        const link = document.createElement('a');
        link.className = 'person-work';
        link.href = file.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const preview = document.createElement('span');
        preview.className = 'person-work-preview';
        preview.textContent = 'Miniatura indisponível';
        if (file.thumbnail) {
          const image = document.createElement('img');
          image.alt = file.name;
          image.loading = 'lazy';
          image.src = `${base}${file.thumbnail}`;
          image.addEventListener('error', () => { preview.textContent = 'Miniatura indisponível'; });
          preview.replaceChildren(image);
        }
        const caption = document.createElement('span');
        caption.textContent = file.name;
        link.append(preview, caption);
        list.append(link);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      status.textContent = error instanceof TypeError ? 'O serviço de obras está indisponível. Inicie o servidor da galeria.' : error.message;
      list.replaceChildren(status);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => window.loadPersonWorks(person));
      list.append(retry);
    }
  };
})();
