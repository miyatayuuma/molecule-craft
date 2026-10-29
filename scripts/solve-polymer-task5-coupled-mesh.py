"""Owner: Task5 coupled feasibility ledger; bounded CPU experiment, not acceptance."""
import json
import subprocess
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/pib-coupled-mesh'
OUT.mkdir(parents=True, exist_ok=True)
if (OUT / 'protocol.json').exists():
    raise SystemExit('Refusing to repeat an existing experiment; inspect the retained result instead.')
PROTOCOL = {
    'kind': 'COUPLED_EXACT_MESH_LOCAL_FEASIBILITY_NOT_ACCEPTANCE',
    'startHead': '6d508e753e2c7bd8cf3b2578d81311936c9e8250',
    'maximumObjectiveEvaluations': 240,
    'maximumConfirmationRasters': 9,
    'anchor': 30,
    'seed': 'retained boundary30#0, actual native-mesh capture',
    'variables': 'three components of camera-space rotation vector in degrees, left-multiplied onto retained quaternion',
    'boundsDegrees': [-6, 6],
    'method': 'COBYQA trust-region maximizing minimum of ALL independent atom/bond/Q ratios; safe-region/depth are separate hard guards',
    'initialRadiusDegrees': 1,
    'finalRadiusDegrees': .025,
    'maximumIterations': 400,
    'objectiveTarget': 1.02,
    'stop': 'first target attainment, trust-region termination, 240 evaluations or 400 iterations; no second seed/restart/sweep',
    'fit': 'unchanged production explicit-quaternion fit, inherited shell pivot/.92 headroom and whole-graph depth budget',
    'raster': 'legacy4 with independently evaluated edges, ALL frozen native spheres/cylinders and depth; no smooth shadow proxy',
    'confirmation': 'at most one selected anchor30 pose plus retained 0/17 poses, each legacy4/shader32/float64',
    'limits': ['local existence search only; no global nonexistence proof', 'CPU arithmetic modes are sensitivity checks, not native error bounds', 'No A06/actual pointer/reset/GPU acceptance', 'No production changes or chemistry/XYZ modifications'],
    'runtime': {'numpy': np.__version__, 'scipy': scipy.__version__},
}
(OUT / 'protocol.json').write_text(json.dumps(PROTOCOL, indent=2) + '\n')
p = subprocess.Popen(['node', 'scripts/polymer-task5-coupled-mesh-oracle.mjs'], cwd=ROOT,
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
history = []


def objective(x):
    if len(history) >= PROTOCOL['maximumObjectiveEvaluations']:
        raise RuntimeError('fixed objective budget exhausted')
    p.stdin.write(json.dumps({'rotationDegrees': list(x)}) + '\n')
    p.stdin.flush()
    line = p.stdout.readline()
    if not line:
        raise RuntimeError('mesh oracle terminated')
    row = json.loads(line)
    if 'error' in row:
        raise RuntimeError(row['error'])
    history.append(row)
    with (OUT / 'history.jsonl').open('a') as f:
        f.write(json.dumps(row) + '\n')
    if len(history) == 1 or row['minimumMargin'] > max(r['minimumMargin'] for r in history[:-1]):
        print(json.dumps({'evaluation': len(history), 'minimumMargin': row['minimumMargin'], 'active': row['margins'][:5], 'rotationDegrees': row['rotationDegrees']}), flush=True)
    return -row['minimumMargin']


try:
    # A single bounded trust-region solve; no result-dependent restarts.
    result = minimize(objective, np.zeros(3), method='COBYQA', bounds=[(-6, 6)] * 3,
                      options={'maxfev': 240, 'maxiter': 400, 'initial_tr_radius': 1,
                               'final_tr_radius': .025, 'f_target': -1.02})
    summary = {'message': result.message, 'success': bool(result.success), 'nfev': result.nfev,
               'x': result.x.tolist(), 'fun': float(result.fun)}
finally:
    p.stdin.close()
    p.wait(timeout=30)
best = max(history, key=lambda r: r['minimumMargin'])
(OUT / 'result.json').write_text(json.dumps({'protocol': PROTOCOL, 'solver': summary, 'evaluations': len(history), 'best': best}, indent=2) + '\n')
print(json.dumps({'result': summary, 'evaluations': len(history), 'bestMinimumMargin': best['minimumMargin']}), flush=True)
