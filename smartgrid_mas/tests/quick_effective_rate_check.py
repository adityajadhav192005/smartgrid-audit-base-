from smartgrid_mas.simulation.eval_suite import mean_attack_rate, attack_rate_reduction
import os

# Ensure env toggles (note: eval_suite reads env at import time; we've already imported it)
# This script relies on the function using the module-level toggles already set on import.

baseline = [{"attack_rate": 0.02} for _ in range(12)]

dynamic = []
for i in range(12):
    rec = {"attack_rate": 0.02, "attack_rate_effective": 0.01 if i % 2 == 0 else 0.02}
    dynamic.append(rec)

mad = mean_attack_rate(dynamic)
mab = mean_attack_rate(baseline)
red = attack_rate_reduction(dynamic, baseline)

print({
    "dynamic_mean_attack_rate": round(mad, 6),
    "baseline_mean_attack_rate": round(mab, 6),
    "attack_rate_reduction": round(red, 6),
})
