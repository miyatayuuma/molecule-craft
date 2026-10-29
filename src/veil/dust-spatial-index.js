// Runtime-only broadphase. Availability and exact collision remain engine-owned.
export const DUST_CELL_SIZE=128;
const indexes=new WeakMap();
export function createDustSpatialIndex(dust,{cellSize=DUST_CELL_SIZE}={}){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid dust cell size');
  const cells=new Map(),records=new Map();
  const key=(x,y)=>`${x},${y}`;
  function insert(record){const k=key(record.cx,record.cy);let bucket=cells.get(k);if(!bucket)cells.set(k,bucket=new Set());bucket.add(record);}
  dust.forEach((particle,ordinal)=>{const record={particle,ordinal,cx:Math.floor(particle.x/cellSize),cy:Math.floor(particle.y/cellSize)};records.set(particle,record);insert(record);});
  function update(particle){
    const record=records.get(particle);if(!record)throw Error('Unindexed dust particle');
    const cx=Math.floor(particle.x/cellSize),cy=Math.floor(particle.y/cellSize);if(cx===record.cx&&cy===record.cy)return false;
    const k=key(record.cx,record.cy),bucket=cells.get(k);bucket.delete(record);if(!bucket.size)cells.delete(k);record.cx=cx;record.cy=cy;insert(record);return true;
  }
  function queryAabb(left,top,right,bottom,stats){
    const candidates=[];
    // Include cells touching the closed envelope; exact checks discard extras.
    for(let cy=Math.floor(top/cellSize);cy<=Math.floor(bottom/cellSize);cy++)for(let cx=Math.floor(left/cellSize);cx<=Math.floor(right/cellSize);cx++){
      const bucket=cells.get(key(cx,cy));if(bucket)for(const record of bucket)candidates.push(record);
    }
    if(stats)stats.cellsVisited+=(Math.floor(bottom/cellSize)-Math.floor(top/cellSize)+1)*(Math.floor(right/cellSize)-Math.floor(left/cellSize)+1);
    candidates.sort((a,b)=>a.ordinal-b.ordinal);return candidates.map(record=>record.particle);
  }
  return {cellSize,update,cellOf:particle=>{const record=records.get(particle);return record?{x:record.cx,y:record.cy}:null;},queryAabb,queryCircle:(x,y,r)=>queryAabb(x-r,y-r,x+r,y+r),querySegment:(a,b,r)=>queryAabb(Math.min(a.x,b.x)-r,Math.min(a.y,b.y)-r,Math.max(a.x,b.x)+r,Math.max(a.y,b.y)+r)};
}
export function resetDustSpatialIndex(map){indexes.delete(map);}
export function dustSpatialIndex(map){
  let cached=indexes.get(map);
  // Population is composed before flight. Explicit array replacement/addition is
  // supported without a per-slice population scan; ordinals always follow it.
  if(!cached||cached.dust!==map.dust||cached.length!==map.dust.length){cached={dust:map.dust,length:map.dust.length,index:createDustSpatialIndex(map.dust)};indexes.set(map,cached);}
  return cached.index;
}
export function updateDustSpatialMembership(map,dust){return indexes.get(map)?.index.update(dust);}
