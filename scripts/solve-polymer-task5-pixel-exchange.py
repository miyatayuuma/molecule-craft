"""Owner: Task5 pixel-exchange ledger. Finite affine MILPs, no raster calls."""
import gzip
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import coo_matrix



class Model:
    def __init__(self, radius):
        self.radius = radius
        self.lo, self.hi, self.cost, self.integer = [], [], [], []
        self.rows, self.lower, self.upper = [], [], []
        for _ in range(3):
            self.var(-radius, radius)
        for i in range(3):
            a = self.var(0, radius, cost=1)
            self.row({a: 1, i: -1}, lo=0)
            self.row({a: 1, i: 1}, lo=0)

    def var(self, low=0, high=1, integer=False, cost=0):
        i = len(self.lo)
        self.lo.append(low); self.hi.append(high)
        self.integer.append(int(integer)); self.cost.append(cost)
        return i

    def row(self, terms, lo=-np.inf, hi=np.inf):
        self.rows.append({i: c for i, c in terms.items() if c})
        self.lower.append(lo); self.upper.append(hi)

    def affine_range(self, f):
        r = self.radius * sum(abs(v) for v in f['gradient'])
        return f['value']-r, f['value']+r

    def implies_ge(self, binary, f, threshold):
        minimum, _ = self.affine_range(f)
        big = max(0, threshold-minimum)
        terms = dict(enumerate(f['gradient']))
        terms[binary] = -big
        self.row(terms, lo=threshold-f['value']-big)

    def implies_le(self, binary, f, threshold):
        self.implies_ge(binary, {'value': -f['value'], 'gradient': [-g for g in f['gradient']]}, -threshold)

    def solve(self, protocol):
        r, c, values = [], [], []
        for j, terms in enumerate(self.rows):
            for i, v in terms.items():
                r.append(j); c.append(i); values.append(v)
        matrix = coo_matrix((values, (r, c)), shape=(len(self.rows), len(self.lo))).tocsc()
        return milp(np.array(self.cost), integrality=np.array(self.integer),
                    bounds=Bounds(self.lo, self.hi),
                    constraints=LinearConstraint(matrix, self.lower, self.upper),
                    options={'time_limit': protocol['MILPTimeLimitSecondsPerSlot'],
                             'node_limit': protocol['MILPNodeLimitPerSlot'],
                             'mip_rel_gap': protocol['MILPRelativeGap']})


def construct(data, radius, steps34, surplus, *, disabled_area=(), disabled_continuity=()):
    protocol = data['protocol']
    m = Model(radius)
    epsilon = protocol['proposalClearancePixels']
    cells_by_object = {}
    area_constraints = []
    for obj in data['objects']:
        cells = {}
        fixed, terms = 0, {}
        for cell in obj['cells']:
            ranges = [m.affine_range(f) for f in cell['conditions']]
            clauses = cell.get('disjunctions', [])
            if any(high < epsilon for low, high in ranges) or any(
                    all(m.affine_range(f)[1] < epsilon for f in clause) for clause in clauses):
                continue
            variable = any(low < epsilon for low, high in ranges) or any(
                not any(m.affine_range(f)[0] >= epsilon for f in clause) for clause in clauses)
            y = m.var(integer=True) if variable else None
            if variable:
                for f in cell['conditions']:
                    m.implies_ge(y, f, epsilon)
                for clause in clauses:
                    if any(m.affine_range(f)[0] >= epsilon for f in clause):
                        continue
                    alternatives = []
                    for f in clause:
                        if m.affine_range(f)[1] < epsilon:
                            continue
                        z = m.var(integer=True); alternatives.append(z)
                        m.row({z: 1, y: -1}, hi=0)
                        m.implies_ge(z, f, epsilon)
                    terms = {z: 1 for z in alternatives}; terms[y] = -1
                    m.row(terms, lo=0)
            cells[(cell['x'], cell['y'])] = (y, cell)
            # Annotation edges are omitted from area witnesses. This is a
            # conservative proposal restriction, not a changed formal grader.
            if not cell['annotationBoundary']:
                if y is None:
                    fixed += 1
                else:
                    terms[y] = 1
        for i, gradient in enumerate(obj['required']['gradient']):
            terms[i] = -gradient
        need = obj['required']['value'] + surplus - fixed
        if obj['id'] not in disabled_area:
            m.row(terms, lo=need)
        cells_by_object[obj['id']] = cells
        area_constraints.append({'kind': obj['kind'], 'index': obj['index'],
                                 'fixedAffineInterior': fixed, 'eligibleCells': len(cells),
                                 'requiredAtSeed': obj['required']['value'] + surplus})

    continuity_records = []
    for continuity in data['continuity']:
        index = continuity['index']
        if index in disabled_continuity:
            continue
        cells = cells_by_object[1024+index]
        branches = [b for b in continuity['branches'] if index != 34 or b['n'] == steps34]
        selected, records = [], []
        for branch in branches:
            n, length = branch['n'], branch['length']
            low, high = m.affine_range(length)
            if high <= (n-1)/2 or low > n/2:
                continue
            b = m.var(integer=True); selected.append(b)
            m.implies_ge(b, length, (n-1)/2 + 1e-7)
            m.implies_le(b, length, n/2)
            hits = [m.var(integer=True) for _ in range(n+1)]
            for hit in hits:
                m.row({hit: 1, b: -1}, hi=0)
            for j in range(n+1):
                choices = []
                for sample in (s for s in branch['samples'] if s['j'] == j):
                    xmin, xmax = m.affine_range(sample['x'])
                    ymin, ymax = m.affine_range(sample['y'])
                    for x in range(math.floor(xmin), math.floor(xmax)+1):
                        for y in range(math.floor(ymin), math.floor(ymax)+1):
                            if (x, y) not in cells:
                                continue
                            owner, cell = cells[(x, y)]
                            if cell['annotationBoundary']:
                                continue
                            z = m.var(integer=True); choices.append(z)
                            m.implies_ge(z, sample['x'], x)
                            m.implies_le(z, sample['x'], x+1-1e-7)
                            m.implies_ge(z, sample['y'], y)
                            m.implies_le(z, sample['y'], y+1-1e-7)
                            m.row({z: 1, hits[j]: -1}, hi=0)
                            if owner is not None:
                                m.row({z: 1, owner: -1}, hi=0)
                terms = {z: 1 for z in choices}; terms[hits[j]] = -1
                m.row(terms, lo=0)
            runs = []
            first_intervals = math.ceil(7.75*n/min(high, n/2))
            # One and two longer runs are included in each local ceil branch;
            # they can satisfy continuity at a smaller projected lane length.
            for intervals in range(first_intervals, min(n, first_intervals+2)+1):
                for start in range(n-intervals+1):
                    run = m.var(integer=True); runs.append(run)
                    for j in range(start, start+intervals+1):
                        m.row({run: 1, hits[j]: -1}, hi=0)
                    m.implies_ge(run, length, 7.75*n/intervals)
            terms = {r: 1 for r in runs}; terms[b] = -1
            m.row(terms, lo=0)
            records.append({'n': n, 'branchVariable': b, 'hits': hits})
        m.row({b: 1 for b in selected}, lo=1, hi=1)
        continuity_records.append({'index': index, 'branches': records})
    return m, area_constraints, continuity_records



if __name__ == '__main__':
    directory = Path(sys.argv[1])
    assert not (directory / 'candidates.json').exists(), 'Do not repeat candidate generation'
    data = json.loads(gzip.decompress((directory / 'model.json.gz').read_bytes()))
    protocol = data['protocol']
    rows = []
    for radius in protocol['trustBoxesDegrees']:
        for n in protocol['bond34StepBranches']:
            for surplus in protocol['areaSurplusPixels']:
                name = f'r{radius}-n{n}-a{surplus}'
                started = time.monotonic()
                m, areas, runs = construct(data, radius, n, surplus)
                result = m.solve(protocol)
                row = {'name': name, 'radius': radius, 'steps34': n, 'surplus': surplus,
                       'solver': {'status': int(result.status), 'message': result.message,
                                  'variables': len(m.lo), 'constraints': len(m.rows),
                                  'seconds': time.monotonic()-started,
                                  'mipGap': float(result.mip_gap) if getattr(result, 'mip_gap', None) is not None else None},
                       'areaConstraints': areas, 'hasIncumbent': result.x is not None}
                if result.x is not None:
                    x = result.x
                    row.update(deltaDegrees=x[:3].tolist(),
                               rotationDegrees=[s+float(d) for s, d in zip(data['seed'], x[:3])],
                               l1Degrees=float(result.fun),
                               continuityWitnesses=[{'index': r['index'], 'branches': [
                                   {'n': b['n'], 'hits': [j for j,h in enumerate(b['hits']) if x[h]>.5]}
                                   for b in r['branches'] if x[b['branchVariable']]>.5]} for r in runs])
                rows.append(row)
                # Every solver outcome, including limits/infeasibility, is retained.
                (directory / 'candidate-history.jsonl').open('a').write(json.dumps(row)+'\n')
                print(json.dumps({'slot': name, **row['solver'], 'incumbent': row['hasIncumbent'],
                                  'rotationDegrees': row.get('rotationDegrees')}), flush=True)
    assert len(rows) == protocol['candidateSlots']
    (directory / 'candidates.json').write_text(json.dumps({'kind': 'AFFINE_PIXEL_EXCHANGE_PROPOSALS_NOT_PROOF',
                                                          'scipy': scipy.__version__, 'rows': rows}, indent=2)+'\n')
