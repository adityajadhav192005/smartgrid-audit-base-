#!/usr/bin/env python3
"""Monitor the running Smart Grid simulation and display progress."""
import os
import time
import sys
from datetime import datetime
from pathlib import Path

def check_progress():
    """Check simulation progress and display status."""
    base_dir = Path("d:/Mtech Main project/smartgrid-audit-base")
    
    print("\n" + "="*70)
    print(f"SMART GRID SIMULATION MONITOR - {datetime.now().strftime('%H:%M:%S')}")
    print("="*70 + "\n")
    
    # Check if simulation is running
    try:
        import psutil
        python_procs = [p for p in psutil.process_iter(['pid', 'name', 'cpu_times'])
                       if 'python' in p.info['name'].lower() and 'experiment_runner' in p.cmdline()]
        
        if python_procs:
            proc = python_procs[0]
            cpu_time = proc.cpu_times().user + proc.cpu_times().system
            memory_mb = proc.memory_info().rss / 1024 / 1024
            
            print(f"✅ SIMULATION RUNNING")
            print(f"   PID: {proc.pid}")
            print(f"   CPU Time: {cpu_time:.1f}s")
            print(f"   Memory: {memory_mb:.1f} MB")
            print(f"   Estimated Progress: {cpu_time / 600 * 100:.1f}% (target: 600s for 24hr run)\n")
        else:
            print("⏸️  SIMULATION NOT CURRENTLY RUNNING\n")
    except ImportError:
        print("⚠️  psutil not installed (pip install psutil for process monitoring)\n")
    
    # Check for output files
    print("Output Files:")
    output_files = [
        "dynamic_metrics.csv",
        "baseline_metrics.csv",
        "experiment_output.log"
    ]
    
    for fname in output_files:
        fpath = base_dir / fname
        if fpath.exists():
            size_kb = fpath.stat().st_size / 1024
            mtime = datetime.fromtimestamp(fpath.stat().st_mtime).strftime('%H:%M:%S')
            print(f"   ✅ {fname} ({size_kb:.1f} KB, updated {mtime})")
        else:
            print(f"   ⏳ {fname} (not yet created)")
    
    print("\n" + "="*70)
    print("Next Steps:")
    print("  1. Run this script periodically to monitor progress")
    print("  2. Once CSV files appear, simulation is generating data")
    print("  3. Run 'python analyze_results.py' when complete")
    print("="*70 + "\n")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        # Watch mode - update every 30 seconds
        print("Monitoring simulation... (Ctrl+C to stop)")
        try:
            while True:
                check_progress()
                time.sleep(30)
        except KeyboardInterrupt:
            print("\n✅ Monitor stopped")
    else:
        check_progress()
