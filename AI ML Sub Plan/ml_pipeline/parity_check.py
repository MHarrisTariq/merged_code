"""
Feature parity validation (GAP-PARITY): compare training batch vs serving snapshot.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml


def load_contract(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", default=str(Path(__file__).parent / "feature_contract.yaml"))
    parser.add_argument("--train-sample", default="", help="JSON path of training row")
    parser.add_argument("--serve-sample", default="", help="JSON path of serving row")
    args = parser.parse_args()

    contract = load_contract(Path(args.contract))
    required = []
    for group in contract.get("entities", {}).values():
        for field in group:
            if isinstance(field, dict) and field.get("name"):
                if not field.get("optional"):
                    required.append(field["name"])

    if not args.train_sample or not args.serve_sample:
        print(json.dumps({"ok": True, "mode": "contract_only", "required_fields": required}))
        return

    train = json.loads(Path(args.train_sample).read_text(encoding="utf-8"))
    serve = json.loads(Path(args.serve_sample).read_text(encoding="utf-8"))
    mismatches = [k for k in required if train.get(k) != serve.get(k)]
    ok = len(mismatches) == 0
    print(json.dumps({"ok": ok, "mismatches": mismatches}, indent=2))
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
