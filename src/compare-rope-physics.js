// Rope constraint design adapted for the encyclopedia from mrdoob's Tangle
// (Codevember 2026/04, MIT): https://github.com/mrdoob/codevember-2026
// Unlike a spring-drawn graph, every gap has simulated intermediate particles.
// The central instrument supports an arbitrary material position along the
// strand, so pulling a bead over it never teleports the next bead into place.

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
        this.lengths[k] = difference / this.steps;
      }
    }
    this.arc[this.count - 1] = arcPositions.at(-1);
    this.width = width;
    this.height = height;
    this.center = center;
    this.grabbed = null;
    this.supportStrength = 1;
    this.clock = 0;
    this.accumulator = 0;
    this.settlePosition();
  }

  get x() { return this.width / 2; }
  get y() { return this.height * 0.43; }

  // A faint buoyant field prevents the rope from dangling off the instrument.
  // Its preferred shape is slack, NOT an almost-straight taut string; the
  // distance constraints, not these guide coordinates, set its actual length.
  guide(index) {
    const distance = this.arc[index] - this.center;
    const extent = Math.abs(distance);
    return {
      x: this.x + distance * 0.77,
      y: this.y + Math.min(72, Math.sqrt(extent) * 3.5),
    };
  }

  settlePosition() {
    for (let i = 0; i < this.count; i++) {
      const point = this.points[i];
      const guide = this.guide(i);
      point.x = guide.x;
      point.y = guide.y;
      point.z = 0;
      point.px = point.x;
      point.py = point.y;
      point.pz = point.z;
    }
    this.solve(24);
  }

  setCenter(value) {
    this.center = clamp(value, this.arc[0], this.arc[this.count - 1]);
  }

  grab(index, x, y) {
    if (!Number.isInteger(index) || index < 0 || index >= this.arcPositions.length) return;
    const heldIndex=index*this.steps,held=this.points[heldIndex];
    const dx=x-held.x,dy=y-held.y;
    // This is a floating strand: moving one bead takes the other beads with
    // it. Shift the neighbouring material as a coherent body before applying
    // the local constraint solve. A hard isolated pin would demand that the
    // first adjacent segment stretch to bridge a big pointer movement.
    for(let i=0;i<this.count;i++){
      const weight=0.82+0.18*Math.exp(-Math.abs(i-heldIndex)/24);
      const point=this.points[i],sx=dx*weight,sy=dy*weight;
      point.x+=sx;point.y+=sy;point.px+=sx;point.py+=sy;
    }
    this.grabbed = { index, x, y };
    this.supportStrength = 0;
    // Match the pointer in this event frame. Holding only the final point
    // after the solve creates an obviously elastic (sometimes 40%+) gap.
    this.solve(18);
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

  // This is a travelling, frictionless instrument support, not a bead index.
  // Its material position moves continuously as the user pulls the string.
  support() {
    const arc = this.arc, x = this.center;
    let low = 0, high = arc.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (arc[middle] < x) low = middle + 1;
      else high = middle;
    }
    const b = low, a = Math.max(0, b - 1);
    const fraction = b === a ? 0 : clamp((x - arc[a]) / (arc[b] - arc[a]), 0, 1);
    return { a, b, fraction };
  }

  pinSupport() {
    if (this.grabbed || this.supportStrength <= 0) return;
    const { a, b, fraction } = this.support(), p = this.points;
    const wa = 1 - fraction, wb = fraction;
    const denominator = wa * wa + wb * wb;
    const deltaX = this.x - p[a].x * wa - p[b].x * wb;
    const deltaY = this.y - p[a].y * wa - p[b].y * wb;
    const aa = wa / denominator, bb = wb / denominator;
    p[a].x += deltaX * aa * this.supportStrength; p[a].y += deltaY * aa * this.supportStrength;
    if (a !== b) {
      p[b].x += deltaX * bb * this.supportStrength; p[b].y += deltaY * bb * this.supportStrength;
    }
  }

  solve(iterations = 8) {
    const p = this.points;
    const fixed = this.grabbed ? this.grabbed.index * this.steps : -1;
    for (let iteration = 0; iteration < iterations; iteration++) {
      if (fixed < 0) this.pinSupport();
      else {
        const held = p[fixed]; held.x = this.grabbed.x; held.y = this.grabbed.y;
      }
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
      // Contact between the nearby large beads; intermediate yarn particles
      // are intentionally exempt from this much larger collision radius.
      const nearest = this.nearestBeadIndex();
      for (let i = Math.max(0, nearest - 8); i <= Math.min(this.arcPositions.length - 1, nearest + 8); i++) {
        for (let j = i + 2; j <= Math.min(this.arcPositions.length - 1, nearest + 8); j++) {
          const a = p[i * this.steps], b = p[j * this.steps];
          const dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1e-8;
          if (distance >= 52) continue;
          const wa=i*this.steps===fixed?0:1,wb=j*this.steps===fixed?0:1;
          const correction = (52 - distance) / distance * 0.58 / (wa+wb);
          a.x -= dx * correction * wa; a.y -= dy * correction * wa;
          b.x += dx * correction * wb; b.y += dy * correction * wb;
        }
      }
    }
    // The pin is already satisfied on each iteration's first pass. In
    // particular, NEVER move the grabbed bead after the length projection.
    if (fixed >= 0) {
      const held=p[fixed];held.x=this.grabbed.x;held.y=this.grabbed.y;
    }
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
    const step2 = FIXED_STEP * FIXED_STEP;
    const near = this.nearestBeadIndex(), radius = this.steps * 11;
    const first = Math.max(0, near * this.steps - radius);
    const last = Math.min(this.count - 1, near * this.steps + radius);
    for (let i = first; i <= last; i++) {
      const point = this.points[i];
      const vx = clamp((point.x - point.px) * 0.981, -18, 18);
      const vy = clamp((point.y - point.py) * 0.981, -18, 18);
      point.px = point.x; point.py = point.y;
      point.x += vx;
      point.y += vy + 115 * step2;
    }
    // A diffuse stabilising field is applied as a *force* once per step, not
    // as a stiff positional rail seven times inside the constraint solver.
    // While held, the rope is free to follow the hand without being stretched
    // between an invisible guide and a second pin at the pointer.
    const influence=this.grabbed?0.0003:0.0014;
    for (let i=first;i<=last;i++) {
      if (this.grabbed?.index*this.steps===i) continue;
      const target=this.guide(i),point=this.points[i];
      point.x+=(target.x-point.x)*influence;
      point.y+=(target.y-point.y)*influence;
      // Low-amplitude coherent air currents keep the *whole* floating strand
      // gently alive, rather than animating only the bead under the finger.
      if (!this.grabbed) {
        const phase=this.clock*1.2+this.arc[i]*0.012;
        point.x+=Math.sin(phase)*0.028;
        point.y+=Math.cos(phase*0.8)*0.032;
      }
    }
    if (!this.grabbed) this.supportStrength=Math.min(1,this.supportStrength+0.055);
    // Solve every segment from its constant rest length, including the ones
    // adjacent to the grabbed bead. The input pin participates in the solver.
    this.solve(this.grabbed?18:11);
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
