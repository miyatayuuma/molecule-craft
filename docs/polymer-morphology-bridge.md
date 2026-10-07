# Polymer chain to material morphology bridge

Task③ is the PE-only presentation handoff between the existing Task 1 held chain and Task 2's completed static morphology. It communicates a change in observation scale: the tracked chain is shown as one member already present inside a representative bulk structure. It does not represent material forming from that one chain.

## Production sequence

1. Task 1 finishes its existing 72-point coarse centerline and long-chain hold.
2. The production bridge resolves the existing `polyethylene` profile and a deterministic `createPolymerMorphologyPlan()` using the PolymerSample ID as seed.
3. The Task 1 line and a single temporary bridge tube share the exact source centerline briefly. Their opacity ownership transfers in opposite directions while camera input, FEED, rack and environment edits are locked.
4. A bounded smooth interpolation moves the temporary line from the source path to the Task 2 hero strand. The camera keeps its orientation and continuously scales/pans to fit the completed plan.
5. The finished morphology appears with a global opacity reveal. The temporary hero then fades into the static morphology renderer's normal strand ownership.
6. The temporary and static render resources are disposed, camera state is restored, and the existing PolymerSample dock / Sample Bay lifecycle resumes.

Reduced motion shortens the overlap, registration, reveal and hold while retaining the identity handoff. Closing or purging during the transition disposes both renderers and returns to the existing finite Sample lifecycle.

## Geometry and resource boundary

`src/polymer-morphology-bridge.js` owns equal arc-length resampling, deterministic forward/reverse hero comparison, proper-rotation similarity registration, and a caller-buffered point interpolation. Registration changes only translation, rotation and uniform scale on the Task 2 renderer root. It never mutates plan points, per-member geometry or domains. When the source already has 72 points it is copied exactly; otherwise the Task 1 line and Task 2 hero are arc-length resampled to 72 points.

`src/polymer-morphology-bridge-renderer.js` allocates one fixed-capacity dynamic tube (72 rings × 8 sides), one geometry, one material and one mesh. Task 2 remains one completed static morphology renderer; there are no per-member animation objects or assembly simulation. Production morphology starts only after PE reaches the Task 1 long-chain hold. The other 24 polymers and normal chemistry remain unchanged.

The isolated `window.__reactionLabProbe.showMorphologyPreview()` remains a localhost-only static-preview contract; production bridge state does not call the preview API.

## Verification

- Pure bridge and geometry tests: `tests/polymer-morphology-bridge.test.mjs`.
- Actual-pointer mobile and desktop production lifecycle, A–F captures, lock behavior, reduced motion and close cleanup: `tests/reaction-lab-polymer-browser.test.mjs`.
- Independent Task 2 static preview: `tests/polymer-morphology-browser.test.mjs`.
- Visual evidence and the Task 1 baseline performance comparison are stored at `docs/evidence/polymer-morphology-bridge/` for 390×844 and 1280×900.
