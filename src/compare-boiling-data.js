import {NORMAL_BOILING_POINTS,BOILING_COMPARISON_EXCEPTIONS} from './compare-boiling-catalog.js';

// Documented normal-pressure boiling points only. Entries lacking reliable
// experimental evidence stay absent rather than receiving guessed values.
export function boilingValueFor(id) { return NORMAL_BOILING_POINTS[id]?.celsius ?? null; }
export function boilingSourceFor(id) {
  const entry=NORMAL_BOILING_POINTS[id];
  return entry?`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${entry.pubchemCid}/JSON?heading=Boiling%20Point`:null;
}
// The sort coordinate of a range is a UI-only midpoint. Never expose it as a
// measured boiling point: the full documented interval must be displayed.
export function boilingComparisonFor(id){
  const standard=NORMAL_BOILING_POINTS[id];
  if(standard)return {kind:'boiling',celsius:standard.celsius};
  const exception=BOILING_COMPARISON_EXCEPTIONS[id];
  if(!exception)return null;
  return exception.kind==='range'
    ?{...exception,celsius:Number(((exception.lowC+exception.highC)/2).toFixed(3))}
    :exception;
}
export const KNOWN_BOILING_POINT_COUNT=Object.keys(NORMAL_BOILING_POINTS).length;
