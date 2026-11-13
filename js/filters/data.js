// MOTOR DE FILTROS
// Normaliza os dados de origem, cria nós derivados, coordena todos os filtros
// e envia o conjunto final de nós e ligações para o renderizador.
// Interface pública: window.applyAllFilters(). Carregar após os módulos auxiliares.

// Categorias válidas (Arte não aparece na visualização)
const VALID_CATEGORIES = [
  "Comunicação",
  "Produto",
  "Teórico",
  "Interação",
  "Serviço",
];
// Técnicas sem SVG que não devem ser exibidas
const HIDDEN_TECHNIQUES = ["Colagem"];

// ===== PRÉ-PROCESSAMENTO =====

function preprocessGraphData(data) {
  // Aceita array plano OU {nodes, links}
  const originalNodes = Array.isArray(data)
    ? data
    : Array.isArray(data.nodes)
    ? data.nodes
    : [];
  const originalLinks = Array.isArray(data)
    ? []
    : Array.isArray(data.links)
    ? data.links
    : [];

  // IDs repetidos fazem o D3 misturar pessoas e suas ligações. Mantém o
  // primeiro ID e cria uma identidade estável para os registros seguintes.
  const usedIds = new Set();
  originalNodes.forEach((node, index) => {
    if (node.id == null || node.id === "") node.id = node.Nome || `pessoa-${index}`;
    let key = String(node.id);
    if (usedIds.has(key)) {
      const base = `pessoa-${key}-${normalizeKey(node.Nome || String(index))}`;
      key = base;
      let suffix = 2;
      while (usedIds.has(key)) key = `${base}-${suffix++}`;
      console.warn(`ID duplicado no acervo: ${node.id} (${node.Nome}). Usando ${key} nesta visualização.`);
      node.id = key;
    }
    usedIds.add(key);
  });

  const categoryNodes = new Map();
  const techniqueNodes = new Map();
  const newLinks = [...originalLinks];

  const DESIGN_AREA_KEY = "Área do design";
  const TECHNIQUES_KEY = "Técnicas";

  const designerNodes = originalNodes.filter(
    (d) => d[DESIGN_AREA_KEY] || d[TECHNIQUES_KEY]
  );

  designerNodes.forEach((dNode) => {
    const areaData = dNode[DESIGN_AREA_KEY];
    let areas = [];
    if (typeof areaData === "string") {
      areas = areaData
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0 && VALID_CATEGORIES.includes(a));
    }

    const tecnicasData = dNode[TECHNIQUES_KEY];
    let tecnicas = [];
    if (typeof tecnicasData === "string") {
      tecnicas = tecnicasData
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !HIDDEN_TECHNIQUES.includes(t));
    }

    let isLinkedViaTechnique = false;

    tecnicas.forEach((tecnicaName) => {
      isLinkedViaTechnique = true;
      const techniqueId = `TEC_${tecnicaName}`;

      // Área canônica da técnica (de areas.json tem prioridade)
      const canonicalArea =
        (window._techniqueAreaMap &&
          window._techniqueAreaMap.get(tecnicaName)) ||
        areas[0] ||
        "Geral";

      if (!techniqueNodes.has(tecnicaName)) {
        techniqueNodes.set(tecnicaName, {
          id: techniqueId,
          Nome: tecnicaName,
          type: "technique",
          isTechnique: true,
          "Área do design": canonicalArea,
        });
      }

      newLinks.push({
        source: dNode.id,
        target: techniqueId,
        type: "person-technique-link",
      });

      // Cada técnica conecta apenas à sua área canônica
      if (VALID_CATEGORIES.includes(canonicalArea)) {
        const categoryId = canonicalArea;
        if (!categoryNodes.has(categoryId)) {
          categoryNodes.set(categoryId, {
            id: categoryId,
            Nome: categoryId,
            type: "category",
            isCategory: true,
          });
        }
        const linkKey = `${techniqueId}-${categoryId}`;
        if (!newLinks.some((l) => l.linkKey === linkKey)) {
          newLinks.push({
            source: techniqueId,
            target: categoryId,
            type: "technique-category-link",
            linkKey,
          });
        }
      }
    });

    if (!isLinkedViaTechnique && areas.length > 0) {
      const categoryId = areas[0];
      newLinks.push({
        source: dNode.id,
        target: categoryId,
        type: "person-category-fallback-link",
      });
      if (!categoryNodes.has(categoryId)) {
        categoryNodes.set(categoryId, {
          id: categoryId,
          Nome: categoryId,
          type: "category",
          isCategory: true,
        });
      }
    }
  });

  const finalNodes = [...originalNodes];
  categoryNodes.forEach((catNode) => {
    if (!originalNodes.some((n) => n.id === catNode.id))
      finalNodes.push(catNode);
  });
  techniqueNodes.forEach((techNode) => {
    if (!originalNodes.some((n) => n.id === techNode.id))
      finalNodes.push(techNode);
  });

  return {
    nodes: finalNodes,
    links: newLinks.filter((l) => !l.linkKey || true),
  };
}

function calculateNodeDegree(nodes, links) {
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  links.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    if (degreeMap.has(sourceId))
      degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
    if (degreeMap.has(targetId))
      degreeMap.set(targetId, degreeMap.get(targetId) + 1);
  });

  nodes.forEach((node) => {
    node.degree = degreeMap.get(node.id) || 0;
  });
  return nodes;
}

function calculateSaturationLevel(nodes) {
  const allDegrees = nodes.map((d) => d.degree || 1);
  const maxDegree = d3.max(allDegrees) || 1;
  const minDegree = d3.min(allDegrees) || 1;

  if (maxDegree === minDegree) {
    nodes.forEach((node) => {
      node.saturationLevel = 4;
    });
    return nodes;
  }

  const step = (maxDegree - minDegree) / 6;
  nodes.forEach((node) => {
    const degree = node.degree || 1;
    let levelIndex = Math.floor((degree - minDegree) / step);
    let inverseIndex = 6 - levelIndex;
    node.saturationLevel =
      Math.max(0, Math.min(6, Math.round(inverseIndex))) + 1;
  });
  return nodes;
}
