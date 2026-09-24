// Catalog additions held out of automatic FIELD distribution pending future
// progression design. CRAFT and chemistry recognition remain open.
export const FIELD_PROGRESSION_RESERVED_MOLECULE_IDS=Object.freeze([
  '1-3-butadiene','isoprene','vinylidene-fluoride',
  'hexafluoropropylene','tetrafluoroethylene','hexamethylenediamine',
]);
const reserved=new Set(FIELD_PROGRESSION_RESERVED_MOLECULE_IDS);
export const isFieldProgressionReserved=id=>reserved.has(id);
