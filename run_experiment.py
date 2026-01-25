"""
Smart Grid Audit Framework - Quick Start Script

This script provides a simple entry point for running the complete pipeline.

Usage:
    python run_experiment.py                    # Run with default settings
    python run_experiment.py --config my.json   # Run with custom config
    python run_experiment.py --help             # Show help
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from smartgrid_mas.pipeline import Pipeline


def main():
    parser = argparse.ArgumentParser(
        description="Smart Grid Audit Framework - Run Complete Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_experiment.py                        # Default configuration
  python run_experiment.py --config my.json       # Custom configuration
  python run_experiment.py --dynamic-only         # Run dynamic mode only
  python run_experiment.py --baseline-only        # Run baseline mode only
  
Output:
  Results are saved to logs/ directory:
    - summary.json         (aggregate metrics)
    - dynamic_metrics.csv  (per-timestep data)
    - baseline_metrics.csv (baseline comparison)
    - events_dynamic.csv   (attack/audit events)
        """
    )
    
    parser.add_argument(
        '--config',
        type=Path,
        default=None,
        help='Path to configuration JSON file (optional)'
    )
    
    parser.add_argument(
        '--dynamic-only',
        action='store_true',
        help='Run only dynamic simulation (skip baseline)'
    )
    
    parser.add_argument(
        '--baseline-only',
        action='store_true',
        help='Run only baseline simulation (skip dynamic)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('logs'),
        help='Output directory for results (default: logs/)'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.dynamic_only and args.baseline_only:
        parser.error("Cannot specify both --dynamic-only and --baseline-only")
    
    # Determine modes to run
    modes = ['dynamic', 'baseline']
    if args.dynamic_only:
        modes = ['dynamic']
    elif args.baseline_only:
        modes = ['baseline']
    
    print("=" * 70)
    print("SMART GRID AUDIT FRAMEWORK")
    print("=" * 70)
    print(f"Configuration: {args.config or 'default'}")
    print(f"Modes: {', '.join(modes)}")
    print(f"Output: {args.output_dir.absolute()}")
    print("=" * 70)
    print()
    
    try:
        # Initialize pipeline
        pipeline = Pipeline(config_path=args.config)
        
        # Override output directory if specified
        if args.output_dir:
            pipeline.config_manager.config.evaluation.output_dir = args.output_dir
        
        # Run pipeline
        results = pipeline.run(modes=modes)
        
        # Print summary
        print("\n" + "=" * 70)
        print("EXPERIMENT COMPLETED SUCCESSFULLY")
        print("=" * 70)
        
        if 'evaluation' in results:
            eval_results = results['evaluation']
            print("\nKey Metrics:")
            print(f"  Attack Rate Reduction: {eval_results.get('attack_rate_reduction', 0):.2%}")
            print(f"  Cost Efficiency:       {eval_results.get('cost_efficiency', 0):.2%}")
            print(f"  Risk Mitigation:       {eval_results.get('risk_mitigation', 0):.2%}")
            print(f"  F1-Score:              {eval_results.get('f1', 0):.3f}")
            print(f"  Precision:             {eval_results.get('precision', 0):.3f}")
            print(f"  Recall:                {eval_results.get('recall', 0):.3f}")
        
        print(f"\nResults saved to: {args.output_dir.absolute()}")
        print("=" * 70)
        
        return 0
    
    except Exception as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
