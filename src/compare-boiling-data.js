// Normal boiling points at approximately 1 atm (NIST Chemistry WebBook,
// SRD 69). The pilot intentionally has only three independently sourced
// substances; unknown data is never inferred from molecular structure.
// Values are rounded to 0.1 °C for the instrument display.
export const BOILING_PILOT = Object.freeze({
  'n-butane': {celsius:-0.5, source:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C106978&Type=TBOIL'},
  ethanol: {celsius:78.4, source:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=6'},
  water: {celsius:100.0, source:'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4'},
});

export function boilingValueFor(id) { return BOILING_PILOT[id]?.celsius ?? null; }

export function boilingPilotEnabled(search='') {
  return new URLSearchParams(search).get('compareBoilingPilot')==='1';
}
