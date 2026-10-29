import {createMoleculeGraph,getFrontierCandidates,scoreFrontierCandidates,selectFrontierCandidate,createSeededFrontierRng} from '../src/molecule-graph.js';

export function makeGraph({nodes,edges,roots=[]}){
  const families=[...new Set(nodes.map(node=>node.family??'test'))],branchNames=[...new Set(nodes.flatMap(node=>node.branches??[]))];
  const familyIndex=new Map(families.map((name,index)=>[name,index])),branchIndex=new Map(branchNames.map((name,index)=>[name,index]));
  return createMoleculeGraph({
    schemaVersion:1,graphRoots:roots,
    familyCodes:Object.fromEntries(families.map((name,index)=>[index,name])),
    branchCodes:Object.fromEntries(branchNames.map((name,index)=>[index,name])),
    nodeColumns:['id','familyCode','roleCodes','depth','tier','sectorCode','affinities','branchCodes','connectionEdgeIndexes'],
    nodes:nodes.map(node=>[node.id,familyIndex.get(node.family??'test'),'B',node.depth??1,node.tier??1,0,node.affinities??'',(node.branches??[]).map(name=>branchIndex.get(name)),[]]),
    edgeColumns:['from','to'],edges,
  });
}

export function expandGraph(graph,{initial=graph.roots,seed=1,region=null,limit=Infinity}={}){
  const discovered=new Set((initial??[]).filter(id=>graph.nodeById(id))),rng=createSeededFrontierRng(seed),selected=[];
  while(selected.length<limit){
    const candidates=getFrontierCandidates(graph,{discoveredIds:discovered});
    const scored=scoreFrontierCandidates(graph,candidates,{discoveredIds:discovered,region});
    const choice=selectFrontierCandidate(scored,{rng});if(!choice)break;
    discovered.add(choice.id);selected.push(choice);
  }
  return {discovered,selected};
}

export function expansionSummary(selected,count){
  const rows=selected.slice(0,count),depths=rows.map(row=>row.depth),branches=new Set(rows.flatMap(row=>row.branchKeys)),families=new Set(rows.map(row=>row.family).filter(Boolean));
  return {count:rows.length,branchCount:branches.size,familyCount:families.size,maxDepth:depths.length?Math.max(...depths):0,meanDepth:depths.length?depths.reduce((a,b)=>a+b,0)/depths.length:0,shallowCount:depths.filter(depth=>depth<=3).length,deepCount:depths.filter(depth=>depth>=4).length};
}

export function sampleIds(scored,{seed=1,count=1000}={}){const rng=createSeededFrontierRng(seed),counts=new Map();for(let i=0;i<count;i++){const picked=selectFrontierCandidate(scored,{rng});if(picked)counts.set(picked.id,(counts.get(picked.id)??0)+1);}return counts;}
