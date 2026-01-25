#!/usr/bin/env python3
"""
Quick demo script showing the Smart Grid Audit Framework execution.
Shows what happens when you run: python -m smartgrid_mas.run_all
"""

import sys
sys.path.insert(0, '/d/Mtech Main project/smartgrid-audit-base')

if __name__ == "__main__":
    from smartgrid_mas.run_all import main
    
    print("\n" + "="*80)
    print("SMART GRID AUDIT FRAMEWORK - EXECUTION DEMO")
    print("="*80)
    print("\nRunning: python -m smartgrid_mas.run_all\n")
    print("This will orchestrate the complete experimental pipeline:")
    print("  ✓ Setting deterministic seeds")
    print("  ✓ Validating environment")
    print("  ✓ Loading/training LSTM model")
    print("  ✓ Building agent pools (paper-faithful)")
    print("  ✓ Initializing attack scenarios")
    print("  ✓ Running 24-hour DYNAMIC simulation (RL + gradient)")
    print("  ✓ Running 24-hour BASELINE simulation (fixed audit frequency)")
    print("  ✓ Computing evaluation metrics")
    print("  ✓ Exporting results to logs/")
    print("  ✓ Printing final summary")
    print("\n" + "="*80)
    print("Starting execution...\n")
    
    try:
        main()
    except Exception as e:
        print(f"\nExecution completed with status: {type(e).__name__}: {e}")
