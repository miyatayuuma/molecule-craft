#!/usr/bin/env python3
"""Generate or validate the canonical Reaction Lab nonbonded dataset.

The check mode deliberately uses only the Python standard library. The
generate mode requires the pinned developer-only OpenFF/AmberTools environment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import sys
import tempfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MOLECULES_PATH = ROOT / "data/molecules.json"
ROUTES_PATH = ROOT / "data/parameterization/reaction-lab-nonbonded-routes.json"
MODELS_PATH = ROOT / "data/reaction-lab-nonbonded-models.json"
AUDIT_PATH = ROOT / "generated/reaction-lab-nonbonded-audit.json"
MODEL_FILE = "openff-gnn-am1bcc-1.0.0.pt"
FF_FILE = "openff-2.3.0.offxml"
CO_DIPOLE_REFERENCE_D = 0.112
DEBYE_PER_E_ANGSTROM = 4.80320471257


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_json(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def graph_digest(record) -> str:
    graph = {
        "atoms": record["atoms"],
        "bonds": record["bonds"],
        "formalCharges": record.get("formalCharges") or {},
    }
    return sha256_bytes(canonical_json(graph))


def dataset_digest(records) -> str:
    data = [{"id": item["id"], "atoms": item["atoms"], "bonds": item["bonds"], "nonbonded": item["nonbonded"]} for item in records]

    def normalize_numbers(value):
        # JSON.stringify in the molecule DB builder serializes integral floats
        # as integers. Normalize numeric representation so the integrity hash
        # survives that stable round trip without changing parameter values.
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return format(float(value), ".15g")
        if isinstance(value, list):
            return [normalize_numbers(item) for item in value]
        if isinstance(value, dict):
            return {key: normalize_numbers(item) for key, item in value.items()}
        return value

    return sha256_bytes(canonical_json(normalize_numbers(data)))


def fail(message: str):
    raise ValueError(message)


def check_dataset() -> None:
    records = read_json(MOLECULES_PATH)
    routes = read_json(ROUTES_PATH)
    models = read_json(MODELS_PATH)
    audit = read_json(AUDIT_PATH)
    errors = []

    if len(records) != 142:
        errors.append(f"expected 142 molecules, found {len(records)}")
    model_ids = {model.get("id") for model in models.get("chargeModels", [])}
    vdw_ids = {model.get("id") for model in models.get("vdwModels", [])}
    expected_charge_models = {"ashgc-1.0", "symmetry-zero", "tip3p-library", "ambertools-am1bcc"}
    if not expected_charge_models.issubset(model_ids):
        errors.append(f"model registry missing charge models: {sorted(expected_charge_models - model_ids)}")
    if "openff-sage-2.3.0" not in vdw_ids:
        errors.append("model registry missing openff-sage-2.3.0")
    if models.get("combiningRule") != "Lorentz-Berthelot":
        errors.append("combining rule must be Lorentz-Berthelot")
    if routes.get("parameterSet") != models.get("parameterSet"):
        errors.append("route manifest and model registry parameterSet differ")

    manifest_ids = {entry.get("moleculeId") for entry in routes.get("explicitZeroSpecies", [])}
    manifest_ids.update(entry.get("moleculeId") for entry in routes.get("librarySpecies", []))
    manifest_ids.update(entry.get("moleculeId") for entry in routes.get("ambertoolsFallbackSpecies", []))
    route_ids = {record.get("id") for record in records}
    if not manifest_ids.issubset(route_ids):
        errors.append(f"manifest references unknown molecules: {sorted(manifest_ids - route_ids)}")
    symmetry_manifest = routes.get("symmetryGroups", {})
    if set(symmetry_manifest) != route_ids:
        errors.append("symmetry manifest must contain every molecule exactly once")

    audit_by_id = {item.get("moleculeId"): item for item in audit.get("molecules", [])}
    if len(audit_by_id) != len(audit.get("molecules", [])) or set(audit_by_id) != route_ids:
        errors.append("audit molecule coverage does not exactly match molecules.json")

    charges_by_id = {}
    route_counts = Counter()
    for record in records:
        molecule_id = record.get("id", "<missing id>")
        block = record.get("nonbonded")
        if not isinstance(block, dict):
            errors.append(f"{molecule_id}: missing nonbonded block")
            continue
        atom_count = len(record.get("atoms", []))
        if block.get("schemaVersion") != 1 or block.get("parameterSet") != "reaction-lab-nonbonded-v1":
            errors.append(f"{molecule_id}: invalid schemaVersion/parameterSet")
        arrays = {
            "atomicChargesE": block.get("atomicChargesE"),
            "sigmaAngstrom": block.get("sigmaAngstrom"),
            "epsilonKcalMol": block.get("epsilonKcalMol"),
            "vdwParameterIds": block.get("vdwParameterIds"),
            "atomMap": block.get("atomMap"),
        }
        for field, values in arrays.items():
            if not isinstance(values, list) or len(values) != atom_count:
                errors.append(f"{molecule_id}: {field} length must equal atom count {atom_count}")
        if not all(isinstance(values, list) and len(values) == atom_count for values in arrays.values()):
            continue
        if block.get("chargeModel") not in model_ids:
            errors.append(f"{molecule_id}: unresolved charge model {block.get('chargeModel')}")
        if block.get("vdwModel") not in vdw_ids:
            errors.append(f"{molecule_id}: unresolved vdW model {block.get('vdwModel')}")
        if block.get("vdwModel") != "openff-sage-2.3.0":
            errors.append(f"{molecule_id}: vdW model must be openff-sage-2.3.0")
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in arrays["atomicChargesE"]):
            errors.append(f"{molecule_id}: non-finite/non-numeric charge")
            continue
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0 for value in arrays["sigmaAngstrom"]):
            errors.append(f"{molecule_id}: sigma must be finite and positive")
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 for value in arrays["epsilonKcalMol"]):
            errors.append(f"{molecule_id}: epsilon must be finite and non-negative")
        if any(not isinstance(value, str) or not value for value in arrays["vdwParameterIds"]):
            errors.append(f"{molecule_id}: vdwParameterIds must be non-empty strings")
        if arrays["atomMap"] != list(range(atom_count)):
            errors.append(f"{molecule_id}: atomMap must be a bijective identity map matching atoms[]")
        if block.get("virtualChargeSites") != []:
            errors.append(f"{molecule_id}: v1 virtualChargeSites must be empty")
        provenance = block.get("provenance")
        if not isinstance(provenance, dict) or provenance.get("moleculeGraphSha256") != graph_digest(record):
            errors.append(f"{molecule_id}: missing or stale molecule graph provenance")
        if provenance and provenance.get("chargeModelId") != block.get("chargeModel"):
            errors.append(f"{molecule_id}: provenance charge model mismatch")

        charge_sum = math.fsum(arrays["atomicChargesE"])
        if abs(charge_sum) > 1e-6:
            errors.append(f"{molecule_id}: neutral charge sum is {charge_sum:.9g} e")
        charges_by_id[molecule_id] = arrays["atomicChargesE"]

        audit_item = audit_by_id.get(molecule_id)
        if not audit_item:
            continue
        route_counts[audit_item.get("actualRoute", "<missing>")] += 1
        if audit_item.get("status") != "clean":
            errors.append(f"{molecule_id}: audit status is {audit_item.get('status')}")
        if audit_item.get("chargeModel") != block.get("chargeModel") or audit_item.get("vdwModel") != block.get("vdwModel"):
            errors.append(f"{molecule_id}: audit provenance disagrees with canonical data")
        if audit_item.get("atomCount") != atom_count or audit_item.get("vdwCoverage") != atom_count:
            errors.append(f"{molecule_id}: audit atom/vdW coverage mismatch")
        if abs(audit_item.get("chargeSum", float("inf")) - charge_sum) > 1e-12:
            errors.append(f"{molecule_id}: audit charge sum mismatch")
        if audit_item.get("symmetryChecks") != [
            {"atomIndices": group, "maxChargeDifferenceE": max(charges_by_id[molecule_id][i] for i in group) - min(charges_by_id[molecule_id][i] for i in group), "passed": max(charges_by_id[molecule_id][i] for i in group) - min(charges_by_id[molecule_id][i] for i in group) <= routes.get("symmetryToleranceE", 1e-4)}
            for group in symmetry_manifest.get(molecule_id, [])
        ]:
            errors.append(f"{molecule_id}: audit symmetry checks do not match the manifest/data")

    for molecule_id, groups in symmetry_manifest.items():
        charge = charges_by_id.get(molecule_id)
        if charge is None:
            continue
        for group in groups:
            if len(group) < 2 or any(not isinstance(i, int) or i < 0 or i >= len(charge) for i in group):
                errors.append(f"{molecule_id}: invalid symmetry group {group}")
                continue
            diff = max(charge[i] for i in group) - min(charge[i] for i in group)
            tolerance = routes.get("symmetryToleranceE", 1e-4)
            if diff > tolerance:
                errors.append(f"{molecule_id}: symmetry group {group} charge spread is {diff:.9g} e (tolerance {tolerance:g})")

    by_id = {record["id"]: record for record in records}
    for molecule_id, indexes in {"hydrogen": [0, 1], "oxygen": [0, 1], "nitrogen": [0, 1], "chlorine": [0, 1]}.items():
        block = by_id.get(molecule_id, {}).get("nonbonded", {})
        if block.get("chargeModel") != "symmetry-zero" or any(block.get("atomicChargesE", [])[i] != 0 for i in indexes):
            errors.append(f"{molecule_id}: explicit-zero charge route mismatch")
    water = by_id.get("water", {}).get("nonbonded", {})
    if water.get("chargeModel") != "tip3p-library" or water.get("atomicChargesE") != [-0.834, 0.417, 0.417]:
        errors.append("water: Sage 2.3.0 TIP3P LibraryCharges must be exact")
    for molecule_id, symbol, index, predicate in [
        ("water", "O", 0, lambda q: q < 0), ("water", "H", 1, lambda q: q > 0),
        ("carbon-dioxide", "C", 0, lambda q: q > 0), ("carbon-dioxide", "O", 1, lambda q: q < 0),
        ("acetone", "O", 3, lambda q: q < 0), ("pyridine", "N", 0, lambda q: q < 0),
    ]:
        rec = by_id.get(molecule_id, {})
        q = rec.get("nonbonded", {}).get("atomicChargesE", [])
        if index >= len(rec.get("atoms", [])) or rec["atoms"][index] != symbol or index >= len(q) or not predicate(q[index]):
            errors.append(f"{molecule_id}: charge sanity failed at {symbol}{index}")

    requested_counts = Counter(item.get("requestedRoute") for item in audit.get("molecules", []))
    expected_requested = routes.get("expectedRequestedRouteCounts", {})
    for route, expected_count in expected_requested.items():
        if requested_counts.get(route) != expected_count:
            errors.append(f"requested route {route}: expected {expected_count}, found {requested_counts.get(route, 0)}")
    actual_model_counts = Counter(record.get("nonbonded", {}).get("chargeModel") for record in records)
    minimum_actual = routes.get("expectedMinimumActualRouteCounts", {})
    if actual_model_counts.get("ashgc-1.0", 0) < minimum_actual.get("ashgc", 0):
        errors.append(f"AshGC actual coverage below expected minimum {minimum_actual.get('ashgc')}")
    fallback_total = actual_model_counts.get("ambertools-am1bcc", 0)
    if fallback_total < minimum_actual.get("ambertools-am1bcc", 0):
        errors.append(f"AmberTools actual fallback coverage below expected minimum {minimum_actual.get('ambertools-am1bcc')}")
    if any(item.get("status") != "clean" for item in audit.get("molecules", [])):
        errors.append("generated audit contains non-clean molecules")
    if audit.get("status") != "clean":
        errors.append(f"generated audit status is {audit.get('status')}")
    if audit.get("canonicalDataSha256") != dataset_digest(records):
        errors.append("generated audit canonical-data hash mismatch")
    if audit.get("routeManifestSha256") != sha256_bytes(ROUTES_PATH.read_bytes()):
        errors.append("generated audit route manifest hash mismatch")
    if audit.get("modelRegistrySha256") != sha256_bytes(MODELS_PATH.read_bytes()):
        errors.append("generated audit model registry hash mismatch")
    if audit.get("symmetryToleranceE") != routes.get("symmetryToleranceE", 1e-4):
        errors.append("generated audit symmetry tolerance mismatch")
    if audit.get("actualRouteCounts") != dict(sorted(route_counts.items())):
        errors.append("generated audit actual route counts mismatch")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        fail(f"canonical nonbonded check failed with {len(errors)} error(s)")
    print(f"Canonical nonbonded check clean: {len(records)} molecules; actual routes {dict(sorted(route_counts.items()))}; SHA-256 {audit['canonicalDataSha256']}")


def atomic_json_write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except Exception:
        try:
            os.unlink(temp_path)
        except FileNotFoundError:
            pass
        raise


def package_versions(prefix: Path) -> dict:
    versions = {}
    meta = prefix / "conda-meta"
    if meta.is_dir():
        for path in meta.glob("*.json"):
            try:
                item = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            versions[item["name"]] = {"version": item["version"], "build": item.get("build"), "channel": item.get("channel")}
    names = ["python", "openff-toolkit", "openff-nagl", "openff-nagl-models", "openff-forcefields", "ambertools", "rdkit", "pytorch"]
    return {name: versions.get(name, {"version": "unavailable"}) for name in names}


def generate_dataset() -> None:
    print("Loading offline OpenFF parameterization environment", file=sys.stderr, flush=True)
    try:
        from rdkit import Chem
        from rdkit.Chem import AllChem
        from openff.nagl_models import validate_nagl_model_path
        from openff.toolkit import ForceField, Molecule
        from openff.toolkit.utils.ambertools_wrapper import AmberToolsToolkitWrapper
        from openff.toolkit.utils.nagl_wrapper import NAGLToolkitWrapper
        from openff.units import unit
        from openff.nagl import GNNModel
        import torch
    except ImportError as error:
        fail(f"generate requires the pinned open-source environment from data/parameterization/openff-ashgc-linux-64.lock: {error}")

    # Keep small-graph inference deterministic and avoid large OpenMP startup
    # overhead from assigning a host-wide thread count to each molecule.
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)

    records = read_json(MOLECULES_PATH)
    routes = read_json(ROUTES_PATH)
    registry = read_json(MODELS_PATH)
    prefix = Path(os.environ.get("CONDA_PREFIX", sys.prefix))
    versions = package_versions(prefix)
    required_versions = registry.get("toolVersions", {})
    package_keys = {
        "python": "python",
        "openff-toolkit": "openff-toolkit",
        "openff-nagl": "openff-nagl",
        "openff-nagl-models": "openff-nagl-models",
        "openff-forcefields": "openff-forcefields",
        "ambertools": "ambertools",
        "rdkit": "rdkit",
        "pytorch": "pytorch",
    }
    for registry_name, package_name in package_keys.items():
        expected_version = required_versions.get(registry_name)
        actual_version = versions.get(package_name, {}).get("version")
        if expected_version and actual_version != expected_version:
            fail(f"parameterization environment version mismatch for {registry_name}: expected {expected_version}, found {actual_version}")
    model_path = Path(validate_nagl_model_path(MODEL_FILE)).resolve()
    model_hash = sha256_bytes(model_path.read_bytes())
    ff_spec = __import__("importlib.util", fromlist=["find_spec"]).find_spec("openforcefields")
    if not ff_spec or not ff_spec.origin:
        fail("openff-forcefields package does not expose the offxml resources")
    ff_path = Path(ff_spec.origin).parent / "offxml" / FF_FILE
    if not ff_path.is_file():
        fail(f"Sage 2.3.0 force field file is unavailable: {ff_path}")
    ff_hash = sha256_bytes(ff_path.read_bytes())
    expected_hashes = registry.get("fileHashes", {})
    if model_hash != expected_hashes.get("ashgcModelSha256"):
        fail(f"AshGC model hash mismatch: expected {expected_hashes.get('ashgcModelSha256')}, found {model_hash}")
    if ff_hash != expected_hashes.get("sageOffxmlSha256"):
        fail(f"Sage offxml hash mismatch: expected {expected_hashes.get('sageOffxmlSha256')}, found {ff_hash}")

    model = GNNModel.load(str(model_path), eval_mode=True)
    force_field = ForceField(str(ff_path))
    if force_field.get_parameter_handler("vdW").combining_rules != "Lorentz-Berthelot":
        fail("Sage 2.3.0 vdW combining rule is not Lorentz-Berthelot")
    vdw_handler = force_field.get_parameter_handler("vdW")
    library_handler = force_field.get_parameter_handler("LibraryCharges")
    explicit_zero = {item["moleculeId"]: item for item in routes["explicitZeroSpecies"]}
    library = {item["moleculeId"]: item for item in routes["librarySpecies"]}
    fallback = {item["moleculeId"]: item for item in routes["ambertoolsFallbackSpecies"]}
    domain_fallback = routes["domainFallbackPolicy"]
    symmetry_groups = routes["symmetryGroups"]
    requested_counts = Counter()
    actual_counts = Counter()
    audit_items = []
    new_records = []
    original_graphs = {record["id"]: (record["atoms"], record["bonds"]) for record in records}

    bond_types = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}

    def openff_molecule(record, formal_override=None):
        charges = {int(index): int(value) for index, value in (record.get("formalCharges") or {}).items()}
        if formal_override is not None:
            charges = formal_override
        editable = Chem.RWMol()
        for atom_index, symbol in enumerate(record["atoms"]):
            atom = Chem.Atom(symbol)
            atom.SetFormalCharge(charges.get(atom_index, 0))
            atom.SetNoImplicit(True)
            editable.AddAtom(atom)
        for a, b, order in record["bonds"]:
            editable.AddBond(a, b, bond_types[order])
        rd_molecule = editable.GetMol()
        Chem.SanitizeMol(rd_molecule)
        molecule = Molecule.from_rdkit(rd_molecule, allow_undefined_stereo=True)
        if molecule.n_atoms != len(record["atoms"]) or [atom.symbol for atom in molecule.atoms] != record["atoms"]:
            fail(f"{record['id']}: OpenFF conversion changed the atom map or element sequence")
        return molecule, rd_molecule

    for record in records:
        molecule_id = record["id"]
        print(f"Parameterizing {molecule_id}", file=sys.stderr, flush=True)
        if molecule_id in explicit_zero:
            requested_route = "explicit-library"
            molecule, rd_molecule = openff_molecule(record)
            charge_model = "symmetry-zero"
            charges = explicit_zero[molecule_id]["atomicChargesE"]
            actual_route = "symmetry-zero"
            domain_status = "not-applicable-explicit-route"
            route_reason = "neutral homonuclear diatomic Stage A approximation"
        elif molecule_id in library:
            requested_route = "explicit-library"
            molecule, rd_molecule = openff_molecule(record)
            charge_model = "tip3p-library"
            matches = library_handler.find_matches(molecule.to_topology())
            if set(matches) != {(0,), (1,), (2,)}:
                fail(f"water: Sage 2.3.0 did not exactly match three TIP3P LibraryCharges sites")
            charges = [float(matches[(i,)].parameter_type.charge[0].m_as(unit.elementary_charge)) for i in range(molecule.n_atoms)]
            actual_route = "tip3p-library"
            domain_status = "not-applicable-library-route"
            route_reason = "Sage 2.3.0 TIP3P LibraryCharges have priority over NAGLCharges"
        else:
            requested_route = "ambertools-am1bcc" if molecule_id in fallback else "ashgc"
            override = {0: -1, 1: 1} if molecule_id == "carbon-monoxide" else None
            molecule, rd_molecule = openff_molecule(record, override)
            if requested_route == "ashgc":
                allowed, reason = model.chemical_domain.check_molecule(molecule, return_error_message=True)
                if allowed:
                    try:
                        molecule.assign_partial_charges(MODEL_FILE, toolkit_registry=NAGLToolkitWrapper(), normalize_partial_charges=True)
                        domain_status = "in-domain"
                        actual_route = "ashgc"
                        route_reason = "official AshGC 1.0 chemical-domain check passed"
                        charge_model = "ashgc-1.0"
                    except Exception as error:
                        allowed = False
                        reason = f"official AshGC parameterization failed after domain validation: {type(error).__name__}: {error}"
                if not allowed:
                    domain_status = "out-of-domain-fallback"
                    actual_route = "ambertools-domain-fallback"
                    route_reason = reason
                    charge_model = "ambertools-am1bcc"
            else:
                domain_status = "documented-ashgc-excluded-representation"
                actual_route = "ambertools-am1bcc"
                route_reason = "explicit route manifest representation override"
                charge_model = "ambertools-am1bcc"
            if charge_model == "ambertools-am1bcc":
                seed = int(routes["conformerProtocol"]["seed"])
                embed_params = AllChem.ETKDGv3()
                embed_params.randomSeed = seed
                status = AllChem.EmbedMolecule(rd_molecule, embed_params)
                if status != 0:
                    fail(f"{molecule_id}: RDKit ETKDGv3 failed to generate a deterministic conformer")
                if AllChem.MMFFHasAllMoleculeParams(rd_molecule):
                    AllChem.MMFFOptimizeMolecule(rd_molecule, mmffVariant="MMFF94s", maxIters=300)
                molecule = Molecule.from_rdkit(rd_molecule, allow_undefined_stereo=True)
                if molecule.n_atoms != len(record["atoms"]) or [atom.symbol for atom in molecule.atoms] != record["atoms"]:
                    fail(f"{molecule_id}: conformer generation changed the atom map")
                molecule.assign_partial_charges("am1bcc", toolkit_registry=AmberToolsToolkitWrapper(), use_conformers=molecule.conformers, normalize_partial_charges=True)
            charges = [float(value.m_as(unit.elementary_charge)) for value in molecule.partial_charges]

        if len(charges) != len(record["atoms"]) or not all(math.isfinite(value) for value in charges):
            fail(f"{molecule_id}: charge assignment did not return one finite value per input atom")
        if abs(math.fsum(charges)) > 1e-6:
            fail(f"{molecule_id}: charge model returned net charge {math.fsum(charges):.9g} e")

        topology = molecule.to_topology()
        vdw_matches = vdw_handler.find_matches(topology)
        if set(vdw_matches) != {(i,) for i in range(len(record["atoms"]))}:
            missing = sorted({(i,) for i in range(len(record["atoms"]))} - set(vdw_matches))
            fail(f"{molecule_id}: Sage 2.3.0 vdW coverage missing atom sites {missing}")
        sigma, epsilon, parameter_ids = [], [], []
        for index in range(len(record["atoms"])):
            parameter = vdw_matches[(index,)].parameter_type
            # OpenFF's parameter type resolves input rmin_half into canonical sigma.
            sigma_value = float(parameter.sigma.m_as(unit.angstrom))
            epsilon_value = float(parameter.epsilon.m_as(unit.kilocalorie_per_mole))
            if not math.isfinite(sigma_value) or sigma_value <= 0 or not math.isfinite(epsilon_value) or epsilon_value < 0:
                fail(f"{molecule_id} atom {index}: invalid Sage vdW value")
            sigma.append(sigma_value)
            epsilon.append(epsilon_value)
            parameter_ids.append(parameter.id)

        atom_count = len(record["atoms"])
        if sorted(range(atom_count)) != list(range(atom_count)):
            fail(f"{molecule_id}: internal parameter atom map is not bijective")
        block = {
            "schemaVersion": 1,
            "parameterSet": "reaction-lab-nonbonded-v1",
            "chargeModel": charge_model,
            "atomicChargesE": charges,
            "vdwModel": "openff-sage-2.3.0",
            "sigmaAngstrom": sigma,
            "epsilonKcalMol": epsilon,
            "vdwParameterIds": parameter_ids,
            "atomMap": list(range(atom_count)),
            "virtualChargeSites": [],
            "provenance": {
                "requestedRoute": requested_route,
                "actualRoute": actual_route,
                "chargeModelId": charge_model,
                "routeReason": route_reason,
                "moleculeGraphSha256": graph_digest(record),
                "chargeInputRepresentation": "[C-]#[O+]" if molecule_id == "carbon-monoxide" else "molecule DB atom/bond graph",
                "chargeInputAtomMap": list(range(atom_count)),
                "chargeModelFileSha256": model_hash if charge_model == "ashgc-1.0" else None,
                "vdwForceFieldSha256": ff_hash,
                "conformerSeed": routes["conformerProtocol"]["seed"] if charge_model == "ambertools-am1bcc" else None,
            },
        }
        record["nonbonded"] = block
        new_records.append(record)
        requested_counts[requested_route] += 1
        actual_counts[actual_route] += 1

        checks = []
        for group in symmetry_groups[molecule_id]:
            spread = max(charges[index] for index in group) - min(charges[index] for index in group)
            check = {"atomIndices": group, "maxChargeDifferenceE": spread, "passed": spread <= float(routes.get("symmetryToleranceE", 1e-4))}
            checks.append(check)
            if spread > float(routes.get("symmetryToleranceE", 1e-4)):
                fail(f"{molecule_id}: symmetry group {group} has partial-charge spread {spread:.9g} e")

        warnings = []
        co_details = None
        if molecule_id == "carbon-monoxide":
            conformer = molecule.conformers[0].m_as(unit.angstrom)
            dipole_vector = [math.fsum(charges[i] * float(conformer[i][axis]) for i in range(atom_count)) for axis in range(3)]
            dipole = math.sqrt(math.fsum(value * value for value in dipole_vector)) * DEBYE_PER_E_ANGSTROM
            ratio = dipole / CO_DIPOLE_REFERENCE_D
            co_details = {
                "atomicChargeSigns": {"C": "negative" if charges[0] < 0 else "positive" if charges[0] > 0 else "zero", "O": "negative" if charges[1] < 0 else "positive" if charges[1] > 0 else "zero"},
                "fixedChargeDipoleDebye": dipole,
                "experimentalReferenceDipoleDebye": CO_DIPOLE_REFERENCE_D,
                "dipoleToReferenceRatio": ratio,
            }
            if ratio > 3 or ratio < 1 / 3:
                warnings.append(f"CO fixed-charge dipole differs from the approximately 0.112 D experimental reference by {ratio:.2f}x; retain as model limitation audit warning")

        status = "clean"
        audit_item = {
            "status": status,
            "moleculeId": molecule_id,
            "requestedRoute": requested_route,
            "actualRoute": actual_route,
            "chargeModel": charge_model,
            "chargeModelDomainStatus": domain_status,
            "vdwModel": "openff-sage-2.3.0",
            "atomCount": atom_count,
            "chargeSum": math.fsum(charges),
            "maxAbsCharge": max(abs(value) for value in charges),
            "vdwCoverage": len(parameter_ids),
            "vdwParameterIds": parameter_ids,
            "symmetryChecks": checks,
            "warnings": warnings,
        }
        if molecule_id == "carbon-monoxide":
            audit_item["coPhysicalSanity"] = co_details
        audit_items.append(audit_item)

    if {record["id"] for record in new_records} != set(original_graphs):
        fail("generated molecule coverage drifted from molecules.json")
    for record in new_records:
        if (record["atoms"], record["bonds"]) != original_graphs[record["id"]]:
            fail(f"{record['id']}: constitutional graph changed during parameter generation")

    canonical_hash = dataset_digest(new_records)
    audit = {
        "schemaVersion": 1,
        "status": "clean",
        "parameterSet": "reaction-lab-nonbonded-v1",
        "canonicalDataSha256": canonical_hash,
        "routeManifestSha256": sha256_bytes(ROUTES_PATH.read_bytes()),
        "modelRegistrySha256": sha256_bytes(MODELS_PATH.read_bytes()),
        "symmetryToleranceE": routes.get("symmetryToleranceE", 1e-4),
        "toolVersions": versions,
        "exactArtifacts": {"ashgcModelFilename": MODEL_FILE, "ashgcModelSha256": model_hash, "sageOffxmlFilename": FF_FILE, "sageOffxmlSha256": ff_hash},
        "requestedRouteCounts": dict(sorted(requested_counts.items())),
        "actualRouteCounts": dict(sorted(actual_counts.items())),
        "molecules": audit_items,
    }
    atomic_json_write(MOLECULES_PATH, new_records)
    atomic_json_write(AUDIT_PATH, audit)
    check_dataset()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("generate", "check"), required=True)
    args = parser.parse_args()
    try:
        if args.mode == "check":
            check_dataset()
        else:
            generate_dataset()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
