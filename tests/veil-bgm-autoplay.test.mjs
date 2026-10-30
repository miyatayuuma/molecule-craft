import assert from 'node:assert/strict';
import {createFieldBgm} from '../src/veil/bgm.js';
let gesture=false, attempts=0, tracks=[];
class AudioMock {constructor(){this.volume=0;this.paused=true;tracks.push(this)} play(){attempts++;if(!gesture)return Promise.reject(new Error('NotAllowedError'));this.paused=false;return Promise.resolve()} pause(){this.paused=true}}
const music=createFieldBgm({AudioCtor:AudioMock,loadSource:async()=> 'data:audio/mpeg;base64,abc'});
const tick=()=>new Promise(r=>setImmediate(r));
music.start();await tick();
assert.equal(attempts,1);assert.equal(tracks[0].paused,true);
gesture=true;music.start();gesture=false;await tick();
music.update(2);assert.equal(tracks[0].paused,false);assert.equal(tracks[0].volume,.12);
music.pause();assert.equal(tracks[0].paused,true);
gesture=true;music.start();gesture=false;await tick();assert.equal(tracks[0].paused,false);
music.dispose();console.log('autoplay rejection, synchronous retry, fade, pause and resume PASS');

