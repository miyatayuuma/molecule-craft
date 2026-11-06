import {moleculeBasicProperties} from './molecule-basic-properties.js';

export const COMPARISON_AXES=Object.freeze({
  molarMass:{label:'モル質量',unit:'g/mol'},
  atomCount:{label:'原子数',unit:'個'},
});

// Values come exclusively from the same calculation used by the molecule
// detail table. A missing science value is not a player-undiscovered bead.
export function buildComparisonRows(records,{axis='molarMass',discoveredIds=new Set()}={}){
  if(!Object.hasOwn(COMPARISON_AXES,axis))throw new RangeError(`Unsupported comparison axis: ${axis}`);
  const rows=[],missing=[];
  for(const record of records){
    try{
      const value=moleculeBasicProperties(record)[axis];
      if(!Number.isFinite(value))throw new RangeError('Missing basic property');
      rows.push({id:record.id,record,value,discovered:discoveredIds.has(record.id)});
    }catch{missing.push(record.id);}
  }
  rows.sort((a,b)=>a.value-b.value||a.id.localeCompare(b.id,'en'));
  return {rows,missing};
}

// Equal values touch only at their safe minimum spacing. Large gaps use a
// documented logarithmic compression; order and the underlying values do not.
export function comparisonDistance(difference,{minSpacing=76,scale=30,unit=3}={}){
  if(!Number.isFinite(difference)||difference<0)throw new RangeError('Expected a nonnegative numeric difference');
  return minSpacing+scale*Math.log1p(difference/unit);
}

export function layoutComparisonRows(rows,axis='molarMass'){
  const positions=[],spacings=[],option=axis==='atomCount'?{scale:22,unit:1}:{scale:30,unit:3};
  let x=0;
  for(let i=0;i<rows.length;i++){
    if(i>0){const difference=rows[i].value-rows[i-1].value,spacing=comparisonDistance(difference,option);x+=spacing;spacings.push(spacing);}
    positions.push(x);
  }
  return {positions,spacings};
}

export function nearestComparisonIndex(positions,coordinate){
  if(!positions.length)return -1;
  let left=0,right=positions.length;
  while(left<right){const mid=(left+right)>>1;if(positions[mid]<coordinate)left=mid+1;else right=mid;}
  if(left===0)return 0;
  if(left===positions.length)return positions.length-1;
  return coordinate-positions[left-1]<=positions[left]-coordinate?left-1:left;
}

export function comparisonValueLabel(value,axis='molarMass'){
  return axis==='atomCount'?`${value} 個`:`${value.toFixed(2)} g/mol`;
}
