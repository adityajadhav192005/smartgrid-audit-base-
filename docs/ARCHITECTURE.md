# Architecture & Design Document

## System Overview

The Smart Grid Audit Framework is organized as a **modular pipeline** with clear separation of concerns. Each stage has well-defined inputs/outputs and can be tested independently.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Configuration Manager                        │
│  • Type-safe parameter access (dataclasses)                      │
│  • JSON config loading/saving                                    │
│  • Parameter validation                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Generation Stage                       │
│  • Smart grid topology generation                                │
│  • Agent initialization (generators, substations, PMUs)          │
│  • Attack injection (FDI, DoS, MITM, CHAIN)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Anomaly Detection Stage                       │
│  • LSTM-based anomaly scoring                                    │
│  • Deviation-based classification (Eq. 8)                        │
│  • Attack type identification (heuristic)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Behavior Analysis Stage                        │
│  • Adaptive baseline refinement (Eq. 10)                         │
│  • Dynamic threshold adjustment                                  │
│  • Cumulative deviation tracking                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Audit Scheduling Stage                        │
│  • Q-learning-based optimization                                 │
│  • Dynamic frequency adjustment                                  │
│  • Cost-aware audit allocation                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Evaluation Stage                            │
│  • Precision, Recall, F1-Score                                   │
│  • Per-attack TPR/FPR metrics                                    │
│  • Statistical significance tests                                │
│  • Cross-layer stability index                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Report Generation                            │
│  • CSV exports (metrics, events)                                 │
│  • JSON summary (aggregate statistics)                           │
│  • Logging & visualization                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### 1. Configuration Manager (`pipeline/config_manager.py`)

**Purpose**: Centralize all configuration parameters with type safety

**Key Classes**:
- `SimulationConfig`: Grid topology, agent distribution, physical constraints
- `RLConfig`: Q-learning hyperparameters, convergence criteria
- `AuditConfig`: Audit costs, frequency constraints
- `AnomalyConfig`: LSTM parameters, adaptive learning rates
- `EvaluationConfig`: Output settings, metric flags

**Methods**:
- `load_from_file()`: Parse JSON configuration
- `save_to_file()`: Export current configuration
- `validate()`: Check parameter constraints
- `get_simulation_params()`: Convert to simulation kwargs

### 2. Main Pipeline (`pipeline/main_pipeline.py`)

**Purpose**: Orchestrate all pipeline stages

**Key Methods**:
- `run()`: Execute complete pipeline (dynamic + baseline + evaluation)
- `_run_dynamic_simulation()`: Run RL-optimized simulation
- `_run_baseline_simulation()`: Run fixed-frequency baseline
- `_evaluate_results()`: Compare dynamic vs baseline
- `_generate_reports()`: Export CSV/JSON outputs

### 3. Agents (`agents/`)

**Purpose**: Model smart grid entities with physical/cyber attributes

**Agent Types**:
- `GeneratorAgent`: Power generation units (criticality weight: 1.0)
- `SubstationAgent`: Distribution controllers (criticality weight: 0.8)
- `PMUAgent`: Phasor measurement units (criticality weight: 0.6)
- `BreakerAgent`: Circuit protection (criticality weight: 0.7)

**State Variables**:
- Physical: voltage, current, power, frequency
- Cyber: communication latency, packet integrity, log frequency
- Audit: last_audit_time, audit_frequency, anomaly_score

### 4. Anomaly Detection (`anomaly_detection/`)

**Purpose**: Identify deviations from normal behavior

**Components**:
- `LSTMModel`: Neural network for sequence prediction
- `AnomalyDetector`: Scoring and classification engine

**Algorithm** (Deviation-Based Scoring):
```
Score(i) = F_w[i] × √(Σ((X[i,j] - B[i,j]) / Th[i,j])²)
```
- `F_w`: Criticality weight (prioritizes high-impact agents)
- `X`: Current observed metrics
- `B`: Baseline (historical normal)
- `Th`: Threshold (max permissible deviation)

**Classification**:
- `Score < 1.0`: Normal
- `Score ≥ 1.0`: Anomalous

### 5. Behavior Analysis (`behavior_analysis/`)

**Purpose**: Adaptive learning to handle grid dynamics

**Key Components**:
- `BaselineManager`: Maintains and updates baseline matrix `B`
- `ThresholdManager`: Adjusts threshold matrix `Th`

**Adaptive Baseline Refinement** (Eq. 10):
```
B'[i,j] = (1-α)B[i,j] + α×X[i,j]
```
- `α_high (0.5-0.9)`: Rapid adaptation during anomalies
- `α_low (0.001-0.3)`: Anchor to history during stable periods

**Threshold Adjustment**:
```
Th'[i,j] = Th[i,j] + β×ΔX[i,j]
```
- `β_stable (0.01-0.3)`: Stable grids (low variance)
- `β_dynamic (0.5-1.0)`: Dynamic grids (renewable integration, load spikes)

### 6. Audit Scheduling (`audit/`)

**Purpose**: Optimize audit frequency with RL

**Components**:
- `QLearningAgent`: Q-table management, exploration/exploitation
- `AuditScheduler`: Frequency adjustment, cost tracking

**Q-Learning Update**:
```
Q(s,a) ← Q(s,a) + α[R + γ×max(Q(s',a')) - Q(s,a)]
```

**State Space**:
- Current anomaly rates
- Average deviations per agent
- Recent audit results (TPR, FPR)

**Action Space**:
- Increase audit frequency (+0.05)
- Decrease audit frequency (-0.05)
- Maintain current frequency

**Reward Function**:
```
R = -α₁×(False Positives) - α₂×(False Negatives)
```
- Penalizes both missed attacks (FN) and unnecessary audits (FP)
- Converges when `E[R]` stabilizes over 10 episodes

### 7. Evaluation (`simulation/eval_suite.py`)

**Purpose**: Comprehensive performance metrics

**Metric Categories**:
1. **Detection Quality**: Precision, Recall, F1, Accuracy, TPR, TNR, FPR, FNR
2. **Attack-Specific**: Per-attack confusion matrices (FDI, DoS, MITM, CHAIN, FAULT)
3. **Cost Analysis**: Audit costs, failure costs, cost efficiency
4. **Risk Assessment**: Global risk, risk mitigation, risk reduced per dollar
5. **Statistical Tests**: Mann-Whitney U, Kolmogorov-Smirnov
6. **Cross-Layer**: Cyber-physical stability index, deviation trends

**Key Functions**:
- `build_summary()`: Aggregate all metrics
- `prf1()`: Precision/Recall/F1 computation
- `confusion_matrix()`: TPR, TNR, FPR, FNR
- `per_attack_confusion()`: Per-attack type metrics
- `statistical_significance()`: Hypothesis testing

## Data Flow

### Simulation Loop (per timestep `t`)

1. **Observe State**: Read physical/cyber metrics from all agents
2. **Detect Anomalies**: Compute deviation scores, classify anomalies
3. **Update Behavior**: Refine baselines, adjust thresholds
4. **Schedule Audits**: RL agent decides audit frequencies
5. **Execute Audits**: Audit selected high-risk agents
6. **Update RL**: Compute reward, update Q-table
7. **Log Metrics**: Record timestep data

### Evaluation Pipeline

1. **Dynamic Run**: Execute with RL-based scheduling
2. **Baseline Run**: Execute with fixed frequency (f=1)
3. **Comparison**: Compute metrics comparing both runs
4. **Statistical Tests**: Validate significance of improvements
5. **Export Results**: Save CSV + JSON outputs

## Configuration Examples

### Small-Scale Test (Fast Convergence)
```json
{
  "simulation": {"n_agents": 50, "n_timesteps": 144},
  "rl": {"learning_rate": 0.02, "max_episodes": 100},
  "audit": {"max_audits_per_cycle": 3}
}
```

### Large-Scale Production (High Accuracy)
```json
{
  "simulation": {"n_agents": 500, "n_timesteps": 1440},
  "rl": {"learning_rate": 0.005, "max_episodes": 500},
  "audit": {"max_audits_per_cycle": 20}
}
```

### High Attack Rate Scenario
```json
{
  "simulation": {"attack_rate": 0.30},
  "anomaly": {"anomaly_threshold": 0.4},
  "audit": {"max_audits_per_cycle": 10}
}
```

## Extension Points

### Adding New Attack Types

1. Modify `attack_injection.py` to inject new attack pattern
2. Update `scoring_pipeline.py` heuristics to classify new type
3. Add attack type to `AttackType` enum
4. Update `per_attack_confusion()` to include new type

### Custom RL Algorithms

1. Subclass `QLearningAgent` in `audit/q_learning_agent.py`
2. Override `select_action()` and `update()` methods
3. Register new agent in `AuditScheduler`

### New Evaluation Metrics

1. Add metric computation in `eval_suite.py`
2. Update `build_summary()` to include new metric
3. Add to JSON/CSV export schema

## Performance Considerations

### Computational Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Anomaly Scoring | O(N×M) | N agents, M metrics per agent |
| LSTM Inference | O(S×H²) | S sequence length, H hidden size |
| Q-Learning Update | O(S×A) | S states, A actions |
| Evaluation Metrics | O(T) | T timesteps |

### Memory Usage

- **100 agents, 288 timesteps**: ~500 MB
- **500 agents, 1440 timesteps**: ~2.1 GB
- **LSTM model**: ~10 MB (weights)
- **Q-table**: ~5 MB (converged)

### Scaling Guidelines

- **< 200 agents**: Single-threaded sufficient
- **200-500 agents**: Enable parallel anomaly detection
- **> 500 agents**: Distributed simulation recommended

## Testing Strategy

### Unit Tests (`smartgrid_mas/tests/`)

- Test each component independently
- Mock dependencies (e.g., mock LSTM for behavior tests)
- Assert expected outputs for known inputs

### Integration Tests

- Test pipeline stages in sequence
- Verify data flow between modules
- Check output consistency

### Validation Tests

- Compare with IEEE test cases
- Validate against research paper results
- Benchmark performance metrics

## Logging & Debugging

### Log Levels

- **DEBUG**: Detailed state transitions, per-agent updates
- **INFO**: Pipeline progress, convergence status, key metrics
- **WARNING**: Anomalies, threshold violations, convergence issues
- **ERROR**: Configuration errors, simulation failures

### Debug Utilities

- `logger.debug(f"Agent {i}: Score={score:.3f}, Anomaly={is_anomalous}")` in anomaly detection
- `logger.info(f"RL Iteration {iter}: Reward={reward:.2f}, Epsilon={epsilon:.3f}")` in audit scheduler
- `logger.warning(f"Agent {i}: Deviation {dev:.2f} exceeds threshold {th:.2f}")` in behavior analysis

## Best Practices

1. **Configuration First**: Always use ConfigManager, avoid hardcoded parameters
2. **Type Hints**: Use type annotations for all function signatures
3. **Docstrings**: Google-style docstrings for all public methods
4. **Logging**: Use structured logging with context (agent ID, timestep, etc.)
5. **Testing**: Write tests before implementing new features (TDD)
6. **Validation**: Assert parameter constraints in configuration
7. **Error Handling**: Fail fast with clear error messages

## Future Enhancements

### Short-Term
- [ ] Parallel anomaly detection for large grids (>500 agents)
- [ ] Real-time visualization dashboard
- [ ] Attack pattern library (replay recorded attacks)

### Medium-Term
- [ ] Multi-class LSTM (7 attack types) instead of binary + heuristic
- [ ] Deep RL (DQN) replacing Q-table
- [ ] Temporal pattern analysis (sliding window statistics)

### Long-Term
- [ ] Federated learning across multiple grids
- [ ] Integration with SCADA systems
- [ ] Hardware-in-the-loop testing with PMU simulators

---

**Last Updated**: January 2026  
**Framework Version**: 2.0.0
