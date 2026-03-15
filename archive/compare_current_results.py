"""
Compare balanced threshold profiles - comprehensive results.
"""
import json
from pathlib import Path

# Load results from logs directory
results_dir = Path("logs/N100")
summary_file = results_dir / "summary.json"

if not summary_file.exists():
    print("No summary.json found in logs/N100")
    exit(1)

with open(summary_file, 'r') as f:
    data = json.load(f)

# Extract key metrics
cost = data.get('cost_efficiency', 0.0) * 100
risk = data.get('risk_mitigation', 0.0) * 100
prec = data.get('precision', 0.0)
recall = data.get('recall', 0.0)
f1 = data.get('f1', 0.0)
acc = data.get('accuracy', 0.0) * 100
cov = data.get('coverage_cycle_dynamic', 0.0) * 100

print("\n" + "="*80)
print("CURRENT CONFIGURATION RESULTS (N=100, seed=42)")
print("="*80)
print(f"Cost Efficiency:    {cost:6.2f}%")
print(f"Risk Mitigation:    {risk:6.2f}%")
print(f"Precision:          {prec:6.3f}")
print(f"Recall:             {recall:6.3f}")
print(f"F1-Score:           {f1:6.3f}")
print(f"Accuracy:           {acc:6.2f}%")
print(f"Coverage:           {cov:6.2f}%")
print("="*80)

# Multi-objective scoring
cost_score = 1.0 if 75 <= cost <= 85 else max(0, 1.0 - abs(cost - 80) / 20)
risk_score = min(1.0, risk / 25.0) if risk > 0 else 0.0
prec_score = 1.0 if 0.30 <= prec <= 0.35 else max(0, 1.0 - abs(prec - 0.325) / 0.1)
acc_score = 1.0 if acc >= 99.0 else 0.8
cov_score = min(1.0, cov / 75.0)
total_score = (cost_score + risk_score + prec_score + acc_score + cov_score) / 5.0

print(f"\nMULTI-OBJECTIVE SCORES:")
print(f"  cost_score:  {cost_score:.2f} (target: 75-85%, actual: {cost:.1f}%)")
print(f"  risk_score:  {risk_score:.2f} (target: ≥25%, actual: {risk:.1f}%)")
print(f"  prec_score:  {prec_score:.2f} (target: 0.30-0.35, actual: {prec:.3f})")
print(f"  acc_score:   {acc_score:.2f} (target: ≥99%, actual: {acc:.1f}%)")
print(f"  cov_score:   {cov_score:.2f} (target: ≥75%, actual: {cov:.1f}%)")
print(f"  ──────────────────────────────")
print(f"  total_score: {total_score:.3f} / 1.000")

if total_score >= 0.90:
    print(f"\n✅ EXCELLENT multi-objective balance!")
elif total_score >= 0.80:
    print(f"\n✓ GOOD multi-objective balance")
else:
    print(f"\n⚠ Needs improvement on multi-objective balance")

# Paper comparison
print(f"\n" + "="*80)
print("PAPER COMPARISON")
print("="*80)
paper_cost = 42.5
paper_risk = 15.0  # estimated
paper_acc = 98.4
paper_cov = 93.8
paper_f1 = 0.558

print(f"{'Metric':<20} {'Paper':<10} {'Ours':<10} {'Delta':<10}")
print("-"*80)
print(f"{'Cost Efficiency':<20} {paper_cost:>6.1f}%   {cost:>6.1f}%   {'+' if cost>paper_cost else ''}{cost-paper_cost:>6.1f}%")
print(f"{'Risk Mitigation':<20} {paper_risk:>6.1f}%   {risk:>6.1f}%   {'+' if risk>paper_risk else ''}{risk-paper_risk:>6.1f}%")
print(f"{'Accuracy':<20} {paper_acc:>6.1f}%   {acc:>6.1f}%   {'+' if acc>paper_acc else ''}{acc-paper_acc:>6.1f}%")
print(f"{'Coverage':<20} {paper_cov:>6.1f}%   {cov:>6.1f}%   {'+' if cov>paper_cov else ''}{cov-paper_cov:>6.1f}%")
print(f"{'F1-Score':<20} {paper_f1:>6.3f}    {f1:>6.3f}    {'+' if f1>paper_f1 else ''}{f1-paper_f1:>6.3f}")

# Count how many metrics beat paper
beats_paper = sum([
    cost > paper_cost,
    risk > paper_risk,
    acc > paper_acc,
    cov > paper_cov,
    f1 >= paper_f1
])

print(f"\n{'✅ BEATS PAPER ON ' + str(beats_paper) + '/5 METRICS'}")
print("="*80)
