"""Owner: Task5 conflict isolation. Pure retained-matrix/primal verification.

No optimizer imports. May reconstruct a zero-delta monotone Boolean witness;
this is not a solver call or an orientation candidate.
"""
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path('docs/validation/polymer-local-fragment-task5-evidence/recovery')


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def residual(d, primal):
    x = primal['x']
    assert len(x) == len(d['lo']) and all(math.isfinite(v) for v in x)
    result = max([0.] + [max(lo-v, v-hi) for lo, v, hi in zip(d['lo'], x, d['hi'])])
    for j in primal['rows']:
        v = sum(x[int(i)]*c for i, c in d['rows'][j].items())
        result = max(result, d['lower'][j]-v, v-d['upper'][j])
    integer = max([0.] + [abs(v-round(v)) for v, flag in zip(x, d['integer']) if flag])
    return dict(maxViolation=result, maxIntegralityViolation=integer)


def verify(out):
    p = read(out/'protocol.json')
    for item in p['frozenFiles']:
        assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256']
    assert hashlib.sha256((out/'protocol.json').read_bytes()).hexdigest() == read(out/'started.json')['protocolSHA256']
    history = read(out/'history.json')
    assert len(history) == p['maxSolverCalls'] == 32
    assert [r['serial'] for r in history] == list(range(1, 33))
    assert sum(r['relaxedIntegrality'] for r in history) == 2
    checked = []
    matrices, catalogues = {}, {}
    for n in [26, 27]:
        d = matrices[n] = read(ROOT/f'pib-corrected-6f85d3a4/corrected-r1-n{n}-system.json.gz')
        prov = catalogues[n] = read(out/f'n{n}-provenance.json.gz')
        assert prov['exactReplay'] and len(prov['rows']) == len(d['rows'])
        assert len(prov['variables']) == len(d['lo'])
        assert [r['row'] for r in prov['rows']] == list(range(len(d['rows'])))
        for item in history:
            if item['branch'] != n or 'maxViolation' not in item:
                continue
            primal = read(out/f"solve-{item['serial']:02d}-primal.json.gz")
            # LP relaxations intentionally do not require binary integrality.
            r = residual(d, primal)
            assert r['maxViolation'] <= 1e-6
            if not item['relaxedIntegrality']:
                assert r['maxIntegralityViolation'] <= 1e-6
            checked.append(dict(serial=item['serial'], branch=n, **r))

    # The n27 solver's deletion of continuity34 was UNKNOWN at20s. An explicit
    # seed witness resolves only this relaxed system, not the full candidate.
    d, prov = matrices[27], catalogues[27]
    keep = [r['row'] for r in prov['rows'] if r['group'] in ['background', 'continuity:32']]
    x = [0.]*6+[1.]*(len(d['lo'])-6)
    for iteration in range(len(x)):
        changed = False
        for j in keep:
            row = {int(i): c for i, c in d['rows'][j].items()}
            v = sum(x[i]*c for i, c in row.items())
            if v < d['lower'][j]-1e-9:
                indices = [i for i, c in row.items() if i >= 6 and c < 0 and x[i]]
            elif v > d['upper'][j]+1e-9:
                indices = [i for i, c in row.items() if i >= 6 and c > 0 and x[i]]
            else:
                continue
            if len(indices) == 1:
                x[indices[0]] = 0
                changed = True
        if not changed:
            break
    independent = read(out/'n27-delete-continuity34-independent-primal.json.gz')
    assert independent['x'] == x and independent['rows'] == keep
    assert max(residual(d, independent).values()) == 0

    # Minimality is relative to all fixed background rows, not a row-level IIS.
    witnesses = {26: {'area:1056': 5, 'continuity:34': 8},
                 27: {'continuity:32': 15, 'continuity:34': 'independent'}}
    cores = {26: ['area:1056', 'continuity:34'], 27: ['continuity:32', 'continuity:34']}
    certificates = []
    for n, core in cores.items():
        d, prov = matrices[n], catalogues[n]
        for removed, serial in witnesses[n].items():
            primal = independent if serial == 'independent' else read(out/f'solve-{serial:02d}-primal.json.gz')
            required = [r['row'] for r in prov['rows'] if r['group'] == 'background' or r['group'] in set(core)-{removed}]
            assert set(required).issubset(primal['rows'])
            r = residual(d, dict(x=primal['x'], rows=required))
            assert max(r.values()) <= 1e-6
            certificates.append(dict(branch=n, removedGroup=removed, witness=serial, **r))
    assert history[6]['classification'] == history[13]['classification'] == 'INFEASIBLE_AFFINE_ONLY'
    native = read(out/'native-audit.json.gz')
    return dict(kind='RETAINED_CONFLICT_CERTIFICATE_VERIFICATION', passAll=True,
        solverCalls=0, candidateSolves=0, newCPURasters=0, newGPUCalls=0,
        executedDiagnosticSolverCalls=len(history), diagnosticSeconds=sum(r['seconds'] for r in history),
        checkedPrimalRows=checked, groupMinimalCertificates=certificates,
        conflictingGroups=cores, approximateInfeasibilityEvidenceSerials={26:7,27:14},
        originalTimeoutSerials=[r['serial'] for r in history if r['classification']=='UNKNOWN'],
        falseNegativePixels=sum(len(o['falseNegatives']) for o in native['actualMask']['objects']),
        trueGeometryFeasibility='UNRESOLVED', certifiedExcludedRegions=0)


if __name__ == '__main__':
    print(json.dumps(verify(Path(sys.argv[1]))))
