export function createStructureSolver({
  THREE,
  molecule,
  placements,
  atomById,
  bondBetween,
  bondLengthFor,
  geometryFor: getGeometry,
  radiusFor,
  nonbondedDistanceFor,
}) {
  let dirty = true;
  let cycles = [];
  let aromaticCycles = [];
  let aromaticEdges = new Set();
  let doubleFrames = new Map();
  let trigonalFrames = new Map();
  let aromaticFrames = new Map();
  let stericExclusions = new Set();
  let stericRelations = new Map();
  let ringFrames = [];
  let rigidFragments = [];
  let bridgeSides = new Map();
  let angleTargets = new Map();
  let componentIds = new Map();
  let adjacency = new Map(), geometries = new Map(), topologyLimited = false;
  const neighborsFor = id => adjacency.get(id) ?? [];
  const geometryFor = id => geometries.get(id) ?? getGeometry(id);

  const pos = id => placements.get(id)?.position;
  const pairKey = (a, b) => `${Math.min(a, b)}:${Math.max(a, b)}`;

  function markTopologyDirty() {
    dirty = true;
  }

  function rebuildTopology({ resetFrames = false } = {}) {
    if (resetFrames) { doubleFrames.clear(); aromaticFrames.clear(); trigonalFrames.clear(); }
    adjacency = new Map(molecule.atoms.map(a => [a.id, []]));
    for (const bond of molecule.bonds) { adjacency.get(bond.a)?.push({atomId:bond.b,order:bond.order}); adjacency.get(bond.b)?.push({atomId:bond.a,order:bond.order}); }
    geometries = new Map(molecule.atoms.map(a => [a.id,getGeometry(a.id)]));
    topologyLimited = false;
    cycles = findCycles(8);
    if (topologyLimited) cycles = []; // Keep the graph; do not optimize a partial set of rings.
    aromaticCycles = cycles.filter(isAromaticSixCarbonCycle);
    aromaticEdges = new Set();
    for (const cycle of aromaticCycles) cycle.forEach((id, index) => aromaticEdges.add(pairKey(id, cycle[(index + 1) % cycle.length])));

    const nextDoubleFrames = new Map();
    for (const bond of molecule.bonds) {
      const key = pairKey(bond.a, bond.b);
      if (bond.order !== 2 || aromaticEdges.has(key) || [bond.a,bond.b].some(id => geometryFor(id).kind !== 'sp2')) continue;
      const atomIds = planarSubstituentGroup(bond);
      const previous = doubleFrames.get(key);
      const normal = previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : doublePlaneNormal(bond, atomIds);
      const frame = {
        key,
        bond: { a: bond.a, b: bond.b },
        atomIds,
        normal,
      };
      frame.substituentSlots = doubleSubstituentSlots(frame, previous?.substituentSlots);
      frame.slottedRootIds = new Set(frame.substituentSlots.flatMap(endpoint => endpoint.branches.map(branch => branch.rootId)));
      nextDoubleFrames.set(key, frame);
    }
    doubleFrames = nextDoubleFrames;
    const nextTrigonalFrames = new Map();
    for (const atom of molecule.atoms) {
      const ns=neighborsFor(atom.id);
      if (geometryFor(atom.id).kind!=='trigonal'||ns.length!==3) continue;
      const atomIds=[atom.id,...ns.map(n=>n.atomId)], previous=trigonalFrames.get(atom.id);
      const normal=previous&&sameMembers(previous.atomIds,atomIds)?previous.normal.clone():doublePlaneNormal({a:atom.id,b:ns[0].atomId},atomIds);
      nextTrigonalFrames.set(atom.id,{atomIds,cycle:[atom.id],normal});
    }
    trigonalFrames=nextTrigonalFrames;

    const nextAromaticFrames = new Map();
    for (const cycle of aromaticCycles) {
      const key = canonicalCycleKey(cycle);
      const atomIds = aromaticPlanarGroup(cycle);
      const previous = aromaticFrames.get(key);
      const frame = {
        key,
        cycle: [...cycle],
        atomIds,
        normal: previous && sameMembers(previous.atomIds, atomIds) ? previous.normal.clone() : cycleNormal(cycle),
      };
      frame.substituents = aromaticSubstituentBranches(frame.cycle, previous?.substituents, frame.normal);
      frame.substituentRootIds = new Set(frame.substituents.map(substituent => substituent.rootId));
      nextAromaticFrames.set(key, frame);
    }
    aromaticFrames = nextAromaticFrames;
    ({excluded:stericExclusions,relations:stericRelations}=buildStericRelations());
    ringFrames = cycles.map(cycle => ({cycle:[...cycle],key:canonicalCycleKey(cycle),aromatic:aromaticCycles.some(item=>sameMembers(item,cycle))}));
    rigidFragments = buildRigidFragments();
    componentIds = new Map();
    for (const atom of molecule.atoms) {
      if (componentIds.has(atom.id)) continue;
      const queue = [atom.id]; componentIds.set(atom.id, atom.id);
      for (let i = 0; i < queue.length; i++) for (const neighbor of neighborsFor(queue[i])) {
        if (componentIds.has(neighbor.atomId)) continue;
        componentIds.set(neighbor.atomId, atom.id); queue.push(neighbor.atomId);
      }
    }
    // Cache graph cuts once per topology, not once per relaxation frame.
    bridgeSides = new Map();
    for (const bond of molecule.bonds) {
      const b = branchFromBond(bond.a, bond.b);
      if (b) bridgeSides.set(pairKey(bond.a, bond.b), { a: branchFromBond(bond.b, bond.a), b, aId: bond.a });
    }
    angleTargets = new Map();
    for (const atom of molecule.atoms) {
      const neighbors = neighborsFor(atom.id);
      const geometry = geometryFor(atom.id), sites = coordinationSites(atom.id, neighbors, geometry);
      for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) {
        const a = neighbors[i].atomId, b = neighbors[j].atomId;
        let target = sites ? Math.acos(THREE.MathUtils.clamp(sites[i].dot(sites[j]), -1, 1)) : geometry.angle;
        for (const cycle of cycles) {
          const index = cycle.indexOf(atom.id);
          if (index < 0) continue;
          const ends = [cycle[(index + cycle.length - 1) % cycle.length], cycle[(index + 1) % cycle.length]];
          if (ends.includes(a) && ends.includes(b)) target = Math.min(target, (cycle.length - 2) * Math.PI / cycle.length);
        }
        // Conjugated O/N followers use the same 120-degree target as their
        // aromatic constraint; competing target angles must not stall convergence.
        if ([...aromaticFrames.values()].some(frame => frame.substituents.some(s => s.rootId === atom.id && s.planarFollowers.length))) target = 2 * Math.PI / 3;
        angleTargets.set(`${atom.id}/${pairKey(a, b)}`, target);
      }
    }
    dirty = false;
  }

  // Assign distinct axial/equatorial sites once per topology, never a single
  // impossible angle to all 10/15 neighbor pairs. Minimize pose disruption.
  function coordinationSites(id, neighbors, geometry) {
    if (!['tbp','octahedral'].includes(geometry.kind) || !geometry.slots || neighbors.length > geometry.slots.length) return null;
    const slots = geometry.slots.map(v => new THREE.Vector3(...v));
    const dirs = neighbors.map(n => pos(n.atomId).clone().sub(pos(id)).normalize());
    let best = Infinity, result = null;
    function search(chosen, used, score) {
      if (score >= best) return;
      if (chosen.length === dirs.length) { best = score; result = [...chosen]; return; }
      const i = chosen.length;
      for (let k=0;k<slots.length;k++) if (!used.has(k)) {
        let next = score;
        for (let j=0;j<i;j++) next += (dirs[i].dot(dirs[j])-slots[k].dot(slots[chosen[j]]))**2;
        used.add(k); chosen.push(k); search(chosen,used,next); chosen.pop(); used.delete(k);
      }
    }
    search([],new Set(),0);
    return result?.map(i => slots[i]);
  }

  function step(scale = 0.5, passes = 1, options = {}) {
    if (dirty) rebuildTopology();
    const locked = options.lockedIds ?? new Set();
    let maxMove = 0;
    const activeAtoms = options.activeIds ? molecule.atoms.filter(a => options.activeIds.has(a.id)) : molecule.atoms;
    const activeBonds = options.activeIds ? molecule.bonds.filter(b => options.activeIds.has(b.a) && options.activeIds.has(b.b)) : molecule.bonds;
    for (let pass = 0; pass < passes; pass++) {
      const before = new Map(activeAtoms.map(atom => [atom.id, pos(atom.id)?.clone()]));
      // Stage B: topology-derived hard geometry. Stage A (torsion IK) lives in
      // conformation-engine.js and feeds a chemically valid trial pose here.
      for(const bond of activeBonds)enforceBondLength(bond,.12*scale,locked);
      // Stage D: local electron-domain geometry remains a soft correction.
      relaxLocalGeometry(scale,locked,activeAtoms);
      projectRigidConstraints(scale,locked,activeAtoms);
      // Stage C: non-bonded collisions and explicit topology penetration.
      // It runs after local geometry so collision response cannot become the
      // source of a large angular correction in the same iteration.
      relaxStericIntersections(scale,locked,options.activeIds);
      for(const bond of activeBonds)enforceBondLength(bond,.35*scale,locked);

      for (const atom of activeAtoms) {
        const point = pos(atom.id);
        const old = before.get(atom.id);
        if (point && old) maxMove = Math.max(maxMove, point.distanceTo(old));
      }
    }
    return maxMove;
  }

  function projectRigidConstraints(scale,locked,activeAtoms){
    for(const frame of doubleFrames.values()){
      enforcePlane(frame.atomIds,frame.normal,[frame.bond.a,frame.bond.b],.22*scale,locked,frame.bond,frame.slottedRootIds);
      enforceDoubleSubstituentDirections(frame,.24*scale,locked);
    }
    for(const frame of trigonalFrames.values())enforcePlane(frame.atomIds,frame.normal,frame.cycle,.22*scale,locked);
    for(const atom of activeAtoms)if(geometryFor(atom.id).kind==='sp')enforceLinearCenter(atom.id,.16*scale,locked);
    for(const frame of aromaticFrames.values()){
      enforcePlane(frame.atomIds,frame.normal,frame.cycle,.26*scale,locked,null,frame.substituentRootIds);
      enforceRegularAromaticCycle(frame,.045*scale,locked);
      enforceAromaticSubstituentDirections(frame,.28*scale,locked);
      enforceConjugatedSubstituentGeometry(frame,.30*scale,locked);
    }
  }

  function relaxStericIntersections(scale,locked,activeIds=null){
    enforceStericSeparation(.018*scale,locked,activeIds);
    enforceRingExclusion(.035*scale,locked,activeIds);
    enforceBondIntersectionSeparation(.018*scale,locked,activeIds);
  }

  function relaxLocalGeometry(scale,locked,activeAtoms){
    for(const atom of activeAtoms)enforceLocalAngles(atom.id,.085*scale,locked);
    for(const atom of activeAtoms)enforceTetrahedralVacancy(atom.id,.24*scale,locked);
  }

  function rotateReferenceFrames(quaternion, affectedIds = null) {
    if (dirty) rebuildTopology();
    const shouldRotate = frame => !affectedIds || frame.atomIds.every(id => affectedIds.has(id));
    for (const frame of trigonalFrames.values()) if (shouldRotate(frame)) frame.normal.applyQuaternion(quaternion).normalize();
    for (const frame of doubleFrames.values()) if (shouldRotate(frame)) frame.normal.applyQuaternion(quaternion).normalize();
    for (const frame of aromaticFrames.values()) if (shouldRotate(frame)) frame.normal.applyQuaternion(quaternion).normalize();
  }

  function enforceBondLength(bond, strength, locked) {
    const a = pos(bond.a);
    const b = pos(bond.b);
    if (!a || !b) return;
    const delta = b.clone().sub(a);
    const length = delta.length(), target = bondLengthFor(bond.a, bond.b, bond.order);
    if (length < 1e-8) delta.set(1, 0, 0);
    const correction = delta.normalize().multiplyScalar((length - target) * strength);
    const sides = bridgeSides.get(pairKey(bond.a, bond.b));
    if (sides && Math.abs(length - target) > target * 0.12) {
      const aLocked = sides.a.some(id => locked.has(id)), bLocked = sides.b.some(id => locked.has(id));
      const total = sides.a.length + sides.b.length;
      const wa = aLocked ? 0 : bLocked ? 1 : sides.b.length / total;
      const wb = bLocked ? 0 : aLocked ? 1 : sides.a.length / total;
      for (const id of sides.a) pos(id)?.addScaledVector(correction, wa);
      for (const id of sides.b) pos(id)?.addScaledVector(correction, -wb);
      return;
    }
    displacePair(bond.a, bond.b, correction, locked);
  }

  function enforceLocalAngles(centerId, strength, locked) {
    const center = pos(centerId);
    const neighbors = neighborsFor(centerId).map(neighbor => neighbor.atomId);
    if (!center || neighbors.length < 2) return;
    for (let left = 0; left < neighbors.length; left++) {
      for (let right = left + 1; right < neighbors.length; right++) {
        enforceAngle(centerId, neighbors[left], neighbors[right], angleTargets.get(`${centerId}/${pairKey(neighbors[left], neighbors[right])}`), strength, locked);
      }
    }
  }

  function enforceLinearCenter(centerId, strength, locked) {
    const center = pos(centerId);
    const neighbors = neighborsFor(centerId).sort((left, right) => right.order - left.order);
    if (!center || neighbors.length !== 2) return;
    const primaryId = neighbors[0].atomId, secondaryId = neighbors[1].atomId, primary = pos(primaryId), secondary = pos(secondaryId);
    if (!primary || !secondary || (locked.has(primaryId) && locked.has(secondaryId))) return;
    if (!locked.has(secondaryId)) {
      moveLinearBranch(centerId, secondaryId, primary.clone().sub(center).normalize().multiplyScalar(-1), Math.min(1, strength * 2.4), locked);
    } else if (!locked.has(primaryId)) {
      moveLinearBranch(centerId, primaryId, secondary.clone().sub(center).normalize().multiplyScalar(-1), Math.min(1, strength * 2.4), locked);
    }
  }

  function enforceTetrahedralVacancy(centerId, strength, locked) {
    if (!locked.has(centerId) || geometryFor(centerId).kind !== 'sp3') return;
    const neighbors = neighborsFor(centerId).map(n => n.atomId);
    if (neighbors.length !== 4) return;
    const moving = neighbors.filter(id => !locked.has(id));
    if (moving.length !== 1) return;
    // Three fixed tetrahedral bonds determine the remaining direction. Pure
    // pair-angle gradients have a false stationary point on the opposite side
    // of the sphere (e.g. a methane H dragged through the other three H atoms).
    const center = pos(centerId), direction = new THREE.Vector3();
    for (const id of neighbors) if (locked.has(id)) direction.sub(pos(id).clone().sub(center).normalize());
    if (direction.lengthSq() < 1e-8) return;
    const rootId = moving[0];
    moveBranchRootToward(centerId, { rootId, atomIds: angleBranch(centerId, rootId) }, direction.normalize(), strength, locked);
  }

  function moveLinearBranch(centerId, rootId, direction, strength, locked) {
    const sides = bridgeSides.get(pairKey(centerId, rootId));
    const atomIds = sides ? (sides.aId === rootId ? sides.a : sides.b) : [rootId];
    moveBranchRootToward(centerId, { rootId, atomIds }, direction, strength, locked);
  }

  function measureError({ ids = null, rigidReference = null } = {}) {
    if (dirty) rebuildTopology();
    const includes = id => !ids || ids.has(id);
    let finite = true, bondRelative = 0, angleRadians = 0, planeDistance = 0, overlapRelative = 0;
    for (const atom of molecule.atoms) if (includes(atom.id)) {
      const point = pos(atom.id);
      if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) finite = false;
      const neighbors = neighborsFor(atom.id).map(n => n.atomId);
      if (!point) continue;
      for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) {
        const a = pos(neighbors[i])?.clone().sub(point), b = pos(neighbors[j])?.clone().sub(point);
        if (!a || !b) { finite = false; continue; }
        const target = angleTargets.get(`${atom.id}/${pairKey(neighbors[i], neighbors[j])}`);
        angleRadians = Math.max(angleRadians, Math.abs(a.angleTo(b) - target));
      }
    }
    for (const bond of molecule.bonds) if (includes(bond.a) && includes(bond.b)) {
      const target = bondLengthFor(bond.a, bond.b, bond.order);
      bondRelative = Math.max(bondRelative, Math.abs((pos(bond.a)?.distanceTo(pos(bond.b)) ?? Infinity) / target - 1));
    }
    for (const frame of [...doubleFrames.values(), ...aromaticFrames.values(), ...trigonalFrames.values()]) {
      const anchors = (frame.cycle ?? [frame.bond.a, frame.bond.b]).map(pos);
      if (anchors.some(p => !p)) { finite = false; continue; }
      const center = anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
      for (const id of frame.atomIds) if (includes(id) && pos(id)) planeDistance = Math.max(planeDistance, Math.abs(pos(id).clone().sub(center).dot(frame.normal)));
    }
    const atoms=molecule.atoms.filter(atom=>includes(atom.id));
    if (nonbondedDistanceFor) for(const [left,right] of spatialAtomPairs(atoms)){
      const a=left.id,b=right.id;
      if(componentIds.get(a)!==componentIds.get(b)||stericExclusions.has(pairKey(a,b)))continue;
      overlapRelative=Math.max(overlapRelative,1-(pos(a)?.distanceTo(pos(b))??0)/stericMinimum(a,b));
    }
    const ringIssues=measureRingPenetrations(includes);
    const bondIntersections=measureBondIntersections(includes);
    const rigidRelative=measureRigidDeviation(rigidReference,includes);
    finite &&= [bondRelative, angleRadians, planeDistance, overlapRelative, rigidRelative].every(Number.isFinite);
    return {finite,bondRelative,angleRadians,planeDistance,overlapRelative,
      ringPenetrations:ringIssues.atomCount+ringIssues.bondCount,ringAtomPenetrations:ringIssues.atomCount,
      ringBondPenetrations:ringIssues.bondCount,bondIntersections,rigidRelative,topologyLimited};
  }

  function stericMinimum(a,b){
    const base=nonbondedDistanceFor?.(a,b)??((radiusFor(a)+radiusFor(b))*.72);
    // 1–2 and 1–3 pairs are excluded. A 1–4 pair still repels, with a small
    // allowance for normal gauche conformations.
    return stericRelations.get(pairKey(a,b))===3?base*.84:base;
  }

  function spatialAtomPairs(atoms){
    const cellSize=2.5,cells=new Map(),order=new Map(atoms.map((atom,index)=>[atom.id,index]));
    const cellFor=point=>[Math.floor(point.x/cellSize),Math.floor(point.y/cellSize),Math.floor(point.z/cellSize)];
    const key=(x,y,z)=>`${x},${y},${z}`;
    for(const atom of atoms){
      const point=pos(atom.id);if(!point||![point.x,point.y,point.z].every(Number.isFinite))continue;
      const [x,y,z]=cellFor(point),bucket=cells.get(key(x,y,z))??[];bucket.push(atom);cells.set(key(x,y,z),bucket);
    }
    const pairs=[];
    for(const atom of atoms){
      const point=pos(atom.id);if(!point||![point.x,point.y,point.z].every(Number.isFinite))continue;
      const [x,y,z]=cellFor(point);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const other of cells.get(key(x+dx,y+dy,z+dz))??[]){
        if(order.get(other.id)<=order.get(atom.id))continue;pairs.push([atom,other]);
      }
    }
    return pairs;
  }

  function ringGeometry(frame){
    const points=frame.cycle.map(pos);
    if(points.some(point=>!point||![point.x,point.y,point.z].every(Number.isFinite)))return null;
    const center=points.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/points.length);
    const normal=cycleNormal(frame.cycle);if(normal.lengthSq()<1e-10)return null;
    let u=points[0].clone().sub(center);u.addScaledVector(normal,-u.dot(normal));
    if(u.lengthSq()<1e-10)u=perpendicular(normal);else u.normalize();
    const v=new THREE.Vector3().crossVectors(normal,u).normalize();
    const polygon=points.map(point=>{const offset=point.clone().sub(center);return{x:offset.dot(u),y:offset.dot(v)};});
    const averageEdge=points.reduce((sum,point,index)=>sum+point.distanceTo(points[(index+1)%points.length]),0)/points.length;
    return {...frame,points,center,normal,u,v,polygon,thickness:Math.max(.14,Math.min(.38,averageEdge*.28))};
  }

  function ringProjection(point,geometry){
    const offset=point.clone().sub(geometry.center),distance=offset.dot(geometry.normal);
    return{x:offset.dot(geometry.u),y:offset.dot(geometry.v),distance};
  }

  function pointInPolygon(point,polygon){
    let inside=false;
    for(let left=0,right=polygon.length-1;left<polygon.length;right=left++){
      const a=polygon[left],b=polygon[right];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }

  function segmentCrossesRing(a,b,geometry){
    const left=ringProjection(a,geometry),right=ringProjection(b,geometry),epsilon=1e-7;
    if(Math.abs(left.distance)<epsilon&&Math.abs(right.distance)<epsilon){
      const middle={x:(left.x+right.x)/2,y:(left.y+right.y)/2};
      return pointInPolygon(left,geometry.polygon)||pointInPolygon(right,geometry.polygon)||pointInPolygon(middle,geometry.polygon);
    }
    if(left.distance*right.distance>0&&Math.min(Math.abs(left.distance),Math.abs(right.distance))>geometry.thickness)return false;
    const denominator=left.distance-right.distance;
    const t=Math.abs(denominator)<epsilon ? .5 : THREE.MathUtils.clamp(left.distance/denominator,0,1);
    const point={x:left.x+(right.x-left.x)*t,y:left.y+(right.y-left.y)*t};
    return pointInPolygon(point,geometry.polygon)&&Math.abs(left.distance+(right.distance-left.distance)*t)<=geometry.thickness;
  }

  function measureRingPenetrations(includes){
    let atomCount=0,bondCount=0;
    for(const frame of ringFrames){
      const geometry=ringGeometry(frame);if(!geometry)continue;
      const ringIds=new Set(frame.cycle),component=componentIds.get(frame.cycle[0]);
      for(const atom of molecule.atoms){
        if(!includes(atom.id)||ringIds.has(atom.id)||componentIds.get(atom.id)!==component)continue;
        const point=pos(atom.id);if(!point)continue;const projection=ringProjection(point,geometry);
        if(Math.abs(projection.distance)<geometry.thickness&&pointInPolygon(projection,geometry.polygon))atomCount++;
      }
      for(const bond of molecule.bonds){
        if(!includes(bond.a)||!includes(bond.b)||ringIds.has(bond.a)||ringIds.has(bond.b)||componentIds.get(bond.a)!==component)continue;
        const a=pos(bond.a),b=pos(bond.b);if(a&&b&&segmentCrossesRing(a,b,geometry))bondCount++;
      }
    }
    return{atomCount,bondCount};
  }

  function segmentCandidatePairs(bonds){
    const cellSize=1.5,cells=new Map(),overflow=[],pairs=new Set(),key=(x,y,z)=>`${x},${y},${z}`;
    bonds.forEach((bond,index)=>{
      const a=pos(bond.a),b=pos(bond.b);if(!a||!b)return;
      const min=[Math.min(a.x,b.x),Math.min(a.y,b.y),Math.min(a.z,b.z)].map(value=>Math.floor((value-.14)/cellSize));
      const max=[Math.max(a.x,b.x),Math.max(a.y,b.y),Math.max(a.z,b.z)].map(value=>Math.floor((value+.14)/cellSize));
      const count=(max[0]-min[0]+1)*(max[1]-min[1]+1)*(max[2]-min[2]+1);
      if(count>96){overflow.push(index);return;}
      for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
        const bucket=cells.get(key(x,y,z))??[];for(const other of bucket)pairs.add(`${other}:${index}`);bucket.push(index);cells.set(key(x,y,z),bucket);
      }
    });
    for(const index of overflow)for(let other=0;other<bonds.length;other++)if(other!==index)pairs.add(`${Math.min(index,other)}:${Math.max(index,other)}`);
    return [...pairs].map(value=>value.split(':').map(Number)).map(([left,right])=>[bonds[left],bonds[right]]);
  }

  function segmentDistance(a0,a1,b0,b1){
    const u=a1.clone().sub(a0),v=b1.clone().sub(b0),w=a0.clone().sub(b0);
    const aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),denominator=aa*cc-bb*bb,epsilon=1e-10;
    let sN,sD=denominator,tN,tD=denominator;
    if(denominator<epsilon){sN=0;sD=1;tN=ee;tD=cc;}
    else{
      sN=bb*ee-cc*dd;tN=aa*ee-bb*dd;
      if(sN<0){sN=0;tN=ee;tD=cc;}else if(sN>sD){sN=sD;tN=ee+bb;tD=cc;}
    }
    if(tN<0){tN=0;if(-dd<0)sN=0;else if(-dd>aa)sN=sD;else{sN=-dd;sD=aa;}}
    else if(tN>tD){tN=tD;if(-dd+bb<0)sN=0;else if(-dd+bb>aa)sN=sD;else{sN=-dd+bb;sD=aa;}}
    const sc=Math.abs(sN)<epsilon?0:sN/sD,tc=Math.abs(tN)<epsilon?0:tN/tD;
    return w.addScaledVector(u,sc).addScaledVector(v,-tc).length();
  }

  function measureBondIntersections(includes){
    const bonds=molecule.bonds.filter(bond=>includes(bond.a)&&includes(bond.b));let count=0;
    for(const [left,right] of segmentCandidatePairs(bonds)){
      if(left.a===right.a||left.a===right.b||left.b===right.a||left.b===right.b)continue;
      if(isRingBond(left)||isRingBond(right))continue;
      if(componentIds.get(left.a)!==componentIds.get(right.a))continue;
      const points=[pos(left.a),pos(left.b),pos(right.a),pos(right.b)];if(points.some(point=>!point))continue;
      if(segmentDistance(...points)<.13)count++;
    }
    return count;
  }

  function isRingBond(bond){return ringFrames.some(frame=>{
    const left=frame.cycle.indexOf(bond.a),right=frame.cycle.indexOf(bond.b);
    return left>=0&&right>=0&&(Math.abs(left-right)===1||Math.abs(left-right)===frame.cycle.length-1);
  });}

  function captureRigidReference(){
    if(dirty)rebuildTopology();
    return rigidFragments.map(fragment=>{
      const pairs=[];
      for(let left=0;left<fragment.atomIds.length;left++)for(let right=left+1;right<fragment.atomIds.length;right++){
        const a=fragment.atomIds[left],b=fragment.atomIds[right],distance=pos(a)?.distanceTo(pos(b));
        if(Number.isFinite(distance)&&distance>1e-8)pairs.push({a,b,distance});
      }
      return{id:fragment.id,pairs};
    });
  }

  function measureRigidDeviation(reference,includes){
    if(!reference)return 0;let relative=0;
    for(const fragment of reference)for(const pair of fragment.pairs??[]){
      if(!includes(pair.a)||!includes(pair.b))continue;
      const distance=pos(pair.a)?.distanceTo(pos(pair.b));
      relative=Math.max(relative,Math.abs((distance??Infinity)/pair.distance-1));
    }
    return relative;
  }

  function captureConformation(ids=null){
    if(dirty)rebuildTopology();const includes=id=>!ids||ids.has(id);
    return new Map(molecule.atoms.filter(atom=>includes(atom.id)&&pos(atom.id)).map(atom=>[atom.id,pos(atom.id).clone()]));
  }

  function restoreConformation(snapshot){
    if(!(snapshot instanceof Map))return false;let restored=false;
    for(const[id,point]of snapshot){if(!pos(id)||!point)continue;pos(id).copy(point);restored=true;}
    return restored;
  }

  function validateConformation({ids=null,rigidReference=null,mode='release'}={}){
    const errors=measureError({ids,rigidReference}),drag=mode==='drag';
    const limits={bondRelative:drag ? .10 : .07,angleRadians:(drag ? 26 : 20)*Math.PI/180,planeDistance:drag ? .10 : .075,
      overlapRelative:drag ? .24 : .18,rigidRelative:drag ? .05 : .035};
    const reasons=[];
    if(!errors.finite)reasons.push('nonfinite');
    if(errors.topologyLimited)reasons.push('topology');
    for(const key of ['bondRelative','angleRadians','planeDistance','overlapRelative','rigidRelative'])if(errors[key]>limits[key])reasons.push(key);
    if(errors.ringPenetrations)reasons.push('ring-penetration');
    if(errors.bondIntersections)reasons.push('bond-intersection');
    return{valid:reasons.length===0,reasons,errors,limits};
  }

  function angleBranch(centerId, rootId) {
    const sides = bridgeSides.get(pairKey(centerId, rootId));
    return sides ? (sides.aId === rootId ? sides.a : sides.b) : [rootId];
  }

  function enforceAngle(centerId, aId, bId, target, strength, locked) {
    const center = pos(centerId);
    const a = pos(aId);
    const b = pos(bId);
    if (!a || !b || (locked.has(aId) && locked.has(bId))) return;
    const va = a.clone().sub(center);
    const vb = b.clone().sub(center);
    const la = va.length();
    const lb = vb.length();
    if (la < 0.001 || lb < 0.001) return;
    va.normalize(); vb.normalize();
    const current = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
    const difference = target - current;
    if (Math.abs(difference) < 0.0015) return;
    let axis = new THREE.Vector3().crossVectors(va, vb);
    if (axis.lengthSq() < 1e-8) axis = perpendicular(va);
    else axis.normalize();
    // Rotate bridge branches rigidly. Moving just a bonded neighbor was
    // stretching its other bonds and making adjacent angle constraints fight.
    const aIds = angleBranch(centerId, aId), bIds = angleBranch(centerId, bId);
    const aLocked = aIds.some(id => locked.has(id)), bLocked = bIds.some(id => locked.has(id));
    const total = aIds.length + bIds.length;
    const aWeight = aLocked ? 0 : bLocked ? 1 : bIds.length / total;
    const bWeight = bLocked ? 0 : aLocked ? 1 : aIds.length / total;
    if (aWeight) rotateAngleBranch(aIds, center, axis, -difference * strength * aWeight * .7);
    if (bWeight) rotateAngleBranch(bIds, center, axis, difference * strength * bWeight * .7);
  }

  function rotateAngleBranch(ids, center, axis, angle) {
    // A rigidly rotated planar fragment carries its reference plane with it.
    // Partial plane edits remain constrained (e.g. dragging one ethene H).
    for (const frame of [...doubleFrames.values(), ...aromaticFrames.values(), ...trigonalFrames.values()]) {
      if (frame.atomIds.every(id => ids.includes(id))) frame.normal.applyAxisAngle(axis, angle).normalize();
    }
    for (const id of ids) pos(id)?.sub(center).applyAxisAngle(axis, angle).add(center);
  }

  function enforcePlane(atomIds, normal, anchorIds, strength, locked, centralBond = null, skipIds = null) {
    const points = atomIds.map(pos).filter(Boolean);
    if (points.length < 3 || normal.lengthSq() < 1e-8) return;
    const anchors = anchorIds.map(pos).filter(Boolean);
    const center = anchors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
    const central = centralBond ? new Set([centralBond.a, centralBond.b]) : new Set();
    for (const id of atomIds) {
      const point = pos(id);
      if (!point || locked.has(id) || skipIds?.has(id)) continue;
      const offset = point.clone().sub(center).dot(normal);
      const weight = central.has(id) ? 0.55 : 1;
      point.addScaledVector(normal, -offset * strength * weight);
    }
  }

  function enforceDoubleSubstituentDirections(frame, strength, locked) {
    for (const endpoint of frame.substituentSlots) {
      const center = pos(endpoint.centerId);
      const partner = pos(endpoint.partnerId);
      if (!center || !partner) continue;
      const axis = partner.clone().sub(center);
      if (axis.lengthSq() < 1e-8) continue;
      axis.normalize();
      let side = new THREE.Vector3().crossVectors(frame.normal, axis);
      if (side.lengthSq() < 1e-8) side = perpendicular(axis);
      else side.normalize();
      for (const branch of endpoint.branches) {
        const direction = axis.clone().multiplyScalar(-0.5).addScaledVector(side, branch.sign * Math.sqrt(3) / 2).normalize();
        moveBranchRootToward(endpoint.centerId, branch, direction, strength, locked);
      }
    }
  }

  function enforceAromaticSubstituentDirections(frame, strength, locked) {
    const ringPoints = frame.cycle.map(pos);
    if (ringPoints.some(point => !point)) return;
    const ringCenter = ringPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / ringPoints.length);
    for (const substituent of frame.substituents) {
      const index = frame.cycle.indexOf(substituent.ringId);
      const center = pos(substituent.ringId);
      const previous = pos(frame.cycle[(index - 1 + frame.cycle.length) % frame.cycle.length]);
      const next = pos(frame.cycle[(index + 1) % frame.cycle.length]);
      if (!center || !previous || !next) continue;
      let outward = previous.clone().sub(center).add(next.clone().sub(center)).multiplyScalar(-1);
      outward.addScaledVector(frame.normal, -outward.dot(frame.normal));
      const radial = center.clone().sub(ringCenter).addScaledVector(frame.normal, -center.clone().sub(ringCenter).dot(frame.normal));
      if (outward.lengthSq() < 1e-8) outward = radial;
      if (outward.lengthSq() < 1e-8) outward = perpendicular(frame.normal);
      outward.normalize();
      if (radial.lengthSq() > 1e-8 && outward.dot(radial) < 0) outward.multiplyScalar(-1);
      moveBranchRootToward(substituent.ringId, substituent, outward, strength, locked);
    }
  }

  function enforceConjugatedSubstituentGeometry(frame, strength, locked) {
    const ringPoints = frame.cycle.map(pos);
    if (ringPoints.some(point => !point)) return;
    for (const substituent of frame.substituents) {
      const ring = pos(substituent.ringId), root = pos(substituent.rootId);
      if (!ring || !root || substituent.planarFollowers.length > 2) continue;
      const incoming = ring.clone().sub(root);
      incoming.addScaledVector(frame.normal, -incoming.dot(frame.normal));
      if (incoming.lengthSq() < 1e-8) continue;
      incoming.normalize();
      let side = new THREE.Vector3().crossVectors(frame.normal, incoming);
      if (side.lengthSq() < 1e-8) side = perpendicular(incoming); else side.normalize();
      for (const follower of substituent.planarFollowers) {
        const direction = incoming.clone().multiplyScalar(-0.5).addScaledVector(side, follower.sign * Math.sqrt(3) / 2).normalize();
        moveBranchRootToward(substituent.rootId, follower, direction, strength, locked);
      }
    }
  }

  function moveBranchRootToward(centerId, branch, direction, strength, locked) {
    const center = pos(centerId);
    const root = pos(branch.rootId);
    if (!center || !root || branch.atomIds.some(id => locked.has(id))) return;
    const bond = bondBetween(centerId, branch.rootId);
    if (!bond) return;
    const target = center.clone().addScaledVector(direction, bondLengthFor(centerId, branch.rootId, bond.order));
    const correction = target.sub(root).multiplyScalar(Math.min(1, strength));
    for (const id of branch.atomIds) pos(id)?.add(correction);
  }

  function enforceRegularAromaticCycle(frame, strength, locked) {
    const points = frame.cycle.map(pos);
    if (points.some(point => !point)) return;
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    let u = points[0].clone().sub(center);
    u.addScaledVector(frame.normal, -u.dot(frame.normal));
    if (u.lengthSq() < 1e-8) u = perpendicular(frame.normal);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(frame.normal, u).normalize();
    const targetSide = frame.cycle.reduce((sum, id, index) => {
      const next = frame.cycle[(index + 1) % frame.cycle.length];
      return sum + bondLengthFor(id, next, bondBetween(id, next)?.order ?? 1);
    }, 0) / frame.cycle.length;
    const radius = targetSide / (2 * Math.sin(Math.PI / frame.cycle.length));
    const second = points[1].clone().sub(center);
    const sign = second.dot(v) >= 0 ? 1 : -1;
    frame.cycle.forEach((id, index) => {
      if (locked.has(id)) return;
      const angle = sign * index * 2 * Math.PI / frame.cycle.length;
      const target = center.clone().addScaledVector(u, Math.cos(angle) * radius).addScaledVector(v, Math.sin(angle) * radius);
      pos(id).lerp(target, strength);
    });
  }

  function enforceStericSeparation(strength, locked, activeIds = null) {
    // Separate workspace components are separate craft projects, not an
    // intermolecular dynamics simulation. A nearby model must not repel the
    // focused model during its release animation.
    const atoms = activeIds ? molecule.atoms.filter(atom => activeIds.has(atom.id)) : molecule.atoms;
    for(const [left,right] of spatialAtomPairs(atoms)){
      const aId=left.id,bId=right.id;
      if(componentIds.get(aId)!==componentIds.get(bId)||stericExclusions.has(pairKey(aId,bId)))continue;
      const a=pos(aId),b=pos(bId);if(!a||!b)continue;
      const delta=b.clone().sub(a),length=delta.length(),minimum=stericMinimum(aId,bId);
      if(length>=minimum)continue;
      // Coincident atoms need a deterministic escape direction too.
      if(length<.0001)delta.set(1,.37,-.21);
      const correction=delta.normalize().multiplyScalar((minimum-length)*strength);
      displacePair(aId,bId,correction.clone().multiplyScalar(-1),locked);
    }
  }

  function closestRingBoundary(point,geometry){
    let best=null,bestDistance=Infinity;
    for(let index=0;index<geometry.polygon.length;index++){
      const a=geometry.polygon[index],b=geometry.polygon[(index+1)%geometry.polygon.length],dx=b.x-a.x,dy=b.y-a.y,lengthSq=dx*dx+dy*dy;
      const t=lengthSq?THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq,0,1):0;
      const candidate={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(candidate.x-point.x,candidate.y-point.y);
      if(candidate.distance<bestDistance){bestDistance=candidate.distance;best=candidate;}
    }
    return best;
  }

  function enforceRingExclusion(strength,locked,activeIds=null){
    for(const frame of ringFrames){
      const geometry=ringGeometry(frame);if(!geometry)continue;
      const ringIds=new Set(frame.cycle),component=componentIds.get(frame.cycle[0]);
      for(const atom of molecule.atoms){
        if((activeIds&&!activeIds.has(atom.id))||ringIds.has(atom.id)||locked.has(atom.id)||componentIds.get(atom.id)!==component)continue;
        const point=pos(atom.id);if(!point)continue;const projection=ringProjection(point,geometry);
        if(Math.abs(projection.distance)>=geometry.thickness||!pointInPolygon(projection,geometry.polygon))continue;
        const boundary=closestRingBoundary(projection,geometry);if(!boundary)continue;
        let dx=boundary.x-projection.x,dy=boundary.y-projection.y,length=Math.hypot(dx,dy);
        if(length<1e-8){dx=atom.id%2 ? .7 : -.7;dy=.45;length=Math.hypot(dx,dy);}
        const clearance=.06,correction=geometry.u.clone().multiplyScalar(dx/length*(length+clearance)).addScaledVector(geometry.v,dy/length*(length+clearance));
        point.addScaledVector(correction,Math.min(1,strength*4));
      }
    }
  }

  function enforceBondIntersectionSeparation(strength,locked,activeIds=null){
    const bonds=molecule.bonds.filter(bond=>!activeIds||activeIds.has(bond.a)&&activeIds.has(bond.b));
    for(const [left,right] of segmentCandidatePairs(bonds)){
      if(left.a===right.a||left.a===right.b||left.b===right.a||left.b===right.b||componentIds.get(left.a)!==componentIds.get(right.a)||isRingBond(left)||isRingBond(right))continue;
      const points=[pos(left.a),pos(left.b),pos(right.a),pos(right.b)];if(points.some(point=>!point)||segmentDistance(...points)>=.13)continue;
      const leftAxis=points[1].clone().sub(points[0]).normalize(),rightAxis=points[3].clone().sub(points[2]).normalize();
      let normal=new THREE.Vector3().crossVectors(leftAxis,rightAxis);
      if(normal.lengthSq()<1e-8)normal=perpendicular(leftAxis);else normal.normalize();
      if((left.a+left.b+right.a+right.b)%2)normal.multiplyScalar(-1);
      const leftLocked=locked.has(left.a)||locked.has(left.b),rightLocked=locked.has(right.a)||locked.has(right.b);
      if(!leftLocked){pos(left.a).addScaledVector(normal,strength);pos(left.b).addScaledVector(normal,strength);}
      if(!rightLocked){const weight=leftLocked?2:1;pos(right.a).addScaledVector(normal,-strength*weight);pos(right.b).addScaledVector(normal,-strength*weight);}
    }
  }

  function displacePair(aId, bId, correction, locked) {
    const a = pos(aId);
    const b = pos(bId);
    if (!a || !b || (locked.has(aId) && locked.has(bId))) return;
    if (locked.has(aId)) b.addScaledVector(correction, -1);
    else if (locked.has(bId)) a.add(correction);
    else {
      a.addScaledVector(correction, 0.5);
      b.addScaledVector(correction, -0.5);
    }
  }

  function planarSubstituentGroup(bond) {
    const ids = new Set([bond.a, bond.b]);
    neighborsFor(bond.a).forEach(neighbor => ids.add(neighbor.atomId));
    neighborsFor(bond.b).forEach(neighbor => ids.add(neighbor.atomId));
    return [...ids];
  }

  function aromaticPlanarGroup(cycle) {
    const ids = new Set(cycle);
    for (const id of cycle) neighborsFor(id).forEach(neighbor => ids.add(neighbor.atomId));
    return [...ids];
  }

  function doubleSubstituentSlots(frame, previousSlots = null) {
    const previousSigns = new Map();
    for (const endpoint of previousSlots ?? []) for (const branch of endpoint.branches) previousSigns.set(`${endpoint.centerId}:${branch.rootId}`, branch.sign);
    const endpoints = [];
    for (const [centerId, partnerId] of [[frame.bond.a, frame.bond.b], [frame.bond.b, frame.bond.a]]) {
      if (geometryFor(centerId).kind !== 'sp2') continue;
      const branches = neighborsFor(centerId)
        .filter(neighbor => neighbor.atomId !== partnerId)
        .map(neighbor => ({ rootId: neighbor.atomId, atomIds: branchFromBond(centerId, neighbor.atomId) }))
        .filter(branch => branch.atomIds);
      if (!branches.length || branches.length > 2) continue;
      const remembered = branches.map(branch => previousSigns.get(`${centerId}:${branch.rootId}`));
      let signs;
      if (remembered.every(sign => sign === -1 || sign === 1) && new Set(remembered).size === remembered.length) signs = remembered;
      else signs = assignDoubleSlotSigns(centerId, partnerId, branches, frame.normal);
      endpoints.push({ centerId, partnerId, branches: branches.map((branch, index) => ({ ...branch, sign: signs[index] })) });
    }
    return endpoints;
  }

  function assignDoubleSlotSigns(centerId, partnerId, branches, normal) {
    const center = pos(centerId);
    const partner = pos(partnerId);
    if (!center || !partner) return branches.map((_, index) => index === 0 ? 1 : -1);
    const axis = partner.clone().sub(center).normalize();
    let side = new THREE.Vector3().crossVectors(normal, axis);
    if (side.lengthSq() < 1e-8) side = perpendicular(axis);
    else side.normalize();
    const slots = [1, -1].map(sign => axis.clone().multiplyScalar(-0.5).addScaledVector(side, sign * Math.sqrt(3) / 2).normalize());
    const directions = branches.map(branch => pos(branch.rootId)?.clone().sub(center).normalize() ?? slots[0]);
    if (branches.length === 1) return [directions[0].dot(slots[0]) >= directions[0].dot(slots[1]) ? 1 : -1];
    const direct = directions[0].dot(slots[0]) + directions[1].dot(slots[1]);
    const crossed = directions[0].dot(slots[1]) + directions[1].dot(slots[0]);
    return direct >= crossed ? [1, -1] : [-1, 1];
  }

  function aromaticSubstituentBranches(cycle, previousSubstituents = null, normal = new THREE.Vector3(0, 0, 1)) {
    const cycleIds = new Set(cycle);
    const previousSigns = new Map();
    for (const substituent of previousSubstituents ?? []) {
      for (const follower of substituent.planarFollowers) previousSigns.set(`${substituent.ringId}:${substituent.rootId}:${follower.rootId}`, follower.sign);
    }
    const branches = [];
    for (const ringId of cycle) {
      for (const neighbor of neighborsFor(ringId)) {
        if (cycleIds.has(neighbor.atomId)) continue;
        const atomIds = branchFromBond(ringId, neighbor.atomId, cycleIds);
        if (!atomIds) continue;
        const followers = conjugatedFollowerBranches(ringId, neighbor.atomId);
        const remembered = followers.map(follower => previousSigns.get(`${ringId}:${neighbor.atomId}:${follower.rootId}`));
        const signs = remembered.every(sign => sign === -1 || sign === 1) && new Set(remembered).size === remembered.length
          ? remembered
          : assignAromaticFollowerSigns(ringId, neighbor.atomId, followers, normal);
        branches.push({ ringId, rootId: neighbor.atomId, atomIds, planarFollowers: followers.map((follower, index) => ({ ...follower, sign: signs[index] })) });
      }
    }
    return branches;
  }

  function assignAromaticFollowerSigns(ringId, rootId, followers, normal) {
    if (!followers.length || followers.length > 2) return followers.map((_, index) => index === 0 ? 1 : -1);
    const ring = pos(ringId), root = pos(rootId);
    if (!ring || !root) return followers.map((_, index) => index === 0 ? 1 : -1);
    const incoming = ring.clone().sub(root);
    incoming.addScaledVector(normal, -incoming.dot(normal));
    if (incoming.lengthSq() < 1e-8) return followers.map((_, index) => index === 0 ? 1 : -1);
    incoming.normalize();
    let side = new THREE.Vector3().crossVectors(normal, incoming);
    if (side.lengthSq() < 1e-8) side = perpendicular(incoming); else side.normalize();
    const slots = [1, -1].map(sign => incoming.clone().multiplyScalar(-0.5).addScaledVector(side, sign * Math.sqrt(3) / 2).normalize());
    const directions = followers.map(follower => pos(follower.rootId)?.clone().sub(root).normalize() ?? slots[0]);
    if (followers.length === 1) return [directions[0].dot(slots[0]) >= directions[0].dot(slots[1]) ? 1 : -1];
    const direct = directions[0].dot(slots[0]) + directions[1].dot(slots[1]);
    const crossed = directions[0].dot(slots[1]) + directions[1].dot(slots[0]);
    return direct >= crossed ? [1, -1] : [-1, 1];
  }

  function conjugatedFollowerBranches(ringId, rootId) {
    const root = atomById(rootId);
    if (!root || (root.element !== 'O' && root.element !== 'N' && geometryFor(rootId).kind !== 'sp2')) return [];
    return neighborsFor(rootId)
      .filter(neighbor => neighbor.atomId !== ringId)
      .map(neighbor => ({ rootId: neighbor.atomId, atomIds: branchFromBond(rootId, neighbor.atomId) }))
      .filter(branch => branch.atomIds);
  }

  function branchFromBond(centerId, rootId, forbiddenIds = null) {
    const seen = new Set([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of neighborsFor(current)) {
        const next = neighbor.atomId;
        if ((current === rootId && next === centerId) || seen.has(next)) continue;
        if (next === centerId || forbiddenIds?.has(next)) return null;
        seen.add(next);
        queue.push(next);
      }
    }
    return [...seen];
  }

  function doublePlaneNormal(bond, atomIds) {
    const a = pos(bond.a);
    const b = pos(bond.b);
    if (!a || !b) return new THREE.Vector3(0, 0, 1);
    const axis = b.clone().sub(a).normalize();
    let bestSide = null;
    let bestLength = 0;
    for (const id of atomIds) {
      if (id === bond.a || id === bond.b) continue;
      const anchor = neighborsFor(bond.a).some(neighbor => neighbor.atomId === id) ? a : b;
      const side = pos(id)?.clone().sub(anchor);
      if (!side) continue;
      side.addScaledVector(axis, -side.dot(axis));
      if (side.lengthSq() > bestLength) { bestLength = side.lengthSq(); bestSide = side; }
    }
    if (!bestSide || bestSide.lengthSq() < 1e-8) bestSide = perpendicular(axis);
    return new THREE.Vector3().crossVectors(axis, bestSide.normalize()).normalize();
  }

  function cycleNormal(cycle) {
    const points = cycle.map(pos);
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const normal = new THREE.Vector3();
    for (let index = 0; index < points.length; index++) {
      normal.add(new THREE.Vector3().crossVectors(points[index].clone().sub(center), points[(index + 1) % points.length].clone().sub(center)));
    }
    return normal.lengthSq() < 1e-8 ? new THREE.Vector3(0, 0, 1) : normal.normalize();
  }

  function buildStericRelations() {
    const excluded = new Set(), relations = new Map();
    for (const atom of molecule.atoms) {
      const queue=[{id:atom.id,depth:0}],seen=new Set([atom.id]);
      for(let index=0;index<queue.length;index++){
        const {id,depth}=queue[index];
        if(depth>=3)continue;
        for(const neighbor of neighborsFor(id)){
          if(seen.has(neighbor.atomId))continue;
          const nextDepth=depth+1,key=pairKey(atom.id,neighbor.atomId);
          seen.add(neighbor.atomId);queue.push({id:neighbor.atomId,depth:nextDepth});
          if(!relations.has(key)||nextDepth<relations.get(key))relations.set(key,nextDepth);
          if(nextDepth<=2)excluded.add(key);
        }
      }
    }
    return {excluded,relations};
  }

  function buildRigidFragments(){
    const seeds=[];
    for(const cycle of cycles)seeds.push({atomIds:new Set(cycle),kinds:new Set(aromaticCycles.some(item=>sameMembers(item,cycle))?['AROMATIC','RING']:['RING'])});
    for(const frame of doubleFrames.values())seeds.push({atomIds:new Set(frame.atomIds),kinds:new Set(['SP2'])});
    for(const frame of trigonalFrames.values())seeds.push({atomIds:new Set(frame.atomIds),kinds:new Set(['PLANAR'])});
    for(const atom of molecule.atoms)if(geometryFor(atom.id).kind==='sp')seeds.push({atomIds:new Set([atom.id,...neighborsFor(atom.id).map(item=>item.atomId)]),kinds:new Set(['SP'])});
    // Constraint groups that share an atom are one rigid island. A rotatable
    // connector merely joins two islands and therefore never merges them.
    for(let left=0;left<seeds.length;left++)for(let right=left+1;right<seeds.length;){
      if([...seeds[left].atomIds].some(id=>seeds[right].atomIds.has(id))){
        for(const id of seeds[right].atomIds)seeds[left].atomIds.add(id);
        for(const kind of seeds[right].kinds)seeds[left].kinds.add(kind);
        seeds.splice(right,1);
      }else right++;
    }
    return seeds.map((seed,index)=>({id:`rigid-${index}`,atomIds:[...seed.atomIds],kinds:[...seed.kinds].sort()}));
  }

  function findCycles(maxLength = 8) {
    const found = new Map();let visits = 0;
    for (const start of molecule.atoms.map(atom => atom.id)) {
      if (topologyLimited) break;
      const walk = (current, path, visited) => {
        if (++visits > 20000 || found.size >= 256) { topologyLimited = true; return; }
        if (path.length > maxLength) return;
        for (const neighbor of neighborsFor(current)) {
          if (topologyLimited) return;
          const next = neighbor.atomId;
          if (next === start && path.length >= 3) {
            found.set(canonicalCycleKey(path), [...path]);
            continue;
          }
          if (visited.has(next) || next < start) continue;
          visited.add(next);
          path.push(next);
          walk(next, path, visited);
          path.pop();
          visited.delete(next);
        }
      };
      walk(start, [start], new Set([start]));
    }
    return [...found.values()];
  }

  function isAromaticSixCarbonCycle(cycle) {
    if (cycle.length !== 6 || !cycle.every(id => atomById(id)?.element === 'C')) return false;
    const orders = cycle.map((id, index) => bondBetween(id, cycle[(index + 1) % 6])?.order ?? 0);
    return orders.filter(order => order === 2).length === 3
      && orders.every((order, index) => (order === 1 || order === 2) && order !== orders[(index + 1) % 6]);
  }

  function sameMembers(left, right) {
    return left.length === right.length && left.every(id => right.includes(id));
  }

  function perpendicular(vector) {
    const reference = Math.abs(vector.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    return new THREE.Vector3().crossVectors(vector, reference).normalize();
  }

  function canonicalCycleKey(cycle) {
    const variants = [];
    for (const sequence of [cycle, [...cycle].reverse()]) {
      for (let index = 0; index < sequence.length; index++) variants.push([...sequence.slice(index), ...sequence.slice(0, index)].join('-'));
    }
    return variants.sort()[0];
  }

  function snapshot() {
    if (dirty) rebuildTopology();
    return {
      cycles: cycles.map(cycle => [...cycle]),
      aromaticCycles: aromaticCycles.map(cycle => [...cycle]),
      doublePlanarGroups: [...doubleFrames.values()].map(frame => [...frame.atomIds]),
      aromaticPlanarGroups: [...aromaticFrames.values()].map(frame => [...frame.atomIds]),
      rigidFragments: rigidFragments.map(fragment=>({id:fragment.id,atomIds:[...fragment.atomIds],kinds:[...fragment.kinds]})),
      ringExclusionVolumes: ringFrames.map(frame=>({key:frame.key,atomIds:[...frame.cycle],aromatic:frame.aromatic,thickness:ringGeometry(frame)?.thickness??0})),
      stericClasses: {
        excluded12and13:stericExclusions.size,
        included14:[...stericRelations.values()].filter(distance=>distance===3).length,
      },
      doubleSubstituentSlots: [...doubleFrames.values()].flatMap(frame => frame.substituentSlots.map(endpoint => ({ centerId: endpoint.centerId, roots: endpoint.branches.map(branch => ({ id: branch.rootId, sign: branch.sign })) }))),
      aromaticOutwardGroups: [...aromaticFrames.values()].map(frame => frame.substituents.map(substituent => ({ ringId: substituent.ringId, rootId: substituent.rootId }))),
      aromaticFollowerSlots: [...aromaticFrames.values()].flatMap(frame => frame.substituents.map(substituent => ({ ringId: substituent.ringId, rootId: substituent.rootId, followers: substituent.planarFollowers.map(follower => ({ id: follower.rootId, sign: follower.sign })) }))),
    };
  }

  return {step,measureError,validateConformation,captureConformation,restoreConformation,captureRigidReference,
    markTopologyDirty,rebuildTopology,rotateReferenceFrames,snapshot};
}
