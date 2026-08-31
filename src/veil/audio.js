// Semantic event boundary: replace tones with samples without changing gameplay.
export function createVeilAudio(){
  let ctx=null,master=null,hum=null,humGain=null,lastPickup=0,muted=false;
  function start(){try{if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx=new Audio();master=ctx.createGain();master.gain.value=.27;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-16;master.connect(limiter);limiter.connect(ctx.destination);hum=ctx.createOscillator();humGain=ctx.createGain();hum.type='sine';hum.frequency.value=64;humGain.gain.value=0;hum.connect(humGain);humGain.connect(master);hum.start();}void ctx.resume().catch(()=>{});}catch{}}
  function tone(frequency,duration=.1,level=.15,delay=0,type='sine',end=null){if(!ctx||muted||ctx.state!=='running')return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.009);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  function event(type,chain=0){
    if(type==='pickup'){if(!ctx||ctx.currentTime-lastPickup<.055)return;lastPickup=ctx.currentTime;const notes=[0,2,4,7,9,12,14,16],step=Math.floor(chain/4)%notes.length,f=220*2**(notes[step]/12);tone(f,.085,.10);if(chain>=50)tone(f*1.5,.13,.025);}
    else if(type==='boost'){tone(90,.5,.28,0,'triangle',440);tone(440,.7,.09,.05,'sine',880);}
    else if(type==='dense'){[0,4,7].forEach((n,i)=>tone(330*2**(n/12),.25,.10,i*.05));}
    else if(type==='rare'||type==='gate'){[0,7,12,16].forEach((n,i)=>tone(330*2**(n/12),.4,.10,i*.1));}
    else if(type==='chainEnd'&&chain>=8)tone(260,.18,.055,0,'sine',200);
  }
  return {start,event,update(speed,chain,boost){if(!ctx)return;hum.frequency.setTargetAtTime(55+speed*.1+(boost?25:0),ctx.currentTime,.12);humGain.gain.setTargetAtTime(muted?0:Math.min(speed/205,1)*(.045+Math.min(chain/100,1)*.035),ctx.currentTime,.1);},mute(value){muted=value;if(master)master.gain.value=muted?0:.27;},pause(){if(ctx)void ctx.suspend().catch(()=>{});},dispose(){if(ctx)void ctx.close().catch(()=>{});}};
}
