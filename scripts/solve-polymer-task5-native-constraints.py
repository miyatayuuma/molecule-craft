"""Owner: Task5 native projection ledger. New fixed two native-constraint slots.

Not an old affine MILP rerun or a direction sweep. The executable predicates
recompute all native triangle, quantization, Float32, floor and ceil branches at
every pose; COBYLA receives the full21 constraint vector, separately for each
of the two previously conflicting ceil branches. Local failure proves no box
infeasible. Normal tests do not invoke this driver.
"""
import gzip
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import minimize


directory = Path(sys.argv[1])
protocol = json.loads((directory/'candidate-protocol.json').read_text())
gate = json.loads(gzip.decompress((directory/'consistency.json.gz').read_bytes()))
assert gate['consistencyGate']
for item in protocol['files']:
    assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
with (directory/'candidate-started.json').open('x') as f:
    json.dump(dict(protocolSHA256=hashlib.sha256((directory/'candidate-protocol.json').read_bytes()).hexdigest(),
                   numpy=np.__version__, scipy=scipy.__version__, startedUnix=time.time()), f, indent=2)
oracle = subprocess.Popen(['node', 'scripts/polymer-task5-native-constraint-oracle.mjs', str(directory)],
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
all_history, results = [], []
try:
    for steps in protocol['ceilBranches']:
        history, cache = [], {}

        def evaluate(x):
            # Bounds are true constraints. Reject outside trials without a
            # projection or an invented optical score.
            assert np.all(np.abs(x) <= 1+1e-10)
            key = tuple(float(v) for v in x)
            if key not in cache:
                assert len(history) < protocol['evaluationsPerSlot']
                oracle.stdin.write(json.dumps(dict(deltaDegrees=list(key)))+'\n')
                oracle.stdin.flush()
                line = oracle.stdout.readline()
                if not line:
                    raise RuntimeError('native oracle terminated')
                row = json.loads(line)
                if 'error' in row:
                    raise RuntimeError(row['error'])
                length = next(o['length'] for o in row['objects'] if o['id'] == 1058)
                # Lower inequality is strict for ceil. Equality remains a
                # diagnostic solver point, never a branch-qualified witness.
                row['ceilBranch'] = steps
                row['branchConstraints'] = [2*length-(steps-1), steps-2*length]
                values = [v['value'] for v in row['constraints']]+row['branchConstraints']
                row['minimumConstraint'] = min(values) if row['guards']['fit'] else -1
                row['branchQualified'] = next(o['steps'] for o in row['objects'] if o['id'] == 1058) == steps
                row['witness'] = row['jointPass'] and row['branchQualified']
                row['serial'] = len(all_history)+1
                history.append(row)
                all_history.append(row)
                cache[key] = row
                with (directory/'native-history.jsonl').open('a') as log:
                    log.write(json.dumps(row)+'\n')
                if len(history) == 1 or row['minimumConstraint'] > max(r['minimumConstraint'] for r in history[:-1]):
                    print(json.dumps(dict(branch=steps, evaluation=len(history), minimumConstraint=row['minimumConstraint'],
                                          deltaDegrees=row['deltaDegrees'], failing=[o['id'] for o in row['objects'] if not o['pass']])), flush=True)
            return cache[key]

        class FoundWitness(Exception):
            pass

        def objective(x):
            row = evaluate(x)
            if row['witness']:
                raise FoundWitness()
            return sum(v*v for v in x)

        def constraints(x):
            row = evaluate(x)
            values = [v['value'] for v in row['constraints']]+row['branchConstraints']
            if not row['guards']['fit']:
                values.append(-1)
            else:
                values.append(1)
            return np.array(values)

        start = time.monotonic()
        try:
            result = minimize(objective, np.zeros(3), method='COBYLA', bounds=[(-1, 1)]*3,
                              constraints=[dict(type='ineq', fun=constraints)],
                              options=dict(maxiter=protocol['evaluationsPerSlot'], rhobeg=.1, tol=1e-4, catol=0))
            solver = dict(message=str(result.message), success=bool(result.success), nfev=int(result.nfev),
                          maxcv=float(result.maxcv))
        except FoundWitness:
            solver = dict(message='stopped on exact full21 branch-qualified CPU-model witness', success=True)
        best = max(history, key=lambda r: (r['witness'], r['minimumConstraint']))
        results.append(dict(branch=steps, solver=solver, seconds=time.monotonic()-start, evaluations=len(history),
                            best=best, witness=best['witness']))
finally:
    oracle.stdin.close()
    oracle.wait(timeout=30)

assert len(all_history) <= protocol['nativeConstraintEvaluationCap']
report = dict(kind='BOUNDED_NATIVE_PIECEWISE_CONSTRAINT_PROPOSALS_NOT_GPU_ACCEPTANCE', protocol=protocol,
              rows=results, nativeConstraintEvaluations=len(all_history), candidateSolverCalls=2,
              qualifyingProposals=sum(r['witness'] for r in results), certifiedExcludedRegions=0,
              trueGeometryFeasibility='UNRESOLVED', oldCampaignReruns=0, GPUCalls=0)
(directory/'native-candidates.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('protocol', 'rows')}), flush=True)
