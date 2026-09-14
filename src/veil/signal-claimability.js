export function syncFieldInsightMarkerClaimability(run,evaluate=()=>null){
  const signals=Array.isArray(run?.map?.signals)?run.map.signals:[];
  for(const signal of signals){signal.claimable=false;signal.claimableRecipe=null;}
  if(!run||run.captured||run.analysis||Array.isArray(run.carriedInsights)&&run.carriedInsights.length>0)return null;
  const player=run.player;let selected=null;
  for(const signal of signals){
    if(signal.ready)continue;const claim=evaluate(signal);if(!claim?.claimable||typeof claim.recipe!=='string'||!claim.recipe)continue;
    const distance=player&&Number.isFinite(player.x)&&Number.isFinite(player.y)?Math.hypot(player.x-signal.x,player.y-signal.y):Infinity;
    if(!selected||distance<selected.distance)selected={signal,claim,distance};
  }
  if(!selected)return null;selected.signal.claimable=true;selected.signal.claimableRecipe=selected.claim.recipe;return {signal:selected.signal,claim:selected.claim};
}
