# FIELD Hazard Authority

This document records the production responsibility split used by `src/veil/hazards.js`.

## Environmental hazards

| Production source | Type | Subtype | Notes |
| --- | --- | --- | --- |
| Veil ambient force field | mechanical | turbulence | Radial force field; spatial falloff is shared with its visual envelope. |
| H/C revisit currents | mechanical | turbulence | Route-local continuous current; authored route remains the geometry authority. |
| BURST advantage fields | mechanical | shear | Compact directional shear fields. |
| Oxygen route pressure | mechanical | pressure | Includes standard route pressure and localized shortcut gates. |
| Expedition pulse challenge | mechanical | pressure | Organic corridor envelope over authored challenge geometry. |
| Expedition curve challenge | mechanical | pressure + shear | Pressure and lateral flow share one seeded influence envelope. |
| Oxygen vortex | mechanical | vortex | Autonomous FIELD environment, not an agent. |
| Oxygen thermal route / belt / frontier wall | thermal | hot-zone | Existing coolant/heat behavior remains the gameplay authority. |
| Thermal challenge | thermal + mechanical | hot-zone + pressure | Heat and pressure coexist in the same authored region. |
| Nitrogen DRIVE channel | mechanical | pressure + shear | Two overlapping opposing flows and a localized steering shear use spatial falloff. |
| Nitrogen PULSE lip | mechanical | shear | One compact burst-advantage field; ordinary movement can skirt its edge. |
| Nitrogen Core approach | thermal + mechanical | hot-zone + pressure + turbulence | Heat and pressure overlap before the fixed Core landmark. |

The taxonomy also defines `abrasive / particle-stream` and `electrical / arc|charged-region`. No production zone is created for those types in this foundation task.

## Not environmental hazards

| Responsibility | Production examples | Reason |
| --- | --- | --- |
| Agent | Dust Eater | Autonomous pursuit/capture behavior is owned by the expedition agent system. |
| Static/world structure | route geometry, landmarks, carbon clusters | Geometry/collectibles do not become hazards merely because they occupy FIELD space. |
| Resource | H/C/N/O dust | Collectible particles are not abrasive hazard authority. |
| Progression mechanism | Normal Insight, Critical Insight, route unlock, destination, challenge completion | These own progression/telemetry, not local physical environment. |
| Settlement | pickup/return/forced-loss lifecycle | Resource persistence is separate from hazard physics. |

## Contract

A local hazard sample exposes:

- `id`
- `type`
- `subtype`
- `intensity` normalized to 0..1
- `severity` in the source mechanic's existing game units
- optional force vector / heat information
- `spatial: true`

`run.currentHazards` is the future equipment integration boundary. Equipment may later inspect stable top-level types such as `thermal` or `mechanical`; FIELD definitions intentionally contain no molecule or upgrade knowledge.

## Organic boundary rules

Authored centers, route relationships, nominal widths, safe lanes, recovery locations and gate locations remain designer-owned. Organicization is applied as a deterministic envelope on top:

1. low-frequency seeded width/center variation where appropriate;
2. continuous lateral falloff;
3. soft longitudinal edge falloff for previously hard challenge/gate boundaries;
4. the same seeded profile is used by gameplay and corresponding visual presentation;
5. the world seed, not launch count, determines variation.

Localized gameplay gates keep their authored full-strength core. Soft precursor/falloff extends only around the boundary, so route differentiation and existing BURST/DRIVE intent are preserved.
