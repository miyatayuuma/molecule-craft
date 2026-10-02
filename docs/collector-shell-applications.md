# Collector Shell material applications

## Production authority

Fabrication remains exclusively `resources.engineeringState().fabricated` (⑩A).
Resource-v9 adds `collectorShell.activeApplications`, three independent boolean
slots. `resources.collectorShellState()` returns a sanitized copy;
`canActivateApplication`, `activateApplication`, `deactivateApplication`,
`toggleApplication` and `setApplicationActive` own selection. Unknown IDs and
unfabricated selections cannot become effective. Save/restore sanitizes missing,
unknown, nonboolean and unfabricated values. Toggle saves atomically with rollback
on storage failure or conflicting-tab protection and consumes no resources.
Canonical full reset clears both fabrication and selection; category resets retain
them under the existing fabrication reset convention.

LOADOUT / 収集殻 → 素材 opens three controls (未製作 / 装着 / 適用中 · 解除).
All three can be applied together. Launch copies and freezes validated material
state into `run.collectorMaterial`; state is not read from storage during frames.
Changing selection takes effect on the next FIELD launch. The existing region
subtitle displays a brief reduction label while the corresponding exposure exists.

## FIELD equations

`src/veil/collector-applications.js` owns the one fixed material factor, **0.5**.
`engine.js` applies it at the existing Collector response boundary, after raw
world exposure. World hazards, visuals and source intensities remain unchanged.

| Application | Collector response | Remaining effect |
|---|---|---|
| WEAR_SKIN | existing clamped abrasive `surfaceDrag × 0.5` | .34 per intensity becomes .17; .48 cap becomes .24 |
| THERMAL_SHELL | existing ambient heat target × 0.5; environmental combustion excess `(factor − 1) × 0.5` | target ceiling 150 becomes 75; base combustion heat and cooling are unchanged |
| CONTROL_INSULATION | `1 − (1 − raw authority) × 0.5`, for electrical steering and propulsion response | control loss ceiling .40 becomes .20; propulsion loss ceiling .24 becomes .12 |

Half of each existing penalty remains. This proportional choice gives noticeable
benefit within the existing ranges without removing the hazard or adding a tier.
The electrical factor follows the existing response clamp so even saturated raw
intensity retains a benefit. Mechanical force, fuel, cooldown, pickup and assist
remain outside these modifiers. All-inactive uses the original equations.
No durability, charge, maintenance, recipe performance tier or fabricated-only
passive effect exists. `collectorApplicationAuthorityReport()` fixes this contract.

## Verification

`collector-applications.test.mjs` proves fabrication → activation → save/reload,
no toggle consumption, rollback, canonical reset, migration/sanitization, actual
FIELD response, isolation and simultaneous use. Its pre-⑩B physics digest comes
from independent checkout `0ad156fb39b350935041f1bcc5453c2220af67b2`:
600 fixed steps each for normal/dense/awakened/dynamic-heavy, including player,
heat, raw hazards, pickup, respawn and progression signatures. Inactive digests
match exactly. The fixture is test-only and is not production authority.

`collector-applications-browser.test.mjs` uses actual Chromium pointer clicks at
390×844: locked/available/active, toggle, reload, FIELD launch and all three
reduction labels. Existing mobile LOADOUT fit and Collection polymer fabrication
browser checks pass. Existing particle performance, spatial index, dynamic
registry, renderer query/counter and retained P5 authority tests pass; no
population scan, renderer modification, pickup or assist change was introduced.

Dense paired Chromium 153 / SwiftShader measurement at 390×844, DPR 2, on
2026-10-03: 360 timed frames per variant and motion setting, after warm-up,
order baseline/inactive/active/active/inactive/baseline.

| Motion | Start-main mean / p95 ms | Inactive mean / p95 ms | All-active mean / p95 ms |
|---|---|---|---|
| Normal | 2.855 / 3.7 | 2.880 / 3.8 | 2.803 / 3.6 |
| Reduced | 2.593 / 3.7 | 2.531 / 3.7 | 2.459 / 3.5 |

Timings are descriptive host measurements, not new CI thresholds. No material
frame regression was observed; P5 classification remains unchanged.

## Integrated progression

The [post-Core material progression contract](post-core-material-progression.md)
connects these authorities with production flight, acquisition, CRAFT, polymer
gameplay, fabrication, mobile selection and save/reload verification. Its closure
tests import the same catalogs and controllers; they do not define parallel
progression or unlock state.
