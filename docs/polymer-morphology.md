# Representative polymer morphology

Generated from production profiles by `node scripts/export-polymer-morphology-doc.mjs`; `--check` verifies correspondence. This table is documentation, never a runtime authority.

Five shared archetypes: ordered-domain, bulky-entangled, flexible-coils, cohesive-ensemble, connected-network.

|Polymer|Archetype|Visual signature|Scientific qualification|
|---|---|---|---|
|polyethylene|ordered-domain|Folded local domains and disordered connecting chains|Crystallization and branching depend on processing.|
|polypropylene|ordered-domain|Methyl-bearing locally folded chains|Order depends on tacticity; route does not establish tacticity.|
|ethylene-propylene-copolymer|flexible-coils|Irregular coils with intermittent methyl bulk|Composition/sequence are schematic, not an alternating copolymer claim.|
|polyisobutylene|flexible-coils|Thicker rounded coils|Uncrosslinked ensemble; no vulcanization.|
|polystyrene|bulky-entangled|Pendant ring outlines on broad persistent bends|Representative disordered PS; tacticity is unspecified.|
|polyvinyl-chloride|bulky-entangled|Small pendant markers and constrained bends|No claim of a fixed crystallinity.|
|polychlorotrifluoroethylene|ordered-domain|Thick locally folded fluoropolymer chains|Order is schematic; thermal history is unspecified.|
|polyacrylonitrile|cohesive-ensemble|Short locally associated segments with nitrile markers|PAN precursor only; no carbonization or drawn fiber.|
|polyacrylic-acid|cohesive-ensemble|Associated bent chains with acid-group markers|Association depends on hydration and ionization.|
|polyethylene-oxide|ordered-domain|Soft folds and flexible disordered bridges|Crystallinity depends on molecular weight and temperature.|
|polyethylene-terephthalate|cohesive-ensemble|Persistent aromatic spans among bent chains|No spinning/drawing; PET can be amorphous or semicrystalline.|
|polyethylene-adipate|ordered-domain|Soft folds with spaced ester markers|Representative order tendency, not a cooling simulation.|
|polylactic-acid|bulky-entangled|Methyl-bearing ester coils|Stereochemistry is unspecified; crystallinity is not asserted.|
|polyglycolic-acid|ordered-domain|Compact folds with ester rhythm|Crystallization is processing dependent.|
|phenol-formaldehyde-resin|connected-network|Branch junctions and connected depth-spanning members|Extension of the existing finite network builder; not a separate curing step.|
|polyethylene-adipamide|cohesive-ensemble|Local associated spans with amide rhythm|No fiber drawing or guaranteed crystallinity.|
|polybutadiene|flexible-coils|Fine strongly curled entangled chains|Unvulcanized; cis/trans microstructure is unspecified.|
|styrene-butadiene-copolymer|flexible-coils|Soft coils with intermittent pendant rings|Unvulcanized; schematic sequence, no imposed block order.|
|nitrile-butadiene-rubber|flexible-coils|Fine coils with intermittent nitrile markers|Unvulcanized; composition is not simulated.|
|polyisoprene|flexible-coils|Curled chains with small methyl protrusions|Unvulcanized; no cis/trans claim.|
|butyl-rubber|flexible-coils|Thick soft coils with sparse sequence accents|Unvulcanized; no sulfur links.|
|polyvinylidene-fluoride|ordered-domain|Compact folded fluoropolymer domains|No specific crystal polymorph or piezoelectric processing.|
|vinylidene-fluoride-hexafluoropropylene-copolymer|flexible-coils|Thick coils with irregular bulky interruptions|No imposed composition, crystallinity, or crosslinking.|
|polytetrafluoroethylene|ordered-domain|Persistent thick fluorinated folds|No sintering, drawing, or manufactured fibrils.|
|nylon-6-6|cohesive-ensemble|Associated amide spans joined by flexible bends|No spinning/drawing; local cohesion only.|

## Scientific basis and interpretation

Existing catalog repeat units, monomer identities and route topology provide the chemistry evidence for all profiles. Backbone rigidity, pendant bulk and schematic copolymer accents are visual grammar, not measured physical parameters. Sequence accents do not assert an alternating/block sequence. Local folded domains illustrate a possible representative organization, never a crystallization result from this route.

- [IUPAC crystalline-polymer morphology terminology](https://publications.iupac.org/pac/83/10/1831/index.html).
- [PSLC / University of Southern Mississippi: crystallinity](https://pslc.ws/macrog/crystal.htm): folded domains coexist with disordered regions; tacticity and intermolecular association matter.
- [PSLC: nylon](https://pslc.ws/macrog/nylon.htm): polar amide groups support local association.
- [PSLC: PAN](https://pslc.ws/macrog/pan.htm): PAN is a precursor to carbon fiber, not carbon fiber itself.

Rubber profiles never create crosslinks. PAN never receives carbonized/drawn-fiber geometry. PET/nylon show limited local association among bent chains, not manufactured fibers. PF alone extends the existing finite network-builder topology.

## Production boundary and rendering

Finite chemistry remains in `reaction-lab-polymerization.js`. The viewer registers the existing Sample immediately on success, waits for the final finite graph transform, then creates `reaction-lab-polymer-cinematic.js`. Its shared, DOM/Three-independent plan comes from `polymer-morphology.js`. No Feed replenishment, molecular body, inventory or persistence field is added.

The presentation clock is the existing visible/open Lab tick, clamped to 50 ms per frame. Bulk feed → scale-out → ensemble growth → morphology hold → collapse precede the existing Sample Bay dock/hold and presentation-ready event. Normal cinematic lasts 5.1 seconds of accepted visible time; reduced motion lasts 1.48 seconds and retains a 650 ms final morphology hold, with no camera travel or circulating feed. Close cancels and releases the temporary visualization, preserves the finite registered Sample and existing dismissal semantics; reopen proceeds to Sample Bay. Next Feed, clear and dispose also release it and restore camera distance. Hidden tabs pause.

The renderer owns one batched tube mesh, one batched pendant-outline geometry, fixed instanced atom/bond templates and a 24-unit coarse feed pool. Linear ensembles contain 32 precomputed strands with 65 points each. The network contains 144 connected members among 64 shared junctions. Counts do not depend on duration. Shared geometries/materials are disposed exactly once; ordinary idle Lab never calls cinematic update. `tests/polymer-morphology.test.mjs` counts real Three resources, checks all profiles, fixed buffer identities, network connectivity and long-duration cleanup.

## Browser and profiling tooling

`tests/reaction-lab-polymer-browser.test.mjs` retains the eight actual-pointer hard routes and adds PS for bulky amorphous coverage. It records feed, scale-out and final morphology screenshots, verifies stable hold and unchanged actual instance count, then exercises Sample Bay, discovery, Collection return and next Feed purge. Reduced motion retains morphology. `POLYMER_DESKTOP=1` selects 1280×900 rather than 390×844.

`node scripts/profile-polymer-scale-up.mjs <verified-baseline-main-SHA>` runs three paired mobile baseline/task passes plus desktop. `tests/helpers/polymer-profile-instrumentation.mjs` temporarily instruments both viewers identically and is removed in a finally block. Raw update/render-preparation/frame-interval samples and phase labels are retained in the CI artifact. Clock values are diagnostic, not CI thresholds; deterministic counts are hard gates.
