# Molecule Craft repository guide

## Context efficiency

- Do not read the whole repository when starting a task.
- Read `docs/architecture.md` first and use its task map to select the owning files.
- Read the target files and their direct imports only.
- Expand to adjacent modules only when a verified dependency or failing test requires it.
- Inspect Git history, old pull requests, and old issues only for a specific regression or cause investigation.

## Large files

- Do not load all of `data/molecules.json` for ordinary exploration, UI, physics, input, or PWA work.
- For molecule DB work, search for the target molecule or field and inspect only the necessary records whenever possible.
- Normally do not read `vendor/`, generated `assets/models/*.svg`, `precache-manifest.js`, generated files, or large fixtures.
- Read those files only when the task directly concerns the dependency, generated output, offline asset set, or fixture.

## Scope rules

- Exploration changes: start with the relevant files under `src/veil/`; do not open molecule data unless the change concerns recipes or molecule roles.
- Craft inventory, atom actions, controls, and panel changes: start with the owning `src/craft-*.js` module named in `docs/architecture.md`; open `src/app.js` only when the change crosses into Three.js integration or startup.
- Collection changes: start with `src/collection-*.js`, `src/functional-groups.js`, and only the required data records.
- PWA changes: start with `src/pwa.js`, `sw.js`, `scripts/build-precache.mjs`, and `tests/pwa.test.mjs`.
- Preserve current gameplay, saved-data compatibility, and offline behavior unless the task explicitly changes them.

## Execution authority

- Work is pre-authorized to carry repository tasks through completion without asking the user for permission or confirmation at intermediate steps.
- Do not ask whether to inspect required files, edit code, refactor within the requested scope, regenerate required outputs, run relevant tests, fix regressions caused by the task, commit, push, create a pull request, or merge to `main`.
- When implementation details are not specified, make the smallest reasonable decision that satisfies the requested behavior and preserves existing behavior outside the task instead of asking for approval.
- Do not stop to present a plan for approval. Investigate only as much as needed, implement, validate, and finish the task.
- Do not perform unrelated destructive changes. If authentication, branch protection, platform policy, or a tool limitation makes an authorized step impossible, report that concrete blocker rather than asking whether to proceed.

## Task completion

- Work implementation tasks are pre-authorized through completion: implement the requested change, run only the relevant tests, commit, push, create a pull request, and merge it into `main` when checks pass.
- Do not stop for separate approval before commit, push, pull-request creation, or merge unless the task explicitly says to stop earlier or not to merge.
- Do not re-read the repository, rerun unrelated tests, or repeat completed investigation only to prepare commit / PR / merge operations.
- Finish the full implementation-to-merge sequence in the same task whenever possible so a follow-up request such as `commit`, `push`, `create PR`, or `merge` is unnecessary.

## Generated files

- Do not edit generated outputs directly.
- `scripts/build-molecule-db.mjs` generates `data/molecules.json`.
- `scripts/build-collection-assets.mjs` generates `assets/models/*.svg`.
- `scripts/build-precache.mjs` generates `precache-manifest.js`.
- Change the source or generator, regenerate, then run the matching tests.
- Regenerate the precache last after any runtime asset changes.

## Repository hygiene

- The only application entrypoint under `src/` is the fixed name `src/app.js`.
- Do not add version-numbered entrypoints such as `src/app-v*.js`.
- Do not keep historical implementations as copied code in `legacy/`, `archive/`, `old/`, `backup/`, or similarly named paths.
- Do not duplicate source files to record change history. Use Git history.
- Keep README focused on the current app; do not append release-by-release implementation logs.
- Keep this file and `docs/architecture.md` short and operational.
- Run `node scripts/check-repository-hygiene.mjs` and the relevant tests before committing.
