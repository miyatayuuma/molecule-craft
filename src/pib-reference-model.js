import {createPolymerReferenceModel} from './polymer-reference-model.js?v=7';

// Preserve the approved PIB construction and its deterministic conformation.
export function createPibReferenceModel(THREE,unitCount){
  return createPolymerReferenceModel(THREE,'polyisobutylene',unitCount);
}
