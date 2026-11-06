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
    this.accumulator = 0;
    this.settlePosition();
  }

  get x() { return this.width / 2; }
  get y() { return this.height * 0.43; }

  // The strand rests on a shallow, invisible presentation surface around the
  // analyser. Its side beads spread across the viewport instead of dangling
  // like weights from a single overhead hook.
  guide(index) {
    const distance = this.arc[index] - this.center;
    const extent = Math.abs(distance);
    return {
      x: this.x + distance * 0.93,
      y: this.y + Math.min(48, Math.sqrt(extent) * 2.3),
    };
  }

  settlePosition() {
    for (let i = 0; i < this.count; i++) {
      const point = this.points[i];
      const guide = this.guide(i);
      point.x = guide.x;
      point.y = guide.y;
      point.z = Math.sin(this.arc[i] * 0.035) * 2;
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
    this.grabbed = { index, x, y };
  }

  release() {
    if (this.grabbed) {
      const point = this.beadPosition(this.grabbed.index);
      point.px = point.x; point.py = point.y; point.pz = point.z;
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
    if (this.grabbed) return;
    const { a, b, fraction } = this.support(), p = this.points;
    const wa = 1 - fraction, wb = fraction;
    const denominator = wa * wa + wb * wb;
    const deltaX = this.x - p[a].x * wa - p[b].x * wb;
    const deltaY = this.y - p[a].y * wa - p[b].y * wb;
    const deltaZ = 0 - p[a].z * wa - p[b].z * wb;
    const aa = wa / denominator, bb = wb / denominator;
    p[a].x += deltaX * aa; p[a].y += deltaY * aa; p[a].z += deltaZ * aa;
    if (a !== b) {
      p[b].x += deltaX * bb; p[b].y += deltaY * bb; p[b].z += deltaZ * bb;
    }
  }

  solve(iterations = 8) {
    const p = this.points;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const forwards = iteration % 2 === 0;
      for (let j = 0; j < this.lengths.length; j++) {
        const i = forwards ? j : this.lengths.length - 1 - j;
        const a = p[i], b = p[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const distance = Math.hypot(dx, dy, dz) || 1e-8;
        const correction = 0.5 * (distance - this.lengths[i]) / distance;
        a.x += dx * correction; a.y += dy * correction; a.z += dz * correction;
        b.x -= dx * correction; b.y -= dy * correction; b.z -= dz * correction;
      }
      // Deliberately weak bending resistance: the string folds, unlike a rod.
      for (let i = 1; i < p.length - 1; i++) {
        const a = p[i - 1], b = p[i], c = p[i + 1];
        b.x += ((a.x + c.x) / 2 - b.x) * 0.009;
        b.y += ((a.y + c.y) / 2 - b.y) * 0.009;
        b.z += ((a.z + c.z) / 2 - b.z) * 0.009;
      }
      // A weak horizontal presentation field keeps the tails spreading to the
      // sides without turning them into fixed rails. The player can displace
      // the rope freely in two dimensions; it sways back after release.
      for (let i = 0; i < p.length; i++) {
        if (this.grabbed && i === this.grabbed.index * this.steps) continue;
        const guide = this.guide(i);
        p[i].x += (guide.x - p[i].x) * 0.008;
        p[i].y += (guide.y - p[i].y) * 0.014;
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
          const correction = (52 - distance) / distance * 0.29;
          a.x -= dx * correction; a.y -= dy * correction;
          b.x += dx * correction; b.y += dy * correction;
        }
      }
      this.pinSupport();
      if (this.grabbed) {
        const held = p[this.grabbed.index * this.steps];
        held.x = this.grabbed.x; held.y = this.grabbed.y;
      }
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
    const step2 = FIXED_STEP * FIXED_STEP;
    const near = this.nearestBeadIndex(), radius = this.steps * 11;
    const first = Math.max(0, near * this.steps - radius);
    const last = Math.min(this.count - 1, near * this.steps + radius);
    for (let i = first; i <= last; i++) {
      const point = this.points[i];
      const vx = clamp((point.x - point.px) * 0.986, -18, 18);
      const vy = clamp((point.y - point.py) * 0.986, -18, 18);
      const vz = clamp((point.z - point.pz) * 0.97, -6, 6);
      point.px = point.x; point.py = point.y; point.pz = point.z;
      point.x += vx;
      point.y += vy + 230 * step2;
      point.z += vz;
    }
    // Solve the entire strand: the material coordinate and link lengths do not
    // change when a distant bead enters the viewport.
    this.solve(7);
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
