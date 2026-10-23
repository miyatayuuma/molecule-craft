"""Owner: Task5 corrected-campaign ledger. Fresh fixed2 slots; no old reruns.

The synthetic preflight is independent of molecule candidate generation. Normal
retained-evidence tests never call either synthetic or molecule MILP solves.
"""
import gzip
import hashlib
import importlib.util
import itertools
import json
import math
import sys
import time
from pathlib import Path

import scipy


def imported(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


model = imported('corrected_pixel_model', 'solve-polymer-task5-pixel-exchange.py')
logic = imported('independent_logic', 'verify-polymer-task5-model-logic.py')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(data, m, result):
    if result.x is None:
        return None
    x = result.x
    assert all(math.isfinite(float(v)) for v in x)
    rows = [sum(x[i]*c for i, c in r.items()) for r in m.rows]
    violation = max([0.0] + [max(lo-v, v-hi) for lo, v, hi in zip(m.lower, rows, m.upper)])
    bounds = max([0.0] + [max(lo-v, v-hi) for lo, v, hi in zip(m.lo, x, m.hi)])
    integers = max([0.0] + [abs(v-round(v)) for v, flag in zip(x, m.integer) if flag])
    # These are solver primal tolerances, not optical acceptance tolerances.
    assert max(violation, bounds, integers) <= 1e-6, (violation, bounds, integers)
    return dict(deltaDegrees=x[:3].tolist(),
                rotationDegrees=[s+float(d) for s, d in zip(data['seed'], x[:3])],
                maxConstraintViolation=float(violation), maxBoundViolation=float(bounds),
                maxIntegralityViolation=float(integers), x=x.tolist())


def preflight(root):
    result = logic.checks()
    for label, path in [('old', 'pib-pixel-exchange-a664c1da/model.json.gz'),
                        ('active', 'pib-active-constraints-8227174d/active-model.json.gz')]:
        data = json.loads(gzip.decompress((root/path).read_bytes()))
        result[label+'SeedWitness'] = logic.fixed_witness(data)
        assert result[label+'SeedWitness']['maxViolation'] == 0
    # Reconstruct area witness indices from cell truth ranges independently of
    # the constructor's aggregate dictionary. OR alternative variables must not
    # replace any selected cell in the full 2370-cell active input.
    m, _, _ = model.construct(data, 1, 26, 0)
    next_var, aggregates = 6, []
    for obj in data['objects']:
        fixed, selected, selectors = 0, [], []
        for cell in obj['cells']:
            conds = [(f['value']-sum(map(abs, f['gradient'])),
                      f['value']+sum(map(abs, f['gradient']))) for f in cell['conditions']]
            clauses = [[(f['value']-sum(map(abs, f['gradient'])),
                         f['value']+sum(map(abs, f['gradient']))) for f in c]
                       for c in cell.get('disjunctions', [])]
            if any(hi < 0 for lo, hi in conds) or any(all(hi < 0 for lo, hi in c) for c in clauses):
                continue
            variable = any(lo < 0 for lo, hi in conds) or any(not any(lo >= 0 for lo, hi in c) for c in clauses)
            if variable:
                y = next_var
                next_var += 1
                if not cell['annotationBoundary']:
                    selected.append(y)
                for c in clauses:
                    if any(lo >= 0 for lo, hi in c):
                        continue
                    for lo, hi in c:
                        if hi >= 0:
                            selectors.append(next_var)
                            next_var += 1
            elif not cell['annotationBoundary']:
                fixed += 1
        expected = {i: 1 for i in selected}
        expected.update({i: -v for i, v in enumerate(obj['required']['gradient']) if v})
        matches = [j for j, row in enumerate(m.rows) if row == expected and
                   abs(m.lower[j]-(obj['required']['value']-fixed)) < 1e-10 and math.isinf(m.upper[j])]
        assert len(matches) == 1, obj['id']
        assert not set(selectors).intersection(m.rows[matches[0]])
        aggregates.append(dict(id=obj['id'], fixedCells=fixed, selectedCellVariables=len(selected),
                               orSelectorVariables=len(selectors), areaRow=matches[0]))
    # Independent direct cell counting at nonzero coordinates, including both
    # signs of the OR, a fixed interior cell and a third selected cell. A model
    # with the former aggregate-variable clobber cannot satisfy these rows.
    synthetic = []
    for sign in (1, -1):
        data = dict(seed=[10., 20., 30.], protocol={'proposalClearancePixels': 0},
                    continuity=[], objects=[dict(id=1, kind='atom', index=0,
                    required=dict(value=3., gradient=[0, 0, 0]), cells=[
                    dict(x=0, y=0, annotationBoundary=False, conditions=[], disjunctions=[[
                        dict(value=-.2, gradient=[1, 0, 0]), dict(value=-.2, gradient=[-1, 0, 0])]]),
                    dict(x=1, y=0, annotationBoundary=False,
                        conditions=[dict(value=1., gradient=[0, 0, 0])]),
                    dict(x=2, y=0, annotationBoundary=False,
                        conditions=[dict(value=-.25, gradient=[sign, 0, 0])])])])
        m, _, _ = model.construct(data, 1, 26, 0)
        truth = []
        for dx in (-1, -.25, -.2, 0, .2, .25, 1):
            visible = int(abs(dx) >= .2) + 1 + int(sign*dx >= .25)
            feasible = any(logic.residual(m, [dx, 0, 0, abs(dx), 0, 0]+list(bits)) < 1e-9
                           for bits in itertools.product((0, 1), repeat=len(m.lo)-6))
            assert feasible == (visible >= 3)
            truth.append(dict(deltaX=dx, visibleCells=visible, feasible=feasible))
        t = time.monotonic()
        r = m.solve(dict(MILPTimeLimitSecondsPerSlot=5, MILPNodeLimitPerSlot=100,
                         MILPRelativeGap=0))
        proposal = extract(data, m, r)
        assert r.status == 0 and proposal
        assert all(abs(a-b) < 1e-10 for a, b in zip(proposal['deltaDegrees'], [sign*.25, 0, 0]))
        assert proposal['rotationDegrees'] == [10+sign*.25, 20., 30.]
        synthetic.append(dict(sign=sign, truth=truth, status=int(r.status),
                              seconds=time.monotonic()-t, proposal=proposal))
    return dict(kind='CORRECTED_MODEL_PREFLIGHT', logic=result, fullActiveAreaAccounting=aggregates,
                nonzeroSynthetic=synthetic,
                syntheticSolverCalls=2, moleculeCandidateSolverCalls=0, newCPURasters=0,
                passAll=True)


def campaign(directory):
    protocol_path = directory/'protocol.json'
    protocol = json.loads(protocol_path.read_text())
    for item in protocol['frozenFiles']:
        assert digest(Path(item['path'])) == item['sha256'], item['path']
    assert json.loads((directory/'preflight.json').read_text())['passAll']
    # Exclusive marker survives interruption and prohibits unbudgeted reruns.
    with (directory/'campaign-started.json').open('x') as f:
        json.dump(dict(protocolSHA256=digest(protocol_path), startedUnix=time.time(),
                       scipy=scipy.__version__), f, indent=2)
    data = json.loads(gzip.decompress(Path(protocol['modelPath']).read_bytes()))
    data['protocol'] = dict(data['protocol'], **protocol)
    rows = []
    for n in protocol['bond34StepBranches']:
        name = f'corrected-r1-n{n}'
        t = time.monotonic()
        m, areas, runs = model.construct(data, 1, n, 0)
        assert len(areas) == 5 and len(runs) == 2
        # Preserve the full linear system and box-bound active catalogue. At
        # infeasible/timeout with no incumbent, no primal active set exists.
        catalogue = []
        for index, (r, lo, hi) in enumerate(zip(m.rows, m.lower, m.upper)):
            low = sum(c*(m.lo[i] if c >= 0 else m.hi[i]) for i, c in r.items())
            high = sum(c*(m.hi[i] if c >= 0 else m.lo[i]) for i, c in r.items())
            catalogue.append(dict(row=index, lower=lo, upper=hi, boxMin=low, boxMax=high))
        (directory/(name+'-system.json.gz')).write_bytes(gzip.compress(json.dumps(dict(
            rows=m.rows, lower=m.lower, upper=m.upper, lo=m.lo, hi=m.hi, cost=m.cost,
            integer=m.integer, areaConstraints=areas, continuity=runs, boxCatalogue=catalogue)).encode()))
        solve_started = time.monotonic()
        r = m.solve(protocol)
        proposal = extract(data, m, r)
        row = dict(name=name, radius=1, steps34=n, surplus=0, hasIncumbent=proposal is not None,
                   solver=dict(status=int(r.status), message=r.message, variables=len(m.lo),
                   constraints=len(m.rows), seconds=time.monotonic()-t,
                   solveSeconds=time.monotonic()-solve_started,
                   mipNodes=getattr(r, 'mip_node_count', None),
                   mipGap=getattr(r, 'mip_gap', None)), areaConstraints=areas,
                   continuityBranches=[dict(index=c['index'], steps=[b['n'] for b in c['branches']]) for c in runs],
                   boxInconsistentRows=[c['row'] for c in catalogue if c['boxMax'] < c['lower'] or c['boxMin'] > c['upper']],
                   primalActiveSet=None)
        if proposal:
            x = proposal.pop('x')
            (directory/(name+'-primal.json.gz')).write_bytes(gzip.compress(json.dumps(x).encode()))
            row.update(proposal)
            row['primalActiveSet'] = [j for j, c in enumerate(catalogue)
                if min(abs(sum(x[int(i)]*v for i, v in m.rows[j].items())-c['lower']),
                       abs(sum(x[int(i)]*v for i, v in m.rows[j].items())-c['upper'])) < 1e-6]
        with (directory/'candidate-history.jsonl').open('a') as f:
            f.write(json.dumps(row)+'\n')
        rows.append(row)
        print(json.dumps({k: row[k] for k in ('name', 'solver', 'hasIncumbent', 'boxInconsistentRows')}), flush=True)
    assert len(rows) == protocol['candidateSlots'] == 2
    (directory/'candidates.json').write_text(json.dumps(dict(
        kind='CORRECTED_AFFINE_PROPOSALS_NOT_PROOF', scipy=scipy.__version__, rows=rows), indent=2)+'\n')


if __name__ == '__main__':
    action, directory = sys.argv[1:]
    if action == 'preflight':
        print(json.dumps(preflight(Path(directory))))
    else:
        assert action == 'campaign'
        campaign(Path(directory))
