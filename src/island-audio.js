// Small procedural sounds. All voices share one user-gesture-unlocked context.
// No looping audio, network assets, or sound before the first interaction.
export function createIslandAudio({muted=false}={}) {
  let context=null,enabled=!muted,suspended=false;
  const last=new Map(),voices=new Set();
  function unlock() {
    if(!enabled||suspended)return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      context??=new Audio();
      if(context.state==='suspended')context.resume().catch(()=>{});
    } catch {context=null;}
  }
  const sounds={
    drop:[320,170,.13,'sine'], water:[780,260,.22,'sine'], overflow:[600,150,.3,'sine'],
    drain:[420,100,.24,'sine'], bubble:[250,900,.12,'sine'], dissolve:[700,1300,.18,'sine'],
    salt:[1700,900,.08,'triangle'], spark:[120,2200,.09,'triangle'],
    fire:[100,65,.25,'triangle'], steam:[300,1200,.25,'sine'],
    oxygen:[700,1100,.17,'sine'], gas:[400,150,.17,'sine'],
    nutrient:[420,760,.2,'sine'], clean:[950,1450,.2,'sine'],
    neutralize:[380,720,.24,'sine'], tint:[500,720,.12,'sine'],
    creature:[580,820,.14,'sine'], collect:[900,1350,.14,'triangle'],
    electricity:[140,700,.12,'triangle'], grow:[390,780,.25,'sine'],
    discovery:[523.25,1046.5,.38,'sine'], bounce:[260,120,.1,'sine'],liquid:[430,200,.16,'sine'],
  };
  function tone(start,end,duration,type,offset=0,gain=.065) {
    if(voices.size>=12)return;
    const t=context.currentTime+offset,osc=context.createOscillator(),amp=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(start,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(gain,t+.014);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(amp);amp.connect(context.destination);voices.add(osc);
    osc.onended=()=>{voices.delete(osc);osc.disconnect();amp.disconnect();};osc.start(t);osc.stop(t+duration+.03);
  }
  return {
    unlock,
    play(type) {
      if(!enabled||suspended||!context||context.state!=='running')return;
      const now=context.currentTime;if(now-(last.get(type)??-10)<.12)return;last.set(type,now);
      const spec=sounds[type];if(!spec)return;
      try {
        tone(...spec);
        if(type==='discovery'){tone(659.25,659.25,.26,'sine',.12,.045);tone(783.99,1046.5,.35,'sine',.24,.04);}
      } catch { /* Audio failure must never interrupt an experiment. */ }
    },
    setMuted(value){enabled=!value;if(enabled)unlock();else for(const osc of voices)try{osc.stop();}catch{}},
    pause(){suspended=true;if(context?.state==='running')context.suspend().catch(()=>{});},
    resume(){suspended=false;},
    dispose(){for(const osc of voices)try{osc.stop();}catch{}voices.clear();context?.close().catch(()=>{});context=null;},
  };
}
