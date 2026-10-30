// Region music is deliberately separate from the synthesized FIELD sound effects.
// The same four low-profile CC0 tracks cover all five exploration regions.
const TRACK_FILES = Object.freeze({
  veil: 'airy.mp3',
  carbon: 'pulse.mp3',
  oxygen: 'urgent.mp3',
  frontier: 'urgent.mp3',
  nitrogen: 'sector.mp3',
});

export const fieldBgmFile = region => TRACK_FILES[region] ?? TRACK_FILES.veil;
const sourceCache = new Map();
function loadEmbeddedMp3(region) {
  const file = fieldBgmFile(region);
  if (!sourceCache.has(file)) {
    const path = new URL(`../../assets/audio/field/${file.slice(0, -4)}.b64`, import.meta.url);
    const source = fetch(path).then(response => {
      if (!response.ok) throw new Error(`FIELD BGM unavailable: ${file}`);
      return response.text();
    }).then(base64 => `data:audio/mpeg;base64,${base64.trim()}`).catch(error => {
      sourceCache.delete(file);
      throw error;
    });
    sourceCache.set(file, source);
  }
  return sourceCache.get(file);
}

export function createFieldBgm({ AudioCtor = globalThis.Audio, loadSource = loadEmbeddedMp3, volume = 0.12, fadeSeconds = 1.8 } = {}) {
  let desired = 'veil', current = null, incoming = null, fade = 0, running = false, muted = false, loadToken = 0, loadingRegion = null;
  const level = Math.max(0, Math.min(1, volume));
  const fadeDuration = Math.max(0.1, fadeSeconds);

  function silence(node) {
    if (!node) return;
    node.audio.volume = 0;
    node.audio.pause();
  }

  function play(node, onReady = () => {}) {
    if (node.playPending) return;
    node.playPending = true;
    try {
      Promise.resolve(node.audio.play()).then(() => {
        node.playPending = false;
        if (!running || muted || (node !== current && node !== incoming)) {
          silence(node);
          return;
        }
        onReady();
      }).catch(() => {
        node.playPending = false;
        // A rejected autoplay attempt must not interrupt synthesized sound effects.
        node.ready = false;
        silence(node);
      });
    } catch {
      node.playPending = false;
      node.ready = false;
      silence(node);
    }
  }

  function transition() {
    if (!running || muted || !AudioCtor) return;
    if (incoming && fieldBgmFile(incoming.region) === fieldBgmFile(desired)) {
      incoming.region = desired;
      return;
    }
    if (loadingRegion && fieldBgmFile(loadingRegion) === fieldBgmFile(desired)) {
      loadingRegion = desired;
      return;
    }
    if (incoming) silence(incoming);
    incoming = null;
    fade = 0;
    if (current && fieldBgmFile(current.region) === fieldBgmFile(desired)) {
      loadToken++;
      loadingRegion = null;
      current.region = desired;
      current.audio.volume = level;
      return;
    }
    const requestedRegion = desired, token = ++loadToken;
    loadingRegion = requestedRegion;
    Promise.resolve().then(() => loadSource(requestedRegion)).then(src => {
      if (token !== loadToken || !running || muted) return;
      loadingRegion = null;
      const audio = new AudioCtor();
      audio.src = src;
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      const next = { region: desired, audio, ready: false };
      incoming = next;
      play(next, () => { next.ready = true; });
    }).catch(() => {
      if (token === loadToken) loadingRegion = null;
    });
  }

  return {
    setRegion(region) {
      const next = TRACK_FILES[region] ? region : 'veil';
      if (next === desired) return;
      desired = next;
      transition();
    },
    start() {
      if (!AudioCtor || muted) { running = true; return; }
      if (!running) {
        running = true;
        if (current) play(current);
      }
      if (incoming && !incoming.ready) play(incoming, () => { incoming.ready = true; });
      else transition();
    },
    update(dt = 1 / 60) {
      if (!running || muted || !incoming?.ready) return;
      fade = Math.min(1, fade + Math.max(0, dt) / fadeDuration);
      incoming.audio.volume = level * fade;
      if (current) current.audio.volume = level * (1 - fade);
      if (fade === 1) {
        silence(current);
        current = incoming;
        incoming = null;
      }
    },
    mute(value) {
      const next = Boolean(value);
      if (next === muted) return;
      muted = next;
      if (muted) {
        loadToken++;
        loadingRegion = null;
        silence(current);
        silence(incoming);
      } else if (running) {
        if (current) play(current);
        if (incoming) play(incoming, () => { incoming.ready = true; });
        else transition();
      }
    },
    pause() {
      running = false;
      loadToken++;
      loadingRegion = null;
      silence(current);
      silence(incoming);
      incoming = null;
      fade = 0;
    },
    dispose() {
      running = false;
      loadToken++;
      loadingRegion = null;
      silence(current);
      silence(incoming);
      current = incoming = null;
    },
  };
}

