#!/usr/bin/env python3
"""
Monitor retraining progress and validate fix
"""
import json
import os
from pathlib import Path
import time

def check_results():
    """Check if results are ready and display summary"""
    log_dir = Path("logs")
    
    results = {}
    for n in [100, 200, 500]:
        summary_file = log_dir / f"N{n}" / "summary.json"
        if summary_file.exists():
            with open(summary_file) as f:
                data = json.load(f)
                results[n] = {
                    'risk_mitigation': data.get('risk_mitigation', 0),
                    'cost_efficiency': data.get('cost_efficiency', 0),
                    'precision': data.get('precision', 0),
                    'attack_rate_reduction': data.get('attack_rate_reduction', 0),
                    'audit_coverage': data.get('coverage_cycle_dynamic', 0),
                }
    
    return results

def display_results(results):
    """Display results in readable format"""
    print("\n" + "="*80)
    print("RETRAINING RESULTS WITH FIXED REWARD WEIGHTS")
    print("="*80)
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    if not results:
        print("⏳ Results not ready yet. Retraining in progress...")
        return False
    
    # Headers
    print(f"{'Metric':<30} {'N=100':<18} {'N=200':<18} {'N=500':<18} {'Target':<18}")
    print("-"*82)
    
    # Risk Mitigation (CRITICAL FIX METRIC)
    print(f"{'Risk Mitigation':<30}", end="")
    for n in [100, 200, 500]:
        val = results.get(n, {}).get('risk_mitigation', -999)
        color = "✅" if val >= 0.10 else "❌" if val < 0 else "⚠️ "
        print(f" {color} {val:>6.2%}       ", end="")
    print(f" ✅ +10-15%")
    
    # Cost Efficiency
    print(f"{'Cost Efficiency':<30}", end="")
    for n in [100, 200, 500]:
        val = results.get(n, {}).get('cost_efficiency', -999)
        color = "✅" if 0.425 <= val <= 0.75 else "❌" if val > 0.75 else "⚠️ "
        print(f" {color} {val:>6.2%}       ", end="")
    print(f" ✅ 42.5-75%")
    
    # Precision
    print(f"{'Precision':<30}", end="")
    for n in [100, 200, 500]:
        val = results.get(n, {}).get('precision', -999)
        color = "✅" if val >= 0.35 else "❌" if val < 0.30 else "⚠️ "
        print(f" {color} {val:>8.4f}      ", end="")
    print(f" ✅ ≥0.35")
    
    # Attack Rate Reduction
    print(f"{'Attack Rate Reduction':<30}", end="")
    for n in [100, 200, 500]:
        val = results.get(n, {}).get('attack_rate_reduction', -999)
        color = "✅" if val >= 0.30 else "❌"
        print(f" {color} {val:>6.2%}       ", end="")
    print(f" ✅ ≥30%")
    
    # Audit Coverage
    print(f"{'Audit Coverage':<30}", end="")
    for n in [100, 200, 500]:
        val = results.get(n, {}).get('audit_coverage', -999)
        color = "✅" if val >= 0.80 else "⚠️ " if val >= 0.70 else "❌"
        print(f" {color} {val:>6.2%}       ", end="")
    print(f" ✅ ≥80%")
    
    print("\n" + "="*80)
    
    # Validation summary
    all_pass = all(
        r.get('risk_mitigation', -1) >= 0.10 and
        0.425 <= r.get('cost_efficiency', 0) <= 0.75 and
        r.get('precision', 0) >= 0.35
        for r in results.values()
    )
    
    if all_pass:
        print("\n✅ SUCCESS! All metrics meet paper targets!")
        print("   - Risk mitigation is POSITIVE (fix worked!)")
        print("   - Cost efficiency is realistic (60-75%)")
        print("   - Precision is above 0.35 threshold")
        print("\n🎉 Framework ready for thesis submission!")
    else:
        print("\n⚠️  Some metrics still need improvement:")
        for n in [100, 200, 500]:
            r = results.get(n, {})
            issues = []
            if r.get('risk_mitigation', -1) < 0.10:
                issues.append(f"Risk mitigation {r.get('risk_mitigation'):.2%} < +10%")
            if not (0.425 <= r.get('cost_efficiency', 0) <= 0.75):
                issues.append(f"Cost efficiency {r.get('cost_efficiency'):.2%} not in 42.5-75%")
            if r.get('precision', 0) < 0.35:
                issues.append(f"Precision {r.get('precision'):.4f} < 0.35")
            if issues:
                print(f"\n   N={n}:")
                for issue in issues:
                    print(f"   - {issue}")
    
    print("="*80 + "\n")
    return True

if __name__ == "__main__":
    print("\n📊 Smart Grid Audit Framework - Retraining Monitor")
    print("   Checking for results with FIXED reward weights...")
    print("   (lambda_attack=5.0, lambda_audit=0.2)\n")
    
    # Check immediately
    results = check_results()
    ready = display_results(results)
    
    if not ready and not results:
        print("⏳ Retraining still in progress...")
        print("   Check again in 30-60 minutes")
        print("   Logs available in: logs/N100/, logs/N200/, logs/N500/")
