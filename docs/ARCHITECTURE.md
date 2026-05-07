# Architecture

## System View

The framework is a modular cyber-physical pipeline:

1. Data and scenario generation
2. Anomaly detection and behavior analysis
3. Audit scheduling and execution
4. Response mechanism
5. Evaluation and reporting

It also has a live integration path with Rapid SCADA through a batch ingest adapter.

## High-Level Pipeline

```text
Data Sources -> Detection -> Behavior Update -> Audit Scheduler -> Response -> Metrics/Export
```

Core execution entrypoint:

1. [smartgrid_mas/run_all.py](smartgrid_mas/run_all.py)

## Major Modules

1. Agents
   [smartgrid_mas/agents](smartgrid_mas/agents)
   Domain entities, state containers, and criticality metadata.
2. Anomaly Detection
   [smartgrid_mas/anomaly_detection](smartgrid_mas/anomaly_detection)
   LSTM-assisted anomaly probability and sequence handling.
3. Behavior Analysis
   [smartgrid_mas/behavior_analysis](smartgrid_mas/behavior_analysis)
   Deviation score, adaptive baseline, adaptive thresholds, trend signals.
4. Audit Scheduling
   [smartgrid_mas/audit](smartgrid_mas/audit)
   RL policy, gradient refinement, and governance constraints.
5. Response
   [smartgrid_mas/response](smartgrid_mas/response)
   Severity scoring and mitigation actions.
6. Simulation and Evaluation
   [smartgrid_mas/simulation](smartgrid_mas/simulation)
   Dynamic run, baseline run, metric aggregation, exports.
7. Live Integration
   [smartgrid_mas/integration](smartgrid_mas/integration)
   SCADA adapter and related operational interfaces.

## Mathematical Flow

Deviation score per agent:

$$
S_i(t) = w_i \sqrt{\frac{1}{d}\sum_{j=1}^{d}\left(\frac{x_{ij}(t)-b_{ij}}{Th_{ij}}\right)^2}
$$

Adaptive baseline update:

$$
b'_{ij} = (1-\alpha)b_{ij} + \alpha x_{ij}(t)
$$

Adaptive threshold update:

$$
Th'_{ij} = Th_{ij} + \beta \Delta x_{ij}(t)
$$

Q-learning update:

$$
Q(s,a) \leftarrow Q(s,a) + \eta \left[ r + \gamma \max_{a'}Q(s',a') - Q(s,a) \right]
$$

Audit cost objective:

$$
C_i = C_a f_i + C_f\frac{R_i}{f_i}
$$

## Scheduler Governance

To prevent security collapse from cost-only optimization:

1. Minimum coverage constraints are enforced.
2. Capacity caps are enforced.
3. Missed-attack penalties dominate reward shaping.
4. Security-first reward design is used.

## Two Operation Modes

1. Experiment Running
   Controlled simulation and benchmark comparisons.
2. Rapid SCADA Live
   Live telemetry ingest from Rapid SCADA to backend scoring.

Live mode guide: [README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md).

## Runtime Sequence (Live)

1. Rapid SCADA provides channel values.
2. Bridge posts a batch payload.
3. Adapter validates required tags by agent type.
4. Backend computes anomaly score and audit decision.
5. Dashboard shows live status and risk views.

Relevant files:

1. [scripts/pull_rapidscada_to_api.ps1](scripts/pull_rapidscada_to_api.ps1)
2. [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py)
3. [smartgrid_mas/api/app.py](smartgrid_mas/api/app.py)

## Evaluation Outputs

Standard outputs include:

1. Cost efficiency and risk mitigation.
2. Accuracy, precision, recall, F1.
3. Per-attack confusion details.
4. Baseline vs dynamic comparisons.

Primary output location: [logs](logs).

## Reproducibility Rules

1. Keep scenario settings fixed for ablations.
2. Run at least 3 seeds and report mean +- std.
3. Always compare dynamic policy against baseline policy.
4. Preserve full env var configuration with final results.

## Related Documents

1. Root overview: [README.md](README.md)
2. Viva defense guide: [README_VIVA_READY_TECHNICAL_FORTRESS.md](README_VIVA_READY_TECHNICAL_FORTRESS.md)
3. Deep decision trace: [README_DEEP_ANALYSIS_DECISION_TRACE.md](README_DEEP_ANALYSIS_DECISION_TRACE.md)