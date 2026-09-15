import './insight-loadout-vfx.js';

export const INSIGHT_SITE_BALANCE=Object.freeze({
  earlyOpportunityRate:.68,
  earliestSeconds:8,
  earlySecondsSpread:10,
  minimumTravel:480,
  travelSpread:360,
  earlyActivationDeadline:28,
  rescueGraceSeconds:4.5,
  rearmExitDistance:330,
  rearmProgressDelta:180,
  rearmMinimumSeconds:2.5,
  rearmMaximumSeconds:10,
  nextSiteMinimumDistance:300,
  sameSiteCooldownSeconds:12,
  forwardDotMinimum:-.18,
  rescueForwardDotMinimum:-.4,
  eaterClearance:280,
});

const site=(id,group,x,y,extra={})=>Object.freeze({id,group,x,y,...extra});
export const INSIGHT_SITE_POOLS=Object.freeze({
  veil:Object.freeze([
    site('veil-canonical','veil',390,-650,{canonicalSignalId:'veil'}),
    site('veil-safe-bend','veil',-520,-2200),
    site('veil-approach-gap','veil',350,-2745),
    site('veil-return-arc','veil',930,-1510),
  ]),
  carbon:Object.freeze([
    site('carbon-canonical','carbon',840,-5660,{canonicalSignalId:'carbon'}),
    site('carbon-entry-junction','carbon',-120,-4990),
    site('carbon-sweep-exit','carbon',650,-5950),
    site('carbon-main-deep','carbon',230,-6400),
    site('carbon-merge','carbon',170,-7190),
  ]),
  oxygen:Object.freeze([
    site('oxygen-network-canonical','oxygen',520,-9250,{canonicalSignalId:'oxygen-network'}),
    site('oxygen-deep-canonical','oxygen',-280,-11100,{canonicalSignalId:'oxygen-deep'}),
    site('oxygen-frontier-canonical','oxygen',100,-11620,{canonicalSignalId:'oxygen-frontier'}),
    site('oxygen-entry-junction','oxygen',120,-8700),
    site('oxygen-main-recovery','oxygen',300,-9750),
    site('oxygen-side-inner','oxygen',850,-10350),
    site('oxygen-network-merge','oxygen',120,-10670),
    site('oxygen-horizon-entry','oxygen',80,-12020),
  ]),
  nitrogen:Object.freeze([]),
});

const REGION_AFFINITY=Object.freeze({veil:'Hydrogen',carbon:'Carbon',oxygen:'Oxygen',nitrogen:'Nitrogen'});
const REGION_ORDER=Object.freeze(['veil','carbon','oxygen','nitrogen']);
const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const finitePoint=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y);
const groupForRegion=region=>region==='frontier'?'oxygen':region;
export const hasInsightSitePool=region=>Array.isArray(INSIGHT_SITE_POOLS[region])&&INSIGHT_SITE_POOLS[region].length>0;

function minimumRegionForRecord(record){
  const atoms=Array.isArray(record?.atoms)?record.atoms:[];
  if(atoms.includes('N'))return 'nitrogen';
  if(atoms.includes('O'))return 'oxygen';
  if(atoms.includes('C'))return 'carbon';
  return atoms.length&&atoms.every(element=>element==='H')?'veil':null;
}

export function chooseInsightHotDestination(candidate,{availableRegions=[],record=null}={}){
  const available=[...new Set(availableRegions)].filter(hasInsightSitePool),minimum=minimumRegionForRecord(record);
  if(!available.length)return null;
  const minimumRank=REGION_ORDER.indexOf(minimum),rows=available.map((region,index)=>{
    const affinity=clamp01(candidate?.regionAffinities?.[REGION_AFFINITY[region]]),rank=REGION_ORDER.indexOf(region),meetsMinimum=minimumRank<0||rank>=minimumRank;
    return {region,index,score:affinity*4+(region===minimum?1.1:0)+(meetsMinimum?.2:-1.5)};
  }).sort((a,b)=>b.score-a.score||a.index-b.index||a.region.localeCompare(b.region));
  return rows[0]?.region??null;
}

function hash32(value){let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}h^=h>>>16;return h>>>0;}
function seededRng(seed){let state=seed>>>0;return()=>{state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const deterministicNoise=(seed,key)=>hash32(`${seed}:${key}`)/4294967296;

function ensureInsightSites(run){
  const map=run?.map;if(!map||!Array.isArray(map.signals))return [];
  if(map._insightSitePoolReady)return map.signals.filter(signal=>signal.insightSite===true);
  map._insightSitePoolReady=true;const seedValue=(map.seed??1)>>>0;
  for(const definitions of Object.values(INSIGHT_SITE_POOLS))for(const definition of definitions){
    let signal=definition.canonicalSignalId?map.signals.find(row=>row.id===definition.canonicalSignalId):null;
    if(!signal){
      const rng=seededRng(hash32(`${seedValue}:${definition.id}`)),jitter=22;
      signal={id:`insight-site:${definition.id}`,region:definition.group,anchorX:definition.x,anchorY:definition.y,x:definition.x+(rng()-.5)*jitter*2,y:definition.y+(rng()-.5)*jitter*2,ready:false,roll:rng(),choice:rng()};
      map.signals.push(signal);
    }
    signal.insightSite=true;signal.insightSiteId=definition.id;signal.insightSiteGroup=definition.group;signal.insightCanonical=!!definition.canonicalSignalId;
  }
  return map.signals.filter(signal=>signal.insightSite===true);
}

function makePlan(run,meta){
  const seed=hash32(`${run?.map?.seed??1}:${meta.seedId}:${meta.hotDestination}`),rng=seededRng(seed),earlyEnabled=rng()<INSIGHT_SITE_BALANCE.earlyOpportunityRate;
  return {
    seedId:meta.seedId,hotDestination:meta.hotDestination,runSeed:seed,
    earlyEnabled,earlyActivationTime:INSIGHT_SITE_BALANCE.earliestSeconds+rng()*INSIGHT_SITE_BALANCE.earlySecondsSpread,
    earlyMinimumTravel:INSIGHT_SITE_BALANCE.minimumTravel+rng()*INSIGHT_SITE_BALANCE.travelSpread,
    phase:'waiting',selectedSiteId:null,activeSiteId:null,activeSince:null,activeBestDistance:Infinity,
    firstEaterSpawnTime:null,rescueEntered:false,rescueEnteredAt:null,rearmCount:0,acquiredTime:null,
    usedSites:{},cooldowns:{},lastExpiredSiteId:null,
  };
}

function heading(run){
  const p=run?.player;if(!p)return {x:0,y:-1};const speed=Math.hypot(p.vx??0,p.vy??0);
  if(speed>20)return {x:(p.vx??0)/speed,y:(p.vy??0)/speed};
  return {x:Math.cos(p.angle??-Math.PI/2),y:Math.sin(p.angle??-Math.PI/2)};
}
function siteMetrics(run,signal){
  const p=run.player,dx=signal.x-p.x,dy=signal.y-p.y,distance=Math.hypot(dx,dy),h=heading(run),forward=distance?((dx*h.x+dy*h.y)/distance):1;
  const eaterDistance=(run.eaters??[]).reduce((best,eater)=>Math.min(best,Math.hypot(signal.x-eater.x,signal.y-eater.y)),Infinity);
  const bounds=run.config?.bounds,inBounds=!bounds||(signal.x>=bounds.left+30&&signal.x<=bounds.right-30&&signal.y>=bounds.top+30&&signal.y<=bounds.bottom-30);
  return {distance,forward,eaterDistance,inBounds};
}
function chooseSite(run,plan,sites,{rescue=false,excludeId=null}={}){
  const currentGroup=groupForRegion(run.region),now=run.time??0,minForward=rescue?INSIGHT_SITE_BALANCE.rescueForwardDotMinimum:INSIGHT_SITE_BALANCE.forwardDotMinimum;
  const scoreRows=(relax=0)=>sites.filter(signal=>!signal.ready&&signal.insightSiteId!==excludeId).map(signal=>({signal,metrics:siteMetrics(run,signal)})).filter(({signal,metrics})=>{
    if(!metrics.inBounds)return false;if((plan.cooldowns[signal.insightSiteId]??0)>now)return false;
    if(!relax&&metrics.distance<INSIGHT_SITE_BALANCE.nextSiteMinimumDistance)return false;
    if(relax<2&&metrics.forward<minForward)return false;
    if(relax<3&&metrics.eaterDistance<INSIGHT_SITE_BALANCE.eaterClearance)return false;
    return true;
  }).map(({signal,metrics})=>{
    const preferred=signal.insightSiteGroup===plan.hotDestination?1:0,current=signal.insightSiteGroup===currentGroup?1:0,used=plan.usedSites[signal.insightSiteId]??0,noise=deterministicNoise(plan.runSeed,`${signal.insightSiteId}:${plan.rearmCount}`);
    const score=preferred*900+current*260+metrics.forward*260-Math.abs(metrics.distance-850)*.18-used*170+noise*90;
    return {signal,metrics,score};
  }).sort((a,b)=>b.score-a.score||a.signal.insightSiteId.localeCompare(b.signal.insightSiteId));
  for(let relax=0;relax<=3;relax++){const rows=scoreRows(relax);if(rows.length)return rows[0].signal;}return null;
}
function activateSite(run,plan,signal,phase){
  if(!signal)return null;plan.phase=phase;plan.activeSiteId=signal.insightSiteId;plan.selectedSiteId=signal.insightSiteId;plan.activeSince=run.time??0;plan.activeBestDistance=Math.hypot(run.player.x-signal.x,run.player.y-signal.y);plan.usedSites[signal.insightSiteId]=(plan.usedSites[signal.insightSiteId]??0)+1;
  run.frontierInsightActiveRoll=signal.roll;run.frontierInsightActiveChoice=signal.choice;run.frontierInsightSiteReady=true;return signal;
}
function clearActive(run,plan,sites,{cooldown=false}={}){
  const active=sites.find(signal=>signal.insightSiteId===plan.activeSiteId);if(cooldown&&active){plan.cooldowns[active.insightSiteId]=(run.time??0)+INSIGHT_SITE_BALANCE.sameSiteCooldownSeconds;plan.lastExpiredSiteId=active.insightSiteId;}
  plan.activeSiteId=null;plan.activeSince=null;plan.activeBestDistance=Infinity;run.frontierInsightActiveRoll=null;run.frontierInsightActiveChoice=null;run.frontierInsightSiteReady=false;return active;
}
function updatePlan(run,plan,sites){
  const now=run.time??0;
  if(plan.firstEaterSpawnTime===null&&Array.isArray(run.eaters)&&run.eaters.length>0)plan.firstEaterSpawnTime=now;
  const active=plan.activeSiteId?sites.find(signal=>signal.insightSiteId===plan.activeSiteId):null;
  if(active?.ready){plan.acquiredTime=now;plan.phase='acquired';clearActive(run,plan,sites);return null;}
  if(!plan.rescueEntered&&plan.firstEaterSpawnTime!==null&&now+1e-9>=plan.firstEaterSpawnTime+INSIGHT_SITE_BALANCE.rescueGraceSeconds){plan.rescueEntered=true;plan.rescueEnteredAt=now;plan.phase='rescue';}
  if(active){
    const metrics=siteMetrics(run,active);plan.activeBestDistance=Math.min(plan.activeBestDistance,metrics.distance);
    if(plan.rescueEntered){
      const age=now-(plan.activeSince??now),missedApproach=plan.activeBestDistance<180&&metrics.distance>=INSIGHT_SITE_BALANCE.rearmExitDistance,passed=metrics.distance>=INSIGHT_SITE_BALANCE.rearmExitDistance&&(metrics.distance>=plan.activeBestDistance+INSIGHT_SITE_BALANCE.rearmProgressDelta||metrics.forward<-.45),stale=age>=INSIGHT_SITE_BALANCE.rearmMaximumSeconds&&metrics.distance>=INSIGHT_SITE_BALANCE.rearmExitDistance;
      if(age>=INSIGHT_SITE_BALANCE.rearmMinimumSeconds&&(missedApproach||passed||stale)){
        const oldId=active.insightSiteId;clearActive(run,plan,sites,{cooldown:true});const next=chooseSite(run,plan,sites,{rescue:true,excludeId:oldId});if(next){plan.rearmCount++;return activateSite(run,plan,next,'rescue');}
      }
    }
    return active;
  }
  if(plan.rescueEntered)return activateSite(run,plan,chooseSite(run,plan,sites,{rescue:true,excludeId:plan.lastExpiredSiteId}),'rescue');
  const travel=Number.isFinite(run.insightEngagementMaxDistance)?run.insightEngagementMaxDistance:0;
  if(plan.earlyEnabled&&now<=INSIGHT_SITE_BALANCE.earlyActivationDeadline&&now+1e-9>=plan.earlyActivationTime&&travel+1e-9>=plan.earlyMinimumTravel)return activateSite(run,plan,chooseSite(run,plan,sites),'early');
  if(now>INSIGHT_SITE_BALANCE.earlyActivationDeadline)plan.phase='waiting-rescue';return null;
}

function syncRunFlags(run,plan){
  run.frontierInsightSiteManaged=!!plan;run.frontierInsightSiteReady=!!plan?.activeSiteId;
  if(!plan){run.frontierInsightActiveRoll=null;run.frontierInsightActiveChoice=null;}
}
export function fieldInsightSiteDiagnostics(run){
  const plan=run?.frontierInsightPlan;if(!plan)return {managed:false,seedId:null,hotDestination:null,selectedSiteId:null,earlyEnabled:false,earlyActivationTime:null,earlyMinimumTravel:null,rescueEntered:false,firstEaterSpawnTime:null,rearmCount:0,acquiredTime:null};
  return {managed:true,seedId:plan.seedId,hotDestination:plan.hotDestination,selectedSiteId:plan.selectedSiteId,activeSiteId:plan.activeSiteId,phase:plan.phase,earlyEnabled:plan.earlyEnabled,earlyActivationTime:plan.earlyActivationTime,earlyMinimumTravel:plan.earlyMinimumTravel,rescueEntered:plan.rescueEntered,rescueEnteredAt:plan.rescueEnteredAt,firstEaterSpawnTime:plan.firstEaterSpawnTime,rearmCount:plan.rearmCount,acquiredTime:plan.acquiredTime};
}

export function syncFieldInsightMarkerClaimability(run,evaluate=()=>null){
  const signals=Array.isArray(run?.map?.signals)?run.map.signals:[];for(const signal of signals){signal.claimable=false;signal.claimableRecipe=null;}
  if(!run)return null;
  if(run.map?.universe!==true){
    if(run.captured||run.analysis||Array.isArray(run.carriedInsights)&&run.carriedInsights.length>0)return null;
    const player=run.player,candidates=signals.filter(signal=>!signal.ready).map(signal=>({signal,claim:evaluate(signal)})).filter(row=>row.claim?.claimable&&typeof row.claim.recipe==='string');
    if(!candidates.length)return null;const selected=candidates.map(row=>({...row,distance:finitePoint(player)?Math.hypot(player.x-row.signal.x,player.y-row.signal.y):Infinity})).sort((a,b)=>a.distance-b.distance)[0];selected.signal.claimable=true;selected.signal.claimableRecipe=selected.claim.recipe;return selected;
  }
  const sites=ensureInsightSites(run),existingPlan=run.frontierInsightPlan;let active=existingPlan?updatePlan(run,existingPlan,sites):null;
  syncRunFlags(run,existingPlan??null);
  if(run.captured||run.analysis||Array.isArray(run.carriedInsights)&&run.carriedInsights.length>0)return null;
  const player=run.player,claims=signals.filter(signal=>!signal.ready).map(signal=>({signal,claim:evaluate(signal)}));
  const chooseNearest=rows=>rows.map(row=>({...row,distance:finitePoint(player)?Math.hypot(player.x-row.signal.x,player.y-row.signal.y):Infinity})).sort((a,b)=>a.distance-b.distance)[0]??null;
  const critical=chooseNearest(claims.filter(row=>row.claim?.critical===true&&row.claim?.claimable===true&&typeof row.claim.recipe==='string'));
  if(critical){critical.signal.claimable=true;critical.signal.claimableRecipe=critical.claim.recipe;return critical;}
  const meta=claims.find(row=>row.claim?.managed===true&&row.claim?.frontier===true&&typeof row.claim.seedId==='string')?.claim??null;
  if(meta?.activeForRun===true){
    const stalePlan=!run.frontierInsightPlan||run.frontierInsightPlan.seedId!==meta.seedId||run.frontierInsightPlan.hotDestination!==meta.hotDestination;
    if(stalePlan){run.frontierInsightPlan=makePlan(run,meta);active=updatePlan(run,run.frontierInsightPlan,sites);}
    syncRunFlags(run,run.frontierInsightPlan);
    if(run.frontierInsightPlan.phase==='acquired')return null;
    if(active){const claim=evaluate(active);if(claim?.claimable&&typeof claim.recipe==='string'){active.claimable=true;active.claimableRecipe=claim.recipe;return {signal:active,claim};}}
    return null;
  }
  syncRunFlags(run,null);
  const legacy=chooseNearest(claims.filter(row=>row.claim?.claimable&&typeof row.claim.recipe==='string'));
  if(!legacy)return null;legacy.signal.claimable=true;legacy.signal.claimableRecipe=legacy.claim.recipe;return legacy;
}
