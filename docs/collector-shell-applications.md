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

The LOADOUT 「素材」 button, material dialog and all three controls were removed
on 2026-10-30. The browser-facing `collector-applications-ui.js` module and its
styles no longer exist. The domain save/activation APIs remain for compatibility
with old resource-v9 saves, but there is no new LOADOUT activation UI.
Legacy active selections can still affect the next FIELD launch: launch copies and
freezes validated material state into `run.collectorMaterial`, and the region
subtitle displays a reduction label during corresponding exposure.

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

The retired LOADOUT material-selector browser check was removed with its UI.
`tests/loadout-workstation.test.mjs` now asserts the absence of its runtime import,
button, dialog, and styles. Domain-level `collector-applications.test.mjs` retains
legacy save and FIELD response coverage.

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
documents the original gameplay integration. Its domain closure tests remain;
its now-retired browser selector journey is no longer a current acceptance path.
