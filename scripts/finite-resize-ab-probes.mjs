import assert from 'node:assert/strict';
// The same server-side test transform is used for BOTH immutable production roots.
// Logs read canvas attributes only, never additional layout or WebGL state queries.
export function instrumentFiniteResizeSource(source){
  let s=source;
  const wrap=(name,body)=>`function ${name}(){const c9Start=performance.now(),c9Before={width:canvas.width,height:canvas.height};try{${body}}finally{(window.__c9ResizeWork??=[]).push({kind:'${name}',startMs:c9Start,endMs:performance.now(),before:c9Before,after:{width:canvas.width,height:canvas.height},sampleId:polymerSamplePresentation?.sampleId??null});}}`;
  assert.match(s,/function resize\(\)\{[^\n]*\}/);
  s=s.replace(/function resize\(\)\{([^\n]*)\}/,(_,body)=>wrap('resize',body));
  const first='  function finishPolymerSample(result){',next='\n  function advancePolymerCompletion(){',a=s.indexOf(first),b=s.indexOf(next,a);
  assert.ok(a>=0&&b>a);const section=s.slice(a,b),body=section.slice(first.length,section.lastIndexOf('}'));
  s=s.slice(0,a)+`  function finishPolymerSample(result){const c9Start=performance.now(),c9Before={width:canvas.width,height:canvas.height};try{${body}}finally{(window.__c9ResizeWork??=[]).push({kind:'finishPolymerSample',startMs:c9Start,endMs:performance.now(),before:c9Before,after:{width:canvas.width,height:canvas.height},sampleId:polymerSamplePresentation?.sampleId??null});}}`+s.slice(b);
  assert.ok(s.includes('new ResizeObserver(resize)'));
  s=s.replace('new ResizeObserver(resize)',"new ResizeObserver(()=>{(window.__c9ResizeWork??=[]).push({kind:'ResizeObserver',startMs:performance.now(),endMs:performance.now()});resize();})");
  const target='scene.add(new THREE.HemisphereLight';assert.ok(s.includes(target));
  s=s.replace(target,`for(const method of ['setSize','setDrawingBufferSize']){const native=renderer[method];renderer[method]=function(...args){const startMs=performance.now(),before={width:canvas.width,height:canvas.height};try{return Reflect.apply(native,this,args);}finally{(window.__c9ResizeWork??=[]).push({kind:method,startMs,endMs:performance.now(),before,after:{width:canvas.width,height:canvas.height},args});}};}\n  ${target}`);
  return s;
}
