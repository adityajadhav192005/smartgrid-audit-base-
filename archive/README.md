# Archive - Test Runners and Intermediate Documentation

This folder contains test utilities and intermediate documentation that were moved here during project cleanup to keep the root directory clean and focused.

## Contents

### Test Runners
- **quick_test.py** — Quick 5-timestep test to verify framework basics
- **run_demo.py** — Demo simulation with detailed console output
- **monitor_sim.py** — Monitoring utility for ongoing simulations
- **verify_fixes.py** — Verification script for Pylance fixes

### Documentation
- **docs/** — Intermediate and step-by-step documentation:
  - 00_START_HERE.md - Initial getting started guide
  - START_HERE.md - Alternative start guide
  - DELIVERY_SUMMARY.md - Initial delivery documentation
  - EXECUTION_REPORT.md - Execution verification report
  - FINAL_REPORT.md - Final status report
  - FRAMEWORK_STATUS_REPORT.md - Framework status overview
  - INDEX.md - Documentation index
  - PYLANCE_FIXES.md - Record of Pylance fixes applied
  - QUICK_REFERENCE.md - Quick reference guide
  - RUN_ALL_GUIDE.md - Complete run_all user guide
  - UNIFIED_RUNNER_REPORT.md - Unified runner documentation

### Reference Files
- **smartgrid.txt** — Project description text file
- **smartgrid.pdf** — Research paper reference (optional)

## Why They're Here

**Test Runners**: These are utility scripts that aren't part of the core framework and aren't imported by any modules. They were moved here to:
- Keep root directory clean (only smartgrid_mas/, logs/, docs/, tests/ at root level)
- Avoid confusion between core framework and test utilities
- Allow easy access when needed for testing/debugging

**Intermediate Docs**: These were created during development and testing but are superseded by the main README.md and inline documentation. They were archived to:
- Preserve development history
- Reduce clutter in root directory
- Keep only the essential README.md at root

## How to Use

### Run a Test Runner
```bash
python archive/quick_test.py          # Quick 5-timestep test
python archive/run_demo.py            # Demo simulation
python archive/verify_fixes.py        # Verify fixes
```

### Access Documentation
Reference documentation is available in `archive/docs/` for detailed implementation history and intermediate guides.

## Main Documentation

For the authoritative documentation, see:
- **../README.md** — Main project README with quick start and architecture
- **../docs/** — Additional documentation (if present)

## Entry Points (These Are Still in Root)

The main entry points are **NOT** in archive:
- `python -m smartgrid_mas.run_all` — Full experiment runner (core framework)
- `python -m smartgrid_mas.simulation.experiment_runner` — Alternative runner
- `pytest -q` — Run all unit tests

---

All utilities here are optional. The framework works without them.
