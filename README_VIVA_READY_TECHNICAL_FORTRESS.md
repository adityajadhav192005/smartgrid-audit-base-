# Viva Ready Technical Fortress

This file is the defense-oriented briefing for the Smart Grid AI Audit Framework.

## One-Line Thesis

The framework learns risk-aware audit schedules that reduce both operational cost and cyber-physical risk, while maintaining very high detection accuracy in multi-agent smart grids.

## Core Contributions

1. Physics-aware anomaly scoring with agent criticality weighting.
2. Adaptive baseline and threshold updates for non-stationary grid behavior.
3. RL audit policy with governance constraints to prevent under-auditing.
4. Hybrid scheduling with gradient refinement for cost-risk balance.
5. End-to-end Rapid SCADA live integration for operational demonstration.

## Why This Is Better Than Fixed Audits

1. Fixed audits spend resources uniformly.
2. This framework allocates audits by current risk and agent criticality.
3. High-risk zones are prioritized in real time.
4. Baseline comparison shows strong cost savings with stronger risk outcomes.

## Mathematical Spine

Anomaly score per agent:

$$
S_i(t) = w_i \sqrt{\frac{1}{d}\sum_{j=1}^{d}\left(\frac{x_{ij}(t)-b_{ij}}{Th_{ij}}\right)^2}
$$

Q-learning update:

$$
Q(s,a) \leftarrow Q(s,a) + \alpha\left[r + \gamma \max_{a'}Q(s',a') - Q(s,a)\right]
$$

Cost objective per agent:

$$
C_i = C_a f_i + C_f\frac{R_i}{f_i}
$$

## Validated Performance Snapshot

| N | Cost Efficiency | Risk Mitigation | Accuracy | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| 100 | 83.55% | 67.62% | 99.56% | 0.2515 | 1.0000 |
| 200 | 84.75% | 71.33% | 99.55% | 0.2362 | 1.0000 |
| 500 | 92.65% | 72.08% | 99.54% | 0.2278 | 1.0000 |

Defense talking point:

1. Headline paper metrics are exceeded.
2. Precision is the remaining optimization gap.

## Anticipated Viva Questions and Crisp Answers

1. Why RL instead of only supervised ML?
   RL optimizes sequential decisions under uncertainty, which matches audit scheduling over time.
2. Why such high recall but lower precision?
   Current policy is security-first and heavily penalizes missed attacks, increasing positive predictions.
3. How do you avoid cost-only collapse?
   Minimum coverage governance and stronger missed-attack penalties in reward shaping.
4. Why trust synthetic scenarios?
   They provide controlled, reproducible stress tests across FDI, DoS, coordinated chain attacks.
5. Is this deployable?
   Yes, via API and Rapid SCADA integration, with clear runtime health and ingestion verification.

## Evidence Files to Show Examiners

1. Main architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. Rapid SCADA runbook: [README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md)
3. Root summary: [README.md](README.md)
4. Results and alignment reports: [PAPER_ALIGNMENT_VALIDATION.md](PAPER_ALIGNMENT_VALIDATION.md)
5. Operational reports: [RESULTS_SUMMARY.md](RESULTS_SUMMARY.md)

## Safe Claims Template

Use this exact framing in viva:

1. We exceed baseline paper metrics for cost efficiency, risk mitigation, and accuracy.
2. Precision target is not yet met and is explicitly tracked as ongoing work.
3. Live SCADA pipeline is real, while current telemetry values are generated calculated channels, not field sensors.

## Next Technical Step

Priority: improve precision without reducing recall by adding calibrated thresholding and hard-negative mining in hybrid detection.