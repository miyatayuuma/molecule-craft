// Deterministic, bounded presentation plan for one continued polyethylene chain.
// This module deliberately has no chemistry, DOM, renderer, or Three.js dependency.
export const HERO_CHAIN_BUDGET = Object.freeze({
  maxBackbonePoints: 32,
  presentationUnitCapacity: 72,
  growthUnits: 68,
  pointsPerUnit: 2,
  pointCapacity: 176,
  centerlinePointCapacity: 72,
  chunkUnits: 4,
  radialSegments: 8,
  vertexCapacity: 576,
  indexCapacity: 3408,
  feedCapacity: 6,
  recognizableFeedUnits: 4,
  molecularUnitCapacity: 68,
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
  coarseStrandWorldRadiusMax: .58,
});

const finitePoint = point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b),middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) * .5;
};
function rotateAroundAxis(vector, axis, angle) {
  const unit = normalize(axis),cosine = Math.cos(angle),sine = Math.sin(angle),axial = dot(unit, vector),perpendicular = cross(unit, vector);
  return vector.map((value, index) => value * cosine + perpendicular[index] * sine + unit[index] * axial * (1 - cosine));
}
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

function makeRepeatUnits(fragment, pointsByAtomIndex, backboneAtomIndices) {
  const station = new Map(backboneAtomIndices.map((atomIndex, index) => [atomIndex, index]));
  const orderedIds = [];
  for (const atomIndex of backboneAtomIndices) {
    const id = fragment.atomOrigins[atomIndex]?.instanceId;
    if (id !== undefined && !orderedIds.includes(id)) orderedIds.push(id);
  }
  const units = [];
  for (const instanceId of orderedIds) {
    const atomIndices = fragment.atomOrigins.map((origin, index) => origin?.instanceId === instanceId ? index : -1).filter(index => index >= 0 && finitePoint(pointsByAtomIndex?.[index]));
    const backbone = atomIndices.filter(index => station.has(index)).sort((a, b) => station.get(a) - station.get(b));
    if (backbone.length !== 2) continue;
    const center = pointsByAtomIndex[backbone[0]].map((value, axis) => (value + pointsByAtomIndex[backbone[1]][axis]) * .5);
    const localIndex = new Map(atomIndices.map((index, local) => [index, local]));
    const atoms = atomIndices.map(index => ({
      element: atomElement(fragment.atoms[index]),
      point: pointsByAtomIndex[index].map((value, axis) => value - center[axis]),
      sourceAtomIndex: fragment.atomOrigins[index]?.sourceAtomIndex,
      graphIndex: index,
    }));
    const bonds = [];
    for (const bond of fragment.bonds) {
      const [a, b, order] = bondParts(bond);
      if (localIndex.has(a) && localIndex.has(b)) bonds.push({a: localIndex.get(a), b: localIndex.get(b), order: order ?? 1});
    }
    units.push({
      instanceId,
      backboneAtomIndices: backbone,
      entryAtomIndex: backbone[0],
      exitAtomIndex: backbone[1],
      center,
      atoms,
      bonds,
      axisLength: distance(pointsByAtomIndex[backbone[0]], pointsByAtomIndex[backbone[1]]),
    });
  }
  return units;
}

function makeMolecularTemplate(units) {
  const source = units[Math.max(0, Math.floor((units.length - 1) * .6))];
  if (!source || source.atoms.length < 2 || source.bonds.length < 1) return null;
  // `makeRepeatUnits` stores atoms in graph order; explicitly put the two backbone
  // carbons first so the rigid template axis follows the actual chain direction.
  const localIndexByGraph = new Map(source.atoms.map((atom, index) => [atom.graphIndex, index]));
  const entry = localIndexByGraph.get(source.backboneAtomIndices[0]);
  const exit = localIndexByGraph.get(source.backboneAtomIndices[1]);
  if (!Number.isInteger(entry) || !Number.isInteger(exit)) return null;
  const order = [entry, exit, ...source.atoms.map((_atom, index) => index).filter(index => index !== entry && index !== exit)];
  const remap = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  return {
    atoms: order.map(index => source.atoms[index]),
    bonds: source.bonds.map(bond => ({a: remap.get(bond.a), b: remap.get(bond.b), order: bond.order})),
    axisStartIndex: 0,
    axisEndIndex: 1,
    axisLength: distance(source.atoms[entry].point, source.atoms[exit].point),
    axis: normalize(subtract(source.atoms[exit].point, source.atoms[entry].point)),
    center: [0, 0, 0],
  };
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
  const repeatUnits = makeRepeatUnits(fragment, pointsByAtomIndex, atomIndices);
  const backboneBondLengths = backbonePoints.slice(1).map((point, index) => distance(point, backbonePoints[index]));
  const bondDirections = backbonePoints.slice(1).map((point, index) => normalize(subtract(point, backbonePoints[index])));
  const turnAngles = bondDirections.slice(1).map((direction, index) => Math.acos(clamp(dot(bondDirections[index], direction), -1, 1)));
  const rawPlaneNormal = bondDirections.length >= 2 ? cross(bondDirections.at(-2), bondDirections.at(-1)) : [0, 0, 0];
  const continuationPlaneNormal = Math.hypot(...rawPlaneNormal) > 1e-8
    ? normalize(rawPlaneNormal)
    : normalize(cross(tangent, Math.abs(tangent[1]) < .88 ? [0, 1, 0] : [0, 0, 1]));
  const lastTurn = turnAngles.at(-1) ?? 0;
  const firstContinuationDirection = bondDirections.length >= 2 && lastTurn > .08
    ? normalize(rotateAroundAxis(bondDirections.at(-1), continuationPlaneNormal, -lastTurn))
    : tangent;
  const secondContinuationDirection = bondDirections.length >= 2 && lastTurn > .08
    ? normalize(rotateAroundAxis(firstContinuationDirection, continuationPlaneNormal, lastTurn))
    : tangent;
  const molecularTemplate = makeMolecularTemplate(repeatUnits);
  return {
    backboneAtomIndices: atomIndices,
    backbonePoints,
    repeatUnits,
    repeatUnitCount: repeatUnits.length,
    repeatUnitCenters: repeatUnits.map(unit => [...unit.center]),
    molecularTemplate,
    backboneBondLengths,
    medianBackboneBondLength: median(backboneBondLengths),
    medianTurnAngleRad: median(turnAngles),
    continuationTurnAngleRad: lastTurn,
    continuationPlaneNormal,
    continuationSeedDirections: [firstContinuationDirection, secondContinuationDirection],
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
  const sign = random() < .5 ? -1 : 1;
  const first = sign * (1.34 + random() * .14), second = sign * (.82 + random() * .16), third = -sign * (.2 + random() * .12);
  const firstAt = Math.min(count - 1, Math.floor(count * (.2 + random() * .04)));
  const secondAt = Math.min(count - 1, Math.floor(count * (.52 + random() * .04)));
  const thirdAt = Math.min(count - 1, Math.floor(count * (.78 + random() * .035)));
  const depthA = (random() - .5) * .34, depthB = (random() - .5) * .34, depthC = (random() - .5) * .34;
  const torsionA = (random() - .5) * .42, torsionB = (random() - .5) * .42, torsionC = (random() - .5) * .42;
  return [
    {at:0,heading:0,depth:0,torsion:0},
    {at:Math.min(4,count - 1),heading:0,depth:0,torsion:0},
    {at:firstAt,heading:first,depth:depthA,torsion:torsionA},
    {at:secondAt,heading:second,depth:depthB,torsion:torsionB},
    {at:thirdAt,heading:third,depth:depthC,torsion:torsionC},
    {at:count-1,heading:third,depth:depthC,torsion:torsionC},
  ];
}

function curveValue(keys, index, field) {
  let next = 1;
  while (next < keys.length - 1 && index > keys[next].at) next++;
  const before = keys[next - 1], after = keys[next], span = Math.max(1, after.at - before.at);
  const progress = smoothstep((index - before.at) / span);
  return before[field] + (after[field] - before[field]) * progress;
}

/** Continue the real C–C zigzag inside one shared, slowly bending chain centerline. */
export function createHeroChainPlan({polymerId, anchor, seed = polymerId, viewPlane = null}) {
  if (!anchor?.backbonePoints?.every(finitePoint) || anchor.backbonePoints.length < 2) throw new TypeError('A resolved finite-fragment anchor is required.');
  const basePointCount = anchor.backbonePoints.length;
  const fallbackBaseCenters = [];
  for (let index = 0; index + 1 < basePointCount; index += HERO_CHAIN_BUDGET.pointsPerUnit) {
    const a = anchor.backbonePoints[index], b = anchor.backbonePoints[Math.min(index + 1, basePointCount - 1)];
    fallbackBaseCenters.push(a.map((value, axis) => (value + b[axis]) * .5));
  }
  const baseCenters = anchor.repeatUnitCenters?.length >= 2 ? anchor.repeatUnitCenters.map(point => [...point]) : fallbackBaseCenters;
  const baseUnitCount = Math.max(1, baseCenters.length);
  const growthUnits = Math.min(HERO_CHAIN_BUDGET.growthUnits, HERO_CHAIN_BUDGET.presentationUnitCapacity - baseUnitCount);
  if (basePointCount + growthUnits * HERO_CHAIN_BUDGET.pointsPerUnit > HERO_CHAIN_BUDGET.pointCapacity || baseUnitCount + growthUnits > HERO_CHAIN_BUDGET.centerlinePointCapacity) throw new Error('Hero-chain point budget exceeded.');

  const points = anchor.backbonePoints.map(point => [...point]), centerlinePoints = [...baseCenters];
  const random = randomFor(`${seed}:polymer-growth-v3`), measuredStep = anchor.medianBackboneBondLength || distance(points.at(-1), points.at(-2));
  if (!Number.isFinite(measuredStep) || measuredStep < .4 || measuredStep > 2.5) throw new Error('Actual PE backbone spacing is outside the visual continuation contract.');
  const initialTangent = normalize(subtract(points.at(-1), points.at(-2)));
  let firstDirection = anchor.continuationSeedDirections?.[0], secondDirection = anchor.continuationSeedDirections?.[1];
  if (!finitePoint(firstDirection) || !finitePoint(secondDirection)) firstDirection = secondDirection = initialTangent;
  firstDirection = normalize(firstDirection);secondDirection = normalize(secondDirection);
  let baseHeading = normalize(firstDirection.map((value, axis) => value + secondDirection[axis]));
  let baseLateral = firstDirection.map((value, axis) => value - secondDirection[axis]);
  if (Math.hypot(...baseLateral) < 1e-6) {
    const reference = Math.abs(baseHeading[1]) < .88 ? [0, 1, 0] : [0, 0, 1];
    baseLateral = cross(reference, baseHeading);
  }
  baseLateral = normalize(baseLateral);
  const halfZigzag = Math.atan2(Math.hypot(...firstDirection.map((value, axis) => value - secondDirection[axis])), Math.hypot(...firstDirection.map((value, axis) => value + secondDirection[axis])));
  const screenRight = finitePoint(viewPlane?.right) ? normalize(viewPlane.right) : null;
  const screenUp = finitePoint(viewPlane?.up) ? normalize(viewPlane.up) : null;
  const viewDirection = finitePoint(viewPlane?.direction) ? normalize(viewPlane.direction) : null;
  let curveAxis = viewDirection ?? normalize(cross(baseHeading, baseLateral));
  if (Math.abs(dot(curveAxis, baseHeading)) > .85) {
    const reference = screenRight ?? (Math.abs(baseHeading[1]) < .88 ? [0, 1, 0] : [1, 0, 0]);
    const cameraPlaneBendAxis = viewDirection ? cross(viewDirection, reference) : cross(baseHeading, reference);
    if (Math.hypot(...cameraPlaneBendAxis) > 1e-6) curveAxis = normalize(cameraPlaneBendAxis);
  }
  let pitchAxis = cross(curveAxis, baseHeading);
  if (Math.hypot(...pitchAxis) < 1e-6) pitchAxis = [...baseLateral];
  pitchAxis = normalize(pitchAxis);
  const curveKeys = makeCurveKeys(growthUnits, random), unitFrames = [];

  for (let unit = 0; unit < growthUnits; unit++) {
    const headingAngle = curveValue(curveKeys, unit, 'heading'), depthAngle = curveValue(curveKeys, unit, 'depth'), torsionAngle = curveValue(curveKeys, unit, 'torsion');
    let heading = rotateAroundAxis(baseHeading, curveAxis, headingAngle);
    heading = normalize(rotateAroundAxis(heading, pitchAxis, depthAngle));
    let lateral = rotateAroundAxis(baseLateral, curveAxis, headingAngle);
    lateral = rotateAroundAxis(lateral, pitchAxis, depthAngle);
    lateral = rotateAroundAxis(lateral, heading, torsionAngle);
    lateral = normalize(lateral.map((value, axis) => value - heading[axis] * dot(lateral, heading)));
    const first = unit === 0
      ? firstDirection
      : normalize(heading.map((value, axis) => value * Math.cos(halfZigzag) + lateral[axis] * Math.sin(halfZigzag)));
    const second = unit === 0
      ? secondDirection
      : normalize(heading.map((value, axis) => value * Math.cos(halfZigzag) - lateral[axis] * Math.sin(halfZigzag)));
    let previous = points.at(-1);
    const firstCarbon = previous.map((value, axis) => value + first[axis] * measuredStep);points.push(firstCarbon);
    previous = firstCarbon;
    const secondCarbon = previous.map((value, axis) => value + second[axis] * measuredStep);points.push(secondCarbon);
    const center = firstCarbon.map((value, axis) => (value + secondCarbon[axis]) * .5);centerlinePoints.push(center);
    unitFrames.push({unitIndex:unit,conceptualUnit:baseUnitCount+unit+1,chunkIndex:Math.floor(unit/HERO_CHAIN_BUDGET.chunkUnits),center,heading,lateral,torsionAngle});
  }
  const generatedBondDirections=points.slice(1).map((point,index)=>normalize(subtract(point,points[index])));
  let maximumContinuationTurnDeviationRad=0;
  for(let directionIndex=basePointCount-1;directionIndex<generatedBondDirections.length;directionIndex++){
    const turn=Math.acos(clamp(dot(generatedBondDirections[directionIndex-1],generatedBondDirections[directionIndex]),-1,1));
    maximumContinuationTurnDeviationRad=Math.max(maximumContinuationTurnDeviationRad,Math.abs(turn-(anchor.continuationTurnAngleRad??anchor.medianTurnAngleRad??0)));
  }
  const molecularChunks = [{
    kind:'actual',chunkIndex:0,conceptualStart:1,unitCount:baseUnitCount,
    centerlineStartIndex:0,centerlineEndIndex:baseUnitCount-1,
    entryCenter:[...centerlinePoints[0]],exitCenter:[...centerlinePoints[baseUnitCount-1]],
    entryTangent:baseCenters.length>1?normalize(subtract(baseCenters[1],baseCenters[0])):[...initialTangent],
    exitTangent:baseCenters.length>1?normalize(subtract(baseCenters.at(-1),baseCenters.at(-2))):[...baseHeading],
  }];
  for (let first = 0; first < growthUnits; first += HERO_CHAIN_BUDGET.chunkUnits) {
    const last = Math.min(growthUnits - 1, first + HERO_CHAIN_BUDGET.chunkUnits - 1),startIndex=baseUnitCount+first,endIndex=baseUnitCount+last;
    molecularChunks.push({
      kind:first<4?'full-molecular-continuation':'reusable-molecular-chunk',chunkIndex:molecularChunks.length,
      conceptualStart:baseUnitCount+first+1,unitCount:last-first+1,
      centerlineStartIndex:startIndex,centerlineEndIndex:endIndex,
      entryCenter:[...centerlinePoints[startIndex]],exitCenter:[...centerlinePoints[endIndex]],
      entryTangent:[...unitFrames[first].heading],exitTangent:[...unitFrames[last].heading],
      torsionStart:unitFrames[first].torsionAngle,torsionEnd:unitFrames[last].torsionAngle,
    });
  }
  return {
    polymerId,seed,points,centerlinePoints,basePointCount,baseUnitCount,growthUnits,pointsPerUnit:HERO_CHAIN_BUDGET.pointsPerUnit,
    targetStep:measuredStep,medianBackboneBondLength:measuredStep,medianTurnAngleRad:anchor.medianTurnAngleRad??0,
    continuationTurnAngleRad:anchor.continuationTurnAngleRad??anchor.medianTurnAngleRad??0,maximumContinuationTurnDeviationRad,
    halfZigzagRad:halfZigzag,curveKeys,unitFrames,molecularChunks,molecularTemplate:anchor.molecularTemplate??null,
    viewPlane:screenRight?{right:screenRight,up:screenUp,direction:viewDirection}:null,budget:HERO_CHAIN_BUDGET,
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

const NORMAL_DURATIONS = Object.freeze([300, 2800, 1500, 3900, 1500]);
const REDUCED_DURATIONS = Object.freeze([600, 2400, 800, 1800, 800]);
const PHASES = Object.freeze(['anchored', 'recognizable-incorporation', 'stage-b-molecular-hold', 'extension', 'long-chain-hold']);
export function heroGrowthFrame(elapsedMs, reducedMotion = false, durationMultiplier = 1, result = {}, growthUnits = HERO_CHAIN_BUDGET.growthUnits) {
  const durations = reducedMotion ? REDUCED_DURATIONS : NORMAL_DURATIONS,scale=Math.max(.1,durationMultiplier);
  const boundedGrowthUnits = Math.max(0, Math.min(HERO_CHAIN_BUDGET.growthUnits, Math.floor(growthUnits)));
  const totalDuration=(durations[0]+durations[1]+durations[2]+durations[3]+durations[4])*scale;
  const elapsed = Math.max(0, Math.min(Number.isFinite(elapsedMs) ? elapsedMs : 0, totalDuration + 50));
  let offset = 0;
  for (let index = 0; index < durations.length; index++) {
    const duration = durations[index]*scale, progress = Math.max(0, Math.min(1, (elapsed - offset) / duration));
    if (elapsed < offset + duration || index === durations.length - 1) {
      let units = 0, unitProgress = 0;
      if (index === 1) { const raw = progress * HERO_CHAIN_BUDGET.recognizableFeedUnits; units = Math.min(HERO_CHAIN_BUDGET.recognizableFeedUnits - 1, Math.floor(raw)); unitProgress = raw - units; }
      else if (index === 2) units = HERO_CHAIN_BUDGET.recognizableFeedUnits;
      else if (index === 3) { const raw = HERO_CHAIN_BUDGET.recognizableFeedUnits + progress * (boundedGrowthUnits - HERO_CHAIN_BUDGET.recognizableFeedUnits); units = Math.min(boundedGrowthUnits - 1, Math.floor(raw)); unitProgress = raw - units; }
      if (index === 4) units = boundedGrowthUnits;
      result.phase=PHASES[index];result.index=index;result.progress=progress;result.units=units;result.unitProgress=unitProgress;result.done=index===4&&progress>=1;
      return result;
    }
    offset += duration;
  }
  result.phase='complete';result.index=4;result.progress=1;result.units=boundedGrowthUnits;result.unitProgress=0;result.done=true;
  return result;
}

export function visibleHeroPointCount(plan, frame) {
  const units = Math.min(plan.growthUnits, frame.units + (frame.unitProgress >= .82 ? Math.min(1, (frame.unitProgress - .82) / .18) : 0));
  return Math.min(plan.points.length, plan.basePointCount + Math.floor(units) * plan.pointsPerUnit + (units % 1 >= .5 ? 1 : 0));
}

/** Count shared unit-centerline stations visible for the same molecular growth frame. */
export function visibleHeroCenterlinePointCount(plan, frame) {
  const progress = Math.min(plan.growthUnits, frame.units + (frame.unitProgress >= .82 ? Math.min(1, (frame.unitProgress - .82) / .18) : 0));
  return Math.min(plan.centerlinePoints.length, plan.baseUnitCount + Math.floor(progress));
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
