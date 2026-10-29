// Test-only source adapter: frame section clocks, never per-particle timers.
export const RENDER_SECTIONS=['background','stars','routeFieldGeometry','hazards','dust','pickupEffects','shockStructures','dustEaters','playerTrail','otherOverlays'];
export const DUST_ABLATIONS=['complete','noGlow','noCenter','noFlow','noCarbon','cullOnly'];
export function profileRendererSource(source,{ablation='complete'}={}){
  if(!DUST_ABLATIONS.includes(ablation))throw Error('Unknown diagnostic ablation');
  const once=(a,b)=>{if(source.split(a).length!==2)throw Error(`Profile anchor drift: ${a}`);source=source.replace(a,b);};
  const before=(a,k)=>once(a,`__profile.mark('${k}');\n    ${a}`);
  once('function draw(run,dt,reduced=false){','function draw(run,dt,reduced=false){const __profile=globalThis.__fieldProfile;__profile.begin();');
  before("ctx.fillStyle='#aac5d6';",'background');
  before('if(!run.map.universe&&run.gatePassed&&run.time-run.gateTime<7){','stars');
  before('ctx.save();ctx.translate(w/2-camera.x*scale,h/2-camera.y*scale);ctx.scale(scale,scale);','otherOverlays');
  before('if(run.map.universe&&run.map.worldState===ELECTRICAL_FIELD.worldState){','routeFieldGeometry');
  before("if(run.map.universe&&run.map.worldState===ELECTRICAL_FIELD.worldState)drawCarbonChargedAnchor",'hazards');
  before('if(run.map.universe&&run.map.worldState===ABRASIVE_PLUME.worldState){','shockStructures');
  before('if(run.map.universe){\n      const d=CHO_DESTINATION','hazards');
  before('const dustRenderStart=diagnostics?.clock?.();','routeFieldGeometry');
  once('for(const dust of rendererDustCandidates(run.map,camera,scale,w,h,diagnostics)){',`const __queryStart=performance.now();const __candidates=rendererDustCandidates(run.map,camera,scale,w,h,diagnostics);__profile.queryMs=performance.now()-__queryStart;__profile.candidates=__candidates.length;for(const dust of __candidates){`);
  once('if(diagnostics){diagnostics.rendered++;','__profile.rendered++;if(diagnostics){diagnostics.rendered++;');
  before('for(const wave of run.shockWaves??[])','dust');
  before('// Dust eaters are self-organising particle vortices:','shockStructures');
  before('for(const e of run.effects){','dustEaters');
  before('const captureTarget=run.eaters?.find','pickupEffects');
  before('const q=screen(p.x,p.y);','otherOverlays');
  before('// Navigation is carried by the field geometry itself;','playerTrail');
  once('ctx.restore();if(run.returnEffect)drawReturnEffect(run.returnEffect,returnCenter,reduced);','ctx.restore();if(run.returnEffect)drawReturnEffect(run.returnEffect,returnCenter,reduced);__profile.mark(\'otherOverlays\');__profile.end();');
  // Counterfactual omission is diagnostic, never a production optimization.
  const lines=source.split('\n');
  const remove=prefix=>{const matches=lines.map((s,i)=>s.trim().startsWith(prefix)?i:-1).filter(i=>i>=0);if(matches.length!==1)throw Error(`Dust anchor drift: ${prefix}`);lines[matches[0]]='';};
  if(ablation==='noFlow'||ablation==='cullOnly')remove('if(dust.flow&&!reduced){ctx.strokeStyle');
  if(ablation==='noGlow'||ablation==='cullOnly')remove(source.includes('const __dustGlowSize=')?'const __dustGlowSize=':'glow(q.x,q.y,(element===');
  if(ablation==='noCenter'||ablation==='cullOnly'){remove("if(element==='C'&&!ecology){ctx.save()");remove('else{ctx.fillStyle=ecology?.color');}
  if(ablation==='noCarbon'){const i=lines.findIndex(s=>s.trim().startsWith("if(element==='C'&&!ecology){ctx.save()"));if(i<0)throw Error('Carbon anchor drift');lines[i]="      if(element==='C'&&!ecology){}";}
  return lines.join('\n');
}
export function createFrameProfile(clock=()=>performance.now()){
  const data={sections:Object.fromEntries(RENDER_SECTIONS.map(k=>[k,0])),queryMs:0,sortMs:0,sortCalls:0,total:0,candidates:0,rendered:0};let last,start;
  return Object.assign(data,{begin(){for(const k of RENDER_SECTIONS)data.sections[k]=0;data.queryMs=data.sortMs=data.sortCalls=data.candidates=data.rendered=0;start=last=clock();},mark(k){const now=clock();data.sections[k]+=now-last;last=now;},end(){data.total=last-start;}});
}
