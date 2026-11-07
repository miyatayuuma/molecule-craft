import {NORMAL_BOILING_POINTS} from './compare-boiling-catalog.js';

// Documented normal-pressure boiling points only. Entries lacking reliable
// experimental evidence stay absent rather than receiving guessed values.
export function boilingValueFor(id) { return NORMAL_BOILING_POINTS[id]?.celsius ?? null; }
export function boilingSourceFor(id) {
  const entry=NORMAL_BOILING_POINTS[id];
  return entry?`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${entry.pubchemCid}/JSON?heading=Boiling%20Point`:null;
}
export const KNOWN_BOILING_POINT_COUNT=Object.keys(NORMAL_BOILING_POINTS).length;
