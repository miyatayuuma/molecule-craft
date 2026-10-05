// Deterministic, bounded presentation plan for one continued polyethylene chain.
// This module deliberately has no chemistry, DOM, renderer, or Three.js dependency.
export const HERO_CHAIN_BUDGET = Object.freeze({
  maxBackbonePoints: 32,
  growthUnits: 48,
  pointsPerUnit: 2,
  pointCapacity: 128,
  radialSegments: 8,
  vertexCapacity: 1024,
  indexCapacity: 6096,
  feedCapacity: 6,
  recognizableFeedUnits: 3,
  molecularUnitCapacity: 48,
  objects: 10,
});

export const POLYMER_VISUAL_AUTHORITY = Object.freeze({
  molecularBondStartPx: 4,
  molecularBondFullPx: 8,
  molecularAtomStartPx: 2.5,
  molecularAtomFullPx: 4.5,
  lodHysteresisScore: .04,
  compositionTarget: .76,
  compositionMinimum: .60,
  compositionMaximum: .85,
  compositionMinorMinimum: .24,
  coarseStrandWidthPx: 2.8,
});

const finitePoint = point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
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

function makeCurveKeys(count, random) {
  const sign=random()<.5?-1:1,firstAt=Math.floor(count*(.22+random()*.04)),secondAt=Math.floor(count*(.53+random()*.05)),thirdAt=Math.min(count-1,Math.floor(count*(.78+random()*.06)));
  const first=sign*(1.05+random()*.2),second=-sign*(.72+random()*.26),third=sign*(.22+random()*.36);
  return[
    {at:8,heading:0,depth:0},
    {at:firstAt,heading:first,depth:(random()-.5)*.12},
    {at:secondAt,heading:second,depth:(random()-.5)*.12},
    {at:thirdAt,heading:third,depth:(random()-.5)*.12},
    {at:count-1,heading:third,depth:(random()-.5)*.12},
  ];
}

function curveValue(keys, index, field) {
  let next = 1;
  while (next < keys.length - 1 && index > keys[next].at) next++;
  const before = keys[next - 1], after = keys[next], span = Math.max(1, after.at - before.at);
  const progress = smoothstep((index - before.at) / span);
  return before[field] + (after[field] - before[field]) * progress;
}

/** Extend the actual backbone with broad, low-frequency, deterministic curvature. */
export function createHeroChainPlan({polymerId, anchor, seed = polymerId, viewPlane = null}) {
  if (!anchor?.backbonePoints?.every(finitePoint) || anchor.backbonePoints.length < 2) throw new TypeError('A resolved finite-fragment anchor is required.');
  if (anchor.backbonePoints.length + HERO_CHAIN_BUDGET.growthUnits * HERO_CHAIN_BUDGET.pointsPerUnit > HERO_CHAIN_BUDGET.pointCapacity) throw new Error('Hero-chain point budget exceeded.');
  const points = anchor.backbonePoints.map(point => [...point]), random = randomFor(`${seed}:polymer-growth-v2`);
  const initialTangent = normalize(subtract(points.at(-1), points.at(-2)));
  let reference = Math.abs(dot(initialTangent, [0, 1, 0])) < .88 ? [0, 1, 0] : [0, 0, 1];
  const normal = normalize(cross(initialTangent, reference)), binormal = normalize(cross(initialTangent, normal));
  const recent = [];
  for (let index = Math.max(1, points.length - 3); index < points.length; index++) recent.push(distance(points[index], points[index - 1]));
  const measuredStep = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : distance(points.at(-1), points.at(-2));
  // Keep a real carbon-scale bond spacing while making the bounded 30-unit continuation
  // large enough to trigger a natural camera pullback before its molecular detail fades.
  const targetStep = clamp(measuredStep * .86, .68, .9);
  const screenRight = finitePoint(viewPlane?.right) ? normalize(viewPlane.right) : null;
  const screenUp = finitePoint(viewPlane?.up) ? normalize(viewPlane.up) : null;
  const viewDirection = finitePoint(viewPlane?.direction) ? normalize(viewPlane.direction) : null;
  const projectedTangent = screenRight && viewDirection
    ? initialTangent.map((value, axis) => value - viewDirection[axis] * dot(initialTangent, viewDirection))
    : null;
  const screenHeading = projectedTangent
    ? Math.hypot(...projectedTangent) > .12
      ? normalize(projectedTangent)
      : screenRight.map(value => value * (dot(initialTangent, screenRight) < 0 ? -1 : 1))
    : null;
  const screenLateral = screenHeading && screenUp
    ? normalize(screenUp.map((value, axis) => value - screenHeading[axis] * dot(screenUp, screenHeading)))
    : null;
  const baseHeading = screenHeading ?? initialTangent;
  const lateral = screenLateral ?? normal;
  const depthDirection = viewDirection ?? binormal;
  const extensionPointCount = HERO_CHAIN_BUDGET.growthUnits * HERO_CHAIN_BUDGET.pointsPerUnit;
  const curveKeys = makeCurveKeys(extensionPointCount, random);
  for (let index = 0; index < extensionPointCount; index++) {
    const step = measuredStep + (targetStep - measuredStep) * clamp((index + 1) / 8, 0, 1);
    let direction;
    if (index === 0) direction = initialTangent;
    else {
      const headingAngle = curveValue(curveKeys, index, 'heading'), depthAngle = curveValue(curveKeys, index, 'depth');
      const planar = baseHeading.map((value, axis) => value * Math.cos(headingAngle) + lateral[axis] * Math.sin(headingAngle));
      const bent = normalize(planar.map((value, axis) => value * Math.cos(depthAngle) + depthDirection[axis] * Math.sin(depthAngle)));
      const initialSteering = clamp(index / 14, 0, 1);
      direction = normalize(initialTangent.map((value, axis) => value * (1 - initialSteering) + bent[axis] * initialSteering));
    }
    const previous = points.at(-1);
    points.push([previous[0] + direction[0] * step, previous[1] + direction[1] * step, previous[2] + direction[2] * step]);
  }
  return {
    polymerId,
    seed,
    points,
    viewPlane: screenHeading ? {right: screenRight, up: screenUp, direction: viewDirection} : null,
    basePointCount: anchor.backbonePoints.length,
    growthUnits: HERO_CHAIN_BUDGET.growthUnits,
    pointsPerUnit: HERO_CHAIN_BUDGET.pointsPerUnit,
    targetStep,
    curveKeys,
    budget: HERO_CHAIN_BUDGET,
  };
}

/** Return a CSS-pixel readability blend. Screen dimensions, not chain age, own LOD. */
export function screenSpaceMolecularWeight({heavyAtomDiameterPx, backboneBondLengthPx, previousWeight = 1}, result = {}) {
  if (!Number.isFinite(heavyAtomDiameterPx) || !Number.isFinite(backboneBondLengthPx)) {
    const retained = clamp(Number.isFinite(previousWeight) ? previousWeight : 1, 0, 1);
    result.readabilityScore = null;result.molecularWeight = retained;result.coarseWeight = 1 - retained;
    return result;
  }
  const atomScore = (heavyAtomDiameterPx - POLYMER_VISUAL_AUTHORITY.molecularAtomStartPx) /
    (POLYMER_VISUAL_AUTHORITY.molecularAtomFullPx - POLYMER_VISUAL_AUTHORITY.molecularAtomStartPx);
  const bondScore = (backboneBondLengthPx - POLYMER_VISUAL_AUTHORITY.molecularBondStartPx) /
    (POLYMER_VISUAL_AUTHORITY.molecularBondFullPx - POLYMER_VISUAL_AUTHORITY.molecularBondStartPx);
  const readabilityScore = Math.min(atomScore, bondScore);
  const deadband = POLYMER_VISUAL_AUTHORITY.lodHysteresisScore;
  let molecularWeight = smoothstep(readabilityScore);
  if (previousWeight >= .999 && readabilityScore >= 1 - deadband) molecularWeight = 1;
  if (previousWeight <= .001 && readabilityScore <= deadband) molecularWeight = 0;
  molecularWeight = clamp(molecularWeight, 0, 1);
  result.readabilityScore = readabilityScore;result.molecularWeight = molecularWeight;result.coarseWeight = 1 - molecularWeight;
  return result;
}

/** Projected polyline length, chord, cumulative turn, and sharpest local turn. */
export function projectedPolymerPathMetrics(points, count = points?.length ?? 0, result = {}) {
  const length = Math.min(Array.isArray(points) ? points.length : 0, Math.max(0, Math.floor(count)));
  if (length < 2) {
    result.pathLengthPx = 0;result.chordLengthPx = 0;result.pathToChordRatio = 0;result.cumulativeTurnRad = 0;result.maxLocalTurnRad = 0;
    return result;
  }
  let pathLengthPx = 0, cumulativeTurnRad = 0, maxLocalTurnRad = 0, previousX = 0, previousY = 0, previousLength = 0;
  for (let index = 1; index < length; index++) {
    const current = points[index],previous = points[index - 1];
    const dx = (Array.isArray(current) ? current[0] : current.x) - (Array.isArray(previous) ? previous[0] : previous.x);
    const dy = (Array.isArray(current) ? current[1] : current.y) - (Array.isArray(previous) ? previous[1] : previous.y),segmentLength = Math.hypot(dx, dy);
    pathLengthPx += segmentLength;
    if (previousLength > 1e-6 && segmentLength > 1e-6) {
      const angle = Math.acos(clamp((previousX * dx + previousY * dy) / (previousLength * segmentLength), -1, 1));
      cumulativeTurnRad += angle;maxLocalTurnRad = Math.max(maxLocalTurnRad, angle);
    }
    previousX = dx;previousY = dy;previousLength = segmentLength;
  }
  const first = points[0],last = points[length - 1];
  const chordLengthPx = Math.hypot((Array.isArray(last) ? last[0] : last.x) - (Array.isArray(first) ? first[0] : first.x),(Array.isArray(last) ? last[1] : last.y) - (Array.isArray(first) ? first[1] : first.y));
  result.pathLengthPx = pathLengthPx;result.chordLengthPx = chordLengthPx;result.pathToChordRatio = pathLengthPx / Math.max(chordLengthPx, 1e-6);
  result.cumulativeTurnRad = cumulativeTurnRad;result.maxLocalTurnRad = maxLocalTurnRad;
  return result;
}

const NORMAL_DURATIONS = Object.freeze([300, 2100, 3900, 1000]);
const REDUCED_DURATIONS = Object.freeze([100, 540, 700, 500]);
const PHASES = Object.freeze(['anchored', 'recognizable-incorporation', 'extension', 'long-chain-hold']);
export function heroGrowthFrame(elapsedMs, reducedMotion = false, durationMultiplier = 1, result = {}) {
  const durations = reducedMotion ? REDUCED_DURATIONS : NORMAL_DURATIONS,scale=Math.max(.1,durationMultiplier);
  const totalDuration=(durations[0]+durations[1]+durations[2]+durations[3])*scale;
  const elapsed = Math.max(0, Math.min(Number.isFinite(elapsedMs) ? elapsedMs : 0, totalDuration + 50));
  let offset = 0;
  for (let index = 0; index < durations.length; index++) {
    const duration = durations[index]*scale, progress = Math.max(0, Math.min(1, (elapsed - offset) / duration));
    if (elapsed < offset + duration || index === durations.length - 1) {
      let units = 0, unitProgress = 0;
      if (index === 1) { const raw = progress * 3; units = Math.min(2, Math.floor(raw)); unitProgress = raw - units; }
      else if (index >= 2) { units = index === 2 ? 3 : HERO_CHAIN_BUDGET.growthUnits; unitProgress = index === 2 ? progress * (HERO_CHAIN_BUDGET.growthUnits - 3) : 0; }
      if (index === 2) { const raw = 3 + unitProgress; units = Math.min(HERO_CHAIN_BUDGET.growthUnits - 1, Math.floor(raw)); unitProgress = raw - units; }
      result.phase=PHASES[index];result.index=index;result.progress=progress;result.units=units;result.unitProgress=unitProgress;result.done=index===3&&progress>=1;
      return result;
    }
    offset += duration;
  }
  result.phase='complete';result.index=4;result.progress=1;result.units=HERO_CHAIN_BUDGET.growthUnits;result.unitProgress=0;result.done=true;
  return result;
}

export function visibleHeroPointCount(plan, frame) {
  const units = Math.min(plan.growthUnits, frame.units + (frame.unitProgress >= .82 ? Math.min(1, (frame.unitProgress - .82) / .18) : 0));
  return Math.min(plan.points.length, plan.basePointCount + Math.floor(units) * plan.pointsPerUnit + (units % 1 >= .5 ? 1 : 0));
}

export function sampleHeroPoint(points, station, result = []) {
  const index = Math.max(0, Math.min(points.length - 1, station)), first = Math.floor(index), second = Math.min(points.length - 1, first + 1), mix = index - first;
  for (let axis = 0; axis < 3; axis++) result[axis] = points[first][axis] + (points[second][axis] - points[first][axis]) * mix;
  return result;
}

function insertSortedUnique(buffer, count, value) {
  let index = 0;
  while (index < count && buffer[index] < value) index++;
  if (index < count && Math.abs(buffer[index] - value) < 1e-6) return count;
  for (let cursor = count; cursor > index; cursor--) buffer[cursor] = buffer[cursor - 1];
  buffer[index] = value;
  return count + 1;
}

/** Allocate once and reuse this scratch space when safe framing is measured per frame. */
export function createSafeRectWorkspace(maxObstacles = 16) {
  const count = Math.max(1, Math.floor(maxObstacles));
  return {
    clipped: Array.from({length: count}, () => ({left: 0, right: 0, top: 0, bottom: 0})),
    xs: new Float64Array(2 + count * 2), ys: new Float64Array(2 + count * 2),
  };
}

/** Largest obstacle-free axis-aligned screen rectangle inside the canvas. */
export function largestSafeRect(canvas, obstacles, padding = 12, result = null, workspace = null, obstacleCount = obstacles?.length ?? 0) {
  const target = result ?? {left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0};
  const scratch = workspace ?? createSafeRectWorkspace(Math.max(16, obstacleCount));
  const left = canvas.left + padding, right = canvas.right - padding, top = canvas.top + padding, bottom = canvas.bottom - padding;
  const clipped = scratch.clipped, xs = scratch.xs, ys = scratch.ys;
  let clippedCount = 0, xCount = 0, yCount = 0;
  xCount = insertSortedUnique(xs, xCount, left);xCount = insertSortedUnique(xs, xCount, right);
  yCount = insertSortedUnique(ys, yCount, top);yCount = insertSortedUnique(ys, yCount, bottom);
  const obstacleLimit = Math.min(Math.max(0, obstacleCount), clipped.length);
  for (let index = 0; index < obstacleLimit; index++) {
    const box = obstacles[index];
    if (!box || box.right <= left || box.left >= right || box.bottom <= top || box.top >= bottom) continue;
    const row = clipped[clippedCount++];
    row.left = Math.max(left, box.left - padding);row.right = Math.min(right, box.right + padding);
    row.top = Math.max(top, box.top - padding);row.bottom = Math.min(bottom, box.bottom + padding);
    xCount = insertSortedUnique(xs, xCount, row.left);xCount = insertSortedUnique(xs, xCount, row.right);
    yCount = insertSortedUnique(ys, yCount, row.top);yCount = insertSortedUnique(ys, yCount, row.bottom);
  }
  const anchorX = (canvas.left + canvas.right) * .5, anchorY = (canvas.top + canvas.bottom) * .5;
  let bestScore = -Infinity,bestLeft=left,bestRight=right,bestTop=top,bestBottom=bottom;
  for (let xi = 0; xi < xCount - 1; xi++) for (let xj = xi + 1; xj < xCount; xj++) for (let yi = 0; yi < yCount - 1; yi++) for (let yj = yi + 1; yj < yCount; yj++) {
    const candidateLeft=xs[xi],candidateRight=xs[xj],candidateTop=ys[yi],candidateBottom=ys[yj];
    const width=candidateRight-candidateLeft,height=candidateBottom-candidateTop;
    if(width<48||height<48)continue;
    let blocked=false;
    for(let obstacleIndex=0;obstacleIndex<clippedCount;obstacleIndex++){
      const box=clipped[obstacleIndex];
      if(candidateLeft<box.right&&candidateRight>box.left&&candidateTop<box.bottom&&candidateBottom>box.top){blocked=true;break;}
    }
    if(blocked)continue;
    const area=width*height,aspectPenalty=Math.abs(Math.log((width/height)/(canvas.width/canvas.height)));
    const containsAnchor=candidateLeft<=anchorX&&candidateRight>=anchorX&&candidateTop<=anchorY&&candidateBottom>=anchorY;
    const score=area*(containsAnchor?2.2:1)/(1+aspectPenalty*.12);
    if(score>bestScore){bestScore=score;bestLeft=candidateLeft;bestRight=candidateRight;bestTop=candidateTop;bestBottom=candidateBottom;}
  }
  target.left=bestLeft;target.right=bestRight;target.top=bestTop;target.bottom=bestBottom;
  target.width=bestRight-bestLeft;target.height=bestBottom-bestTop;
  return target;
}
