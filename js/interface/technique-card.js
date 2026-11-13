// Monta o card de técnica e sua lista de designers.
function exibirListaPessoas(nodeData, designers) {
  const container = document.getElementById("card-tec-area");
  container.style.display = "block";
  document.getElementById("card-pessoa").style.display = "none";
  container.innerHTML = "";
  container.className = "adinkra-card technique-card";

  const techniqueId = nodeData.id;
  const techniqueName = nodeData.Nome || nodeData.id;
  const description = TECNICA_DESCRICOES[techniqueName] || "";
  const designerIds = new Set(designers.map((designer) => designer.id));

  const techArea =
    (typeof nodeAreaMap !== "undefined" && nodeAreaMap.get(techniqueId)) ||
    null;
  if (techArea) _applyCategoryColors(container, techArea);

  if (!techniqueNamesVisibility.has(techniqueId)) {
    techniqueNamesVisibility.set(techniqueId, false);
  }

  const topLayout = document.createElement("div");
  topLayout.className = "adinkra-card-top-layout";
  const leftColumn = document.createElement("div");
  leftColumn.className = "adinkra-card-left-column";
  const title = document.createElement("h2");
  title.className = "adinkra-card-title";
  title.textContent = techniqueName;
  leftColumn.appendChild(title);

  const rightColumn = document.createElement("div");
  rightColumn.className = "adinkra-card-right-column";
  const descriptionEl = document.createElement("p");
  descriptionEl.className = "adinkra-card-description";
  descriptionEl.textContent = description;
  rightColumn.appendChild(descriptionEl);
  topLayout.append(leftColumn, rightColumn);

  container.appendChild(topLayout);

  const peopleHeader = document.createElement("div");
  peopleHeader.className = "adinkra-section-header adinkra-designers-header";
  const peopleTitle = document.createElement("span");
  peopleTitle.textContent = "Designers";
  const peopleCount = document.createElement("small");
  peopleCount.textContent = designers.length;
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "adinkra-names-toggle";
  toggleButton.innerHTML = '<img class="adinkra-eye-off" src="assets/icons/ver-nomes-off.svg" alt=""><img class="adinkra-eye-on" src="assets/icons/ver-nomes-on.svg" alt="">';
  peopleHeader.append(peopleTitle, peopleCount, toggleButton);
  container.appendChild(peopleHeader);

  const grid = document.createElement("div");
  grid.className = "adinkra-designers-grid";
  const initialNamesVisible = techniqueNamesVisibility.get(techniqueId);
  grid.hidden = !initialNamesVisible;
  designers
    .slice()
    .sort((a, b) => (a.Nome || "").localeCompare(b.Nome || "", "pt"))
    .forEach((designer) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "adinkra-designer-tag";
      item.textContent = designer.Nome || designer.id;
      item.addEventListener("click", () => focusNode(null, designer));
      item.addEventListener("mouseenter", () => {
        window._setPersonNatHover?.(designer, true);
        _highlightPersonInGraph(designer, true);
      });
      item.addEventListener("mouseleave", () => {
        window._setPersonNatHover?.(designer, false);
        _highlightPersonInGraph(designer, false);
      });
      grid.appendChild(item);
    });
  if (designers.length === 0) {
    const empty = document.createElement("span");
    empty.className = "adinkra-designer-tag";
    empty.textContent = "Nenhum designer conectado";
    grid.appendChild(empty);
  }
  container.appendChild(grid);

  function syncTechniquePeopleView(showNames) {
    techniqueNamesVisibility.set(techniqueId, showNames);
    window.DBG_TECHNIQUE_NAMES_VISIBLE = showNames;
    const nameSizePx = `${window.DBG_PERSON_NAME_SIZE || 10}px`;

    nodeGroup
      .selectAll(".node")
      .filter(
        (node) =>
          !node.isCategory && !node.isTechnique && designerIds.has(node.id)
      )
      .interrupt()
      .transition()
      .duration(350)
      .style("opacity", 0.92)
      .each(function (node) {
        // Mesmo aviso pra colisão: aqui o nome fica visível pra todo
        // mundo da lista, não só pros vizinhos hovered.
        node.__labelVisible = showNames;
        node.__labelSide = showNames
          ? (node.x >= activeNode.x ? "right" : "left")
          : null;
      });
    if (simulation) simulation.force("collide").initialize(simulation.nodes());

    labelGroup
      .selectAll(".label")
      .filter((node) => designerIds.has(node.id))
      .interrupt()
      .text((node) =>
        showNames ? node.Nome || node.id : (node.Nome || node.id).split(" ")[0]
      )
      .attr("dx", (node) => {
        if (!showNames) return "0";
        return node.__labelSide === "left"
          ? `-${nodeRadius(node) + 7}px`
          : `${nodeRadius(node) + 7}px`;
      })
      .attr("dy", showNames ? "0" : (node) => `${nodeRadius(node) + 6}px`)
      .attr("text-anchor", showNames ? (node) => node.__labelSide === "left" ? "end" : "start" : "middle")
      .attr("dominant-baseline", showNames ? "middle" : "hanging")
      .style("font-size", showNames ? nameSizePx : "9px")
      .style("visibility", showNames ? "visible" : "hidden")
      .style("pointer-events", showNames ? "all" : "none");

    // Aumenta o raio do bouquet ao exibir nomes para reduzir sobreposição de labels
    if (simulation && activeNode?.isTechnique) {
      const graphAreaEl = document.querySelector(".graph-area");
      const svgW = Math.min(
        graphAreaEl?.clientWidth || window.innerWidth,
        2000
      );
      const svgH = Math.min(
        graphAreaEl?.clientHeight || window.innerHeight,
        1200
      );
      const minDim = Math.min(svgW, svgH);
      // Mesmo raio base do foco normal (BOUQUET_RADIUS_RATIO/MIN_PX),
      // com um acréscimo extra quando os nomes completos estão
      // visíveis, pra dar mais espaço e reduzir sobreposição de labels.
      const R1 = showNames
        ? Math.max(
            minDim * (BOUQUET_RADIUS_RATIO - 0.02),
            BOUQUET_RADIUS_MIN_PX + 20
          )
        : Math.max(minDim * BOUQUET_RADIUS_RATIO, BOUQUET_RADIUS_MIN_PX);
      const R2 = Math.max(minDim * 0.14, 70);
      simulation.force(
        "focus-bouquet",
        _radialFocusForce(activeNode, R1, R2, showNames ? 1.4 : 1.6)
      );
      simulation.alpha(0.48).restart();
      clearTimeout(window.__bouquetCool);
      window.__bouquetCool = setTimeout(() => {
        if (simulation) simulation.alphaTarget(0);
      }, 2200);
    }
  }

  toggleButton.addEventListener("click", () => {
    const nextState = !techniqueNamesVisibility.get(techniqueId);
    grid.hidden = !nextState;
    toggleButton.classList.toggle("is-visible", nextState);
    toggleButton.setAttribute("aria-label", nextState ? "Ocultar nomes dos designers" : "Mostrar nomes dos designers");
    toggleButton.title = nextState ? "Oculta os nomes" : "Exibe os nomes";
    syncTechniquePeopleView(nextState);
  });

  toggleButton.setAttribute("aria-label", initialNamesVisible ? "Ocultar nomes dos designers" : "Mostrar nomes dos designers");
  toggleButton.title = initialNamesVisible ? "Oculta os nomes" : "Exibe os nomes";
  toggleButton.classList.toggle("is-visible", Boolean(initialNamesVisible));

  syncTechniquePeopleView(techniqueNamesVisibility.get(techniqueId));
}
