// Rope constraint design adapted for the encyclopedia from mrdoob's Tangle
// (Codevember 2026/04, MIT): https://github.com/mrdoob/codevember-2026
// Unlike a spring-drawn graph, every gap has simulated intermediate particles.
// Only the focused bead is held by the central instrument. Every other
// particle floats under rope tension and a weak lateral current.

export const ROPE_SUBDIVISIONS = 4;
const FIXED_STEP = 1 / 90;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export class ComparisonRopePhysics {
  constructor(arcPositions, { width = 390, height = 400, center = arcPositions[0] ?? 0 } = {}) {
    if (!arcPositions.length) throw new RangeError('Rope needs at least one bead');
    this.arcPositions = arcPositions;
    this.steps = ROPE_SUBDIVISIONS;
    this.count = (arcPositions.length - 1) * this.steps + 1;
    this.points = Array.from({ length: this.count }, () => ({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }));
    this.lengths = new Float64Array(Math.max(0, this.count - 1));
    this.arc = new Float64Array(this.count);
    for (let i = 0; i < arcPositions.length - 1; i++) {
      const difference = arcPositions[i + 1] - arcPositions[i];
      if (!(difference > 0)) throw new RangeError('Rope arc must be increasing');
      for (let j = 0; j < this.steps; j++) {
        const k = i * this.steps + j;
        this.arc[k] = arcPositions[i] + difference * j / this.steps;
        // Twice the strand length for the same bead spacing. The extra
        // material gathers into natural folds between beads.
        this.lengths[k] = difference * 2 / this.steps;
      }
    }
    this.arc[this.count - 1] = arcPositions.at(-1);
    this.width = width;
    this.height = height;
    this.center = center;
    this.grabbed = null;
    this.docking = null;
    this.completedDock = null;
    this.clock = 0;
    this.accumulator = 0;
    this.settlePosition();
    // Begin with a relaxed-looking floating strand, without spending the first
    // visible second pulling a ruler-straight initial layout into shape.
    for(let frame=0;frame<22;frame++)this.step();
  }

  get x() { return this.width / 2; }
  get y() { return this.height * 0.43; }

  // A deliberately irregular starting fold. This is only an initial condition:
  // the simulation never pulls the beads back to these material coordinates.
  initialPoint(index) {
    const distance = this.arc[index] - this.center;
    const extent = Math.abs(distance);
    const substep=index%this.steps;
    const beadIndex=Math.floor(index/this.steps);
    const span=this.arcPositions[Math.min(beadIndex+1,this.arcPositions.length-1)]-this.arcPositions[beadIndex];
    const fold=Math.min(substep,this.steps-substep)*span*.38;
    const wave=Math.sin(this.arc[index]*.031)*20+Math.sin(this.arc[index]*.012+1.8)*13;
    return {
      x: this.x + distance * .72 + wave,
      y: this.y + Math.min(54, Math.sqrt(extent)*2.7)+fold+Math.cos(this.arc[index]*.019)*26,
    };
  }

  settlePosition() {
    for (let i = 0; i < this.count; i++) {
      const point = this.points[i];
      const initial = this.initialPoint(i);
      point.x = initial.x;
      point.y = initial.y;
      point.z = 0;
      point.px = point.x;
      point.py = point.y;
      point.pz = point.z;
    }
    this.solve(24);
  }

  setCenter(value) {
    if(this.docking)this.docking=null;
    this.center = clamp(value, this.arc[0], this.arc[this.count - 1]);
  }

  // A release nominates a bead, but does not switch the instrument's reading.
  // The bead travels into the socket under a damped attraction, and only then
  // becomes the supported material point. Nearby beads are left free.
  dock(index) {
    if(!Number.isInteger(index)||index<0||index>=this.arcPositions.length)return;
    const bead=this.beadPosition(index);
    this.docking={index,elapsed:0,stable:0,x:bead.x,y:bead.y,vx:0,vy:0};
    this.completedDock=null;
  }

  cancelDock() {
    if(this.docking)this.docking=null;
    this.completedDock=null;
  }

  grab(index, x, y) {
    if (!Number.isInteger(index) || index < 0 || index >= this.arcPositions.length) return;
    if(this.grabbed?.index!==index){
      this.cancelDock();
      const held=this.beadPosition(index);
      this.grabbed={index,x:held.x,y:held.y,targetX:x,targetY:y};
    }else{
      this.grabbed.targetX=x;
      this.grabbed.targetY=y;
    }
    // Only the held material point is driven. Constraints propagate motion
    // down the rope over subsequent frames; there is no whole-strand shift.
  }

  release({ vx = 0, vy = 0 } = {}) {
    if (this.grabbed) {
      // A short, capped momentum pulse travels into adjacent rope particles.
      // Verlet stores previous positions, so subtracting velocity here gives
      // a physical-looking follow-through when the hand lets go.
      const held = this.grabbed.index * this.steps;
      const impulseX = clamp(vx / 90 * 0.44, -7, 7);
      const impulseY = clamp(vy / 90 * 0.44, -7, 7);
      for (let i = Math.max(0, held - this.steps * 2); i <= Math.min(this.count - 1, held + this.steps * 2); i++) {
        const influence = Math.exp(-Math.abs(i - held) / (this.steps * 0.75));
        this.points[i].px = this.points[i].x - impulseX * influence;
        this.points[i].py = this.points[i].y - impulseY * influence;
      }
    }
    this.grabbed = null;
  }

  resize(width, height) {
    const scaleX = width / this.width, scaleY = height / this.height;
    for (const point of this.points) {
      point.x *= scaleX; point.px *= scaleX;
      point.y *= scaleY; point.py *= scaleY;
    }
    this.width = width;
    this.height = height;
  }

  solve(iterations = 8) {
    const p = this.points;
    // The focused bead remains supported when a different bead is pulled.
    // The hand then acts as a soft force (not a second impossible hard pin).
    // Docking transfers the single anchor to the new bead in motion.
    const focused=this.nearestBeadIndex();
    const held=this.docking??(this.grabbed?.index===focused?this.grabbed:null)??{index:focused,x:this.x,y:this.y};
    const fixed=held.index*this.steps;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const bead=p[fixed];bead.x=held.x;bead.y=held.y;
      const forwards = iteration % 2 === 0;
      for (let j = 0; j < this.lengths.length; j++) {
        const i = forwards ? j : this.lengths.length - 1 - j;
        const a = p[i], b = p[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1e-8;
        const weightA = i === fixed ? 0 : 1, weightB = i + 1 === fixed ? 0 : 1;
        const correction = (distance - this.lengths[i]) / (distance * (weightA + weightB));
        a.x += dx * correction * weightA; a.y += dy * correction * weightA;
        b.x -= dx * correction * weightB; b.y -= dy * correction * weightB;
      }
      // Deliberately weak bending resistance: the string folds, unlike a rod.
      for (let i = 1; i < p.length - 1; i++) {
        if (i === fixed) continue;
        const a = p[i - 1], b = p[i], c = p[i + 1];
        b.x += ((a.x + c.x) / 2 - b.x) * 0.006;
        b.y += ((a.y + c.y) / 2 - b.y) * 0.006;
      }
      // Beads are solid. Adjacent beads also repel one another when the rope
      // folds, so only the bead being pulled into the socket can occupy it.
      const nearest = this.nearestBeadIndex();
      const around=this.docking?.index??nearest;
      for (let i = Math.max(0, around - 8); i <= Math.min(this.arcPositions.length - 1, around + 8); i++) {
        for (let j = i + 1; j <= Math.min(this.arcPositions.length - 1, around + 8); j++) {
          const a = p[i * this.steps], b = p[j * this.steps];
          const dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1e-8;
          const minimum=j===i+1?68:56;
          if (distance >= minimum) continue;
          const wa=i*this.steps===fixed?0:1,wb=j*this.steps===fixed?0:1;
          const correction = (minimum - distance) / distance * 0.58 / (wa+wb);
          a.x -= dx * correction * wa; a.y -= dy * correction * wa;
          b.x += dx * correction * wb; b.y += dy * correction * wb;
        }
      }
    }
    // Contact and bending projections introduce small distance errors. Finish
    // with short, alternating distance-only passes so they never show up as
    // visibly elastic gaps when a long strand starts moving.
    for(let iteration=0;iteration<8;iteration++){
      const forwards=iteration%2===0;
      for(let j=0;j<this.lengths.length;j++){
        const i=forwards?j:this.lengths.length-1-j;
        const a=p[i],b=p[i+1],dx=b.x-a.x,dy=b.y-a.y;
        const distance=Math.hypot(dx,dy)||1e-8;
        const wa=i===fixed?0:1,wb=i+1===fixed?0:1;
        const scale=(distance-this.lengths[i])/(distance*(wa+wb));
        a.x+=dx*scale*wa;a.y+=dy*scale*wa;
        b.x-=dx*scale*wb;b.y-=dy*scale*wb;
      }
    }
    // The pin is already satisfied on each iteration's first pass. In
    // particular, NEVER move the grabbed bead after the length projection.
    const bead=p[fixed];bead.x=held.x;bead.y=held.y;
  }

  nearestBeadIndex() {
    const rows = this.arcPositions;
    let low = 0, high = rows.length - 1;
    while (low < high) {
      const m = (low + high) >>> 1;
      if (rows[m] < this.center) low = m + 1;
      else high = m;
    }
    if (low === 0) return 0;
    return this.center - rows[low - 1] <= rows[low] - this.center ? low - 1 : low;
  }

  step() {
    // Verlet integration plus distance, bending, contact and support constraints.
    this.clock += FIXED_STEP;
    if(this.grabbed){
      const held=this.grabbed;
      const dx=held.targetX-held.x,dy=held.targetY-held.y;
      const distance=Math.hypot(dx,dy);
      if(distance>0.01){
        // A soft pointer tether permits a perceptible, bounded lag. The
        // remaining rope catches up by tension and inertia, not translation.
        const delta=Math.min(distance*.32,24);
        held.x+=dx/distance*delta;
        held.y+=dy/distance*delta;
      }
      if(held.index!==this.nearestBeadIndex()){
        const bead=this.beadPosition(held.index);
        const pullX=held.x-bead.x,pullY=held.y-bead.y;
        const distance=Math.hypot(pullX,pullY);
        if(distance>.01){
          const pull=Math.min(distance*.42,20);
          bead.x+=pullX/distance*pull;bead.y+=pullY/distance*pull;
        }
      }
    }
    const step2 = FIXED_STEP * FIXED_STEP;
    const near = this.nearestBeadIndex(), radius = this.steps * 11;
    const around=this.docking?.index??near;
    const first = Math.max(0, Math.min(near,around) * this.steps - radius);
    const last = Math.min(this.count - 1, Math.max(near,around) * this.steps + radius);
    for (let i = first; i <= last; i++) {
      const point = this.points[i];
      const vx = clamp((point.x - point.px) * 0.981, -18, 18);
      const vy = clamp((point.y - point.py) * 0.981, -18, 18);
      point.px = point.x; point.py = point.y;
      point.x += vx;
      point.y += vy + 115 * step2;
    }
    // No per-bead position targets. Slow, opposing lateral currents spread
    // the two sides while buoyancy and wandering air keep their shapes alive.
    // A wide soft boundary discourages the visible section from escaping;
    // actual bead spacing emerges solely from the constant-length rope.
    const free=!(this.grabbed||this.docking);
    const anchorArc=this.arcPositions[near];
    const visibleRadius=Math.max(280,this.width*.87);
    for (let i=first;i<=last;i++) {
      if (this.grabbed?.index*this.steps===i) continue;
      const point=this.points[i];
      const side=Math.sign(this.arc[i]-anchorArc);
      const distanceX=point.x-this.x;
      const outer=Math.max(0,Math.abs(distanceX)-visibleRadius);
      const phase=this.clock*.68+this.arc[i]*.009;
      const strength=free?1:.3;
      // Both sides share a broad, soft air pocket. No particle is attracted
      // to a slot computed from its molecule value or its bead index.
      const sidePocket=side*Math.min(240,this.width*.62);
      const sideways=side*.06+(sidePocket-distanceX)*.0035;
      point.x+=strength*(sideways+Math.sin(phase)*.065-Math.sign(distanceX)*outer*.0014);
      // This vertical force is shared by the whole strand, not a separate
      // prescribed height for each bead.
      point.y+=strength*((this.y-20-point.y)*.004+Math.cos(phase*.8)*.03);
    }
    if(this.docking){
      const magnet=this.docking;
      // A damped, speed-limited moving magnet: its anchor travels gradually
      // to the socket. Only this bead is pinned; the rope stays flexible.
      magnet.vx=clamp((magnet.vx+(this.x-magnet.x)*.045)*.78,-6,6);
      magnet.vy=clamp((magnet.vy+(this.y-magnet.y)*.045)*.78,-6,6);
      magnet.x+=magnet.vx;magnet.y+=magnet.vy;
      this.docking.elapsed+=FIXED_STEP;
    }
    // Solve every segment from its constant rest length, including the ones
    // adjacent to the grabbed bead. The input pin participates in the solver.
    this.solve(this.grabbed||this.docking?20:11);
    if(this.docking){
      const target=this.docking;
      const distance=Math.hypot(target.x-this.x,target.y-this.y);
      const speed=Math.hypot(target.vx,target.vy);
      this.docking.stable=distance<5&&speed<1.8?this.docking.stable+1:0;
      if(this.docking.stable>=8||(this.docking.elapsed>2.2&&distance<11)){
        const index=this.docking.index;
        this.docking=null;
        this.center=this.arcPositions[index];
        this.completedDock=index;
      }
    }
  }

  advance(seconds) {
    this.accumulator += clamp(seconds, 0, 0.05);
    let n = 0;
    while (this.accumulator >= FIXED_STEP && n < 5) {
      this.step(); this.accumulator -= FIXED_STEP; n++;
    }
  }

  beadPosition(index) { return this.points[index * this.steps]; }
  ropePoints(fromIndex, toIndex) {
    return this.points.slice(Math.max(0, fromIndex * this.steps), Math.min(this.count, toIndex * this.steps + 1));
  }
}
