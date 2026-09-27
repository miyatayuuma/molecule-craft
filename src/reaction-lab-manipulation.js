// Chemistry-independent input, screen-space acquisition, and visual depth docking.
export const MANIPULATION_TIME_SCALE = 0.15;
export const CHAMBER_TIME_MODES = Object.freeze({ NORMAL: 'NORMAL', MANIPULATING: 'MANIPULATING' });
export const DEPTH_TARGET_ACQUIRE_PADDING_PX = 24;
export const DEPTH_TARGET_RELEASE_PADDING_PX = 40;
export const GRAB_FALLBACK_RADIUS_PX = 22;
export const DEPTH_DOCKING_TIME_CONSTANT_MS = 45;
export const MAX_DOCKING_COMPRESSION_WORLD = 0.06;

/** Shared Chamber time authority for direct manipulation and future interactions. */
export function createChamberTimeAuthority() {
  let mode = CHAMBER_TIME_MODES.NORMAL;
  return {
    get mode() { return mode; },
    get scale() { return mode === CHAMBER_TIME_MODES.MANIPULATING ? MANIPULATION_TIME_SCALE : 1; },
    setMode(next) {
      if (!Object.values(CHAMBER_TIME_MODES).includes(next)) throw new Error(`Unknown Chamber time mode: ${next}`);
      mode = next;
      return mode;
    },
  };
}

const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, value) => [a[0] * value, a[1] * value, a[2] * value];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = value => Math.hypot(value[0], value[1], value[2]);

function normalized(value) {
  const magnitude = length(value);
  return magnitude > 1e-12 ? scale(value, 1 / magnitude) : null;
}

export function scaleSimulationElapsed(realElapsedSeconds, timeScale = 1) {
  if (!Number.isFinite(realElapsedSeconds) || realElapsedSeconds < 0 || !Number.isFinite(timeScale) || timeScale < 0) {
    throw new Error('Simulation elapsed time and time scale must be finite and non-negative.');
  }
  return realElapsedSeconds * timeScale;
}

/** Return the minimum signed 2D gap between projected real-atom disks. */
export function projectedSurfaceGap(atomsA, atomsB) {
  let best = Infinity;
  for (const atomA of atomsA ?? []) for (const atomB of atomsB ?? []) {
    const gap = Math.hypot(atomA.x - atomB.x, atomA.y - atomB.y) - atomA.radiusPx - atomB.radiusPx;
    if (Number.isFinite(gap) && gap < best) best = gap;
  }
  return best;
}

/** Keep a locked target until it crosses a wider release threshold. */
export function chooseDepthTarget(currentId, candidates, {
  acquirePaddingPx = DEPTH_TARGET_ACQUIRE_PADDING_PX,
  releasePaddingPx = DEPTH_TARGET_RELEASE_PADDING_PX,
} = {}) {
  if (!(releasePaddingPx > acquirePaddingPx)) throw new Error('Target release padding must exceed acquire padding.');
  const rows = (candidates ?? [])
    .filter(item => item && typeof item.id === 'string' && Number.isFinite(item.gapPx) && item.busy !== true && item.present !== false)
    .slice()
    .sort((a, b) => a.gapPx - b.gapPx || String(a.id).localeCompare(String(b.id)));
  const current = rows.find(item => item.id === currentId);
  if (current && current.gapPx <= releasePaddingPx) return current.id;
  const next = rows[0];
  return next && next.gapPx <= acquirePaddingPx ? next.id : null;
}

function rotateVector(quaternion, point) {
  const [x, y, z, w] = quaternion;
  const [px, py, pz] = point;
  const tx = 2 * (y * pz - z * py);
  const ty = 2 * (z * px - x * pz);
  const tz = 2 * (x * py - y * px);
  return [
    px + w * tx + (y * tz - z * ty),
    py + w * ty + (z * tx - x * tz),
    pz + w * tz + (x * ty - y * tx),
  ];
}

function worldAtoms(molecule) {
  if (!finiteVector(molecule.center) || !Array.isArray(molecule.orientation) || molecule.orientation.length !== 4 || !molecule.orientation.every(Number.isFinite)) return null;
  if (!Array.isArray(molecule.atoms) || !molecule.atoms.length) return null;
  const atoms = [];
  for (const atom of molecule.atoms) {
    if (!finiteVector(atom.position) || !(atom.radius > 0) || !Number.isFinite(atom.radius)) return null;
    atoms.push({ center: add(molecule.center, rotateVector(molecule.orientation, atom.position)), radius: atom.radius });
  }
  return atoms;
}

function surfaceGapAtOffset(atomsA, atomsB, axis, offset) {
  let best = Infinity;
  const translation = scale(axis, offset);
  for (const atomA of atomsA) for (const atomB of atomsB) {
    const distance = length(subtract(add(atomA.center, translation), atomB.center));
    best = Math.min(best, distance - atomA.radius - atomB.radius);
  }
  return best;
}

/**
 * Find the nearest camera-normal translation that brings actual visual atom
 * spheres to a bounded-contact boundary. No reaction or virtual-site data is
 * accepted by this geometry-only helper.
 */
export function solveDepthDocking({ dragged, target, cameraNormal, previousCenter = dragged?.center,
  maxCompression = MAX_DOCKING_COMPRESSION_WORLD } = {}) {
  const atomsA = worldAtoms(dragged), atomsB = worldAtoms(target), axis = normalized(cameraNormal);
  if (!atomsA || !atomsB || !axis || !finiteVector(previousCenter) || !(maxCompression >= 0) || !Number.isFinite(maxCompression)) return null;
  const intervals = [];
  for (const atomA of atomsA) for (const atomB of atomsB) {
    const relative = subtract(atomA.center, atomB.center);
    const along = dot(relative, axis);
    const perpendicular = subtract(relative, scale(axis, along));
    const contactRadius = atomA.radius + atomB.radius - maxCompression;
    if (!(contactRadius > 0)) continue;
    const remaining = contactRadius * contactRadius - dot(perpendicular, perpendicular);
    if (remaining <= 1e-12) continue;
    const halfWidth = Math.sqrt(remaining);
    intervals.push({ min: -along - halfWidth, max: -along + halfWidth });
  }
  if (!intervals.length) return null;
  intervals.sort((a, b) => a.min - b.min || a.max - b.max);
  const merged = [];
  for (const interval of intervals) {
    const tail = merged.at(-1);
    if (tail && interval.min <= tail.max + 1e-10) tail.max = Math.max(tail.max, interval.max);
    else merged.push({ ...interval });
  }

  // The pointer may have moved in screen space while the body was docked. Pick
  // the allowed boundary nearest the previous world depth; ties keep a stable
  // sign and can never switch sides from small frame-to-frame fluctuations.
  const previousOffset = dot(subtract(previousCenter, dragged.center), axis);
  const candidates = merged.flatMap(interval => [interval.min, interval.max]);
  const valid = candidates
    .map(offset => ({ offset, gap: surfaceGapAtOffset(atomsA, atomsB, axis, offset) }))
    .filter(item => item.gap >= -maxCompression - 1e-7)
    .sort((a, b) => Math.abs(a.offset - previousOffset) - Math.abs(b.offset - previousOffset) || a.offset - b.offset);
  if (!valid.length) return null;
  const selected = valid[0];
  return {
    offset: selected.offset,
    center: add(dragged.center, scale(axis, selected.offset)),
    minimumSurfaceGap: selected.gap,
    compression: Math.max(0, -selected.gap),
  };
}

export function minimumMoleculeSurfaceGap({ dragged, target }) {
  const atomsA = worldAtoms(dragged), atomsB = worldAtoms(target);
  if (!atomsA || !atomsB) return Infinity;
  let best = Infinity;
  for (const atomA of atomsA) for (const atomB of atomsB) {
    best = Math.min(best, length(subtract(atomA.center, atomB.center)) - atomA.radius - atomB.radius);
  }
  return best;
}
