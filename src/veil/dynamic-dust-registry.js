// Simulation ownership only; camera visibility and availability are unrelated.
// References point to canonical map.dust objects and never enter saved data.
const registries=new WeakMap();
export function dynamicDustRegistry(map){
  let cached=registries.get(map);
  // Composition boundaries may replace/append dust (Nitrogen and test stress).
  // Same-array reordering/property edits must explicitly invalidate the registry.
  if(!cached||cached.dust!==map.dust||cached.length!==map.dust.length){
    const seen=new Set(),particles=[];
    for(const dust of map.dust)if((dust.vortex||dust.flow)&&!seen.has(dust)){seen.add(dust);particles.push(dust);}
    cached={dust:map.dust,length:map.dust.length,particles:Object.freeze(particles)};registries.set(map,cached);
  }
  return cached.particles;
}
export function resetDynamicDustRegistry(map){registries.delete(map);}
