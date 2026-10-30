# FIELD exploration BGM

Four royalty-free tracks are bundled locally, so playback does not depend on the
original host being online. They are intentionally quiet under the existing
procedural pickup, hazard, propulsion and insight sounds.

| Region | Track | File |
| --- | --- | --- |
| H Veil | Airy | `assets/audio/field/airy.b64` |
| Carbon Drift | Pulse | `assets/audio/field/pulse.b64` |
| Oxygen Surge and Inner Horizon | Urgent | `assets/audio/field/urgent.b64` |
| Nitrogen FIELD | Sector | `assets/audio/field/sector.b64` |

- Creator: SRG774
- Source: https://opengameart.org/content/dark-sci-fi-audio-pack
- License: Creative Commons CC0 1.0 Universal (public domain dedication)
- License reference: https://creativecommons.org/publicdomain/zero/1.0/
- Original files: `airy.mp3`, `pulse.mp3`, `urgent.mp3`, `sector.mp3`
- The MP3s were transcoded to 128 kbit/s and stored as base64 text assets
  (`.b64`) for GitHub text-only upload compatibility. The browser restores
  their MP3 data URLs on demand; the PWA caches the text assets for offline use.
- Audio is loopable; the implementation fades between regions over 1.8 seconds.
- The existing FIELD sound button, pause, backgrounding and expedition return
  control both BGM and synthesized sound effects. No save schema changes.
