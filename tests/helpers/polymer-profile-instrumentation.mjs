// Temporary benchmark instrumentation only; identical insertion on baseline and task.
export function instrumentPolymerViewer(source){
  if(source.includes('const polymerFrameProfile='))throw Error('Already instrumented');
  source=source.replace('  const activePointers=new Map();',`  const polymerFrameProfile={update:new Float64Array(2048),render:new Float64Array(2048),frame:new Float64Array(2048),phase:new Array(2048),count:0};
  const activePointers=new Map();`);
  const call=source.includes('advancePolymerPresentation(Math.min(elapsed,50));')?'advancePolymerPresentation(Math.min(elapsed,50));':'advancePolymerPresentation(elapsed);';
  source=source.replace(call+ '\n    renderer.render(scene,camera);',`const profileStart=performance.now();${call}
    const profileRender=performance.now();renderer.render(scene,camera);const profileEnd=performance.now(),i=polymerFrameProfile.count++%2048;
    polymerFrameProfile.update[i]=profileRender-profileStart;polymerFrameProfile.render[i]=profileEnd-profileRender;polymerFrameProfile.frame[i]=elapsed;polymerFrameProfile.phase[i]=typeof polymerCinematic!=='undefined'&&polymerCinematic?polymerCinematic.stats.phase:polymerSamplePresentation?.phase??'idle';`);
  source=source.replace('    const probe={',`    const probe={
      profileReset(){polymerFrameProfile.count=0;},
      profile(){const n=Math.min(2048,polymerFrameProfile.count);return{count:n,update:Array.from(polymerFrameProfile.update.slice(0,n)),render:Array.from(polymerFrameProfile.render.slice(0,n)),frame:Array.from(polymerFrameProfile.frame.slice(0,n)),phase:polymerFrameProfile.phase.slice(0,n)};},`);
  return source;
}
