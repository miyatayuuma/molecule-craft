# Task⑤ PIB visibility recovery — BLOCKED

Authority at start: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 Draft/Open HEAD `6036606df10126840c5c51ada9fde76cb4d57f84`. Main and PR #345 are not merged or modified by this investigation. **No production repair is adopted.** The frozen actual-PNG campaign still has zero simultaneous witnesses at anchors 0/17/30. Numeric and CPU mesh predictions below do not certify new PNG acceptance or global rigid-view impossibility.

Evidence: [manifest](polymer-local-fragment-task5-evidence/recovery/pib-occlusion-6036606d/index.json), [original 40-direction conflict ledger](polymer-local-fragment-task5-evidence/recovery/pib-visibility-conflict.json). Original PNGs, masks, annotation-free photometry and prior failures remain unchanged. The new folder contains complete bounded diagnostic observations, protocols, CPU masks explicitly named `CPU`, the protected-test log, and independent review.

## Frozen raster cause

The actual sample is `polymer-sample-1-1`, route `polyisobutylene-cationic`, 390×844 / DPR1 / normal. Every junction requires the same 11 real atoms and 10 real bonds in one local view. The original 40 directions and one local focus per anchor are unchanged. Reconstructed initial lane projections agree with the saved snapshot within 1e-6 CSS px. Hashes of all 18 retained original image/mask/photometry files are checked before analysis; all six actual screenshots were visually inspected.

| Saved view | Missing target | Actual mask / reconstructed projection | Cause |
|---|---|---|---|
| anchor0 / yaw0 / pitch0 | H4 | visible disk .476959; C10 occupies 256 pixels inside its projected disk. H4 center depth18.1095, C10 depth14.5224 | Other methyl C10 occludes H4 |
| anchor0 / yaw90 / pitch−60 | bond13 C11–H9; bond15 C10–H15 | continuous5.8271 /7.3618px, threshold7.75; projected lengths14.0821 /14.2329px; angles52.39° /37.45° to camera normal | Endpoint C11 / H15 occlusion |
| anchor17 / yaw45 / pitch30 | bond28 C21–H27; bond29 C21–H28 | projected lengths12.0671 /13.6294px, widths7.0829 /6.5645px; mask46 /50px meets area requirements42.7348 /44.7353; continuous4.3442 /5.3544px fails | Endpoint H27 / C21 occlusion, not missing lanes |
| anchor17 / yaw135 / pitch30 | bond25 C22–H19; bond27 C21–H26 | mask0 /0px; camera angles31.84° /15.47° | Complete endpoint C22 / H26 occlusion |
| anchor30 / yaw45 / pitch−60 | C31; bond12 C35–H8 | C31 disk .496155, principally overlapped by C34; bond12 mask0px and camera angle11.42° | C34 overlap and H8 end-on occlusion |
| anchor30 / yaw90 / pitch−60 | bond12 C35–H8; bond35 C35–H33 | bond12 mask0px; bond35 mask48px <49.6897 required and continuous6.8991px | H8 completely covers its own connection and also obscures bond35 |

`pib-occlusion.json.gz` retains endpoint graph indices and source tuples, order/lane, model and camera axes, angle, trimmed length, projected length/width, ID pixels, continuous length, observed mask owners, sphere depths, DOM rectangles, selection circles, pose, scale, safe rectangle and image hashes. Sphere/cylinder analytic counts are diagnostic approximations; ID pixels are the observed authority. The finite-cylinder side intersection is bounded to its actual segment. Projected-disk owner counts are not asserted to be exact 3D occlusion area.

## Cause discrimination and bounded results

| Candidate cause | Finding |
|---|---|
| A: end-on / atom occlusion | Supported directly by original masks and screenshots, as above |
| B: local orientation selection | The gap-only top-four facet ranking discards useful candidates. Expanded *numeric-only* graph facets predict a readable view for0 and17; this does not prove actual-PNG PASS |
| C: pivot / fit scale | A fixed factor comparison evaluated selected-AABB pivot and a hypothetical344×309 safe rectangle, retaining all other bounds. Neither supplies a simultaneous30 witness. No DOM/pivot/zoom change is adopted |
| D: rendered lane / mask mismatch | No mismatch demonstrated. PIB has47 real single lanes; camera-facing offset changes cannot explain these missing IDs. Reconstructed lane endpoints match saved projection |
| E: formal grader error | Not demonstrated. The **production selection proxy**, however, counts33 centerline ray samples, whereas A04 grades lane area and continuous pixels. These are different observables. No formal threshold or grader is changed |
| F: structural infeasibility | **Unresolved globally.** Finite searches establish only failure of their enumerated candidates; they do not prove that every rigid pose fails |

All experiments below declare their budget before evaluating it. Full rows and all candidates are retained, including failures. No new browser or GPU campaign was started. Replaying newly extracted scripts to verify identical stored observations is not an additional search or successful-result retry.

| Diagnostic | Fixed budget | Result / limit |
|---|---:|---|
| Previous-best local refinement | 3anchors ×5seeds ×4levels ×7poses =420 fits | Numeric score1 at0/17;30 best .666667 |
| Single sphere-direction study for30 | 8192directions ×2rolls =16384 fits | Best .803561; no global impossibility conclusion |
| Coarse-to-fine30 refinement | 5seeds ×4levels ×2sweeps ×7poses =280 fits | Best .848485 |
| Graph-facet truncation discrimination | 4176 /4160 /4176 fits; total12512 ≤12600 declared | Numeric score1 at0/17;30 best .652062 |
| Pivot / safe-region factor comparison | 108 fits, only already retained orientations plus current selector | No30 numeric score1; do not change production using these predictions |
| CPU triangle depth raster | 6old controls +13retained candidates | Old foreground-union mismatch .2626–.4240%;0/17 partial pixel predictions pass, all11 candidates for30 fail at least one pixel requirement |
| One pixel-metric refinement for30 | 3seeds ×5levels ×27offsets =405 fits/raster evaluations | No joint pixel prediction; best minimum normalized margin .962091 |
| Wide-region pixel factor | 24already retained factor poses, no added orientations | No30 joint pixel prediction; hypothetical DOM is not accepted |

CPU meshes use the production24×16 sphere and12-segment cylinder tokens, perspective projection, object IDs and triangle depth. The original atom mesh local quaternion was not captured in the historical report; identity orientation approximates its tessellation. At old17/bond29 four mismatched pixels change measured continuous length by about .974px. Therefore a near-boundary prediction cannot be promoted to actual PASS/FAIL. CPU `jointPrediction` is only the A03/A04 *partial pixel prediction*, without A06 photometry, actual pointer ownership, or an independently captured q/depth acceptance record.

The pixel-refinement best still predicts bond33 area91px <94.4742px and bond34 continuous7.4562px <7.75px. Those values identify the next observation boundary; they are not proof of impossibility. An independent ray/triangle review reproduces the original failures and the retained near-boundary candidate deficits. Increasing numerical or browser trials until a favorable result appears is not the next step.

## Preservation, review and remaining gates

Production files, XYZ, graph, origin, sample identity, save schema, pointer ownership, Stage B cache, iteration limits, all visual and performance thresholds, and PWA353 remain unchanged. The protected test command passed35 / failed0 / skipped0, covering frozen PLA/PET, all25 canonical final and95 intermediate graphs, determinism/rejection/fallback, observation, optical grading, allocation/static drawing and heap contracts. This is not Repository/FIELD/Stage B/Finite browser acceptance.

The existing five GitHub inline review threads are resolved. The latest6036606d GitHub review request has no returned receipt at investigation start. A separate read-only reviewer examined the PLA validated-pre-distance retention and the four new diagnostic scripts: no new blocking defect; it required manifest source/fixture/script hashes and explicit CPU prediction limits, now recorded. It did not run browser tests or independently rerun the35 tests. A fresh GitHub review request binds the saved checkpoint HEAD; pending external review is not called complete.

Task⑤ remains **BLOCKED / PR #354 Draft / Open / Unmerged**. New actual-PNG PIB3/3, final all25/12jobs, V0–V8/C01–C09/S10–S16, PAN4/NBR1 L1, lifecycle/PF3cycle, strict Stage B/Finite RAF, Repository/FIELD, merge and post-merge are **NOT_RUN / NOT_CERTIFIED** on this checkpoint. Historical successes do not certify this source. PWA freshness remains353 verified assets. No Task⑤ unmet criterion is transferred to Task⑥.

Minimum restart: reconcile latest main/PR/review, then resolve anchor30's area/continuous-length conflict through a demonstrably generic rigid orientation/focus selection. The current proxy must not substitute for the actual area metric. Preserve the three sites and frozen input; if a cause-backed candidate becomes supportable, bind its complete reset/focus rule before the existing40-direction/one-anchor actual-PNG/pointer campaign. Capture the actual atom mesh local quaternions if using mesh predictions to adjudicate a near-boundary view. If all3 sites do not pass, retain the blocker and do not launch the full12/Finite/merge campaign. Coordinate/conformer changes, wider thresholds and another blind direction sweep are not authorized by this result.

## Exact offline replay

Run from the repository root. Node24.19.0 produced the saved numeric/CPU records. No browser, third-party package or network is needed. These commands reproduce diagnostic results, not production acceptance.

```sh
node scripts/diagnose-polymer-task5-pib-occlusion.mjs
node scripts/diagnose-polymer-task5-pib-refinement.mjs
node scripts/diagnose-polymer-task5-pib-search.mjs sphere
node scripts/diagnose-polymer-task5-pib-search.mjs facets
node scripts/diagnose-polymer-task5-pib-search.mjs refine30
node scripts/diagnose-polymer-task5-pib-search.mjs factors
node scripts/diagnose-polymer-task5-pib-mesh.mjs --refine --fit-factors
node --test tests/polymer-task5-pla-recovery.test.mjs tests/polymer-task5-pet-recovery.test.mjs tests/polymer-fragment-task4.test.mjs tests/polymer-observation.test.mjs tests/polymer-raster-grading.test.mjs tests/polymer-static-render.test.mjs tests/polymer-allocation-window.test.mjs tests/polymer-heap-grading.test.mjs
node scripts/build-precache.mjs --check
node scripts/check-repository-hygiene.mjs
```

The extracted sphere/facet/refine30/factor replay was compared with every original retained observation: identical. The CPU control predictions are independently checked against saved real ID masks and a separate reviewer raycaster, with differences retained rather than hidden. The four scripts are current diagnostic tooling owned by this document; none is imported by production.

## Exact mesh follow-up — actual capture 519a686c, still BLOCKED

Start authority: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `24d0f0daec64279a264cd118c9b4c96a28342534`. All five existing inline review threads are resolved. The merged discussion timeline (which includes bot issue-comment receipts, unlike the reviews-only endpoint) confirms a Codex receipt for24d0f0d: comment6358835149, no major code issues. This does not certify visual acceptance. The latest-HEAD PR workflow lookup returned no runs; it is not a successful acceptance result. PR #345 remains open/unmerged and untouched.

The actual atom mesh carries a nonidentity local quaternion because `mergePolymerSourceAtoms()` uses `Group.attach()` on an existing source mesh. The historical report and original artifact12420347609 do **not** retain those quaternions. A new production capture cannot retroactively supply the historical values. This missing authority is stated explicitly, rather than replacing it with an identity assumption.

One predeclared hosted diagnostic ran on source `519a686caae48de4ff7d55e0be927bc3c2b26079`: [run39924742033](https://github.com/miyatayuuma/molecule-craft/actions/runs/39924742033), job120318249309, artifact12489405304, ZIP SHA256 `dcc1a6ed508a059c4703daf05c21dfa85734f66f96adc1b1d48c0d8fde2c497e`. It completed its diagnostic capture, **not** Task⑤ acceptance. No rerun was made. Its budget was one actual-pointer production sample, six previously saved control poses and the three previously saved anchor30 boundary poses; zero new directions or searches. All raw captures are retained in [the manifest](polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/manifest.json).

Test-server-only instrumentation records all95 actual atom/lane meshes, their local position/quaternion/scale/matrix, world matrix, material side, exact Float32 geometry attributes/indices, camera and group matrices. It then replays the frozen graph/XYZ/camera/poses while retaining the newly captured inherited local quaternions. Sphere24×16 and cylinder12 tokens match production. Captured local matrices recompose to their world matrices with max error0, and all atom centers and lane endpoints reproject with max error0 CSS px/depth. Graph equality is asserted before replay. This does not turn the replay into a real-pointer local-focus acceptance or certify its photometry.

The six control masks continue to show the original named atom/bond failures. All three saved boundary poses also fail the **actual new ID-mask** A03/A04 partial criteria:

| Saved anchor30 candidate | Actual failure with captured mesh transform |
|---|---|
| boundary0, prior best | bond33 area91px <94.474167779px; bond34 continuous7.456203238px <7.75px |
| boundary1 | C30 fraction.590563551 <.60; bond32 area64 <64.805465246px; bond33 area96 <99.436973657px; bond34 continuous7.396846102px <7.75px |
| boundary2 | bond32 area51 <53.703722902px and continuous6.969204562px; bond34 continuous7.373731857px <7.75px |

Thus the prior91px/7.456px boundary was not rescued by using actual inherited sphere quaternions. It is now independently observed in an actual raster of that retained pose, without promoting CPU output to acceptance. The newly captured actual controls differ from the historical masks by.1115–.1814% of foreground union; this is consistent with differing tessellation poses, but the old quaternion is unavailable and no unique causal reconstruction is claimed.

`scripts/analyze-polymer-task5-exact-mesh.mjs` reconstructs native meshes from those captured attributes/matrices. Its fixed modes distinguish double precision, Float32 shader/depth arithmetic with an8-bit subpixel grid, and the documented4-bit legacy SwiftShader grid. Top-left edge ownership and front-face culling are included. SwiftShader's public `VkConfig.hpp` exposes both compile-time precision settings; the exact ANGLE/SPIR-V build setting was not captured, so the legacy mode remains a diagnostic hypothesis, not a certified GPU emulator. Offline corrections of those raster rules add no poses or browser executions.

The complete front-face/depth version still differs from the actual masks by1–16 pixels per image in its4-bit mode (Float64:44–73;8-bit mode:45–73). Earlier intermediate uncullled calculations reached1–5 pixels, which is **not** the final complete-raster parity result. Some target counts differ, so the predictor is **not pixel-identical and is not admitted as a formal candidate selector**. In particular, neither tiny whole-image error nor partial metric agreement at the best boundary justifies treating the CPU score as a PASS.

No generic production orientation repair is adopted. The actual boundary candidates fail, the CPU parity prerequisite remains unresolved, and the original local-quaternion authority is not recoverable from the retained JSON. The whole set of rigid poses is **not** proven impossible. No further direction sweep, conformer edit, transparency, omitted atom/bond, fixed observation quaternion or threshold change was made. The production orientation candidates, fit function, graph/XYZ/origin, chemistry, Stage B, feedback timers and PWA assets are byte-identical to the start HEAD.

The related18 geometry/observation/raster tests and the remaining17 geometry/static/resource/heap tests passed:35 PASS,0 FAIL,0 SKIP. This covers frozen PLA/PET and the canonical25final/95intermediate graph checks. Precache freshness:353 verified assets. Syntax and diff checks pass. These deterministic results do not replace formal browser, performance, Repository or FIELD gates. A fresh review request targets code checkpoint58b723747bed0ff03bb250f166b1743180684d78 (comment6361041033); its receipt remains pending at this reconciliation. The following evidence-only review-ledger correction changes no code. Receipt and exact source binding must be reconciled before any final acceptance claim.

Disposition: **Task⑤ BLOCKED / PR #354 Draft / Open / Unmerged**. Formal PIB3/3 remains0/3 in the original campaign; this follow-up is9 diagnostic rasters, not a new formal three-site campaign. A06/real local-focus/reset acceptance, all25/fixed12jobs, V0–V8/C01–C09/S10–S16, PAN4/NBR1 L1, final PF/resource/lifecycle/PWA browser checks, strict Stage B/Finite real RAF, Repository/FIELD, final independent review, merge and post-merge are NOT_RUN/NOT_CERTIFIED on this checkpoint. No Task⑤ requirement is transferred to Task⑥.

The smallest next decision is how to bind an exact tessellation authority when the historical local quaternions were never saved. The new actual capture makes every new transform observable, but does not authorize silently replacing historical evidence. Technical restart is confined to the remaining native rasterization difference on these same nine captures, including recorded material-side/depth semantics; no extra orientation search is needed to resolve that prerequisite. Only after the selector's measurements are demonstrably consistent may one generic fixed-budget orientation candidate be evaluated and then sent through the unchanged actual-pointer40-direction/one-anchor gate.

Offline replay (read-only; no new capture):

```sh
mkdir -p test-results/pib-exact-replay
python - <<'PY'
import gzip, shutil
from pathlib import Path
src=Path('docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c')
dst=Path('test-results/pib-exact-replay')
for p in src.iterdir():
    if p.name.endswith('.json.gz'):
        (dst/p.name[:-3]).write_bytes(gzip.decompress(p.read_bytes()))
    elif p.suffix=='.png':
        shutil.copyfile(p,dst/p.name)
PY
node scripts/analyze-polymer-task5-exact-mesh.mjs test-results/pib-exact-replay
```

The exact-capture helper `tests/helpers/polymer-exact-mesh.mjs` and one-shot workflow `.github/workflows/task5-pib-exact-mesh.yml` are owned by this follow-up. The workflow path filter prevents ordinary evidence/checkpoint changes from starting another browser diagnostic. They are test tooling and are not imported by production.
