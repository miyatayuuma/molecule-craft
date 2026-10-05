// Deterministic, bounded presentation plan for a single continued polymer chain.
// This module is deliberately independent of Three.js and chemical authority.
export const HERO_CHAIN_BUDGET = Object.freeze({
  maxBackbonePoints: 32,
  growthUnits: 30,
  pointsPerUnit: 2,
  pointCapacity: 92,
  radialSegments: 5,
  vertexCapacity: 460,
  feedCapacity: 6,
  recognizableFeedUnits: 3,
  detailWindowUnits: 2,
  objects: 6,
});

const finitePoint = point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = point => {
  const length = Math.hypot(...point);
  if (!Number.isFinite(length) || length < 1e-8) throw new Error('Polymer growth anchor has no stable tangent.');
  return point.map(value => value / length);
};

function atomElement(atom) { return typeof atom === 'string' ? atom : atom?.element; }
function bondParts(bond) { return Array.isArray(bond) ? bond : [bond?.a, bond?.b, bond?.order]; }

function shortestPath(adjacency, start, end) {
  const queue = [start], previous = new Map([[start, null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === end) break;
    for (const next of adjacency.get(current) ?? []) if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
  }
  if (!previous.has(end)) return null;
  const path = [];
  for (let current = end; current !== null; current = previous.get(current)) path.push(current);
  return path.reverse();
}

/** Resolve the rendered carbon backbone from the actual finite fragment. */
export function createPolymerGrowthAnchor({fragment, pointsByAtomIndex, newestInstanceId}) {
  if (!fragment?.atoms?.length || !Array.isArray(fragment.bonds) || !Array.isArray(fragment.atomOrigins)) throw new TypeError('A finite polymer fragment is required.');
  const carbons = fragment.atoms.map((atom, index) => atomElement(atom) === 'C' ? index : -1).filter(index => index >= 0);
  if (carbons.length < 2 || carbons.length > HERO_CHAIN_BUDGET.maxBackbonePoints) throw new Error('Finite fragment is outside the bounded carbon-backbone contract.');
  const carbonSet = new Set(carbons), adjacency = new Map(carbons.map(index => [index, new Set()]));
  for (const bond of fragment.bonds) {
    const [a, b] = bondParts(bond);
    if (!carbonSet.has(a) || !carbonSet.has(b)) continue;
    adjacency.get(a).add(b); adjacency.get(b).add(a);
  }
  const terminals = carbons.filter(index => adjacency.get(index).size <= 1);
  const endpoints = terminals.length >= 2 ? terminals : carbons;
  const candidates = [];
  for (let first = 0; first < endpoints.length; first++) for (let second = first + 1; second < endpoints.length; second++) {
    const path = shortestPath(adjacency, endpoints[first], endpoints[second]);
    if (!path || path.some(index => !finitePoint(pointsByAtomIndex?.[index]))) continue;
    const length = path.slice(1).reduce((sum, index, offset) => sum + distance(pointsByAtomIndex[index], pointsByAtomIndex[path[offset]]), 0);
    const originMatches = fragment.atomOrigins[path.at(-1)]?.instanceId === newestInstanceId;
    const reverseMatches = fragment.atomOrigins[path[0]]?.instanceId === newestInstanceId;
    candidates.push({path, length, originMatches, reverseMatches});
  }
  candidates.sort((a, b) => Number(b.originMatches) - Number(a.originMatches) || Number(b.reverseMatches) - Number(a.reverseMatches) || b.length - a.length || a.path.at(-1) - b.path.at(-1));
  const selected = candidates[0];
  if (!selected) throw new Error('Could not resolve a connected rendered carbon backbone.');
  let atomIndices = [...selected.path];
  if (selected.reverseMatches && !selected.originMatches) atomIndices.reverse();

  const continuationIds = new Set((fragment.continuations ?? []).map(item => Number.isInteger(item.atomRef) ? item.atomRef : Number.parseInt(String(item.atomRef).split(':').at(-1), 10)));
  if (continuationIds.size) {
    const markedEnd = [atomIndices[0], atomIndices.at(-1)].find(index => continuationIds.has(index) && fragment.atomOrigins[index]?.instanceId === newestInstanceId);
    if (markedEnd === atomIndices[0]) atomIndices.reverse();
  }
  const backbonePoints = atomIndices.map(index => [...pointsByAtomIndex[index]]);
  const tangent = normalize(subtract(backbonePoints.at(-1), backbonePoints.at(-2)));
  const stationForAtomIndex = fragment.atoms.map((_atom, index) => {
    const point = pointsByAtomIndex?.[index];
    if (!finitePoint(point)) return null;
    let nearest = 0, nearestDistance = Infinity;
    for (let station = 0; station < backbonePoints.length; station++) { const d = distance(point, backbonePoints[station]); if (d < nearestDistance) { nearest = station; nearestDistance = d; } }
    return nearest;
  });
  return {
    backboneAtomIndices: atomIndices,
    backbonePoints,
    growthEndAtomIndex: atomIndices.at(-1),
    growthTip: [...backbonePoints.at(-1)],
    tangent,
    stationForAtomIndex,
    initialExtent: backbonePoints.slice(1).reduce((sum, point, index) => sum + distance(point, backbonePoints[index]), 0),
  };
}

function randomFor(seedText) {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Extend the actual backbone with persistent-curvature, nonperiodic continuation. */
export function createHeroChainPlan({polymerId, anchor, seed = polymerId}) {
  if (!anchor?.backbonePoints?.every(finitePoint) || anchor.backbonePoints.length < 2) throw new TypeError('A resolved finite-fragment anchor is required.');
  if (anchor.backbonePoints.length + HERO_CHAIN_BUDGET.growthUnits * HERO_CHAIN_BUDGET.pointsPerUnit > HERO_CHAIN_BUDGET.pointCapacity) throw new Error('Hero-chain point budget exceeded.');
  const points = anchor.backbonePoints.map(point => [...point]), random = randomFor(`${seed}:polymer-growth-v1`);
  let tangent = normalize(subtract(points.at(-1), points.at(-2)));
  let reference = Math.abs(dot(tangent, [0, 1, 0])) < .88 ? [0, 1, 0] : [0, 0, 1];
  let normal = normalize(cross(tangent, reference)), binormal = normalize(cross(tangent, normal));
  const recent = [];
  for (let index = Math.max(1, points.length - 3); index < points.length; index++) recent.push(distance(points[index], points[index - 1]));
  const measuredStep = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : distance(points.at(-1), points.at(-2));
  const targetStep = Math.max(.3, Math.min(.43, measuredStep * .42));
  let curveA = 0, curveB = 0;
  const extensionPointCount = HERO_CHAIN_BUDGET.growthUnits * HERO_CHAIN_BUDGET.pointsPerUnit;
  for (let index = 0; index < extensionPointCount; index++) {
    const unitProgress = Math.min(1, (index + 1) / 6), step = measuredStep + (targetStep - measuredStep) * unitProgress;
    if (index > 1) {
      curveA = curveA * .94 + (random() - .5) * .085;
      curveB = curveB * .94 + (random() - .5) * .075;
      const magnitude = Math.hypot(curveA, curveB);
      if (magnitude > .28) { curveA *= .28 / magnitude; curveB *= .28 / magnitude; }
      tangent = normalize([tangent[0] + normal[0] * curveA + binormal[0] * curveB, tangent[1] + normal[1] * curveA + binormal[1] * curveB, tangent[2] + normal[2] * curveA + binormal[2] * curveB]);
      normal = normalize(cross(tangent, Math.abs(dot(tangent, [0, 1, 0])) < .88 ? [0, 1, 0] : [0, 0, 1]));
      binormal = normalize(cross(tangent, normal));
    }
    const previous = points.at(-1);
    points.push([previous[0] + tangent[0] * step, previous[1] + tangent[1] * step, previous[2] + tangent[2] * step]);
  }
  return {
    polymerId,
    seed,
    points,
    basePointCount: anchor.backbonePoints.length,
    growthUnits: HERO_CHAIN_BUDGET.growthUnits,
    pointsPerUnit: HERO_CHAIN_BUDGET.pointsPerUnit,
    targetStep,
    budget: HERO_CHAIN_BUDGET,
  };
}

const NORMAL_DURATIONS = Object.freeze([300, 2100, 3900, 1000]);
const REDUCED_DURATIONS = Object.freeze([100, 540, 700, 500]);
const PHASES = Object.freeze(['anchored', 'recognizable-incorporation', 'extension', 'long-chain-hold']);
export function heroGrowthFrame(elapsedMs, reducedMotion = false, durationMultiplier = 1) {
  const durations = (reducedMotion ? REDUCED_DURATIONS : NORMAL_DURATIONS).map(value => value * Math.max(.1, durationMultiplier));
  const elapsed = Math.max(0, Math.min(Number.isFinite(elapsedMs) ? elapsedMs : 0, durations.reduce((sum, value) => sum + value, 0) + 50));
  let offset = 0;
  for (let index = 0; index < durations.length; index++) {
    const duration = durations[index], progress = Math.max(0, Math.min(1, (elapsed - offset) / duration));
    if (elapsed < offset + duration || index === durations.length - 1) {
      let units = 0, unitProgress = 0;
      if (index === 1) { const raw = progress * 3; units = Math.min(2, Math.floor(raw)); unitProgress = raw - units; }
      else if (index >= 2) { units = index === 2 ? 3 : HERO_CHAIN_BUDGET.growthUnits; unitProgress = index === 2 ? progress * (HERO_CHAIN_BUDGET.growthUnits - 3) : 0; }
      if (index === 2) { const raw = 3 + unitProgress; units = Math.min(HERO_CHAIN_BUDGET.growthUnits - 1, Math.floor(raw)); unitProgress = raw - units; }
      return {phase: PHASES[index], index, progress, units, unitProgress, done: index === 3 && progress >= 1};
    }
    offset += duration;
  }
  return {phase: 'complete', index: 4, progress: 1, units: HERO_CHAIN_BUDGET.growthUnits, unitProgress: 0, done: true};
}

export function visibleHeroPointCount(plan, frame) {
  const units = Math.min(plan.growthUnits, frame.units + (frame.unitProgress >= .82 ? Math.min(1, (frame.unitProgress - .82) / .18) : 0));
  return Math.min(plan.points.length, plan.basePointCount + Math.floor(units) * plan.pointsPerUnit + (units % 1 >= .5 ? 1 : 0));
}

export function sampleHeroPoint(points, station) {
  const index = Math.max(0, Math.min(points.length - 1, station)), first = Math.floor(index), second = Math.min(points.length - 1, first + 1), mix = index - first;
  return points[first].map((value, axis) => value + (points[second][axis] - value) * mix);
}

/** Largest obstacle-free axis-aligned screen rectangle inside the canvas. */
export function largestSafeRect(canvas, obstacles, padding = 12) {
  const bounds = {left: canvas.left + padding, right: canvas.right - padding, top: canvas.top + padding, bottom: canvas.bottom - padding};
  const clipped = obstacles.filter(box => box.right > bounds.left && box.left < bounds.right && box.bottom > bounds.top && box.top < bounds.bottom).map(box => ({left: Math.max(bounds.left, box.left - padding), right: Math.min(bounds.right, box.right + padding), top: Math.max(bounds.top, box.top - padding), bottom: Math.min(bounds.bottom, box.bottom + padding)}));
  const xs = [...new Set([bounds.left, bounds.right, ...clipped.flatMap(box => [box.left, box.right])])].sort((a, b) => a - b);
  const ys = [...new Set([bounds.top, bounds.bottom, ...clipped.flatMap(box => [box.top, box.bottom])])].sort((a, b) => a - b);
  let best = null;
  for (let xi = 0; xi < xs.length - 1; xi++) for (let xj = xi + 1; xj < xs.length; xj++) for (let yi = 0; yi < ys.length - 1; yi++) for (let yj = yi + 1; yj < ys.length; yj++) {
    const candidate = {left: xs[xi], right: xs[xj], top: ys[yi], bottom: ys[yj]}, width = candidate.right - candidate.left, height = candidate.bottom - candidate.top;
    if (width < 48 || height < 48 || clipped.some(box => candidate.left < box.right && candidate.right > box.left && candidate.top < box.bottom && candidate.bottom > box.top)) continue;
    const area = width * height, aspectPenalty = Math.abs(Math.log((width / height) / (canvas.width / canvas.height)));
    const containsAnchor = candidate.left <= (canvas.left + canvas.right) * .5 && candidate.right >= (canvas.left + canvas.right) * .5 && candidate.top <= (canvas.top + canvas.bottom) * .5 && candidate.bottom >= (canvas.top + canvas.bottom) * .5;
    const score = area * (containsAnchor ? 2.2 : 1) / (1 + aspectPenalty * .12);
    if (!best || score > best.score) best = {...candidate, score};
  }
  return best ? {left: best.left, right: best.right, top: best.top, bottom: best.bottom, width: best.right - best.left, height: best.bottom - best.top} : {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top};
}
