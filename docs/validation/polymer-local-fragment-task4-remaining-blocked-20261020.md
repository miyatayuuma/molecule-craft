# Task④ remaining-guardrail recovery — BLOCKED (2026-10-20)

## Fixed authority and outcome

Start/final main: `37b7d2cde1e60cd28575784a252382f4599c391f`.
PR351 source: `0036e0f68f8fcce863d05fe2073950ad15461642`, OPEN / UNMERGED.
PR345 is unchanged/open at `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`.

FIELD's missing readiness/input-observation contract has a reviewed repair with successful desktop/mobile browser regression, held separately at `1378aa30f77723db2e2553685fe508f5c0e71757` on `repair/task4-field-confirmation-contract`. It is **not integrated into PR351**. Finite is narrowed to GPU presentation wait during the instrumented missing frames; the underlying GPU/driver/OS-scheduling cause is not isolated, so no speculative production repair is selected. Neither required failure is replaced by a separate PASS.

No production source, geometry, graph/origin/identity, baseline, comparator, threshold, real RAF, StageB workload or650/250ms feedback duration changed in this campaign. Every hosted diagnostic/regression job verifies production files against0036. No new ordinary performance acceptance was run. Main was not merged; post-merge/PWA acceptance was not executed.

## FIELD evidence and repair

Previous Repository run39251826296/job118057240204 failed at material progression line243: partialPanel.hidden=false, Supply open, FIELD hidden, browserErrors empty. Source-wide writer analysis confirms only showPartialConfirm makes the panel visible; the production confirmation click immediately hides it and commit failure/update does not re-show it. Thus the intended confirmation activation had not completed after the final display, or a later PARTIAL request re-showed it. The old log cannot distinguish an omitted tap, a missed click, or reissue; **smooth scrolling is not proven as the old cause**.

Frozen diagnostic run39351928250 observes trusted native click → production partial handler → commit successfully. DOM/hit observation may force layout, so that success does not prove the old defect absent.

The minimal test repair removes the arbitrary100ms delay and waits for actual PARTIAL or FIELD state. Both initial and persisted-shell launches use an exposed intended target, one native click with hit verification, and a same-dispatch observer registered after the production listener. It asserts trusted/correct target/button0 and synchronous panel.hidden=true, then Supply closure and visible running FIELD. No retry loop clicks or DOM.click substitutes are added.

[Regression run39353360567](https://github.com/miyatayuuma/molecule-craft/actions/runs/39353360567), job118402467300: desktop1280×900 and mobile390×844 both body/cleanup PASS. All four confirmation boundaries are trusted/correctTarget/partialHidden=true with button0; actual FEED/four polymer routes/fabrication/toggles/reload/FIELD cache/effects pass with no browser/local-asset errors. Independent reviewer audited raw logs. This remains branch-level regression evidence, not a PR351 Repository PASS.

To integrate later, apply only the test diff from1378 into existing PR351; omit its one-off push workflow. Do not create a duplicate Task④ implementation PR.

## Finite boundary isolation

The old required failure remains390normal: candidate5 intervals>25ms versus baseline2, unchanged allowance3. Candidate maximum33.4ms passed its75.15ms magnitude bound. All40 old trials and failed-source history remain in the parent evidence authority.

All40 new diagnostic rows are separately retained by run:20 in39351928250,10 baseline rows in39352734608,10 candidate rows in39353100047. Each batch preserves normal/reduced first warm-up plus four trials. They are instrumented diagnostics, never pooled into acceptance or substituted for the old run.

Initial observation confirms the old five gaps were near completion start; snapshot output is larger on candidate, but measured synchronous snapshot generation does not support it as the principal cause. The initial trace omitted main RunTask/GPU attribution; that measurement deficiency was explicitly reported and corrected once. Correction run39352734608 collected baseline but failed candidate's category-catalogue precondition before manual/completion measurement. That instrumentation FAIL and complete raw log are preserved. A candidate-only capture39353100047 records the catalogue before tracing, requests explicit protocol patterns and validates actual renderer-main RunTask after saving. It executes the previously unmeasured candidate part; no baseline/FIELD retry.

All five corrected normal candidate traces include actual renderer-main tasks. Instrumented measured gaps are six, plus two warm-up gaps excluded from measured statistics. Every gap overlaps a GPU presentation span (`SkiaOutputSurfaceImplOnGpu::SwapBuffers` / Graphics.Pipeline post-submit), while no long renderer-main CPU task explains the gap.

| Candidate measured trial | RAF interval relative to sample (ms) | GPU SwapBuffers interval (ms) | Wall / thread CPU (ms) |
|---|---|---|---|
|1|64.5–131.3|63.210–133.163|69.953 /0.556|
|1|131.3–164.5|139.733–162.026|22.293 /0.525|
|1|214.6–247.9|228.731–250.470|21.739 /0.529|
|2|39.8–73.1|54.009–82.147|28.138 /0.503|
|3|120.1–153.4|130.950–150.764|19.814 /0.497|
|4|60.6–94.0|72.688–91.730|19.042 /0.485|

Separately, canvas368×609→368×570 (warm-up574) causes actual height-setter/WebGL command-buffer waits. Candidate trial1 height setter is42.1ms; that precedes the counted64.5–131.3ms interval. Baseline also shows both resize waits and later GPU presentation waits. Therefore **resize is not established as the cause of all counted gaps**, and neither snapshot nor geometry optimization is justified by this evidence.

RAF offsets in the table are reconstructed from the profile's rounded browser timestamps; CPU/wall spans are direct trace values linked by user-timing anchors and pid/tid. Node/browser clocks are not subtracted; shared request IDs only associate protocol requests. renderer.scheduler is not Linux scheduler evidence. The GPU/driver/OS-scheduler cause inside presentation wait remains unknown. These instrumented observations do not directly prove the cause of the old uninstrumented five intervals.

## Preserved geometry, release and performance authority

The prior strict release-boundary repair remains unchanged: exact XYZ zero and matching identity/ownership at trusted pointerup; later normal physics is separate. Existing blur/cancel/close contracts remain intact. No new runtime fix was needed or claimed here.

Existing0036 geometry all25 PASS is retained, not re-measured this campaign: maximum bond0.006146543008233696world, angle6.468591961469741degrees, plane0.06486308344375737world, severe overlaps0. Chemical graph/origin/sample identity, fallback/re-FEED and75 projections remain byte-preserved by runtime identity.

Required CI authority remains:
- Repository39251826296 FAIL; candidate StageB PASS (trials4.7/4.7/5.5/4.5ms, pooled4.6), baseline control and downstream PWA/whitespace SKIPPED.
- Finite39251826085 FAIL; other three conditions/pointer/integrated E2Es PASS, resource/Collection/offline SKIPPED.
- Dedicated StageB118057239621 PASS: baseline pooled6.2ms/candidate6.0ms, unchanged absolute/relative gates.
- FIELD39251826033 PASS desktop/mobile, no substitution for Repository failure.
- Initial/intermediate/diagnostic failures,0f dedicated passes, geometry solve-P95 tail increase and PR345 independent unresolved history remain in the unmodified parent authority. No blanket performance PASS.

## Review, evidence and bounded next step

Independent reviewer found and verified correction of failed-trial capture, native RAF receiver and request correlation defects before measurement. Final raw FIELD logs and all corrected normal traces were independently audited. No major reporting/code finding remains; BLOCKED disposition is supported.

The campaign explicitly records one initial diagnostic, one coverage correction (candidate preflight FAIL), one completion of that unexecuted candidate capture, and one FIELD repair regression (two viewports). There are zero new ordinary acceptance synchronizations and zero unchanged-source favorable-gate retries. No further silent diagnostic expansion.

The evidence directory contains full decoded logs for all four jobs, all40 diagnostic rows, complete observations for all10 corrected normal trials, analysis and a manifest. Completion-window trace retention uses all10 trials including warm-ups and a fixed whole-completion window (100ms before registration through max(target/completion/last frame)+150ms); metadata is retained and no trial is selected by outcome. Full original ZIPs were independently SHA256-verified for the three diagnostic artifacts; full-trace hashes/byte counts and artifact IDs are recorded. FIELD artifact digest is GitHub-reported, not independently downloaded. Original workflow artifacts have30-day retention; the durable trace archive explicitly contains the relevant completion windows, not all pre-trial trace traffic or screenshots.

The trace gzip is stored as14 ordered binary parts. Concatenate them and verify its compressed SHA256 before decompressing. All22 uploaded evidence blobs were checked against local Git blob hashes; all14 parts reconstructed the expected gzip containing10 trial windows. No whitespace normalization of decoded raw logs is performed.

Minimal resume:
1. Keep0036 and the old required FAIL authoritative; FIELD repair1378 is ready for integration at the next justified PR synchronization.
2. Use the retained GPU presentation spans to distinguish actual graphics work/driver blocking from host scheduler stalls. Do not infer a resize or snapshot cause, relax thresholds/flags, or rerun unchanged source seeking PASS. Further measurement needs a new explicitly bounded, discriminating experiment.
3. Only after a demonstrated repair, reconcile latest main, integrate into PR351, run ordinary Repository/FIELD/Finite/StageB plus relevant geometry checks, independently review, merge when all conditions hold, and verify post-merge main/PWA.

Task⑤ receives no new merged production authority. The geometry API `createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId})` and its evidence remain fixed at0036. Task④ remains **BLOCKED**.
