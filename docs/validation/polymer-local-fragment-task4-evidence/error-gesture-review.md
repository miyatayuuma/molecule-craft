# Task④ failed-display gesture boundary — independent delta review

Verdict: **Approve the reviewed source fix for publication and normal CI. No remaining unguarded ready-only polymer fit dereference was found.** Actual browser execution on this new source is still required before claiming its gesture regression test PASS.

Reviewed SHA256:
- src/reaction-lab-viewer.js: `776d8772f3100b5077be751564e059f48a83f0936faf734dc9d910e59520469b`
- tests/reaction-lab-polymer-browser.test.mjs: `c31213d22c7be52eb42f562e4935db2f928783035ef0100364cc4d1f82635920`

## Defect and repair

A committed Sample can reach ready while its safe display-error placeholder has no layout plan or fit. The former wheel and orbit-pinch paths checked ready plus visual existence, then dereferenced presentation.fit.maxZoomFactor/scale. That readiness condition certified chemistry/feedback completion, not an observable geometry, so the GitHub review finding is correct.

The new canObservePolymerSample predicate requires all of ready, fit, layoutPlan, no displayError and not suspended. Both orbit admission and orbit movement/pinch use it; wheel additionally exits on displayError, keeping the Lab camera unchanged in that state. Error-state pointerdown exits before adding/capturing pointers. The test probe now reports observation active through the same predicate. These conditions preserve the ordinary accepted-sample controls while preventing the missing-fit dereference.

## Adjacent ready/fit audit

- Audited all ready-only and fit-reference paths in the viewer.
- Reset's existing handler independently checks presentation.ready, visual existence and fit before reading fit.position/quaternion/scale; no missing-fit dereference remains there.
- Initial completion fitting already checks the local fit before applying transforms.
- Encyclopedia opening uses ready as a chemical/discovery condition and never dereferences fit; retaining access after a display failure is safe.
- Completion readiness, rack locking and display status do not read fit fields without guards.
- Pointer release removes existing orbit/active pointer state independently of fit validity. Existing failure disposal clears observation pointers.
- The unrelated Stage B velocity-fit local variable has its own fit.finite contract and is outside this polymer change.

## Verification and scope

Independently ran syntax checks for both changed files and git diff --check: PASS. No experiment, browser run or performance measurement was started by this review.

The added failure QA sends actual CDP mouse wheel and a two-touch pinch over the failed completed display, then checks no runtime exception, no active pointer, unchanged Lab camera distance, observation inactive and the same actual sample ID. Existing ordinary observation tests continue to cover successful orbit/pinch/reset. The test is meaningful for the reported bug; its actual hosted result on this source remains pending.

The fix changes input/error guards and probe state only. It does not alter geometry, reaction graphs, chemistry, saved data, performance thresholds or measured fixed-step algorithms. The parent's reported later a6 Stage B PASS was not independently inspected in this delta review. The original retained Stage B failure remains evidence; no claim that this gesture repair explains or repairs performance is made. Latest-source CI and all required gates remain the final acceptance authority.
