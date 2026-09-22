# Post-Core Rare ecology authority

Rare ecology is a managed-resource extension of FIELD, active only when both World Awakening and `rareEcologyEligible` are committed for the expedition launch.

## Geographic identity

| FIELD area | trace element | replaced resource socket |
| --- | --- | --- |
| H / Veil | P | H |
| Carbon | S | C |
| Oxygen / Frontier | F | O |
| Nitrogen | Cl | N |

The ecology replaces a small deterministic subset of existing resource sockets. It does not create anomaly sites, scan interactions, specimen cargo, claimed flags, objective markers, or a second settlement path.

## Determinism

Resource sockets have stable authored/derived keys. Rare selection uses a fixed ecology world seed plus the socket key, not the expedition launch seed. Selected Rare particles use the stable socket coordinate even where ordinary particles retain launch-seeded visual jitter.

## Inventory suppression

Each element owns centralized parameters in `src/veil/rare-ecology.js`: base density, replacement ceiling, reserve target, suppression onset, density floor and curve. Availability is computed independently per element.

Effective held amount is BASE stock plus current-run cargo. Materialized particles are not removed when cargo rises; after pickup, the same suppression authority determines whether that socket can respawn and how long its respawn takes. Lowering BASE stock on a later expedition restores density.

These values are FIELD balance parameters only. They do not define future DOCK treatment chemistry or treatment cost.

## Lifecycle

P/S/F/Cl are part of `MANAGED_ELEMENTS`. They use the standard particle contact, `elementDust`, normal-return settlement, capture-loss and BASE STOCK authorities. Rare-containing Graph/Insight progression remains separate: resource ownership alone does not enable late-game molecule progression.

Rare Element Ecology uses `kind:'rare-element'` plus `rareEcology:true`. The former high-value/ringed H particle is retired; any supplemental H position is an ordinary `element:'H'`, `kind:'normal'` resource with normal value and settlement behavior.
