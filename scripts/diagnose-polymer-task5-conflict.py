"""Owner: polymer-local-fragment-task5-conflict-isolation.md.

Replays provenance, then diagnoses the RETAINED matrices. Never searches poses
or invokes a raster. Deletion witnesses are not production candidates.
"""
import gzip
import hashlib
import importlib.util
import inspect
import json
import linecache
import math
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import coo_matrix

ROOT = Path('docs/validation/polymer-local-fragment-task5-evidence/recovery')
FROZEN = ROOT/'pib-corrected-6f85d3a4'
ACTIVE = ROOT/'pib-active-constraints-8227174d/active-model.json.gz'


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, data):
    raw = (json.dumps(data, indent=None if path.suffix == '.gz' else 2)+'\n').encode()
    path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == '.gz' else raw)


def replay(n):
    spec = importlib.util.spec_from_file_location('frozen_model', Path(__file__).with_name('solve-polymer-task5-pixel-exchange.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    base = mod.Model

    class Traced(base):
        def __init__(self, radius):
            self.provenance, self.variables = [], []
            super().__init__(radius)

        def origin(self):
            frame = inspect.currentframe().f_back.f_back
            chain = []
            while frame and frame.f_code.co_filename == mod.__file__:
                chain.append(frame)
                if frame.f_code.co_name == 'construct':
                    break
                frame = frame.f_back
            call = chain[-1] if chain else None
            if not call or call.f_code.co_name != 'construct' or 'obj' not in call.f_locals:
                return dict(group='background', category='rotationBounds', site='Model.__init__')
            loc = call.f_locals
            site = linecache.getline(mod.__file__, call.f_lineno).strip()
            # The continuity_records list is first bound after the object loop.
            cont = 'continuity_records' in loc
            out = dict(group='background', site=site, line=call.f_lineno)
            if not cont:
                obj = loc['obj']
                out.update(objectId=obj['id'], kind=obj['kind'], index=obj['index'])
                cell = loc.get('cell')
                if cell:
                    out['pixel'] = [cell['x'], cell['y']]
                if 'm.row(terms, lo=need)' in site:
                    out.update(group=f"area:{obj['id']}", category='area')
                    out.pop('pixel', None)
                elif 'clause_terms' in site:
                    out['category'] = 'depthOR'
                elif 'm.row(' in site:
                    out['category'] = 'binaryImplication'
                else:
                    f = loc.get('f', {})
                    out['category'] = 'depthOrdering' if str(f.get('key', '')).startswith('depth:') else 'pixelCoverage'
                    if 'key' in f:
                        out['predicate'] = f['key']
            else:
                index = loc['index']
                out.update(group=f'continuity:{index}', index=index)
                branch = loc.get('branch', {})
                if 'n' in branch:
                    out['steps'] = branch['n']
                if 'sample[' in site:
                    out.update(category='floorCell', sample=loc['j'], lane=loc['sample'].get('lane'), pixel=[loc['x'], loc['y']])
                elif 'length,' in site or 'selected}' in site:
                    out['category'] = 'ceilBranch' if 'run,' not in site else 'continuousLength'
                elif 'hits[j]' in site:
                    out.update(category='binaryImplication', sample=loc['j'])
                else:
                    out['category'] = 'binaryImplication'
            return out

        def row(self, terms, lo=-np.inf, hi=np.inf):
            self.provenance.append(dict(row=len(self.rows), **self.origin()))
            super().row(terms, lo, hi)

        def var(self, low=0, high=1, integer=False, cost=0):
            self.variables.append(dict(variable=len(self.lo), lower=low, upper=high, integer=bool(integer), **self.origin()))
            return super().var(low, high, integer, cost)

    mod.Model = Traced
    m, _, _ = mod.construct(read(ACTIVE), 1, n, 0)
    frozen = read(FROZEN/f'corrected-r1-n{n}-system.json.gz')
    for key in ['rows', 'lower', 'upper', 'lo', 'hi', 'cost', 'integer']:
        actual = getattr(m, key)
        if key == 'rows':
            actual = [{str(k): v for k, v in r.items()} for r in actual]
        assert actual == frozen[key], key
    return frozen, m.provenance, m.variables


def diagnose(out):
    out.mkdir(parents=True, exist_ok=True)
    protocol = dict(kind='FROZEN_MATRIX_CONFLICT_DIAGNOSIS_NOT_CANDIDATE_GENERATION',
        startingMain='593ac571e4d664f7af885855352142874dd227ab',
        startingHead='c3d297fae42b4e653388b5e4ff75bdb50f02fd7c',
        maxSolverCalls=32, secondsPerCall=20, nodesPerCall=2000,
        branches=[26, 27], groupDeletionOrder=['area:31', 'area:1058', 'area:1059', 'area:1056', 'area:1057', 'continuity:32', 'continuity:34'],
        phaseA='Two full LP relaxations; integer full systems are NOT rerun.',
        phaseB='Greedy deletion in fixed order, retained rows and bounds unchanged; unknown retains group.',
        phaseC='For final conflict: remove pixelCoverage then depthOrdering rows, by object31/1056/1057/1058/1059; at most remaining16 calls; stop after both branches or cap.',
        stop='No pose optimization. Time/node limit is UNKNOWN, never infeasible. Stop at32 calls. No unused budget transfer.',
        candidateSolverCalls=0, newCPURasters=0, newGPUCalls=0,
        frozenFiles=[dict(path=str(p), sha256=sha(p)) for p in [Path(__file__), ACTIVE]+[FROZEN/f'corrected-r1-n{n}-system.json.gz' for n in [26, 27]]])
    assert not (out/'started.json').exists(), 'No diagnostic reruns'
    save(out/'protocol.json', protocol)
    with (out/'started.json').open('x') as f:
        json.dump(dict(protocolSHA256=sha(out/'protocol.json'), scipy=scipy.__version__, started=time.time()), f)
    history, summaries = [], []

    for n in protocol['branches']:
        d, prov, variables = replay(n)
        save(out/f'n{n}-provenance.json.gz', dict(rows=prov, variables=variables, exactReplay=True,
            categories=dict(Counter(p['category'] for p in prov))))
        rr, cc, vv = [], [], []
        for j, row in enumerate(d['rows']):
            for i, v in row.items():
                rr.append(j); cc.append(int(i)); vv.append(v)
        A = coo_matrix((vv, (rr, cc)), shape=(len(d['rows']), len(d['lo']))).tocsc()
        lower, upper = np.array(d['lower']), np.array(d['upper'])

        def solve(label, keep, relax=False):
            assert len(history) < protocol['maxSolverCalls']
            serial = len(history)+1
            t = time.monotonic()
            ids = np.array(keep)
            r = milp(np.zeros(len(d['lo'])), integrality=np.zeros(len(d['lo'])) if relax else d['integer'],
                bounds=Bounds(d['lo'], d['hi']), constraints=LinearConstraint(A[ids], lower[ids], upper[ids]),
                options=dict(time_limit=protocol['secondsPerCall'], node_limit=protocol['nodesPerCall'], mip_rel_gap=0))
            row = dict(serial=serial, branch=n, label=label, relaxedIntegrality=relax, rows=len(keep),
                status=int(r.status), message=r.message, seconds=time.monotonic()-t,
                classification='INFEASIBLE_AFFINE_ONLY' if r.status == 2 else 'UNKNOWN')
            if r.x is not None:
                x = r.x
                values = A[ids]@x
                violation = max(0., float(np.max(lower[ids]-values)), float(np.max(values-upper[ids])),
                    float(np.max(np.array(d['lo'])-x)), float(np.max(x-np.array(d['hi']))))
                integral = 0. if relax else float(np.max(np.abs(x-np.round(x))*np.array(d['integer'])))
                row.update(maxViolation=violation, maxIntegralityViolation=integral)
                if max(violation, integral) <= 1e-6:
                    row['classification'] = 'FEASIBLE_DIAGNOSTIC_RELAXATION'
                save(out/f'solve-{serial:02d}-primal.json.gz', dict(x=x.tolist(), rows=keep))
            history.append(row)
            save(out/'history.json', history)
            print(json.dumps(row), flush=True)
            return row

        solve('full-LP-relaxation', list(range(len(prov))), True)
        active = list(protocol['groupDeletionOrder'])
        decisions = []

        def selected(groups):
            return [p['row'] for p in prov if p['group'] == 'background' or p['group'] in groups]

        for group in protocol['groupDeletionOrder']:
            trial = [g for g in active if g != group]
            r = solve('delete-'+group, selected(trial))
            decisions.append(dict(group=group, solveSerial=r['serial'], activeBefore=list(active), classification=r['classification']))
            if r['classification'] == 'INFEASIBLE_AFFINE_ONLY':
                active = trial
        # A feasible witness from a superset also witnesses any later deletions.
        minimal = all(x['classification'] == 'FEASIBLE_DIAGNOSTIC_RELAXATION' for x in decisions if x['group'] in active)
        summary = dict(branch=n, conflictingGroups=active, backgroundRowsRetained=True,
            groupMinimalWithFixedBackground=minimal, decisions=decisions)
        summaries.append(summary)
        save(out/'conflicts.json', summaries)

    # Separate fixed-background discrimination, not a second candidate campaign.
    for summary in summaries:
        n = summary['branch']
        d, prov, _ = replay(n)
        # Reuse solve closure only through a fresh generic function below.
        base_rows = [p['row'] for p in prov if p['group'] == 'background' or p['group'] in summary['conflictingGroups']]
        for obj in [31, 1056, 1057, 1058, 1059]:
            for category in ['pixelCoverage', 'depthOrdering']:
                if len(history) >= protocol['maxSolverCalls']:
                    break
                removed = [p['row'] for p in prov if p.get('objectId') == obj and p['category'] == category]
                if not removed:
                    continue
                remove_set = set(removed)
                # solve closure references A/lower/upper/d/n; rebuild below.
                rr, cc, vv = [], [], []
                for j, row in enumerate(d['rows']):
                    for i, v in row.items():
                        rr.append(j); cc.append(int(i)); vv.append(v)
                A = coo_matrix((vv, (rr, cc)), shape=(len(d['rows']), len(d['lo']))).tocsc()
                lower, upper = np.array(d['lower']), np.array(d['upper'])
                solve(f'background-delete-{obj}-{category}', [j for j in base_rows if j not in remove_set])
    save(out/'summary.json', dict(conflicts=summaries, solverCalls=len(history), candidateSolverCalls=0,
        newCPURasters=0, newGPUCalls=0, trueGeometryFeasibility='UNRESOLVED'))


if __name__ == '__main__':
    diagnose(Path(sys.argv[1]))
