// Feasible affine clocks from ALL observed request/reply brackets. No latency
// pair is selected or discarded according to the workload or its outcome.
export function fitFiniteClockBounds(pairs,{minimumSpanMs=10}={}){
  const valid=(pairs??[]).filter(p=>Number.isFinite(p.sourceMs)&&Number.isFinite(p.sourceUncertaintyMs)&&p.sourceUncertaintyMs>=0&&Number.isFinite(p.targetLowMs)&&Number.isFinite(p.targetHighMs)&&p.targetHighMs>=p.targetLowMs);
  if(valid.length<2)return{available:false,reason:'fewer-than-two-clock-pairs',pairCount:valid.length};
  const span=Math.max(...valid.map(p=>p.sourceMs))-Math.min(...valid.map(p=>p.sourceMs));
  if(span<minimumSpanMs)return{available:false,reason:'clock-pairs-too-close',pairCount:valid.length,sourceSpanMs:span};
  const referenceMs=valid.reduce((s,p)=>s+p.sourceMs,0)/valid.length,first=valid[0],center=(first.targetLowMs+first.targetHighMs)/2+referenceMs-first.sourceMs,padding=span*2+Math.max(...valid.map(p=>p.sourceUncertaintyMs))+1000;
  let polygon=[[.95,center-padding],[1.05,center-padding],[1.05,center+padding],[.95,center+padding]];
  const clip=(A,B,C)=>{
    const output=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],v=A*p[0]+B*p[1]-C,w=A*q[0]+B*q[1]-C;
      if(v<=0)output.push(p);
      if((v<0)!==(w<0)){const f=v/(v-w);output.push([p[0]+f*(q[0]-p[0]),p[1]+f*(q[1]-p[1])]);}
    }
    polygon=output;
  };
  for(const p of valid){
    // Positive slope: the unknown marker instant lies inside the host bracket.
    clip(p.sourceMs-p.sourceUncertaintyMs-referenceMs,1,p.targetHighMs);
    clip(-(p.sourceMs+p.sourceUncertaintyMs-referenceMs),-1,-p.targetLowMs);
    if(!polygon.length)return{available:false,reason:'clock-brackets-inconsistent',pairCount:valid.length,sourceSpanMs:span};
  }
  return{available:true,pairCount:valid.length,sourceSpanMs:span,referenceMs,sourceRangeMs:[Math.min(...valid.map(p=>p.sourceMs)),Math.max(...valid.map(p=>p.sourceMs))],vertices:polygon.map(([slope,targetAtReferenceMs])=>({slope,targetAtReferenceMs})),method:'all-pair-affine-feasible-region',assumption:'one stable monotonic affine clock rate during this trace; every marker executes inside its recorded host request/reply bracket'};
}

export function projectFiniteClockBounds(bounds,startMs,endMs,{maxUncertaintyMs=1}={}){
  if(!bounds?.available)return{available:false,reason:bounds?.reason??'clock-bounds-unavailable'};
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return{available:false,reason:'invalid-window'};
  const vertices=bounds.vertices,ref=bounds.referenceMs;
  const sourceLow=Math.min(...vertices.map(p=>(startMs-p.targetAtReferenceMs)/p.slope+ref)),sourceHigh=Math.max(...vertices.map(p=>(endMs-p.targetAtReferenceMs)/p.slope+ref));
  if(sourceLow<bounds.sourceRangeMs[0]||sourceHigh>bounds.sourceRangeMs[1])return{available:false,reason:'window-not-enclosed-by-clock-pairs'};
  const range=at=>{const values=vertices.map(p=>p.slope*(at-ref)+p.targetAtReferenceMs);return[Math.min(...values),Math.max(...values)];};
  const low=range(sourceLow),high=range(sourceHigh),y0=(low[0]+low[1])/2,y1=(high[0]+high[1])/2,slope=(y1-y0)/(sourceHigh-sourceLow),offset=y0-slope*sourceLow,uncertaintyMs=Math.max((low[1]-low[0])/2,(high[1]-high[0])/2)+.005;
  return{available:uncertaintyMs<=maxUncertaintyMs,reason:uncertaintyMs<=maxUncertaintyMs?null:'mapping-uncertainty-exceeds-1ms',slope,offset,uncertaintyMs,pairCount:bounds.pairCount,sourceSpanMs:bounds.sourceSpanMs,sourceWindowMs:[sourceLow,sourceHigh],targetWindowMs:[startMs,endMs],endpointBoundsMs:[low,high],method:bounds.method,midpointResidualUsed:false,interpretation:'Prediction envelope over every feasible affine clock; 0.005 ms numerical margin; no host pair discarded'};
}
