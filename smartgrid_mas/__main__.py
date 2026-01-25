"""
Module entry point for smartgrid_mas package.

Supports: python -m smartgrid_mas.run_all
"""
import sys

if __name__ == "__main__":
    # Handle python -m smartgrid_mas.run_all
    from smartgrid_mas.run_all import main
    main()
