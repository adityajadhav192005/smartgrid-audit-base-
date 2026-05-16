# Deep Analysis and Decision Trace

This document records design decisions, why they were made, and what trade-offs remain.

## Design Goal

Beat the paper baseline on both cost and risk without sacrificing detection quality.

## Decision Timeline

1. Moved from static audit scheduling to RL scheduling.
2. Added adaptive baseline and threshold updates to handle drift.
3. Added governance constraints to prevent audit collapse.
4. Corrected reward weighting to prioritize missed-attack penalties.
5. Integrated per-attack metric accounting fixes for valid reporting.
6. Hardened live Rapid SCADA ingestion with strict type-aware validation.

## Key Trade-Offs

1. Security-first reward improves recall but can lower precision.
2. Strong constraints improve safety but may reduce short-term cost savings.
3. Rich hybrid logic improves robustness but increases system complexity.

## Why RL Plus Gradient

1. RL learns long-horizon scheduling policy under uncertainty.
2. Gradient update provides local cost correction per cycle.
3. Combined approach is more stable than either method alone in current setup.

## Why Precision Is Still Low

Observed behavior:

1. Recall is near 1.0.
2. Precision remains below target 0.35.

Likely causes:

1. Conservative thresholding toward over-detection.
2. High missed-attack penalties in reward design.
3. Class imbalance and limited hard negatives.

Planned mitigations:

1. Probability calibration and threshold tuning.
2. Hard-negative mining in detector pipeline.
3. Reward fine-tuning to reduce false positives without recall collapse.

## Live Integration Decisions

1. Use batch ingest endpoint for scalability.
2. Reject missing required live tags instead of fallback substitution.
3. Keep Rapid SCADA pipeline operationally honest in documentation.

## Verification Discipline

Before claiming improvements:

1. Run N=100, N=200, and N=500.
2. Use at least 3 seeds.
3. Report mean +- std.
4. Confirm per-attack support is included.
5. Preserve environment variable configuration.

## Where to Cross-Check

1. Project summary: [README.md](README.md)
2. Architecture details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. Rapid SCADA guide: [README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md)
4. Viva guide: [README_VIVA_READY_TECHNICAL_FORTRESS.md](README_VIVA_READY_TECHNICAL_FORTRESS.md)