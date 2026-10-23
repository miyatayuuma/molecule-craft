"""Owner: Task5 model-consistency ledger. Algebraic checks, no solver/raster."""
import gzip
import importlib.util
import itertools
import json
import math
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('pixel_exchange', Path(__file__).with_name('solve-polymer-task5-pixel-exchange.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def residual(model, x):
    return max([0]+[max(lo-sum(x[i]*c for i,c in row.items()),sum(x[i]*c for i,c in row.items())-hi) for row,lo,hi in zip(model.rows,model.lower,model.upper)])

def fixed_witness(data):
    m,_,_ = module.construct(data,0,26,0,disabled_area=[1057],disabled_continuity=[34])
    x = [0.0]*6+[1.0]*(len(m.lo)-6)
    # At delta=0 only logical choice/hit/run binaries remain. Starting at all1,
    # remove choices forbidden by fixed affine rows, then propagate run<=hit
    # and hit<=sum(choices). This is an independent monotone assignment, no MILP.
    for iteration in range(len(x)):
        changed = False
        for row,lo,hi in zip(m.rows,m.lower,m.upper):
            value = sum(x[i]*c for i,c in row.items())
            if value < lo-1e-9:
                negative = [i for i,c in row.items() if i>=6 and c<0 and x[i]]
                if len(negative)==1:
                    x[negative[0]]=0;changed=True
            elif value > hi+1e-9:
                positive = [i for i,c in row.items() if i>=6 and c>0 and x[i]]
                if len(positive)==1:
                    x[positive[0]]=0;changed=True
        if not changed:
            break
    violation = residual(m,x)
    assert violation < 1e-8, violation
    assert all(lo<=v<=hi for lo,v,hi in zip(m.lo,x,m.hi))
    return dict(kind='INDEPENDENT_ZERO_DELTA_PRIMAL_NO_SOLVER',variables=len(x),constraints=len(m.rows),maxViolation=violation,x=x)

def checks():
    truth_rows=0
    for kind in ('ge','le'):
        for gradient in ([1.2,-.5,.3],[-2,1,0],[0,0,0]):
            f=dict(value=.27,gradient=gradient)
            for threshold in (-.5,.2,.5):
                m=module.Model(.7);binary=m.var(integer=True)
                getattr(m,'implies_'+kind)(binary,f,threshold)
                for delta in itertools.product((-.7,0,.7),repeat=3):
                    value=f['value']+sum(d*g for d,g in zip(delta,gradient))
                    for active in (0,1):
                        x=list(delta)+[0,0,0]+[active]
                        row=m.rows[-1];v=sum(x[i]*c for i,c in row.items())
                        satisfied=m.lower[-1]-1e-12<=v<=m.upper[-1]+1e-12
                        expected=(not active) or (value>=threshold-1e-12 if kind=='ge' else value<=threshold+1e-12)
                        assert satisfied==expected,(kind,delta,active,value,threshold)
                        truth_rows+=1
    # Existential OR clauses must accept either valid depth/coverage branch,
    # reject when both fail, and require a selected area witness. Enumerate the
    # tiny binary system directly, avoiding any solver dependency in this check.
    synthetic = dict(protocol={'proposalClearancePixels':0},objects=[dict(id=1,kind='atom',index=0,
        required=dict(value=.5,gradient=[0,0,0]),cells=[dict(x=0,y=0,annotationBoundary=False,
        conditions=[dict(value=1,gradient=[0,0,0])],disjunctions=[[
        dict(value=-.2,gradient=[1,0,0]),dict(value=-.2,gradient=[-1,0,0])]])])],continuity=[])
    m,_,_=module.construct(synthetic,1,26,0)
    or_cases=[]
    for dx in (-1,-.2,0,.2,1):
        feasible=any(residual(m,[dx,0,0,abs(dx),0,0]+list(bits))<1e-9
                     for bits in itertools.product((0,1),repeat=len(m.lo)-6))
        assert feasible==(abs(dx)>=.2)
        or_cases.append(dict(deltaX=dx,feasible=feasible))
    # ceil branch and interval count are checked at boundaries, independently
    # of MILP enumeration; no fixed old screen cells are used.
    ceil_rows=[]
    for L in (12.956049664164484,13,13.0001,13.078125,13.08):
        n=math.ceil(2*L);intervals=math.ceil(7.75*n/L)
        assert intervals*L/n>=7.75-1e-12
        assert (intervals-1)*L/n<7.75
        ceil_rows.append(dict(length=L,steps=n,requiredHits=intervals+1))
    return dict(implicationTruthCases=truth_rows,depthOrCases=or_cases,ceilCases=ceil_rows,solverCalls=0,rasters=0)

if __name__=='__main__':
    root=Path(sys.argv[1]);result=checks()
    old=json.loads(gzip.decompress((root/'pib-pixel-exchange-a664c1da/model.json.gz').read_bytes()))
    active=json.loads(gzip.decompress((root/'pib-active-constraints-8227174d/active-model.json.gz').read_bytes()))
    result['oldSeedWitness']=fixed_witness(old)
    result['activeSeedWitness']=fixed_witness(active)
    print(json.dumps(result))
