// Test-only candidate provider; production has no all-dust fallback.
export function dustSpatialIndex(map){return {queryCircle:()=>map.dust,querySegment:()=>map.dust};}

export function resetDustSpatialIndex(){}
