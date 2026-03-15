"""Quick test for v12 - N=100 only"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from smartgrid_mas.run_all import main
import argparse

if __name__ == "__main__":
    # Override to only run N=100
    parser = argparse.ArgumentParser()
    args = parser.parse_args([])
    
    # Monkey patch to force N=100 only
    import smartgrid_mas.run_all as run_all_module
    original_n_values = [100, 200, 500]
    run_all_module.N_VALUES = [100]  # Only test N=100
    
    print("=" * 70)
    print("v12 QUICK TEST: N=100 ONLY")
    print("=" * 70)
    
    main()
    
    print("\n" + "=" * 70)
    print("v12 TEST COMPLETE - Check logs/N100/summary.json for results")
    print("=" * 70)
