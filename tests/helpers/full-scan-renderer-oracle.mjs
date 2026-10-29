// Test-only candidate provider. Production drawing still supplies exact checks.
export function dustSpatialIndex(map){return {queryAabb:()=>map.dust};}
export function rendererDustCandidates(map){return map.dust;}
