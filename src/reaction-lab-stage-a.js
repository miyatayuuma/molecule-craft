// Stateless canonical Coulomb + Lennard-Jones rigid-body physics.
// All positions are Angstroms; no Three.js values or visual radii enter here.
export const REACTION_LAB_WORLD_UNITS_PER_ANGSTROM = 0.78;
export const COULOMB_KCAL_ANGSTROM_PER_MOL_E2 = 332.06371;
export const KCAL_MOL_AMU_TO_ANGSTROM_PS2 = 418.4;
export const STAGE_A_PHYSICAL_PS_PER_GAME_SECOND = 0.10;
export const STAGE_A_GAME_STEP_SECONDS = 1 / 120;
export const STAGE_A_MAX_CATCH_UP_STEPS = 8;
export const OVERLAP_GUARD_RADIUS_ANGSTROM = 0.35;
export const OVERLAP_GUARD_SIGMA_FRACTION = 0.75;

export const STANDARD_ATOMIC_MASS_AMU = Object.freeze({
  H: 1.008, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998403163, P: 30.973761998, S: 32.06, Cl: 35.45,
});

const vec = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, value) => [a[0] * value, a[1] * value, a[2] * value];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const finiteVector = a => a.length === 3 && a.every(Number.isFinite);

function quaternionNormalize(q = [0, 0, 0, 1]) {
  const magnitude = Math.hypot(q[0], q[1], q[2], q[3]);
  return magnitude > 1e-15 ? q.map(value => value / magnitude) : [0, 0, 0, 1];
}

function quaternionRotate(qValue, point) {
  const [x, y, z, w] = quaternionNormalize(qValue);
  const u = [x, y, z];
  return add(point, add(scale(cross(u, point), 2 * w), scale(cross(u, cross(u, point)), 2)));
}

function quaternionMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function rigidBodyMassProperties(atoms) {
  if (!Array.isArray(atoms) || !atoms.length) throw new Error('A rigid body needs at least one real atom.');
  const masses = atoms.map(atom => {
    const mass = STANDARD_ATOMIC_MASS_AMU[atom.element];
    if (!Number.isFinite(mass)) throw new Error(`No standard atomic mass for ${atom.element}.`);
    return mass;
  });
  const totalMassAmu = masses.reduce((sum, mass) => sum + mass, 0);
  const centerOfMassAngstrom = atoms.reduce((sum, atom, index) => add(sum, scale(atom.positionAngstrom, masses[index])), vec()).map(value => value / totalMassAmu);
  const centeredPositionsAngstrom = atoms.map(atom => sub(atom.positionAngstrom, centerOfMassAngstrom));
  const inertiaTensorAmuAngstrom2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let index = 0; index < atoms.length; index++) {
    const r = centeredPositionsAngstrom[index], mass = masses[index], rr = dot(r, r);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      inertiaTensorAmuAngstrom2[row][column] += mass * ((row === column ? rr : 0) - r[row] * r[column]);
    }
  }
  return { totalMassAmu, centerOfMassAngstrom, centeredPositionsAngstrom, inertiaTensorAmuAngstrom2 };
}

// A C1-continuous soft core active only inside severe overlap. At the boundary
// it matches both distance and first derivative, leaving normal interactions
// exactly canonical and making force the derivative of the reported energy.
function guardedRadius(radius, boundary = OVERLAP_GUARD_RADIUS_ANGSTROM) {
  if (radius >= boundary) return { effectiveRadius: radius, derivative: 1, active: false };
  const ratio = Math.max(0, radius / boundary);
  return { effectiveRadius: boundary * (0.75 + 0.25 * ratio ** 4), derivative: ratio ** 3, active: true };
}

function radialForceVector(forceMagnitude, delta, radius, fallbackDirection) {
  if (radius > 1e-14) return scale(delta, forceMagnitude / radius);
  if (forceMagnitude === 0) return vec();
  const direction = finiteVector(fallbackDirection) && norm(fallbackDirection) > 1e-14 ? fallbackDirection : [1, 0, 0];
  return scale(direction, forceMagnitude / norm(direction));
}

export function coulombPairEnergyForce(chargeA, chargeB, deltaAngstrom, { guardRadiusAngstrom = OVERLAP_GUARD_RADIUS_ANGSTROM, fallbackDirection } = {}) {
  const radius = norm(deltaAngstrom);
  if (!Number.isFinite(radius) || !chargeA || !chargeB) return { energyKcalMol: 0, forceOnA: vec(), guarded: false };
  const guard = guardedRadius(radius, guardRadiusAngstrom);
  const product = COULOMB_KCAL_ANGSTROM_PER_MOL_E2 * chargeA * chargeB;
  const energyKcalMol = product / guard.effectiveRadius;
  const derivative = -product / (guard.effectiveRadius ** 2) * guard.derivative;
  return { energyKcalMol, forceOnA: radialForceVector(derivative, deltaAngstrom, radius, fallbackDirection), guarded: guard.active };
}

export function lorentzBerthelot(sigmaA, epsilonA, sigmaB, epsilonB) {
  if (![sigmaA, epsilonA, sigmaB, epsilonB].every(Number.isFinite) || sigmaA <= 0 || sigmaB <= 0 || epsilonA < 0 || epsilonB < 0) throw new Error('Invalid Lennard-Jones parameters.');
  return { sigmaAngstrom: (sigmaA + sigmaB) / 2, epsilonKcalMol: Math.sqrt(epsilonA * epsilonB) };
}

export function lennardJonesPairEnergyForce(sigmaA, epsilonA, sigmaB, epsilonB, deltaAngstrom, { guardRadiusAngstrom = null, fallbackDirection } = {}) {
  const radius = norm(deltaAngstrom), mixed = lorentzBerthelot(sigmaA, epsilonA, sigmaB, epsilonB);
  if (!Number.isFinite(radius) || mixed.epsilonKcalMol === 0) return { ...mixed, energyKcalMol: 0, forceOnA: vec(), guarded: false };
  const guard = guardedRadius(radius, guardRadiusAngstrom ?? mixed.sigmaAngstrom * OVERLAP_GUARD_SIGMA_FRACTION), ratio = mixed.sigmaAngstrom / guard.effectiveRadius;
  const sixth = ratio ** 6, twelfth = sixth * sixth;
  const energyKcalMol = 4 * mixed.epsilonKcalMol * (twelfth - sixth);
  const derivative = 24 * mixed.epsilonKcalMol * (sixth - 2 * twelfth) / guard.effectiveRadius * guard.derivative;
  return { ...mixed, energyKcalMol, forceOnA: radialForceVector(derivative, deltaAngstrom, radius, fallbackDirection), guarded: guard.active };
}

function symmetricPseudoInverseMultiply(matrixValue, vectorValue) {
  // Jacobi eigen decomposition yields a stable Moore-Penrose inverse for the
  // zero principal moment of linear molecules without amplifying that axis.
  const a = matrixValue.map(row => [...row]), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 24; iteration++) {
    let p = 0, q = 1;
    if (Math.abs(a[0][2]) > Math.abs(a[p][q])) [p, q] = [0, 2];
    if (Math.abs(a[1][2]) > Math.abs(a[p][q])) [p, q] = [1, 2];
    if (Math.abs(a[p][q]) < 1e-14) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(angle), s = Math.sin(angle);
    for (let k = 0; k < 3; k++) {
      if (k === p || k === q) continue;
      const apk = a[p][k], aqk = a[q][k];
      a[p][k] = a[k][p] = c * apk - s * aqk;
      a[q][k] = a[k][q] = s * apk + c * aqk;
    }
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  const eigenvalues = [a[0][0], a[1][1], a[2][2]], maximum = Math.max(0, ...eigenvalues), threshold = Math.max(1e-12, maximum * 1e-10);
  const transformed = v[0].map((_, column) => dot([v[0][column], v[1][column], v[2][column]], vectorValue));
  const coefficients = eigenvalues.map((value, index) => value > threshold ? transformed[index] / value : 0);
  return [0, 1, 2].map(row => coefficients.reduce((sum, value, index) => sum + v[row][index] * value, 0));
}

function bodySitePosition(body, localPosition) { return add(body.positionAngstrom, quaternionRotate(body.orientation, localPosition)); }
function stableFallback(a, b) {
  const seed = `${a.bodyId}:${a.kind}:${a.index}|${b.bodyId}:${b.kind}:${b.index}`;
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const axis = Math.abs(hash % 3), sign = (hash & 4) ? -1 : 1;
  return axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign];
}

export function evaluateStageAForces(bodies, { excludedMoleculePairs = new Set(), collectPairDiagnostics = true, profile = null, includeStageBVirtualSites = false } = {}) {
  if (!collectPairDiagnostics) return evaluateStageAForcesFast(bodies, { excludedMoleculePairs, profile, includeStageBVirtualSites });
  const results = new Map(bodies.map(body => [body.id, { forceKcalMolAngstrom: vec(), torqueKcalMolAngstrom: vec(), energyKcalMol: 0 }]));
  const pairDiagnostics = [];
  let overlapGuardActivationCount = 0;
  // A rigid body's orientation is constant throughout this force evaluation.
  // Cache each transformed site once instead of rotating it for every pair.
  const prepared = bodies.map(body => ({ body, sites: [
    ...(body.atoms ?? []).map((atom, index) => ({ bodyId: body.id, kind: 'atom', index, chargeE: atom.chargeE, atom, positionAngstrom: bodySitePosition(body, atom.positionAngstrom) })),
    ...(body.virtualChargeSites ?? []).map((site, index) => ({ bodyId: body.id, kind: 'virtual', index, chargeE: site.chargeE, atom: null, positionAngstrom: bodySitePosition(body, site.positionAngstrom) })),
  ] }));
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex++) {
    const left = bodies[leftIndex], right = bodies[rightIndex], pairName = [left.id, right.id].sort().join('|');
    if (excludedMoleculePairs.has(pairName)) continue;
    const leftResult = results.get(left.id), rightResult = results.get(right.id), sitePairs = new Map();
    const getPair = (siteA, siteB, positionA, positionB) => {
      if (!collectPairDiagnostics) return null;
      const key = `${siteA.kind}:${siteA.index}|${siteB.kind}:${siteB.index}`;
      if (!sitePairs.has(key)) sitePairs.set(key, { bodyAId: left.id, siteA: { kind: siteA.kind, index: siteA.index }, bodyBId: right.id, siteB: { kind: siteB.kind, index: siteB.index }, positionA, positionB, coulombEnergyKcalMol: 0, ljEnergyKcalMol: 0, coulombForceOnA: vec(), ljForceOnA: vec(), forceOnA: vec(), torqueOnA: vec(), torqueOnB: vec(), overlapGuarded: false });
      return sitePairs.get(key);
    };
    const leftSites = prepared[leftIndex].sites, rightSites = prepared[rightIndex].sites;
    for (const siteA of leftSites) for (const siteB of rightSites) {
      if (!siteA.chargeE || !siteB.chargeE) continue;
      const positionA = siteA.positionAngstrom, positionB = siteB.positionAngstrom, delta = sub(positionB, positionA), fallbackDirection = stableFallback(siteA, siteB);
      const term = coulombPairEnergyForce(siteA.chargeE, siteB.chargeE, delta, { fallbackDirection }), pair = getPair(siteA, siteB, positionA, positionB);
      if(pair){pair.coulombEnergyKcalMol += term.energyKcalMol; pair.coulombForceOnA = add(pair.coulombForceOnA, term.forceOnA); pair.forceOnA = add(pair.forceOnA, term.forceOnA); pair.overlapGuarded ||= term.guarded;}
      leftResult.energyKcalMol += term.energyKcalMol / 2; rightResult.energyKcalMol += term.energyKcalMol / 2;
      leftResult.forceKcalMolAngstrom = add(leftResult.forceKcalMolAngstrom, term.forceOnA); rightResult.forceKcalMolAngstrom = sub(rightResult.forceKcalMolAngstrom, term.forceOnA);
      const torqueA = cross(sub(positionA, left.positionAngstrom), term.forceOnA), torqueB = cross(sub(positionB, right.positionAngstrom), scale(term.forceOnA, -1));
      leftResult.torqueKcalMolAngstrom = add(leftResult.torqueKcalMolAngstrom, torqueA); rightResult.torqueKcalMolAngstrom = add(rightResult.torqueKcalMolAngstrom, torqueB);
      if(pair){pair.torqueOnA = add(pair.torqueOnA, torqueA); pair.torqueOnB = add(pair.torqueOnB, torqueB);}
      if (term.guarded) overlapGuardActivationCount++;
    }
    for (const siteA of leftSites) {
      if (!siteA.atom) continue;
      const positionA = siteA.positionAngstrom;
      for (const siteB of rightSites) {
        if (!siteB.atom) continue;
        const positionB = siteB.positionAngstrom, delta = sub(positionB, positionA), fallbackDirection = stableFallback(siteA, siteB);
        const atomA = siteA.atom, atomB = siteB.atom;
        const term = lennardJonesPairEnergyForce(atomA.sigmaAngstrom, atomA.epsilonKcalMol, atomB.sigmaAngstrom, atomB.epsilonKcalMol, delta, { fallbackDirection });
        const pair = getPair(siteA, siteB, positionA, positionB);
        const guardAlreadyCounted = pair?.overlapGuarded??false;
        if(pair){pair.ljEnergyKcalMol += term.energyKcalMol; pair.ljForceOnA = add(pair.ljForceOnA, term.forceOnA); pair.forceOnA = add(pair.forceOnA, term.forceOnA); pair.overlapGuarded ||= term.guarded;}
        leftResult.energyKcalMol += term.energyKcalMol / 2; rightResult.energyKcalMol += term.energyKcalMol / 2;
        leftResult.forceKcalMolAngstrom = add(leftResult.forceKcalMolAngstrom, term.forceOnA); rightResult.forceKcalMolAngstrom = sub(rightResult.forceKcalMolAngstrom, term.forceOnA);
        const torqueA = cross(sub(positionA, left.positionAngstrom), term.forceOnA), torqueB = cross(sub(positionB, right.positionAngstrom), scale(term.forceOnA, -1));
        leftResult.torqueKcalMolAngstrom = add(leftResult.torqueKcalMolAngstrom, torqueA); rightResult.torqueKcalMolAngstrom = add(rightResult.torqueKcalMolAngstrom, torqueB);
        if(pair){pair.torqueOnA = add(pair.torqueOnA, torqueA); pair.torqueOnB = add(pair.torqueOnB, torqueB);}
        if (term.guarded && !guardAlreadyCounted) overlapGuardActivationCount++;
      }
    }
    if (collectPairDiagnostics) for (const pair of sitePairs.values()) pairDiagnostics.push({ ...pair, totalEnergyKcalMol: pair.coulombEnergyKcalMol + pair.ljEnergyKcalMol, coulombForce: pair.coulombForceOnA, ljForce: pair.ljForceOnA, totalForce: pair.forceOnA });
  }
  return { bodies: results, pairDiagnostics, overlapGuardActivationCount };
}

// Allocation-light evaluator used by the viewer's production step. Diagnostics
// intentionally stay on the rich path above; this path only returns body state
// and the overlap count, and uses one real-real traversal for both potentials.
const descriptorByBody = new WeakMap();
const ljMixByBody = new WeakMap();
const EMPTY_SITES = Object.freeze([]);

function staticDescriptor(body, includeStageBVirtualSites) {
  const stageB = includeStageBVirtualSites ? (body.stageBVirtualChargeSites ?? EMPTY_SITES) : EMPTY_SITES;
  const cached = descriptorByBody.get(body);
  if (cached && cached.atomsRef === body.atoms && cached.virtualRef === body.virtualChargeSites && cached.stageBRef === stageB) return cached;
  const atoms = body.atoms ?? [], canonicalVirtual = body.virtualChargeSites ?? [];
  const virtualCount = canonicalVirtual.length + stageB.length, realCount = atoms.length;
  const localX = new Float64Array(realCount + virtualCount), localY = new Float64Array(realCount + virtualCount), localZ = new Float64Array(realCount + virtualCount);
  const charge = new Float64Array(realCount + virtualCount), sigma = new Float64Array(realCount), epsilon = new Float64Array(realCount);
  for (let i = 0; i < realCount; i++) {
    const atom = atoms[i], p = atom.positionAngstrom;
    localX[i] = p[0]; localY[i] = p[1]; localZ[i] = p[2]; charge[i] = atom.chargeE ?? 0;
    sigma[i] = atom.sigmaAngstrom; epsilon[i] = atom.epsilonKcalMol;
  }
  let out = realCount;
  for (const sites of [canonicalVirtual, stageB]) for (let i = 0; i < sites.length; i++, out++) {
    const p = sites[i].positionAngstrom;
    localX[out] = p[0]; localY[out] = p[1]; localZ[out] = p[2]; charge[out] = sites[i].chargeE;
  }
  const worldX = new Float64Array(realCount + virtualCount), worldY = new Float64Array(realCount + virtualCount), worldZ = new Float64Array(realCount + virtualCount);
  const result = { atomsRef: body.atoms, virtualRef: body.virtualChargeSites, stageBRef: stageB, realCount, virtualCount, localX, localY, localZ, charge, sigma, epsilon, worldX, worldY, worldZ, stageBCount: stageB.length };
  descriptorByBody.set(body, result);
  return result;
}

function transformDescriptor(body, d) {
  const q = body.orientation, qx=q[0], qy=q[1], qz=q[2], qw=q[3];
  // Same unit-quaternion rotation used by quaternionRotate, expressed directly
  // so each site creates no vectors or intermediate arrays.
  const xx=qx*qx, yy=qy*qy, zz=qz*qz, xy=qx*qy, xz=qx*qz, yz=qy*qz, wx=qw*qx, wy=qw*qy, wz=qw*qz;
  const m00=1-2*(yy+zz), m01=2*(xy-wz), m02=2*(xz+wy);
  const m10=2*(xy+wz), m11=1-2*(xx+zz), m12=2*(yz-wx);
  const m20=2*(xz-wy), m21=2*(yz+wx), m22=1-2*(xx+yy), px=body.positionAngstrom[0], py=body.positionAngstrom[1], pz=body.positionAngstrom[2];
  for (let i=0, n=d.realCount+d.virtualCount; i<n; i++) {
    const x=d.localX[i], y=d.localY[i], z=d.localZ[i];
    d.worldX[i]=px+m00*x+m01*y+m02*z; d.worldY[i]=py+m10*x+m11*y+m12*z; d.worldZ[i]=pz+m20*x+m21*y+m22*z;
  }
}

function bodyPairMix(left, right) {
  let rightMap = ljMixByBody.get(left);
  if (!rightMap) { rightMap = new WeakMap(); ljMixByBody.set(left, rightMap); }
  const cached = rightMap.get(right);
  if (cached && cached.leftAtoms === left.atoms && cached.rightAtoms === right.atoms) return cached;
  const a = left.atoms ?? [], b = right.atoms ?? [], sigma = new Float64Array(a.length*b.length), epsilon = new Float64Array(a.length*b.length);
  for (let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) {
    const k=i*b.length+j; sigma[k]=(a[i].sigmaAngstrom+b[j].sigmaAngstrom)/2; epsilon[k]=Math.sqrt(a[i].epsilonKcalMol*b[j].epsilonKcalMol);
  }
  const result={leftAtoms:left.atoms,rightAtoms:right.atoms,sigma,epsilon,rightCount:b.length}; rightMap.set(right,result); return result;
}

function hashFallbackAxis(leftId,leftKind,leftIndex,rightId,rightKind,rightIndex) {
  const seed = `${leftId}:${leftKind}:${leftIndex}|${rightId}:${rightKind}:${rightIndex}`;
  let hash=2166136261; for(let i=0;i<seed.length;i++) hash=Math.imul(hash^seed.charCodeAt(i),16777619);
  return [Math.abs(hash%3), (hash&4)?-1:1];
}

const clockNow=()=>globalThis.performance?.now?.()??Date.now();
function evaluateStageAForcesFast(bodies, { excludedMoleculePairs = new Set(), includeStageBVirtualSites = false, profile = null } = {}) {
  if(profile){profile.worldSiteTransformationMs??=0;profile.coulombPairEvaluationMs??=0;profile.ljPairEvaluationMs??=0;profile.torqueAccumulationMs??=0;profile.stageBAugmentationMs=0;profile.stageBAugmentedBodyCopies=0;profile.realRealPairEvaluations??=0;profile.virtualChargePairEvaluations??=0;profile.staticSiteDescriptorsRebuilt=0;profile.allocationCounters??={pairDiagnosticMaps:0,pairDiagnosticObjects:0,temporaryVectorArraysPerPair:0,bodyResultRecords:0};}
  const count=bodies.length, forceX=new Float64Array(count),forceY=new Float64Array(count),forceZ=new Float64Array(count),torqueX=new Float64Array(count),torqueY=new Float64Array(count),torqueZ=new Float64Array(count),energy=new Float64Array(count);
  const descriptors=new Array(count); let guardCount=0;
  for(let i=0;i<count;i++){const body=bodies[i],stageB=includeStageBVirtualSites?(body.stageBVirtualChargeSites??EMPTY_SITES):EMPTY_SITES,cached=descriptorByBody.get(body),rebuild=!(cached&&cached.atomsRef===body.atoms&&cached.virtualRef===body.virtualChargeSites&&cached.stageBRef===stageB),d=staticDescriptor(body,includeStageBVirtualSites);descriptors[i]=d;if(profile&&rebuild)profile.staticSiteDescriptorsRebuilt++;const started=profile?clockNow():0;transformDescriptor(body,d);if(profile){profile.worldSiteTransformationMs+=clockNow()-started;profile.transformedWorldSiteCount=(profile.transformedWorldSiteCount??0)+d.realCount+d.virtualCount;}}
  const pairName=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
  const apply=(ai,bi,sa,sb,fx,fy,fz,e,guarded)=>{
    forceX[ai]+=fx;forceY[ai]+=fy;forceZ[ai]+=fz;forceX[bi]-=fx;forceY[bi]-=fy;forceZ[bi]-=fz;energy[ai]+=e*0.5;energy[bi]+=e*0.5;
    const a=bodies[ai],b=bodies[bi],da=descriptors[ai],db=descriptors[bi];
    torqueX[ai]+=(da.worldY[sa]-a.positionAngstrom[1])*fz-(da.worldZ[sa]-a.positionAngstrom[2])*fy;
    torqueY[ai]+=(da.worldZ[sa]-a.positionAngstrom[2])*fx-(da.worldX[sa]-a.positionAngstrom[0])*fz;
    torqueZ[ai]+=(da.worldX[sa]-a.positionAngstrom[0])*fy-(da.worldY[sa]-a.positionAngstrom[1])*fx;
    torqueX[bi]-=(db.worldY[sb]-b.positionAngstrom[1])*fz-(db.worldZ[sb]-b.positionAngstrom[2])*fy;
    torqueY[bi]-=(db.worldZ[sb]-b.positionAngstrom[2])*fx-(db.worldX[sb]-b.positionAngstrom[0])*fz;
    torqueZ[bi]-=(db.worldX[sb]-b.positionAngstrom[0])*fy-(db.worldY[sb]-b.positionAngstrom[1])*fx;
    if(guarded)guardCount++;
  };
  const interaction=(ai,bi,sa,sb,chargeA,chargeB,sigma,epsilon,ljGuardBoundary)=>{
    const a=descriptors[ai],b=descriptors[bi],dx=b.worldX[sb]-a.worldX[sa],dy=b.worldY[sb]-a.worldY[sa],dz=b.worldZ[sb]-a.worldZ[sa],r2=dx*dx+dy*dy+dz*dz,r=Math.sqrt(r2);
    if(!Number.isFinite(r))return;
    let e=0,derivative=0,guarded=false;
    if(chargeA&&chargeB){
      const profileStart=profile?clockNow():0;
      const g=r<OVERLAP_GUARD_RADIUS_ANGSTROM,ratio=g?Math.max(0,r/OVERLAP_GUARD_RADIUS_ANGSTROM):1,eff=g?OVERLAP_GUARD_RADIUS_ANGSTROM*(.75+.25*ratio**4):r,gd=g?ratio**3:1,product=COULOMB_KCAL_ANGSTROM_PER_MOL_E2*chargeA*chargeB;
      e=product/eff;derivative=-product/(eff*eff)*gd;guarded=g;
      if(profile)profile.coulombPairEvaluationMs+=clockNow()-profileStart;
    }
    if(epsilon!==0){
      const profileStart=profile?clockNow():0;
      const g=r<ljGuardBoundary,ratioGuard=g?Math.max(0,r/ljGuardBoundary):1,eff=g?ljGuardBoundary*(.75+.25*ratioGuard**4):r,gd=g?ratioGuard**3:1,ratio=sigma/eff,sixth=ratio**6,twelfth=sixth*sixth;
      e+=4*epsilon*(twelfth-sixth);derivative+=24*epsilon*(sixth-2*twelfth)/eff*gd;guarded ||= g;
      if(profile)profile.ljPairEvaluationMs+=clockNow()-profileStart;
    }
    let fx=0,fy=0,fz=0;
    if(r>1e-14){const factor=derivative/r;fx=dx*factor;fy=dy*factor;fz=dz*factor;}
    else if(derivative!==0){const [axis,sign]=hashFallbackAxis(bodies[ai].id,sa<a.realCount?'atom':'virtual',sa<a.realCount?sa:sa-a.realCount,bodies[bi].id,sb<b.realCount?'atom':'virtual',sb<b.realCount?sb:sb-b.realCount);if(axis===0)fx=sign*derivative;else if(axis===1)fy=sign*derivative;else fz=sign*derivative;}
    if(profile)profile.realRealPairEvaluations++;
    const torqueStart=profile?clockNow():0;apply(ai,bi,sa,sb,fx,fy,fz,e,guarded);if(profile)profile.torqueAccumulationMs+=clockNow()-torqueStart;
  };
  const coulombOnly=(ai,bi,sa,sb)=>{
    const a=descriptors[ai],b=descriptors[bi],qa=a.charge[sa],qb=b.charge[sb];
    if(!qa||!qb)return;
    const dx=b.worldX[sb]-a.worldX[sa],dy=b.worldY[sb]-a.worldY[sa],dz=b.worldZ[sb]-a.worldZ[sa],r=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(!Number.isFinite(r))return;
    const profileStart=profile?clockNow():0,guarded=r<OVERLAP_GUARD_RADIUS_ANGSTROM,ratio=guarded?Math.max(0,r/OVERLAP_GUARD_RADIUS_ANGSTROM):1,effective=guarded?OVERLAP_GUARD_RADIUS_ANGSTROM*(.75+.25*ratio**4):r,derivative=-(COULOMB_KCAL_ANGSTROM_PER_MOL_E2*qa*qb)/(effective*effective)*(guarded?ratio**3:1),energy=COULOMB_KCAL_ANGSTROM_PER_MOL_E2*qa*qb/effective;
    let fx=0,fy=0,fz=0;
    if(r>1e-14){const factor=derivative/r;fx=dx*factor;fy=dy*factor;fz=dz*factor;}
    else if(derivative!==0){const [axis,sign]=hashFallbackAxis(bodies[ai].id,sa<a.realCount?'atom':'virtual',sa<a.realCount?sa:sa-a.realCount,bodies[bi].id,sb<b.realCount?'atom':'virtual',sb<b.realCount?sb:sb-b.realCount);if(axis===0)fx=sign*derivative;else if(axis===1)fy=sign*derivative;else fz=sign*derivative;}
    if(profile){profile.coulombPairEvaluationMs+=clockNow()-profileStart;profile.virtualChargePairEvaluations++;}
    const torqueStart=profile?clockNow():0;apply(ai,bi,sa,sb,fx,fy,fz,energy,guarded);if(profile)profile.torqueAccumulationMs+=clockNow()-torqueStart;
  };
  for(let ai=0;ai<count;ai++)for(let bi=ai+1;bi<count;bi++){
    const left=bodies[ai],right=bodies[bi];if(excludedMoleculePairs.size&&excludedMoleculePairs.has(pairName(left.id,right.id)))continue;
    const a=descriptors[ai],b=descriptors[bi],mix=bodyPairMix(left,right);
    // One real-real traversal evaluates both Coulomb and LJ with the same r.
    for(let i=0;i<a.realCount;i++)for(let j=0;j<b.realCount;j++){
      const k=i*mix.rightCount+j,sigma=mix.sigma[k],epsilon=mix.epsilon[k];
      interaction(ai,bi,i,j,a.charge[i],b.charge[j],sigma,epsilon,sigma*OVERLAP_GUARD_SIGMA_FRACTION);
    }
    // Only pairs involving canonical or Stage B virtual charges use the extra
    // Coulomb path; each real-real charge pair above is already accounted for.
    for(let i=0;i<a.realCount;i++)for(let j=b.realCount;j<b.realCount+b.virtualCount;j++)coulombOnly(ai,bi,i,j);
    for(let i=a.realCount;i<a.realCount+a.virtualCount;i++)for(let j=0;j<b.realCount;j++)coulombOnly(ai,bi,i,j);
    for(let i=a.realCount;i<a.realCount+a.virtualCount;i++)for(let j=b.realCount;j<b.realCount+b.virtualCount;j++)coulombOnly(ai,bi,i,j);
  }
  const results=new Map();for(let i=0;i<count;i++)results.set(bodies[i].id,{forceKcalMolAngstrom:[forceX[i],forceY[i],forceZ[i]],torqueKcalMolAngstrom:[torqueX[i],torqueY[i],torqueZ[i]],energyKcalMol:energy[i]});if(profile)profile.allocationCounters.bodyResultRecords+=count;
  return {bodies:results,pairDiagnostics:[],overlapGuardActivationCount:guardCount};
}

export function createStageABody({ id, positionAngstrom, orientation = [0, 0, 0, 1], velocityAngstromPerPs = [0, 0, 0], angularVelocityRadPerPs = [0, 0, 0], atoms, virtualChargeSites = [], massProperties = null }) {
  const properties = massProperties ?? rigidBodyMassProperties(atoms);
  const inertiaTensorAmuAngstrom2 = properties.inertiaTensorAmuAngstrom2.map(row => [...row]);
  const inertiaTensorInverseAmuAngstromMinus2 = [0,1,2].map(column => {
    const vector=[0,0,0]; vector[column]=1; return symmetricPseudoInverseMultiply(inertiaTensorAmuAngstrom2,vector);
  });
  const inverseRows=[0,1,2].map(row=>[inertiaTensorInverseAmuAngstromMinus2[0][row],inertiaTensorInverseAmuAngstromMinus2[1][row],inertiaTensorInverseAmuAngstromMinus2[2][row]]);
  return { id, positionAngstrom: [...positionAngstrom], orientation: quaternionNormalize(orientation), velocityAngstromPerPs: [...velocityAngstromPerPs], angularVelocityRadPerPs: [...angularVelocityRadPerPs], atoms: atoms.map((atom, index) => ({ ...atom, positionAngstrom: [...(properties.centeredPositionsAngstrom?.[index] ?? atom.positionAngstrom)], massAmu: STANDARD_ATOMIC_MASS_AMU[atom.element] })), virtualChargeSites: virtualChargeSites.map(site => ({ ...site, positionAngstrom: [...site.positionAngstrom] })), massAmu: properties.totalMassAmu, inertiaTensorAmuAngstrom2, inertiaTensorInverseAmuAngstromMinus2: inverseRows };
}

export function integrateStageA(bodies, physicalDeltaPs, { excludedMoleculePairs = new Set(), linearDampingPerPs = 9.08, angularDampingPerPs = 37.1, collectPairDiagnostics = true, includeStageBVirtualSites = false, profile = null } = {}) {
  if (!Number.isFinite(physicalDeltaPs) || physicalDeltaPs < 0) throw new Error('Physical timestep must be finite and non-negative.');
  const forces = collectPairDiagnostics
    ? evaluateStageAForces(bodies, { excludedMoleculePairs, collectPairDiagnostics })
    : evaluateStageAForcesFast(bodies, { excludedMoleculePairs, includeStageBVirtualSites, profile });
  for (const body of bodies) {
    if (body.kinematic) continue;
    const angularStart=profile?clockNow():0;
    const state = forces.bodies.get(body.id), acceleration = scale(state.forceKcalMolAngstrom, KCAL_MOL_AMU_TO_ANGSTROM_PS2 / body.massAmu);
    body.velocityAngstromPerPs = scale(add(body.velocityAngstromPerPs, scale(acceleration, physicalDeltaPs)), Math.exp(-linearDampingPerPs * physicalDeltaPs));
    body.positionAngstrom = add(body.positionAngstrom, scale(body.velocityAngstromPerPs, physicalDeltaPs));
    const profileStart=profile?clockNow():0,conjugate=[-body.orientation[0],-body.orientation[1],-body.orientation[2],body.orientation[3]], torqueBody=quaternionRotate(conjugate,state.torqueKcalMolAngstrom), inverse=body.inertiaTensorInverseAmuAngstromMinus2;
    const accelerationBody=[inverse[0][0]*torqueBody[0]+inverse[0][1]*torqueBody[1]+inverse[0][2]*torqueBody[2],inverse[1][0]*torqueBody[0]+inverse[1][1]*torqueBody[1]+inverse[1][2]*torqueBody[2],inverse[2][0]*torqueBody[0]+inverse[2][1]*torqueBody[1]+inverse[2][2]*torqueBody[2]];
    const angularAcceleration = scale(quaternionRotate(body.orientation,accelerationBody), KCAL_MOL_AMU_TO_ANGSTROM_PS2);
    if(profile){profile.inertiaAngularAccelerationMs=(profile.inertiaAngularAccelerationMs??0)+clockNow()-profileStart;profile.angularStateUpdateMs=(profile.angularStateUpdateMs??0)+clockNow()-angularStart;}
    body.angularVelocityRadPerPs = scale(add(body.angularVelocityRadPerPs, scale(angularAcceleration, physicalDeltaPs)), Math.exp(-angularDampingPerPs * physicalDeltaPs));
    const omega=body.angularVelocityRadPerPs,omegaQuaternion=[omega[0],omega[1],omega[2],0];
    body.orientation=quaternionNormalize(quaternionMultiply(omegaQuaternion,body.orientation).map((value,index)=>body.orientation[index]+0.5*value*physicalDeltaPs));
  }
  return forces;
}

export function createFixedStepAccumulator(step, { gameStepSeconds = STAGE_A_GAME_STEP_SECONDS, physicalPsPerGameSecond = STAGE_A_PHYSICAL_PS_PER_GAME_SECOND, maxCatchUpSteps = STAGE_A_MAX_CATCH_UP_STEPS } = {}) {
  if (typeof step !== 'function' || !(gameStepSeconds > 0) || !(physicalPsPerGameSecond > 0) || !Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps < 1) throw new Error('Invalid fixed-step accumulator configuration.');
  let accumulator = 0;
  return {
    advance(renderDeltaSeconds) {
      const delta = Number.isFinite(renderDeltaSeconds) ? Math.max(0, Math.min(renderDeltaSeconds, gameStepSeconds * maxCatchUpSteps)) : 0;
      accumulator = Math.min(accumulator + delta, gameStepSeconds * maxCatchUpSteps);
      let steps = 0;
      while (accumulator + 1e-12 >= gameStepSeconds && steps < maxCatchUpSteps) {
        step(gameStepSeconds * physicalPsPerGameSecond);
        accumulator -= gameStepSeconds; steps++;
      }
      return { steps, interpolationAlpha: accumulator / gameStepSeconds, droppedGameSeconds: Math.max(0, renderDeltaSeconds - delta) };
    },
    reset() { accumulator = 0; },
    get remainderGameSeconds() { return accumulator; },
  };
}

export function stageABodySnapshot(body) {
  return { id: body.id, massAmu: body.massAmu, centerOfMassAngstrom: [...body.positionAngstrom], inertiaTensorAmuAngstrom2: body.inertiaTensorAmuAngstrom2.map(row => [...row]), positionAngstrom: [...body.positionAngstrom], orientation: [...body.orientation], velocityAngstromPerPs: [...body.velocityAngstromPerPs], angularVelocityRadPerPs: [...body.angularVelocityRadPerPs] };
}
