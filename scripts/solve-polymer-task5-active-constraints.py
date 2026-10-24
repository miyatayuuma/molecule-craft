"""Owner: Task5 model-consistency ledger. One seed gate then fixed2 slots."""
import gzip
import importlib.util
import json
import sys
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('pixel_exchange', Path(__file__).with_name('solve-polymer-task5-pixel-exchange.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def run(directory):
    assert not (directory / 'candidates.json').exists(), 'No candidate reruns'
    assert not (directory / 'active-zero-delta-solver.json').exists(), 'No seed solver reruns'
    data = json.loads(gzip.decompress((directory / 'active-model.json.gz').read_bytes()))
    protocol = data['protocol']
    consistency = json.loads((directory / 'active-seed-membership.json').read_text())
    assert all(not r['falseNegatives'] and not r['falsePositives'] for r in consistency['consistency'])
    m, areas, runs = module.construct(data, 0, 26, 0, disabled_area=[1057], disabled_continuity=[34])
    t = time.monotonic()
    result = m.solve(dict(protocol, MILPTimeLimitSecondsPerSlot=10))
    fixed = dict(kind='CORRECTED_ACTIVE_MODEL_ZERO_DELTA', status=int(result.status), message=result.message,
                 seconds=time.monotonic()-t, hasIncumbent=result.x is not None, variables=len(m.lo), constraints=len(m.rows),
                 deltaDegrees=result.x[:3].tolist() if result.x is not None else None, areas=areas, continuity=runs)
    (directory / 'active-zero-delta-solver.json').write_text(json.dumps(fixed, indent=2)+'\n')
    print(json.dumps({'seedGate': fixed}), flush=True)
    assert result.status == 0 and result.x is not None, 'MODEL_INVALID; no active solves permitted'
    rows = []
    for radius in protocol['trustBoxesDegrees']:
        for n in protocol['bond34StepBranches']:
            t = time.monotonic()
            m, areas, runs = module.construct(data, radius, n, 0)
            result = m.solve(protocol)
            row = dict(name=f'active-r{radius}-n{n}',radius=radius,steps34=n,surplus=0,
                       solver=dict(status=int(result.status),message=result.message,variables=len(m.lo),constraints=len(m.rows),seconds=time.monotonic()-t),
                       areaConstraints=areas,hasIncumbent=result.x is not None)
            if result.x is not None:
                row.update(deltaDegrees=result.x[:3].tolist(),rotationDegrees=[s+float(d) for s,d in zip(data['seed'],result.x[:3])],
                           continuityWitnesses=[{'index':r['index'],'branches':[{'n':b['n'],'hits':[j for j,h in enumerate(b['hits']) if result.x[h]>.5]} for b in r['branches'] if result.x[b['branchVariable']]>.5]} for r in runs])
                residuals = [sum(terms.get(i,0)*result.x[i] for i in terms) for terms in m.rows]
                row['maxConstraintViolation'] = max([0]+[max(lo-v,v-hi) for lo,v,hi in zip(m.lower,residuals,m.upper)])
            rows.append(row)
            with (directory / 'candidate-history.jsonl').open('a') as f:
                f.write(json.dumps(row)+'\n')
            print(json.dumps(row), flush=True)
    assert len(rows) == protocol['candidateSlots']
    (directory / 'candidates.json').write_text(json.dumps({'kind':'MINIMAL_AFFINE_PROPOSALS_NOT_PROOF','rows':rows},indent=2)+'\n')

if __name__ == '__main__':
    run(Path(sys.argv[1]))
