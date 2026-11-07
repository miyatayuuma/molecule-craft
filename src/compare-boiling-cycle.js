// A finite, deterministic observation cycle independent of WebGL, input
// events, game saves, and the rope physics. All times are in seconds.
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export const BOILING_TIMING=Object.freeze({warmup:2.25,boiling:3.0,recovery:1.7});
export const BOILING_START_OFFSET=55;

// Temperature rises quickly at first, then eases gently into the plateau.
// This is a presentation curve, not a measured thermal conductivity model.
export const heatingProgress=time=>{
  const t=clamp(time/BOILING_TIMING.warmup,0,1);
  return 1-(1-t)**3;
};

export function boilingHeatLevel(snapshot){
  if(snapshot?.phase==='heating')return heatingProgress(snapshot.time);
  if(snapshot?.phase==='boiling'||snapshot?.phase==='subliming')return 1;
  return 0;
}

export class ComparisonBoilingCycle {
  constructor(){this.activeId=null;this.entries=new Map();}

  focus(id,point,{known=false,boilingPoint=null,transition=null}={}){
    if(id===this.activeId)return;
    if(this.activeId!==null){
      const previous=this.entries.get(this.activeId);
      if(previous){
        const from=this.opacity(previous);
        previous.phase='recovering';previous.recovery=0;previous.recoveryFrom=from;
      }
    }
    this.activeId=id;
    // Unknown beads never trigger physical or numeric revelations.
    if(!known||!Number.isFinite(boilingPoint))return;
    const previous=this.entries.get(id);
    if(previous?.phase==='recovering')this.entries.delete(id);
    this.entries.set(id,{id,point,boilingPoint,transition,phase:'heating',time:0,recovery:0,recoveryFrom:1});
  }

  advance(dt){
    const elapsed=clamp(dt,0,.05);
    for(const [id,entry] of this.entries){
      if(entry.phase==='recovering'){
        entry.recovery+=elapsed;
        if(entry.recovery>=BOILING_TIMING.recovery)this.entries.delete(id);
        continue;
      }
      if(id!==this.activeId)continue;
      if(entry.phase==='evaporated')continue;
      entry.time+=elapsed;
      if(entry.phase==='heating'&&entry.time>=BOILING_TIMING.warmup-1e-8){
        entry.phase=entry.transition?.kind==='sublimation'?'subliming':'boiling';
        entry.time=Math.max(0,entry.time-BOILING_TIMING.warmup);
      }
      if((entry.phase==='boiling'||entry.phase==='subliming')&&entry.time>=BOILING_TIMING.boiling-1e-8){
        entry.phase='evaporated';entry.time=BOILING_TIMING.boiling;
      }
    }
  }

  opacity(entry){
    if(entry.phase==='heating')return 1;
    if(entry.phase==='boiling'||entry.phase==='subliming')return 1-clamp((entry.time-.6)/(BOILING_TIMING.boiling-.6),0,1);
    if(entry.phase==='evaporated')return 0;
    if(entry.phase==='recovering')return entry.recoveryFrom+(1-entry.recoveryFrom)*clamp(entry.recovery/BOILING_TIMING.recovery,0,1);
    return 1;
  }

  reading(){
    const entry=this.entries.get(this.activeId);
    if(!entry)return null;
    const {boilingPoint,transition,phase,time}=entry;
    if(phase==='heating')return boilingPoint-BOILING_START_OFFSET*(1-heatingProgress(time));
    if(transition?.kind==='range'){
      // Animate *documented uncertainty*, not measurement error. The UI keeps
      // the fixed range and its isomer/literature explanation visible.
      const wave=Math.sin(time*5.2)*.76+Math.sin(time*11.3)*.24;
      return clamp(boilingPoint+wave*(transition.highC-transition.lowC)/2,transition.lowC,transition.highC);
    }
    return boilingPoint;
  }

  snapshot(id){
    const entry=this.entries.get(id);
    if(!entry)return null;
    return {...entry,opacity:this.opacity(entry)};
  }
}
