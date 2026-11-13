// Conteúdo editável da equipe e das publicações. Os dados ficam em data/*.json.
document.addEventListener('DOMContentLoaded', () => {
  const teamGrid = document.getElementById('team-grid');
  const publicationsGrid = document.getElementById('publications-grid');
  if (!teamGrid || !publicationsGrid) return;

  const icon = (file, alt = '') => {
    const image = document.createElement('img');
    image.src = `./assets/icons/home/${file}`;
    image.alt = alt;
    return image;
  };

  function fitTeamBios() {
    teamGrid.querySelectorAll('.home-team-info p').forEach((bio) => {
      bio.style.fontSize = '';
      let size = parseFloat(getComputedStyle(bio).fontSize);
      while (bio.scrollHeight > bio.clientHeight + 1 && size > 10.5) {
        size -= 0.5;
        bio.style.fontSize = `${size}px`;
      }
    });
  }

  function renderTeam(people) {
    const cards = people.map((person) => {
      const card = document.createElement('article');
      const photo = person.foto ? document.createElement('img') : document.createElement('div');
      photo.className = 'home-team-photo';
      if (person.foto) {
        photo.src = person.foto;
        photo.alt = `Foto de ${person.nome}`;
        photo.loading = 'lazy';
      } else {
        photo.setAttribute('aria-hidden', 'true');
      }
      const info = document.createElement('div');
      info.className = 'home-team-info';
      const name = document.createElement('h3');
      name.textContent = person.nome || '';
      const role = document.createElement('em');
      role.textContent = person.cargo || '';
      const bio = document.createElement('p');
      bio.textContent = person.minibio || '';
      const tags = document.createElement('div');
      tags.className = 'home-team-tags';
      (person.tags || []).forEach((tag) => {
        const badge = document.createElement('span');
        badge.textContent = tag;
        badge.dataset.tag = tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        tags.append(badge);
      });
      info.append(name, role, bio, tags);
      card.append(photo, info);
      return card;
    });
    teamGrid.replaceChildren(...cards);
    document.fonts.ready.then(() => requestAnimationFrame(fitTeamBios));
    window.addEventListener('resize', () => requestAnimationFrame(fitTeamBios), { passive: true });
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' || url.origin === window.location.origin ? url.href : '';
    } catch { return ''; }
  }

  function renderPublications(publications) {
    const cards = publications.map((publication) => {
      const card = document.createElement('article');
      const title = document.createElement('h3');
      title.textContent = publication.sigla || '';
      card.append(title);

      const fileUrl = safeUrl(publication.arquivo || publication.url);
      if (fileUrl) {
        const link = document.createElement('a');
        link.className = 'home-publication-download';
        link.href = fileUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `Abrir publicação ${publication.sigla || ''}`);
        link.title = `Abrir publicação ${publication.sigla || ''}`;
        link.append(icon('baixar.svg'));
        card.append(link);
      } else {
        const unavailable = document.createElement('span');
        unavailable.className = 'home-publication-download is-unavailable';
        unavailable.setAttribute('aria-label', 'Publicação ainda indisponível');
        unavailable.append(icon('baixar-indisponivel.svg'));
        card.append(unavailable);
      }

      const citation = document.createElement('p');
      citation.className = 'home-publication-citation';
      citation.append(`${publication.autores || ''} `);
      const boldTitle = document.createElement('strong');
      boldTitle.textContent = publication.titulo || '';
      citation.append(boldTitle, ` ${publication.detalhes || ''}`);
      card.append(citation);

      if (publication.status) {
        const status = document.createElement('p');
        status.className = 'home-publication-status';
        status.textContent = publication.status;
        card.append(status);
      }
      if (publication.url) {
        const available = document.createElement('p');
        available.className = 'home-publication-available';
        const label = document.createElement('strong');
        label.textContent = 'Disponível em:';
        available.append(label, document.createElement('br'));
        const link = document.createElement('a');
        link.href = safeUrl(publication.url) || '#';
        link.textContent = publication.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        available.append(link);
        card.append(available);
      }
      if (publication.video !== undefined) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'site-outline-link home-publication-video';
        button.textContent = 'Assista nossa apresentação';
        button.dataset.publicationVideo = safeUrl(publication.video);
        button.disabled = !button.dataset.publicationVideo;
        if (button.disabled) button.title = 'Vídeo em preparação';
        card.append(button);
      }
      return card;
    });
    publicationsGrid.replaceChildren(...cards);
  }

  async function load(path, target, render) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.error(`Não foi possível carregar ${path}:`, error);
      target.textContent = 'Não foi possível carregar este conteúdo.';
    }
  }
  load('./data/equipe-proj.json', teamGrid, renderTeam);
  load('./data/publicacoes.json', publicationsGrid, renderPublications);
});
