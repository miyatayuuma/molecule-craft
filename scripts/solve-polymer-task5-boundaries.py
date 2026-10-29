"""Owner: Task5 boundary recovery ledger. Twelve geometric LPs, no raster/search loop."""
import json
import sys
from pathlib import Path
import scipy
from scipy.optimize import linprog

directory = Path(sys.argv[1])
assert not (directory / 'candidates.json').exists(), 'Do not overwrite a saved candidate list'
data = json.loads((directory / 'linear-input.json').read_text())
rows = []
for plan in data['plans']:
    # boundary value + gradient dot delta >= threshold - rho
    # Existing visible cells are strict local guards. Only gain/extension cells
    # share minimax slack rho. Infeasible positive slack is retained, not passed.
    A, b = [], []
    for feature in plan['features']:
        A.append([-v for v in feature['gradient']] + [0 if feature['guard'] else -1])
        b.append(feature['value'] - feature['threshold'])
    bounds = [(max(-plan['radius'], -6-s), min(plan['radius'], 6-s)) for s in data['seed']] + [(None, None)]
    result = linprog([0, 0, 0, 1], A_ub=A, b_ub=b, bounds=bounds, method='highs')
    assert result.success, result.message
    delta = result.x[:3].tolist()
    active = [dict(key=f['key'], guard=f['guard'], residual=float(r)) for f, r in zip(plan['features'], result.ineqlin.residual) if r < 1e-7]
    rows.append(dict(name=plan['name'], areaPixels=plan['areaPixels'], side=plan['side'], radius=plan['radius'], rotationDegrees=[s+d for s,d in zip(data['seed'], delta)], deltaDegrees=delta, linearSlack=float(result.x[3]), active=active, solver=dict(success=bool(result.success), message=result.message, iterations=result.nit)))
out = dict(kind='BOUNDARY_LINEARIZATIONS_NOT_FEASIBILITY_CERTIFICATES', scipy=scipy.__version__, rows=rows)
(directory / 'candidates.json').write_text(json.dumps(out, indent=2)+'\n')
print(json.dumps(dict(candidates=len(rows), scipy=scipy.__version__, noRasterCalls=True)))
