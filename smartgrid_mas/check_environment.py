"""
SmartGrid environment validator.

Run before a cold startup to confirm every dependency, folder, port, and
configuration the demo stack expects is in place.

Usage:
    python -m smartgrid_mas.check_environment
    python -m smartgrid_mas.check_environment --json
    python -m smartgrid_mas.check_environment --strict   # exit 1 on any WARN
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import shutil
import socket
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable, List, Tuple


PROJECT_ROOT = Path(__file__).resolve().parent.parent

REQUIRED_DIRS = [
    "smartgrid_mas",
    "smartgrid_mas/api",
    "smartgrid_mas/agents",
    "smartgrid_mas/audit",
    "smartgrid_mas/environment",
    "smartgrid_mas/detection",
    "smartgrid_mas/integration",
    "web",
    "web/src/app",
    "scripts",
]

REQUIRED_FILES = [
    "requirements.txt",
    "smartgrid_mas/__init__.py",
    "smartgrid_mas/api/app.py",
    "smartgrid_mas/environment/grid_env.py",
    "smartgrid_mas/environment/scenario_engine.py",
    "web/package.json",
    "web/.env.local",
    "scripts/start_local_demo.ps1",
    "scripts/stop_local_demo.ps1",
]

REQUIRED_PY_PACKAGES = [
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("pydantic", "pydantic"),
    ("numpy", "numpy"),
    ("pandas", "pandas"),
    ("sklearn", "scikit-learn"),
    ("yaml", "pyyaml"),
    ("scipy", "scipy"),
    ("psutil", "psutil"),
]

OPTIONAL_PY_PACKAGES = [
    ("torch", "torch (LSTM training)"),
    ("matplotlib", "matplotlib (figure generation)"),
    ("tqdm", "tqdm (progress bars)"),
]

REQUIRED_CLI = ["node", "npm"]

PORTS_TO_CHECK = [
    (8000, "FastAPI backend"),
    (3000, "Next.js dashboard"),
    (10109, "Rapid SCADA bridge"),
]

ENV_VARS = [
    ("SMARTGRID_API_KEY", "smartgrid-dev-key", False),
    ("SMARTGRID_API_HOST", "127.0.0.1", False),
    ("SMARTGRID_API_PORT", "8000", False),
]

WEB_ENV_KEYS = [
    "SMARTGRID_API_KEY",
    "SMARTGRID_API_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]


@dataclass
class CheckResult:
    name: str
    status: str  # OK | WARN | FAIL
    detail: str = ""


@dataclass
class Report:
    results: List[CheckResult] = field(default_factory=list)

    def add(self, name: str, status: str, detail: str = "") -> None:
        self.results.append(CheckResult(name=name, status=status, detail=detail))

    def counts(self) -> Tuple[int, int, int]:
        ok = sum(1 for r in self.results if r.status == "OK")
        warn = sum(1 for r in self.results if r.status == "WARN")
        fail = sum(1 for r in self.results if r.status == "FAIL")
        return ok, warn, fail


def _check_dirs(report: Report) -> None:
    for rel in REQUIRED_DIRS:
        p = PROJECT_ROOT / rel
        if p.is_dir():
            report.add(f"dir:{rel}", "OK")
        else:
            report.add(f"dir:{rel}", "FAIL", f"missing directory {p}")


def _check_files(report: Report) -> None:
    for rel in REQUIRED_FILES:
        p = PROJECT_ROOT / rel
        if p.is_file():
            report.add(f"file:{rel}", "OK")
        else:
            status = "WARN" if rel.endswith(".env.local") else "FAIL"
            report.add(f"file:{rel}", status, f"missing file {p}")


def _check_python_packages(report: Report) -> None:
    for mod, label in REQUIRED_PY_PACKAGES:
        try:
            importlib.import_module(mod)
            report.add(f"py:{label}", "OK")
        except ImportError as exc:
            report.add(f"py:{label}", "FAIL", f"`pip install {label}` ({exc})")

    for mod, label in OPTIONAL_PY_PACKAGES:
        try:
            importlib.import_module(mod)
            report.add(f"py:{label}", "OK")
        except ImportError:
            report.add(f"py:{label}", "WARN", "optional, install if needed")


def _check_cli(report: Report) -> None:
    for binary in REQUIRED_CLI:
        path = shutil.which(binary)
        if path:
            report.add(f"cli:{binary}", "OK", path)
        else:
            report.add(f"cli:{binary}", "FAIL", f"{binary} not found on PATH")


def _check_ports(report: Report) -> None:
    for port, label in PORTS_TO_CHECK:
        in_use = _port_in_use(port)
        if in_use:
            report.add(f"port:{port}", "WARN", f"{label} port already bound (existing process)")
        else:
            report.add(f"port:{port}", "OK", f"{label} port free")


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return True
    return False


def _check_env_vars(report: Report) -> None:
    for var, default, required in ENV_VARS:
        value = os.environ.get(var)
        if value:
            report.add(f"env:{var}", "OK", f"= {_mask(var, value)}")
        elif required:
            report.add(f"env:{var}", "FAIL", "unset")
        else:
            report.add(f"env:{var}", "OK", f"unset (will default to {default!r})")


def _check_web_env_local(report: Report) -> None:
    env_file = PROJECT_ROOT / "web" / ".env.local"
    if not env_file.exists():
        report.add("web:.env.local", "WARN", "missing — dashboard will use code defaults")
        return

    contents = env_file.read_text(encoding="utf-8-sig", errors="ignore")
    keys_present = {
        line.split("=", 1)[0].strip().lstrip("﻿")
        for line in contents.splitlines()
        if line and not line.lstrip().startswith("#") and "=" in line
    }
    for key in WEB_ENV_KEYS:
        if key in keys_present:
            report.add(f"web:{key}", "OK")
        else:
            severity = "FAIL" if key.startswith("SMARTGRID_API_KEY") else "WARN"
            report.add(f"web:{key}", severity, f"not set in web/.env.local")


def _check_web_node_modules(report: Report) -> None:
    node_modules = PROJECT_ROOT / "web" / "node_modules"
    if node_modules.is_dir():
        report.add("web:node_modules", "OK")
    else:
        report.add("web:node_modules", "WARN", "run `cd web && npm install`")


def _mask(var: str, value: str) -> str:
    if "KEY" in var or "SECRET" in var or "TOKEN" in var:
        if len(value) <= 4:
            return "***"
        return f"{value[:2]}***{value[-2:]}"
    return value


CHECKS: List[Tuple[str, Callable[[Report], None]]] = [
    ("Folder structure", _check_dirs),
    ("Required files", _check_files),
    ("Python packages", _check_python_packages),
    ("CLI tools", _check_cli),
    ("Network ports", _check_ports),
    ("Environment variables", _check_env_vars),
    ("Dashboard env (web/.env.local)", _check_web_env_local),
    ("Dashboard node_modules", _check_web_node_modules),
]


def _print_text(report: Report) -> None:
    icon = {"OK": "OK  ", "WARN": "WARN", "FAIL": "FAIL"}
    last_group = ""
    for r in report.results:
        group = r.name.split(":", 1)[0]
        if group != last_group:
            print(f"\n[{group}]")
            last_group = group
        detail = f"  ({r.detail})" if r.detail else ""
        print(f"  {icon[r.status]}  {r.name}{detail}")

    ok, warn, fail = report.counts()
    print(f"\nSummary: {ok} OK | {warn} WARN | {fail} FAIL")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="smartgrid_mas.check_environment",
        description="Validate folder structure, deps, ports, and env for a cold startup.",
    )
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    parser.add_argument(
        "--strict", action="store_true", help="exit non-zero on any WARN, not just FAIL"
    )
    args = parser.parse_args(argv)

    report = Report()
    for _, fn in CHECKS:
        fn(report)

    if args.json:
        payload = {
            "project_root": str(PROJECT_ROOT),
            "results": [asdict(r) for r in report.results],
            "summary": dict(zip(("ok", "warn", "fail"), report.counts())),
        }
        print(json.dumps(payload, indent=2))
    else:
        print(f"SmartGrid environment check  (root: {PROJECT_ROOT})")
        _print_text(report)

    _, warn, fail = report.counts()
    if fail:
        return 2
    if warn and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
