// Chemistry reference data, independent of game performance or saved progress.
// Abridged standard atomic weights (CIAAW 2024):
// https://www.ciaaw.org/abridged-atomic-weights.htm
// These are approximate values for ordinary isotopic compositions, not
// exact masses for a particular isotope or sample.
export const ATOMIC_WEIGHTS = Object.freeze({
  H: 1.0080,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
});

// Stable order for the encyclopedia and the future comparison view.
const ELEMENT_ORDER = Object.freeze(['C', 'H', 'N', 'O', 'F', 'P', 'S', 'Cl']);

export function moleculeBasicProperties(record) {
  if (!Array.isArray(record?.atoms) || record.atoms.length === 0) {
    throw new TypeError('A molecule must have a nonempty atom list.');
  }
  const counts = new Map();
  for (const symbol of record.atoms) {
    if (!Object.hasOwn(ATOMIC_WEIGHTS, symbol)) {
      throw new RangeError(`Unknown atomic weight: ${symbol}`);
    }
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  const composition = ELEMENT_ORDER.filter(symbol => counts.has(symbol)).map(symbol => ({
    symbol,
    count: counts.get(symbol),
  }));
  const molarMass = composition.reduce((sum, item) => sum + ATOMIC_WEIGHTS[item.symbol] * item.count, 0);
  return {
    atomCount: record.atoms.length,
    elementCount: composition.length,
    composition,
    molarMass, // g/mol; retain full calculation precision for comparisons
  };
}
