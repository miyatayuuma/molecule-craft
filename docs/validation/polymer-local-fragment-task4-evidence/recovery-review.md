# Task④ recovery-path independent review

Verdict: **Approve this limited cause-backed recovery patch for ordinary CI verification. No new major issue found in the reviewed delta. Task④ remains BLOCKED by the retained strict Stage B failure and pending browser recovery confirmation.**

Reviewed source: `src/reaction-lab-viewer.js`, delta from the previously reviewed Task④ implementation. Changes are limited to `polymerCore` const→let and failed-transaction replacement within `startPurge`.

## Root cause and change

The existing Core `beginBatch` rejects any retained non-SAMPLE transaction with `polymer-transaction-active`. `sampleDismiss` clears a transaction only in SAMPLE. A source/display failure can intentionally latch a WAITING or intermediate transaction while permitting next FEED; the prior purge called sampleDismiss, so that non-SAMPLE transaction survived. This causally explains the reported initial-failure→next-FEED browser rejection.

The patch captures the source/display failure flag before clearing the old visual. Only after explicit FEED has called batch.beginFeed and entered startPurge does it replace the failed transient Core using the same existing records/routes/site-pattern factory. Normal batches continue calling the original sampleDismiss path. There is no relaxation of Core locking, reaction graph editing, chemistry validation, route inventory or persistence.

## Checks and boundary reasoning

- Reviewed all viewer references to polymerCore: callers access the lexical variable at invocation time; no stale bound method or exposed old Core handle was found.
- Old transient docking/automatic-motion/source/visual ownership is cleared by the existing purge sequence. The replacement does not continue a failed transaction or present invented chemistry.
- batch.beginFeed increments batchGeneration before startPurge. Core's local sample sequence resets when reconstructed, but sample IDs also include batchGeneration, so this recovery does not duplicate a prior sample ID in the live viewer.
- Failure flag capture occurs before polymerGraphVisual is nulled, preserving intermediate/final displayError detection. Latched source error is likewise detected. The next batch initialization clears the error fields through the existing path.
- Reset is outside generic fixed-step integration and does not add geometry solving during failed-state frames. It adds a bounded factory reconstruction only on explicit failed-batch discard.
- Existing browser fault QA already covers initial failure, no repeated solve, next FEED, actual Sample completion and final display failure recovery. Its actual pass on this patched source is still required; source inspection does not establish that browser result.
- Independently ran `node --check src/reaction-lab-viewer.js` and `git diff --check`: PASS. The reported31 local regression passes are owner-reported; this reviewer did not rerun them.

The retained run39197944147 Stage B hard/pooled-relative FAIL remains unchanged. This recovery patch is justified by a distinct observed functional failure; it is not evidence that the performance failure was noise or resolved, and does not justify changing thresholds, skipping gates or reporting CLOSED.

Reviewed viewer SHA256: `86c47c5e83a724117bcd0411ad3e5e3af15f53577db0050bcafa1f621c142451`.
