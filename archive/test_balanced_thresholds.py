"""
Test balanced threshold profiles for multi-objective optimization.
Goal: Beat paper on ALL metrics (cost 75-85%, risk 25%+, precision 0.30-0.35).
"""
import os
import sys
import json
from pathlib import Path

# Test configurations: balanced profiles between baseline (4.0) and extreme (8.0)
CONFIGS = [
    {
        "name": "balanced_55",
        "SMARTGRID_SCORE_THRESHOLD": "5.5",
        "SMARTGRID_ANOMALY_PROB_THRESHOLD": "0.9995",
        "SMARTGRID_HYBRID_W_DEV": "0.65",
        "SMARTGRID_HYBRID_W_PROB": "0.35",
    },
    {
        "name": "balanced_60",
        "SMARTGRID_SCORE_THRESHOLD": "6.0",
        "SMARTGRID_ANOMALY_PROB_THRESHOLD": "0.9997",
        "SMARTGRID_HYBRID_W_DEV": "0.70",
        "SMARTGRID_HYBRID_W_PROB": "0.30",
    },
    {
        "name": "balanced_65",
        "SMARTGRID_SCORE_THRESHOLD": "6.5",
        "SMARTGRID_ANOMALY_PROB_THRESHOLD": "0.9998",
        "SMARTGRID_HYBRID_W_DEV": "0.72",
        "SMARTGRID_HYBRID_W_PROB": "0.28",
    },
]

def run_config(config, n_agents=100, seed=42):
    """Run simulation with specific threshold configuration."""
    print(f"\n{'='*80}")
    print(f"Testing {config['name']}: N={n_agents}, seed={seed}")
    print(f"Thresholds: SCORE={config['SMARTGRID_SCORE_THRESHOLD']}, "
          f"PROB={config['SMARTGRID_ANOMALY_PROB_THRESHOLD']}, "
          f"W_DEV={config['SMARTGRID_HYBRID_W_DEV']}")
    print(f"{'='*80}\n")
    
    # Set environment variables
    for key, value in config.items():
        if key != "name":
            os.environ[key] = value
    
    # Set seed and N
    os.environ["SMARTGRID_SEED"] = str(seed)
    os.environ["SMARTGRID_N_AGENTS"] = str(n_agents)
    
    # Enable 40% minimum coverage constraint
    os.environ["SMARTGRID_MIN_COVERAGE_PCT"] = "0.40"
    
    # Run simulation
    from smartgrid_mas.run_all import main
    try:
        main()
    except Exception as e:
        print(f"ERROR in {config['name']}: {e}")
        return None
    
    # Load results
    log_dir = Path(f"logs/N{n_agents}")
    summary_file = log_dir / "summary_final.json"
    
    if summary_file.exists():
        with open(summary_file, 'r') as f:
            results = json.load(f)
        return results
    else:
        print(f"WARNING: No summary file found for {config['name']}")
        return None


def main():
    """Run all balanced threshold configurations and compare."""
    print("="*80)
    print("MULTI-OBJECTIVE THRESHOLD CALIBRATION")
    print("Goal: Beat paper on ALL metrics simultaneously")
    print("  - Cost efficiency: 75-85% (not 99%)")
    print("  - Risk mitigation: 25%+ (not 20%)")
    print("  - Precision: 0.30-0.35")
    print("  - Accuracy: >99%")
    print("  - Coverage: >75%")
    print("="*80)
    
    results = {}
    
    # Test on N=100, seed=42 (quick validation)
    for config in CONFIGS:
        result = run_config(config, n_agents=100, seed=42)
        if result:
            results[config['name']] = result
    
    # Print comparison table
    print("\n" + "="*80)
    print("RESULTS COMPARISON")
    print("="*80)
    print(f"{'Config':<15} {'Cost%':<8} {'Risk%':<8} {'Prec':<8} {'Acc%':<8} {'Cov%':<8}")
    print("-"*80)
    
    for config_name, result in results.items():
        cost = result.get('cost_efficiency', 0.0) * 100
        risk = result.get('risk_mitigation', 0.0) * 100
        prec = result.get('precision', 0.0)
        acc = result.get('accuracy', 0.0) * 100
        cov = result.get('audit_coverage', 0.0) * 100
        
        print(f"{config_name:<15} {cost:>6.1f}% {risk:>6.1f}% {prec:>7.3f} {acc:>6.1f}% {cov:>6.1f}%")
    
    # Identify best balanced profile
    print("\n" + "="*80)
    print("BEST PROFILE SELECTION")
    print("="*80)
    
    best_profile = None
    best_score = -1.0
    
    for config_name, result in results.items():
        cost = result.get('cost_efficiency', 0.0) * 100
        risk = result.get('risk_mitigation', 0.0) * 100
        prec = result.get('precision', 0.0)
        acc = result.get('accuracy', 0.0) * 100
        cov = result.get('audit_coverage', 0.0) * 100
        
        # Multi-objective scoring: 
        # - Cost in target range [75-85%]
        # - Risk >= 25%
        # - Precision in [0.30-0.35]
        # - Accuracy >= 99%
        # - Coverage >= 75%
        
        cost_score = 1.0 if 75 <= cost <= 85 else max(0, 1.0 - abs(cost - 80) / 20)
        risk_score = min(1.0, risk / 25.0) if risk > 0 else 0.0
        prec_score = 1.0 if 0.30 <= prec <= 0.35 else max(0, 1.0 - abs(prec - 0.325) / 0.1)
        acc_score = 1.0 if acc >= 99.0 else 0.8
        cov_score = min(1.0, cov / 75.0)
        
        # Weighted multi-objective score (equal weights)
        total_score = (cost_score + risk_score + prec_score + acc_score + cov_score) / 5.0
        
        print(f"{config_name}: total_score={total_score:.3f} "
              f"(cost={cost_score:.2f}, risk={risk_score:.2f}, prec={prec_score:.2f}, "
              f"acc={acc_score:.2f}, cov={cov_score:.2f})")
        
        if total_score > best_score:
            best_score = total_score
            best_profile = config_name
    
    if best_profile:
        print(f"\n✓ BEST BALANCED PROFILE: {best_profile} (score={best_score:.3f})")
        print(f"\nRecommended for full multi-seed validation (N=100/200/500, seeds=42/43/44)")
    else:
        print("\n✗ No profile met multi-objective criteria - may need further tuning")
    
    return results, best_profile


if __name__ == "__main__":
    results, best_profile = main()
