function preprocessGraphData(data) {
  const originalNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const originalLinks = Array.isArray(data.links) ? data.links : [];

  const categoryNodes = new Map();
  const techniqueNodes = new Map();
  const newLinks = [...originalLinks];

  const DESIGN_AREA_KEY = "Área do design";
  const TECHNIQUES_KEY = "Técnicas";

  const designerNodes = originalNodes.filter(
    (d) => d[DESIGN_AREA_KEY] || d[TECHNIQUES_KEY]
  );

  designerNodes.forEach((dNode) => {
    // 1. ÁREAS DO DESIGN (CATEGORIA - eixos)
    const areaData = dNode[DESIGN_AREA_KEY];
    let areas = [];
    if (typeof areaData === "string") {
      areas = areaData
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
    }

    // 2. TÉCNICAS
    const tecnicasData = dNode[TECHNIQUES_KEY];
    let tecnicas = [];
    if (typeof tecnicasData === "string") {
      tecnicas = tecnicasData
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    let isLinkedViaTechnique = false;

    // --- Pessoa -> Técnica -> Categoria ---
    tecnicas.forEach((tecnicaName) => {
      isLinkedViaTechnique = true;
      const techniqueId = `TEC_${tecnicaName}`;

      if (!techniqueNodes.has(tecnicaName)) {
        techniqueNodes.set(tecnicaName, {
          id: techniqueId,
          Nome: tecnicaName,
          type: "technique",
          isTechnique: true,
          "Área do design": areas[0] || "Geral",
        });
      }

      // Pessoa -> Técnica
      newLinks.push({
        source: dNode.id,
        target: techniqueId,
        type: "person-technique-link",
      });

      // Técnica -> Categoria
      if (areas.length > 0) {
        areas.forEach((subArea) => {
          const categoryId = subArea;

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
              linkKey: linkKey,
            });
          }
        });
      }
    });

    // TODO: Algumas pessoas então caindo aqui direto, investigar
    // fallback pessoa -> categoria (sem tecnica)
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

// Conta quantas linhas estão conectadas a cada nó e faz bolinhas de tamanhos diferentes
function calculateNodeDegree(nodes, links) {
  const degreeMap = new Map();
  nodes.forEach((node) => degreeMap.set(node.id, 0));

  links.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;

    if (degreeMap.has(sourceId)) {
      degreeMap.set(sourceId, degreeMap.get(sourceId) + 1);
    }
    if (degreeMap.has(targetId)) {
      degreeMap.set(targetId, degreeMap.get(targetId) + 1);
    }
  });

  nodes.forEach((node) => {
    node.degree = degreeMap.get(node.id) || 0;
  });

  return nodes;
}
