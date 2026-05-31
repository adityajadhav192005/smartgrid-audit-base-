"""Module entry point for the smartgrid_mas package.

Supported invocations:

    python -m smartgrid_mas                       # default: run_all
    python -m smartgrid_mas run_all [args...]
    python -m smartgrid_mas check_environment [args...]
"""

from __future__ import annotations

import sys
from typing import Callable, Dict


def _run_all(argv: list[str]) -> int:
    from smartgrid_mas.run_all import main as run_all_main

    # run_all.main() reads sys.argv directly. Mirror the rest of argv into it
    # so flags after the subcommand still reach the underlying parser.
    sys.argv = ["smartgrid_mas.run_all", *argv]
    run_all_main()
    return 0


def _check_environment(argv: list[str]) -> int:
    from smartgrid_mas.check_environment import main as check_main

    return check_main(argv)


_DISPATCH: Dict[str, Callable[[list[str]], int]] = {
    "run_all": _run_all,
    "check_environment": _check_environment,
    "check-environment": _check_environment,
}


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        return _run_all([])

    command, rest = argv[0], argv[1:]
    if command in ("-h", "--help", "help"):
        print(__doc__)
        print("Available commands:", ", ".join(sorted(set(_DISPATCH))))
        return 0

    handler = _DISPATCH.get(command)
    if handler is None:
        print(f"Unknown command: {command!r}", file=sys.stderr)
        print(f"Available commands: {', '.join(sorted(set(_DISPATCH)))}", file=sys.stderr)
        return 2

    return handler(rest)


if __name__ == "__main__":
    sys.exit(main())
