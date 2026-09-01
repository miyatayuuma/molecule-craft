import assert from 'node:assert/strict';
import {createVeilAudio} from '../src/veil/audio.js';

class Param{constructor(){this.value=0;this.events=[];}setValueAtTime(value){this.value=value;this.events.push(['set',value]);}linearRampToValueAtTime(value){this.events.push(['linear',value]);}exponentialRampToValueAtTime(value){this.events.push(['exponential',value]);}setTargetAtTime(value){this.value=value;this.events.push(['target',value]);}}
class Node{connect(){}disconnect(){}start(){}stop(){}}
const oscillators=[];
class AudioContext{
  constructor(){this.state='running';this.currentTime=1;this.sampleRate=32;this.destination=new Node();}
  createGain(){const node=new Node();node.gain=new Param();return node;}
  createDynamicsCompressor(){const node=new Node();node.threshold=new Param();node.ratio=new Param();return node;}
  createOscillator(){const node=new Node();node.frequency=new Param();node.type='sine';oscillators.push(node);return node;}
  createBuffer(){return {getChannelData:()=>new Float32Array(this.sampleRate)};}
  createBufferSource(){const node=new Node();node.loop=false;return node;}
  createBiquadFilter(){const node=new Node();node.frequency=new Param();node.type='lowpass';return node;}
  resume(){return Promise.resolve();}suspend(){return Promise.resolve();}close(){return Promise.resolve();}
}
globalThis.window={AudioContext};
const audio=createVeilAudio();audio.start();oscillators.length=0;
audio.event('returnSafe');const safe=oscillators.splice(0);
audio.event('capture');const emergency=oscillators.splice(0);
assert.equal(safe.length,4);assert.equal(emergency.length,3);
assert.ok(safe[0].frequency.events[1][1]>safe[0].frequency.events[0][1],'Stable retrieval opens with a soft rising confirmation');
assert.ok(emergency[0].frequency.events[1][1]<emergency[0].frequency.events[0][1],'Emergency retrieval opens with a short falling warning');

console.log('Veil audio passed: stable confirmation and emergency warning use distinct envelopes.');
