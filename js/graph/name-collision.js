/* Colisão suave dos rótulos: corrige velocidades sem escrever diretamente
 * nas posições, preservando o movimento natural da simulação D3. */
function forceNameCollision(bounds, dimensions) {
  let nodes = [];

  function force() {
    if ((!window.DBG_ALL_NAMES_VISIBLE && !window.DBG_TECHNIQUE_NAMES_VISIBLE) || window._currentSearchTerm) return;

    const namedNodes = nodes.filter((node) => node.__labelVisible);
    const focusedCategoryNames = Boolean(window.DBG_FOCUSED_CATEGORY_NAMES);
    const passes = focusedCategoryNames ? 6 : 4;
    const impulse = focusedCategoryNames ? 0.72 : 0.6;
    const retention = dimensions().retention ?? 0.32;

    for (let pass = 0; pass < passes; pass++) {
      const boxes = namedNodes.map(bounds);

      for (let i = 0; i < namedNodes.length; i++) {
        for (let j = i + 1; j < namedNodes.length; j++) {
          const a = namedNodes[i];
          const b = namedNodes[j];
          const aa = boxes[i];
          const bb = boxes[j];
          const ax = a.fx ?? (a.x + a.vx * retention);
          const ay = a.fy ?? (a.y + a.vy * retention);
          const bx = b.fx ?? (b.x + b.vx * retention);
          const by = b.fy ?? (b.y + b.vy * retention);
          const left = ax + aa.right - bx - bb.left;
          const right = bx + bb.right - ax - aa.left;
          const top = ay + aa.bottom - by - bb.top;
          const bottom = by + bb.bottom - ay - aa.top;
          if (Math.min(left, right, top, bottom) <= 0) continue;

          const axis = Math.min(left, right) < Math.min(top, bottom) ? "x" : "y";
          const delta = axis === "x"
            ? (left <= right ? -left : right)
            : (top <= bottom ? -top : bottom);
          const freeA = a[`f${axis}`] == null;
          const freeB = b[`f${axis}`] == null;
          if (!freeA && !freeB) continue;

          const push = (delta * impulse) / retention / (freeA && freeB ? 2 : 1);
          if (freeA) a[`v${axis}`] += push;
          if (freeB) b[`v${axis}`] -= push;
        }
      }
    }

    const maxSpeed = focusedCategoryNames ? 2.2 : 1.5;
    namedNodes.forEach((node) => {
      const speed = Math.hypot(node.vx, node.vy) * retention || 1;
      const scale = Math.min(1, maxSpeed / speed);
      node.vx *= scale;
      node.vy *= scale;
    });
  }

  force.initialize = (value) => { nodes = value; };
  return force;
}
