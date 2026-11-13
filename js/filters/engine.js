// ===== CARREGAMENTO DOS DADOS =====

let allNodeById = new Map();
let neverConnectedIds = new Set();

async function loadDesignersFromApi() {
  const base = await window.getBlackvisApiBase();
  window.BLACKVIS_API_RUNTIME_BASE = base;
  window.configureAdinkraIcons(base);
  const response = await fetch(`${base}/api/designers`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados das pessoas.");
  const updatedAt = document.getElementById("data-last-updated");
  const countEl = document.getElementById("data-designers-count");
  if (countEl) countEl.textContent = new Intl.NumberFormat("pt-BR").format(body.designers?.length || 0);
  if (updatedAt) {
    const modified = new Date(body.lastUpdated);
    if (Number.isFinite(modified.getTime())) {
      updatedAt.dateTime = modified.toISOString();
      updatedAt.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(modified);
    } else {
      document.getElementById("nav-updates-date-line").textContent = "Data de atualização indisponível.";
    }
  }
  return body.designers || [];
}

Promise.all([d3.json("data/areas.json"), loadDesignersFromApi()])
  .then(([areasData, data]) => {
    // Constrói mapa técnica → área canônica a partir de areas.json
    const techniqueAreaMap = new Map();
    const areaTechniqueOrder = new Map();
    const tecnicaDescricoes = {};
    const areaDescricoes = {};
    const adinkraInfo = {};

    areasData.forEach((areaEntry) => {
      areaTechniqueOrder.set(
        areaEntry.area,
        areaEntry.tecnicas.map((tec) => tec.nome)
      );
      areaEntry.tecnicas.forEach((tec) => {
        techniqueAreaMap.set(tec.nome, areaEntry.area);
        tecnicaDescricoes[tec.nome] = tec.descricao || "";
      });
      areaDescricoes[areaEntry.area] = areaEntry.descricao || "";
      if (areaEntry.adinkra) adinkraInfo[areaEntry.area] = areaEntry.adinkra;
    });

    window._techniqueAreaMap = techniqueAreaMap;
    window._areaTechniqueOrder = areaTechniqueOrder;
    // Expõe como globais para uso em interactions.js
    window.TECNICA_DESCRICOES = tecnicaDescricoes;
    window.AREA_DESCRICOES = areaDescricoes;
    window.ADINKRA_INFO = adinkraInfo;

    let processedData = preprocessGraphData(data);
    processedData.nodes = calculateNodeDegree(
      processedData.nodes,
      processedData.links
    );
    processedData.nodes = calculateSaturationLevel(processedData.nodes);
    allNodes = processedData.nodes;
    allLinks = processedData.links;
    allNodeById = new Map(allNodes.map((node) => [node.id, node]));
    const allConnectedIds = new Set();
    allLinks.forEach((link) => {
      allConnectedIds.add(getId(link.source));
      allConnectedIds.add(getId(link.target));
    });
    neverConnectedIds = new Set(
      allNodes
        .filter((node) => !node.isCategory && !node.isTechnique && !allConnectedIds.has(node.id))
        .map((node) => node.id)
    );

    buildColorMaps(allNodes, allLinks);

    const designerNodes = allNodes.filter((d) => !d.isCategory && !d.isTechnique && getBirthYear(d) !== null);
    const minDataYear =
      d3.min(designerNodes, getBirthYear) ||
      YEAR_MIN_DEFAULT;
    const maxDataYear =
      d3.max(designerNodes, getBirthYear) ||
      YEAR_MAX_DEFAULT;

    window.currentMin = minDataYear;
    window.currentMax = maxDataYear;
    window.currentCategory = "all";
    window.currentNationality = "all";
    window.currentPeriod = "all";

    initSlider(minDataYear, maxDataYear);
    setupCategoryFilter();
    setupNationalityFilter();
    renderLocationFilters();
    setupDesignerSearch();
    setupLogoReset();
    setupMenuControls();

    window.applyAllFilters();
  })
  .catch((error) => {
    console.error("Erro fatal ao carregar dados:", error);
    const details = document.getElementById("nav-updates-details");
    if (details) details.textContent = "Informações de atualização indisponíveis.";
    showToast("Erro ao carregar os dados.", "erro");
  });

// ===== APPLY ALL FILTERS =====

// Todas as técnicas e eixos de uma pessoa, direto de allLinks (sem
// filtro nenhum aplicado). Usada pela exceção de foco em pessoa: ao
// focar alguém, ela sempre traz sua vizinhança completa, mesmo que o
// filtro de área ativo excluísse parte dela.
function _fullNeighborhoodOf(personId) {
  const ids = new Set([personId]);
  const directNeighbors = new Set();

  allLinks.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s === personId) {
      ids.add(t);
      directNeighbors.add(t);
    }
    if (t === personId) {
      ids.add(s);
      directNeighbors.add(s);
    }
  });

  // Segundo salto: o eixo/categoria de cada técnica encontrada, pra
  // aparecer o eixo junto, não só a técnica isolada.
  allLinks.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (directNeighbors.has(s)) ids.add(t);
    if (directNeighbors.has(t)) ids.add(s);
  });

  return ids;
}

// Verifica se algum vizinho real da pessoa (em allLinks, sem filtro)
// está faltando no grafo atualmente desenhado. Só quando falta algo
// vale a pena recalcular o grafo inteiro — evita redesenhar tudo em
// todo clique de pessoa, só quando a exceção do filtro realmente
// precisa entrar em ação.
function _personNeedsFullNeighborhoodExpansion(personId) {
  const currentIds = new Set(graphData.nodes.map((n) => n.id));
  return allLinks.some((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s !== personId && t !== personId) return false;
    const otherId = s === personId ? t : s;
    return !currentIds.has(otherId);
  });
}

function applyAllFilters(centerNodes = false) {
  renderLocationFilters();
  const rawSearchTerm = document.getElementById("search-input")?.value || "";
  const searchTerm = normalizeKey(rawSearchTerm);
  const isNameSearch = searchTerm !== "";
  const selectedCats = window.selectedCategories;
  const areaFilterActive = !!(selectedCats && selectedCats.size > 0);

  // Usa as ligações reais pessoa → técnica → eixo nos dois modos de busca.
  const techsInCategories = areaFilterActive
    ? new Set(
        allLinks
          .filter((link) => {
            const target = typeof link.target === "object" ? link.target.id : link.target;
            return link.type === "technique-category-link" && selectedCats.has(target);
          })
          .map((link) => typeof link.source === "object" ? link.source.id : link.source)
      )
    : null;
  const peopleInSelectedCategories = areaFilterActive
    ? new Set(
        allLinks.flatMap((link) => {
          if (link.type !== "person-technique-link") return [];
          const source = typeof link.source === "object" ? link.source.id : link.source;
          const target = typeof link.target === "object" ? link.target.id : link.target;
          if (techsInCategories.has(source)) return [target];
          if (techsInCategories.has(target)) return [source];
          return [];
        })
      )
    : null;

  let filteredNodes;

  switch (true) {
    // ── Busca por nome dentro do eixo selecionado, quando houver ──
    case isNameSearch: {
      let searchPool = allNodes.filter((d) => !d.isCategory && !d.isTechnique);

      if (areaFilterActive) {
        searchPool = searchPool.filter((d) => peopleInSelectedCategories.has(d.id));
      }

      const natSel = window.selectedNationalities;
      if (natSel && natSel.size > 0) {
        searchPool = searchPool.filter((d) => natSel.has(d["Nacionalidade"]));
      }

      const matched = searchPool.filter((d) =>
        normalizeKey(d.Nome || "")
          .split(" ")
          .some((part) => part.startsWith(searchTerm))
      );

      if (matched.length === 0) {
        const filteredCount = document.getElementById("data-filtered-count");
        if (filteredCount) filteredCount.textContent = "0";
        window._lastFilterAction = () => {
          const searchInput = document.getElementById("search-input");
          if (searchInput) searchInput.value = "";
          window.applyAllFilters();
        };
        showToast("Designer não encontrado", "erro", null, true, window._lastFilterAction);
        return;
      }

      filteredNodes = [...matched];
      window._searchMatched = matched;

      const legendText = `Exibindo resultados para "${rawSearchTerm}". Encontramos ${
        matched.length
      } designer${
        matched.length !== 1 ? "s" : ""
      } correspondentes à sua busca.`;
      _setLegendDesc(legendText);

      window._currentSearchTerm = searchTerm;
      break;
    }

    // ── Visualização normal: filtros combináveis + exceção de foco ──
    default: {
      const categoryFilter = window.currentCategory;
      const nationalityFilter = window.currentNationality;
      const periodFilter = window.currentPeriod;
      const minYear = window.currentMin;
      const maxYear = window.currentMax;
      // Para o filtro de eixo, a fonte de verdade são os links reais:
      // pessoa → técnica → eixo. O campo "Área do design" pode listar
      // interesses/contextos adicionais e não deve criar uma conexão visual.
      // Cada filtro descreve só duas coisas: "está ativo?" e "essa
      // pessoa bate?". Um nó passa se, pra TODO filtro ativo, ele bate
      // — não importa quantos estejam ligados ao mesmo tempo, porque é
      // sempre uma intersecção (E lógico). Pra adicionar um filtro novo
      // no futuro (ex: gênero), basta uma entrada aqui, sem mexer em
      // mais nada — inclusive resolve o filtro de nacionalidade, que
      // antes só funcionava dentro do modo de busca.
      const FILTER_DEFINITIONS = {
        area: {
          isActive: () => areaFilterActive,
          matches: (node) => peopleInSelectedCategories.has(node.id),
        },
        nationality: {
          isActive: () =>
            window.selectedNationalities &&
            window.selectedNationalities.size > 0,
          matches: (node) =>
            window.selectedNationalities.has(node["Nacionalidade"]),
        },
        location: {
          isActive: () => Boolean(window.locationFilter),
          matches: (node) => {
            const filter = window.locationFilter;
            return filter.values
              ? filter.values.has(node[filter.field])
              : node[filter.field] === filter.value;
          },
        },
        period: {
          isActive: () => periodFilter !== "all" && periodFilter !== "Todos",
          matches: (node) => {
            const hasBirthYear = getBirthYear(node) !== null;
            return periodFilter === "Com dados" ? hasBirthYear : !hasBirthYear;
          },
        },
        birthYear: {
          // A visualização inicial mantém todos os designers. Depois que
          // o usuário arrasta o slider, pessoas sem ano conhecido não
          // pertencem a nenhum intervalo e devem ser ocultadas.
          isActive: () => Boolean(window._yearSliderTouched),
          matches: (node) => {
            const birthYear = getBirthYear(node);
            if (birthYear === null) return false;
            return birthYear >= minYear && birthYear <= maxYear;
          },
        },
      };

      function personMatchesActiveFilters(node) {
        return Object.values(FILTER_DEFINITIONS).every(
          (filter) => !filter.isActive() || filter.matches(node)
        );
      }

      // A visualização parte das pessoas que passaram por TODOS os
      // filtros. Técnicas e eixos só entram quando existe uma ligação
      // real com esse conjunto. Isso evita eixos/tecnicas vazios e faz
      // o clique no adinkra e no Menu operarem sobre a mesma rede.
      const visiblePeople = allNodes.filter(
        (node) => !node.isCategory && !node.isTechnique && personMatchesActiveFilters(node)
      );
      const hasActivePeopleFilter = Boolean(
        isNameSearch ||
        areaFilterActive ||
        window.selectedNationalities?.size ||
        window.locationFilter ||
        (periodFilter && periodFilter !== "all" && periodFilter !== "Todos") ||
        window._yearSliderTouched
      );
      if (hasActivePeopleFilter && visiblePeople.length === 0) {
        showToast(
          "Nenhum designer encontrado para os filtros selecionados.",
          "erro",
          null,
          true,
          window._lastFilterAction
        );
      }
      const visibleIds = new Set(visiblePeople.map((node) => node.id));
      const visibleTechniqueIds = new Set();

      allLinks.forEach((link) => {
        const source = typeof link.source === "object" ? link.source.id : link.source;
        const target = typeof link.target === "object" ? link.target.id : link.target;
        if (link.type === "person-technique-link") {
          if (visibleIds.has(source)) visibleTechniqueIds.add(target);
          if (visibleIds.has(target)) visibleTechniqueIds.add(source);
        }
        if (link.type === "person-category-fallback-link") {
          const sourceNode = allNodeById.get(source);
          const targetNode = allNodeById.get(target);
          const categoryId = sourceNode?.isCategory
            ? source
            : targetNode?.isCategory
            ? target
            : null;
          const keepCategory = !areaFilterActive || selectedCats.has(categoryId);
          if (keepCategory) {
            if (visibleIds.has(source)) visibleIds.add(target);
            if (visibleIds.has(target)) visibleIds.add(source);
          }
        }
      });

      visibleTechniqueIds.forEach((id) => visibleIds.add(id));
      allLinks.forEach((link) => {
        if (link.type !== "technique-category-link") return;
        const source = typeof link.source === "object" ? link.source.id : link.source;
        const target = typeof link.target === "object" ? link.target.id : link.target;
        const categoryId = allNodeById.get(source)?.isCategory
          ? source
          : allNodeById.get(target)?.isCategory
          ? target
          : null;
        if (!areaFilterActive || selectedCats.has(categoryId)) {
          if (visibleTechniqueIds.has(source)) visibleIds.add(target);
          if (visibleTechniqueIds.has(target)) visibleIds.add(source);
        }
      });

      filteredNodes = allNodes.filter((node) => visibleIds.has(node.id));

      window._currentSearchTerm = "";
      break;
    }
  }

  // ── Filtragem de links ──
  const filteredNodeIds = new Set(filteredNodes.map((d) => d.id));
  const filteredLinks = allLinks.filter((link) => {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;
    return filteredNodeIds.has(src) && filteredNodeIds.has(tgt);
  });

  // ── Remove qualquer nó órfão (sem conexão após filtrar) ──
  if (!isNameSearch) {
    const connectedIds = new Set();
    filteredLinks.forEach((l) => {
      connectedIds.add(typeof l.source === "object" ? l.source.id : l.source);
      connectedIds.add(typeof l.target === "object" ? l.target.id : l.target);
    });

    const keptByCategory = new Set(
      window.selectedCategories && window.selectedCategories.size > 0
        ? filteredNodes
            .filter((d) => !d.isCategory && !d.isTechnique)
            .map((d) => d.id)
        : []
    );

    filteredNodes = filteredNodes.filter(
      (d) =>
        connectedIds.has(d.id) ||
        neverConnectedIds.has(d.id) ||
        keptByCategory.has(d.id)
    );
  }

  if (!isNameSearch) window._searchMatched = null;

  // Em qualquer filtro ativo, as linhas fazem parte do resultado: não
  // escondemos as conexões que explicam por que cada pessoa apareceu.
  window._hasActiveMenuFilter = Boolean(
    isNameSearch ||
      window.selectedCategories?.size ||
      window.selectedNationalities?.size ||
      window.locationFilter ||
      (window.currentPeriod && window.currentPeriod !== "all" && window.currentPeriod !== "Todos") ||
      window.currentMin !== window._sliderMin ||
      window.currentMax !== window._sliderMax
  );

  updateMenuCounts(filteredNodes, filteredLinks);

  drawForceGraph(
    { nodes: filteredNodes, links: filteredLinks },
    isNameSearch || centerNodes
  );

  if (
    isNameSearch &&
    window._searchMatched &&
    typeof window._setupSearchLayout === "function"
  ) {
    window._setupSearchLayout(window._searchMatched);
  }

  if (typeof window._applySearchLabels === "function") {
    window._applySearchLabels(window._currentSearchTerm || "");
  }
  if (typeof window._applyNatVisuals === "function") {
    window._applyNatVisuals();
  }

  if (window._pendingAreaCard && typeof focusNode === "function") {
    // Clicar no filtro → abre card
    const areaNode = filteredNodes.find(
      (node) => node.isCategory && node.id === window._pendingAreaCard
    );
    if (areaNode) {
      focusNode(null, areaNode, { areaFromFilter: true });
    }
    window._pendingAreaCard = null;
  }

  // O grafo recriado recebe rótulos novos. Restaura a preferência do olho
  // depois da busca e do foco, inclusive ao remover o último filtro de eixo.
  // Usa apenas as pessoas do grafo filtrado, sem incluir resultados externos.
  if (!isNameSearch && window.DBG_ALL_NAMES_VISIBLE) {
    window._setAllNamesVisible?.(true);
  }
}

window.applyAllFilters = applyAllFilters;
