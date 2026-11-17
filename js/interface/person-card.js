// Apresenta o perfil da pessoa e ajusta minibios longas à altura do painel.
let personBioFitFrame = 0;

function fitPersonBioToPanel() {
  const panel = document.querySelector(".info-panel");
  const personCard = document.getElementById("card-pessoa");
  const bio = document.getElementById("card-p-bio");
  if (!panel?.classList.contains("is-open") || personCard?.style.display !== "flex" ||
      !bio?.textContent || panel.clientWidth < 200 || panel.clientHeight < 100) return;

  // Recomeça do tamanho definido no SCSS para não deixar uma biografia curta
  // pequena só porque o perfil anterior tinha mais texto.
  bio.style.fontSize = "";
  const normalSize = parseFloat(getComputedStyle(bio).fontSize);
  const fits = (size) => {
    bio.style.fontSize = `${size}px`;
    return panel.scrollHeight <= panel.clientHeight + 1;
  };
  if (fits(normalSize)) {
    bio.style.fontSize = "";
    return;
  }

  const minimumSize = 10;
  if (!fits(minimumSize)) return; // Evita ocultar texto ilegível; a rolagem permanece disponível.
  let low = minimumSize;
  let high = normalSize;
  for (let step = 0; step < 8; step++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  bio.style.fontSize = `${Math.floor(low * 10) / 10}px`;
}

function schedulePersonBioFit() {
  cancelAnimationFrame(personBioFitFrame);
  personBioFitFrame = requestAnimationFrame(fitPersonBioToPanel);
}

const personPanel = document.querySelector(".info-panel");
if (personPanel && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(schedulePersonBioFit).observe(personPanel);
}
document.fonts?.ready.then(schedulePersonBioFit);

function exibirPerfil(designerData) {
  const personCard = document.getElementById("card-pessoa");
  document.getElementById("card-tec-area").style.display = "none";
  personCard.style.display = "flex";

  const personAreas = String(designerData["Área do design"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (personAreas[0]) _applyCategoryColors(personCard, personAreas[0]);

  const name = designerData.Nome || designerData.id;
  const birth = designerData["Data de nascimento"];
  const death = designerData["Data de falecimento (se houver)"];
  const miniBio = designerData.Minibio || "";
  const location =
    (designerData.Cidade && String(designerData.Cidade).trim()) ||
    (designerData.Estado && String(designerData.Estado).trim()) ||
    (designerData["País"] && String(designerData["País"]).trim()) ||
    "";

  document.getElementById("card-p-nome").textContent = name;
  const locations = document.getElementById("card-p-local");
  locations.replaceChildren();
  const nationality = designerData.Nacionalidade === "Brasileira" ? "Brasileiro" : "Estrangeiro";
  [designerData.Nacionalidade ? nationality : "", designerData.Região || designerData.Continente, location]
    .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index)
    .forEach((value) => {
      const tag = document.createElement("span");
      tag.className = "profile-tag";
      tag.textContent = value;
      locations.appendChild(tag);
    });
  const birthEl = document.getElementById("card-p-nasc");
  if (birth && !isNaN(birth)) {
    const birthYear = Math.floor(birth);
    birthEl.textContent = death && !isNaN(death) && String(death).trim() !== ""
      ? `${birthYear} - ${Math.floor(death)}`
      : String(birthYear);
  } else {
    birthEl.textContent = "Desconhecido";
  }

  const oldGenderField = document.getElementById("card-p-genero-campo");
  if (oldGenderField) oldGenderField.remove();
  const gender = designerData["Gênero"] || "";
  if (gender) {
    const fields = document.querySelector("#card-pessoa .card-p-campos");
    const genderField = document.createElement("p");
    genderField.id = "card-p-genero-campo";
    genderField.className = "card-campo";
    genderField.textContent = gender;
    fields.appendChild(genderField);
  }

  const techniquesEl = document.getElementById("card-p-tecnicas");
  techniquesEl.innerHTML = "";

  const techniques = (designerData["Técnicas"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Marca no menu os adinkras correspondentes às técnicas desta pessoa.
  // É apenas um destaque visual; não altera os filtros ativos do grafo.
  const connectedAreas = new Set(personAreas);
  techniques.forEach((technique) => {
    const area = nodeAreaMap && nodeAreaMap.get(`TEC_${technique}`);
    if (area) connectedAreas.add(area);
  });
  _setPersonCategoryHighlights([...connectedAreas]);

  const areaGroups = {};
  techniques.forEach((technique) => {
    const area =
      (nodeAreaMap && nodeAreaMap.get(`TEC_${technique}`)) || "Outro";
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(technique);
  });

  Object.entries(areaGroups).forEach(([area, values]) => {
    if (area === "Outro") return;
    values.forEach((technique) => {
    const row = document.createElement("div");
    row.className = "tec-row";
    row.style.setProperty("--technique-color", CATEGORY_COLORS[area] || "#8c8787");

    const iconPath = window.getAreaIconPath(area);
    if (iconPath) {
      const img = document.createElement("img");
      img.src = iconPath;
      img.className = "tec-area-icon";
      img.alt = area;
      row.appendChild(img);
    }

    const names = document.createElement("span");
    names.className = "tec-names";
    names.textContent = technique;
    row.appendChild(names);

    techniquesEl.appendChild(row);
    });
  });

  const bioEl = document.getElementById("card-p-bio");
  bioEl.textContent = miniBio;
  bioEl.style.display = miniBio ? "block" : "none";
  // A galeria fica preservada para depois do lançamento.
  // Enquanto desativada, o card não mostra obras nem consulta essa API.
  const worksSection = document.getElementById("card-p-works");
  if (worksSection) {
    worksSection.hidden = !window.BLACKVIS_SHOW_WORKS;
    if (!window.BLACKVIS_SHOW_WORKS) {
      worksSection.querySelector(".card-p-work-list")?.replaceChildren();
    }
  }
  if (window.BLACKVIS_SHOW_WORKS) window.loadPersonWorks(designerData);

  const oldSocialLinks = document.getElementById("card-p-social");
  if (oldSocialLinks) oldSocialLinks.remove();

  const socialMap = {
    "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn",
    "twitter.com": "Twitter",
    "x.com": "Twitter",
    "behance.net": "Behance",
    "facebook.com": "Facebook",
    "youtube.com": "YouTube",
    "vimeo.com": "Vimeo",
  };

  const socialLinks = (designerData["Redes sociais"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));

  const extraLinks = (designerData["Links extras"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));

  const buttons = [...socialLinks, ...extraLinks].map((url) => {
    const match = Object.entries(socialMap).find(([domain]) =>
      url.includes(domain)
    );
    return { url, label: match ? match[1] : "Portfolio" };
  });

  const deduped = [];
  const seenLabels = new Set();
  buttons.forEach((button) => {
    if (seenLabels.has(button.label)) return;
    seenLabels.add(button.label);
    deduped.push(button);
  });

  if (deduped.length > 0) {
    const socialWrap = document.createElement("div");
    socialWrap.id = "card-p-social";
    socialWrap.className = "card-social-links";

    deduped.forEach(({ url, label }) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "card-social-link";
      link.textContent = label;
      socialWrap.appendChild(link);
    });

    bioEl.insertAdjacentElement("afterend", socialWrap);
  }
  schedulePersonBioFit();
}
