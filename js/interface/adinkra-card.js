// Constrói o card de adinkra e aplica as cores de seu eixo.
function _applyCategoryColors(container, area) {
  const card = document.getElementById("card");
  const c1 =
    (typeof CATEGORY_COLORS !== "undefined" && CATEGORY_COLORS[area]) ||
    "#CCCCCC";
  const c55 =
    (typeof CATEGORY_COLORS_55 !== "undefined" && CATEGORY_COLORS_55[area]) ||
    c1;
  const c30 =
    (typeof CATEGORY_COLORS_30 !== "undefined" && CATEGORY_COLORS_30[area]) ||
    c1;
  [container, card].filter(Boolean).forEach((el) => {
    el.style.setProperty("--cat-color", c1);
    el.style.setProperty("--cat-color-55", c55);
    el.style.setProperty("--cat-color-30", c30);
  });
}

function exibirAreaCard(nodeData, techniques) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  // Cada novo adinkra começa com os nomes ocultos, sem herdar o estado do card anterior.
  window._setAllNamesVisible?.(false);
  const namesButton = document.getElementById("toggle-all-names");
  namesButton?.classList.remove("active");
  namesButton?.setAttribute("aria-pressed", "false");
  namesButton?.setAttribute("aria-label", "Mostrar todos os nomes");
  container.innerHTML = "";
  container.className = "adinkra-card";

  const area = nodeData.Nome || nodeData.id;
  _applyCategoryColors(container, area);
  const adinkraInfo =
    (typeof ADINKRA_INFO !== "undefined" && ADINKRA_INFO[area]) || {};
  const connectedTechniques = techniques.filter((technique) =>
    graphData.links.some((link) => {
      if (link.type !== "person-technique-link") return false;
      const source = _linkNodeId(link.source);
      const target = _linkNodeId(link.target);
      return source === technique.id || target === technique.id;
    })
  );

  const topLayout = document.createElement("div");
  topLayout.className = "adinkra-card-top-layout";
  const leftColumn = document.createElement("div");
  leftColumn.className = "adinkra-card-left-column";
  const adinkraName = document.createElement("h2");
  adinkraName.className = "adinkra-card-title";
  adinkraName.textContent = adinkraInfo.nome || area;
  leftColumn.appendChild(adinkraName);
  const adinkraDescription = document.createElement("p");
  adinkraDescription.className = "adinkra-card-description";
  const symbolDescription = adinkraInfo.descricao || "";
  if (adinkraInfo.nome && symbolDescription.startsWith(adinkraInfo.nome)) {
    const symbolName = document.createElement("em");
    symbolName.textContent = adinkraInfo.nome;
    adinkraDescription.append(symbolName, symbolDescription.slice(adinkraInfo.nome.length));
  } else {
    adinkraDescription.textContent = symbolDescription;
  }
  const rightColumn = document.createElement("div");
  rightColumn.className = "adinkra-card-right-column";
  rightColumn.appendChild(adinkraDescription);
  const areaDescription = document.createElement("p");
  areaDescription.className = "adinkra-card-description adinkra-area-description";
  areaDescription.textContent =
    (typeof AREA_DESCRICOES !== "undefined" && AREA_DESCRICOES[area]) || "";
  topLayout.append(leftColumn, rightColumn);

  const axisBlock = document.createElement("div");
  axisBlock.className = "adinkra-axis-block";
  const axisHeader = document.createElement("div");
  axisHeader.className = "adinkra-section-header";
  const axisTitle = document.createElement("span");
  axisTitle.textContent = `Eixo ${area}`;
  axisHeader.appendChild(axisTitle);
  axisBlock.append(axisHeader, areaDescription);

  const techniqueGrid = document.createElement("div");
  techniqueGrid.className = "adinkra-techniques-grid";
  connectedTechniques
    .slice()
    .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
    .forEach((technique) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-technique-tag";
      item.textContent = technique.Nome || technique.id;
      item.addEventListener("click", () => focusNode(null, technique));
      techniqueGrid.appendChild(item);
    });
  axisBlock.appendChild(techniqueGrid);
  container.append(topLayout, axisBlock);

  // Designers conectados a esta área
  const connectedPeopleSet = new Set();
  techniques.forEach((tec) => {
    graphData.links.forEach((link) => {
      if (link.type !== "person-technique-link") return;
      const srcId = _linkNodeId(link.source);
      const tgtId = _linkNodeId(link.target);
      if (srcId === tec.id) {
        const p = graphData.nodes.find(
          (n) => n.id === tgtId && !n.isCategory && !n.isTechnique
        );
        if (p) connectedPeopleSet.add(p);
      }
      if (tgtId === tec.id) {
        const p = graphData.nodes.find(
          (n) => n.id === srcId && !n.isCategory && !n.isTechnique
        );
        if (p) connectedPeopleSet.add(p);
      }
    });
  });

  const sortedPeople = [...connectedPeopleSet].sort((a, b) =>
    (a.Nome || "").localeCompare(b.Nome || "", "pt")
  );
  if (sortedPeople.length > 0) {
    const peopleHeader = document.createElement("div");
    peopleHeader.className = "adinkra-section-header adinkra-designers-header";
    const peopleTitle = document.createElement("span");
    peopleTitle.textContent = "Designers";
    const peopleCount = document.createElement("small");
    peopleCount.textContent = sortedPeople.length;
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "adinkra-names-toggle";
    toggleBtn.setAttribute("aria-label", "Mostrar nomes dos designers no grafo");
    toggleBtn.title = "Exibe os nomes";
    toggleBtn.innerHTML = '<img class="adinkra-eye-off" src="assets/icons/ver-nomes-off.svg" alt=""><img class="adinkra-eye-on" src="assets/icons/ver-nomes-on.svg" alt="">';
    peopleHeader.append(peopleTitle, peopleCount, toggleBtn);
    container.appendChild(peopleHeader);

    const peopleGrid = document.createElement("div");
    peopleGrid.className = "adinkra-designers-grid";
    sortedPeople.forEach((person) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-designer-tag";
      item.textContent = person.Nome || person.id;
      item.addEventListener("click", () => focusNode(null, person));
      item.addEventListener("mouseenter", () => window._setPersonNatHover?.(person, true));
      item.addEventListener("mouseleave", () => window._setPersonNatHover?.(person, false));
      peopleGrid.appendChild(item);
    });
    container.appendChild(peopleGrid);

    let open = false;
    peopleGrid.hidden = true;
    toggleBtn.classList.remove("is-visible");
    toggleBtn.setAttribute("aria-label", "Mostrar nomes dos designers no grafo");
    const designerIds = new Set(sortedPeople.map((person) => person.id));
    const setDesignerNamesVisible = (visible) => {
      window._setAllNamesVisible?.(visible, designerIds);
    };
    const toggle = () => {
      open = !open;
      setDesignerNamesVisible(open);
      peopleGrid.hidden = !open;
      toggleBtn.setAttribute("aria-label", open ? "Ocultar nomes dos designers no grafo" : "Mostrar nomes dos designers no grafo");
      toggleBtn.title = open ? "Oculta os nomes" : "Exibe os nomes";
      toggleBtn.classList.toggle("is-visible", open);
    };
    toggleBtn.addEventListener("click", toggle);
  }
}
