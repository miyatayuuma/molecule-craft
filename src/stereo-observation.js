import {describeAlkeneRelativeSide} from './stereo-descriptor.js?v=1';

const PRESENTATIONS=Object.freeze({
  '2-butene':Object.freeze({
    kind:'alkene-relative-side',
    states:Object.freeze({
      'same-side':Object.freeze({label:'cis (Z)',detail:'C=Cの両側が同じ側'}),
      'opposite-side':Object.freeze({label:'trans (E)',detail:'C=Cの両側が反対側'}),
    }),
  }),
});

export function craftStereoPresentationFor(recordId){
  return PRESENTATIONS[recordId]??null;
}

export function observeCraftStereo({record,molecule,positions}={}){
  const presentation=craftStereoPresentationFor(record?.id);
  if(!presentation||!molecule||!positions)return null;
  if(presentation.kind!=='alkene-relative-side')return null;
  const descriptors=[];
  for(const bond of molecule.bonds??[]){
    const descriptor=describeAlkeneRelativeSide(molecule,positions,bond);
    if(descriptor?.kind===presentation.kind)descriptors.push(descriptor);
  }
  if(descriptors.length!==1)return null;
  const descriptor=descriptors[0],state=presentation.states[descriptor.relation];
  if(!state)return null;
  return Object.freeze({
    kind:presentation.kind,
    relation:descriptor.relation,
    label:state.label,
    detail:state.detail,
    descriptor,
  });
}
