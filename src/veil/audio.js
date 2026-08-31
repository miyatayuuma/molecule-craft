import { VEIL, VEIL_AUDIO as A } from './config.js';
// Semantic events keep sample replacement independent of simulation and input.
export function createVeilAudio(){
  let ctx=null,master=null,hum=null,humGain=null,air=null,airGain=null,lastPickup=-1,phrase=0,muted=false;
  function start(){try{if(!ctx){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx=new Audio();
    master=ctx.createGain();master.gain.value=muted?0:A.master;
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-18;limiter.ratio.value=5;master.connect(limiter);limiter.connect(ctx.destination);
    hum=ctx.createOscillator();humGain=ctx.createGain();hum.type='sine';hum.frequency.value=64;humGain.gain.value=0;hum.connect(humGain);humGain.connect(master);hum.start();
    // Filtered air gives sustained suction a soft body, without stacking hundreds of voices.
    const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=noise.getChannelData(0);let smoothed=0;
    for(let i=0;i<data.length;i++){smoothed=(smoothed+(Math.random()*2-1)*.02)/1.02;data[i]=smoothed*3;}
    air=ctx.createBufferSource();air.buffer=noise;air.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;
    airGain=ctx.createGain();airGain.gain.value=0;air.connect(filter);filter.connect(airGain);airGain.connect(master);air.start();
  }void ctx.resume().catch(()=>{});}catch{}}
  function tone(frequency,duration=.1,level=.15,delay=0,type='sine',end=null){
    if(!ctx||muted||ctx.state!=='running')return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function event(type,chain=0,count=1){
    if(type==='pickup'){
      if(!ctx||ctx.currentTime-lastPickup<A.pickupInterval)return;
      if(ctx.currentTime-lastPickup>.5)phrase=0;lastPickup=ctx.currentTime;
      const stage=Math.min(3,Math.floor(chain/25)),step=(phrase++%4)+stage,f=A.pickupBase*2**(A.notes[step]/12);
      tone(f,A.pickupSeconds,A.pickupLevel);if(chain>=25)tone(f*1.5,.2,A.harmonyLevel);
      if(count>=6)tone(f/2,.22,.08);
    }else if(type==='boost'){tone(70,.28,A.boostLevel,0,'triangle',250);tone(196,.65,.09,.03,'sine',784);}
    else if(type==='cooling'){tone(660,.42,.045,0,'sine',330);tone(440,.55,.035,.04,'triangle',220);}
    else if(type==='cluster'){tone(92,.34,.12,0,'triangle',164);[0,5,9].forEach((n,i)=>tone(220*2**(n/12),.32,.055,.05+i*.035));}
    else if(type==='signal'){[0,4,11].forEach((n,i)=>tone(330*2**(n/12),.48,.05,i*.09,'sine'));}
    else if(type==='dense'){[0,7,12].forEach((n,i)=>tone(196*2**(n/12),.3,.08,i*.04));}
    else if(type==='rare'||type==='gate'){[0,7,12,16].forEach((n,i)=>tone(294*2**(n/12),.45,.09,i*.11));}
    else if(type==='chainEnd'&&chain>=8){phrase=0;tone(196,.24,.04,0,'sine',164.8);}
  }
  return {start,event,update(speed,chain,boost){if(!ctx||!hum)return;const fever=Math.min(chain/VEIL.feverChain,1),t=ctx.currentTime;
    hum.frequency.setTargetAtTime(55+speed*.065,t,.15);humGain.gain.setTargetAtTime(muted?0:Math.min(speed/VEIL.speed,1)*(A.movementLevel+fever*A.feverLevel),t,.12);
    airGain?.gain.setTargetAtTime(muted?0:(chain>0?.04+fever*.06:0)+(boost?.14:0),t,.12);
  },mute(value){muted=value;if(master)master.gain.setTargetAtTime(muted?0:A.master,ctx.currentTime,.025);},pause(){if(ctx)void ctx.suspend().catch(()=>{});},dispose(){if(ctx)void ctx.close().catch(()=>{});}};
}
