import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFieldBgm, fieldBgmFile } from '../src/veil/bgm.js';

const tracks = [];
class MockAudio {
  constructor() { this.volume = 0; this.paused = true; this.loop = false; tracks.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const settle = () => new Promise(resolve => setImmediate(resolve));

assert.equal(fieldBgmFile('veil'), 'airy.mp3');
assert.equal(fieldBgmFile('carbon'), 'pulse.mp3');
assert.equal(fieldBgmFile('oxygen'), 'urgent.mp3');
assert.equal(fieldBgmFile('frontier'), 'urgent.mp3');
assert.equal(fieldBgmFile('nitrogen'), 'sector.mp3');
for (const name of ['airy', 'pulse', 'urgent', 'sector']) {
  const text = await readFile(new URL(`../assets/audio/field/${name}.b64`, import.meta.url), 'utf8');
  const bytes = Buffer.from(text, 'base64');
  assert.ok(bytes.length > 100_000, `${name} is a complete MP3`);
  assert.equal(bytes.toString('ascii', 0, 3), 'ID3', `${name} has an MP3 header`);
}

const music = createFieldBgm({
  AudioCtor: MockAudio,
  loadSource: async region => `https://example.invalid/field/${fieldBgmFile(region)}`,
  volume: .12,
  fadeSeconds: 2,
});
music.mute(true);
music.start();
assert.equal(tracks.length, 0, 'Saved mute prevents music from loading');
music.mute(false);
await settle();
assert.equal(tracks.length, 1);
assert.ok(tracks[0].src.endsWith('/airy.mp3'));
assert.equal(tracks[0].loop, true);
music.update(2);
assert.equal(tracks[0].volume, .12);

music.setRegion('carbon');
await settle();
music.update(1);
assert.equal(tracks[0].volume, .06, 'Previous track fades down');
assert.equal(tracks[1].volume, .06, 'New track fades up');
music.update(1);
assert.equal(tracks[0].paused, true, 'Previous track stops after crossfade');
assert.equal(tracks[1].volume, .12);

music.setRegion('oxygen');
await settle();
music.update(2);
music.setRegion('frontier');
assert.equal(tracks.length, 3, 'Frontier shares oxygen music without restarting');
music.setRegion('nitrogen');
await settle();
music.update(2);
assert.ok(tracks[3].src.endsWith('/sector.mp3'));
assert.equal(tracks[2].paused, true);

music.pause();
assert.equal(tracks[3].paused, true);
music.start();
await settle();
assert.equal(tracks[3].paused, false, 'Resume continues the same audio');
music.mute(true);
assert.equal(tracks[3].paused, true);
music.mute(false);
await settle();
assert.equal(tracks[3].paused, false, 'Unmute restores music');
music.dispose();
assert.equal(tracks[3].paused, true);

console.log('FIELD BGM passed: four CC0 tracks, five regions, fade, saved mute, pause and resume.');
