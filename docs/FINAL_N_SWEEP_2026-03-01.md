# Final Experiment Summary (N Sweep)

Date: 2026-03-01
Configuration: 24h cycle, 5-minute timestep, budget ratio = 0.40, N = 100/200/500

## Key Outcomes

| Metric | N100 | N200 | N500 |
|---|---:|---:|---:|
| Attack Rate (Dynamic) | 0.15% | 0.14% | 0.14% |
| Attack Rate (Baseline) | 0.62% | 0.62% | 0.63% |
| Attack Rate Reduction | 75.98% | 77.18% | 78.55% |
| Precision | 0.2402 | 0.2269 | 0.2145 |
| Recall | 1.000 | 1.000 | 1.000 |
| F1 | 0.3874 | 0.3699 | 0.3533 |
| TPR / TNR / FPR | 1.000 / 0.9953 / 0.0047 | 1.000 / 0.9952 / 0.0048 | 1.000 / 0.9950 / 0.0050 |
| Accuracy | 0.995 | 0.995 | 0.995 |
| Risk Mitigation | 79.32% | 80.36% | 81.24% |
| CLSI | 99.65% | 99.65% | 99.65% |
| Cost Efficiency | 60.00% | 60.00% | 60.00% |

## Cost (Executed)

| Metric | N100 | N200 | N500 |
|---|---:|---:|---:|
| Dynamic Cost | $11,520.00 | $23,040.00 | $57,600.00 |
| Baseline Cost | $28,800.00 | $57,600.00 | $144,000.00 |

## Scaling/Runtime

- RL iterations: 40,320 (N100), 80,640 (N200), 201,600 (N500)
- Gradient iterations: 288 for all N
- Events (Dyn/Base): 28,800/28,800 (N100), 57,600/57,600 (N200), 144,000/144,000 (N500)
- Total experiment runtime: 342.3 seconds

## Seed Robustness (across N)

- Attack rate reduction: 0.7724 ± 0.0105
- Cost efficiency: 0.6000 ± 0.0000
- F1: 0.3702 ± 0.0139
- Risk mitigation: 0.8031 ± 0.0078

## Assessment

- Cost objective is satisfied at paper-aligned level (60%).
- Risk objective is strongly positive and stable across scale.
- Detection recall and overall accuracy are excellent.
- Remaining improvement area: precision (0.21-0.24 range) if a higher precision target is required.
