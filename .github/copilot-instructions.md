# Smart Grid Audit Framework - AI Coding Instructions

## Project Overview
This is an M.Tech research project implementing an AI-driven audit framework for **multi-agent smart grid security**. The system detects anomalies in distributed smart grids and optimizes audit scheduling using reinforcement learning (RL) to balance attack detection with operational costs.

## Core Architecture

### System Layers (Critical Pattern)
The framework models smart grids as **three interconnected layers**:
- **Physical Layer**: Generation/storage agents, PMUs (phasor measurement units), breakers, maintenance agents
- **Cyber Layer**: Monitoring, security, and learning agents; area/substation controllers
- **Communication Layer**: LAN/WAN links connecting both layers (introduces vulnerabilities)

**Key insight**: Cross-layer attacks can cascade from cyber to physical layer. Audit designs must account for this coupling.

### Component Dependencies
1. **Data Collection** → **Anomaly Detection** → **Behavior Analysis** → **Audit Scheduling** → **Response Mechanism**
2. Real-time metrics flow from physical layer (voltage, current, frequency) → anomaly scoring → RL-based scheduling decisions

## Critical Algorithms & Models

### Anomaly Detection (Deviation-Based)
- **Formula**: Score(i) = F_w[i] * √(Σ((X[i,j] - B[i,j]) / Th[i,j])²)
- Classifies agents as anomalous when Score ≥ 1.0
- Uses **weighted normalization** across 3 metrics per agent
- Criticality weights (F_w) prioritize high-impact agents (generators > storage > breakers)

### Behavior Analysis (Adaptive Learning)
- **Baseline refinement**: b'[i,j] = (1-α)*b[i,j] + α*X[i,j]
  - α_high (0.5-0.9) during anomalies → rapid adaptation
  - α_low (0.001-0.3) during stable conditions → anchor to history
- **Threshold adjustment**: Th'[i,j] = Th[i,j] + β*ΔX[i,j]
  - β ranges: 0.01-0.3 (stable grids), 0.5-1.0 (dynamic grids)
- **Cumulative deviation tracking**: Helps predict cascading failures via K-means clustering

### Audit Optimization (Reinforcement Learning)
- **Q-learning updates**: Q(s,a) ← Q(s,a) + α[R + γ*max(Q(s',a')) - Q(s,a)]
- **State**: Current anomaly rates, deviations, audit results
- **Actions**: Increase/decrease audit frequency, maintain
- **Reward function**: -α₁*(False Positives) - α₂*(False Negatives)
- **Convergence**: E[R] stabilizes over 10 episodes; audit coverage/accuracy > 90%

## Development Patterns & Conventions

### Mathematical Notation (Used Throughout)
- **X(t)** = observed physical metrics matrix
- **Y(t)** = observed cyber metrics matrix  
- **B** = baseline matrix (historical normal conditions)
- **Th** = threshold matrix (max permissible deviations)
- **R_attack** = proportion of agents flagged anomalous
- **C** = operational cost = C_audit + C_frequency
- **F_w** = criticality weights for each agent

### Matrix Structures for Different Agent Types
- **B_g** (Generation): current, voltage, power, response time, comm frequency
- **B_c** (Consumer): energy consumption, demand response, peak time, comm frequency
- **B_p** (Distribution): load distribution, fault detection time, latency, energy loss
- **B_s** (Storage): charging/discharging rate, SoC, latency, idle time
- **B_sec** (Security): response time, comm integrity, log update frequency, false positive rate

### Simulation Parameters (Reference)
- Grid topology: 10×10 to 20×25 agent grids (scalable)
- Agent distribution: 20% generators, 30% substations, 50% PMUs/breakers
- Attack scenarios: Random FDI (10% nodes), DoS (5%), coordinated breaker attacks
- Training: ~200 episodes, ~0.7s per episode for 100 nodes; convergence in 2-3 minutes
- Inference: <50ms per audit cycle on RTX 3090
- LSTM network: 80:20 train/test split for anomaly detection

## Tool Stack & Implementation Details

### Software Stack
- **Python**: Audit scheduling, anomaly detection, RL algorithms
- **MATLAB/Simulink**: Power system dynamics & fault simulation
- **JADE Framework**: Decentralized multi-agent audit execution (Java)
- **PowerWorld**: Power system stability analysis
- **GridLAB-D**: Electricity distribution modeling
- **NS-3**: Cyber-attack simulation & network traffic analysis
- **TensorFlow**: RL inference (Q-networks) - ~42.7ms latency on GPU

### Key Libraries/Modules (Inferred from Paper)
- Reinforcement Learning: Q-learning agent with experience replay, prioritized sampling
- Anomaly Detection: LSTM networks, supervised classification
- Optimization: Genetic algorithms (GA) for audit frequency scheduling
- Data Processing: Low-pass filtering, normalization, standardization

## Critical Behavioral Patterns

### Real-Time Constraint Handling
- **Physical limits**: Voltage, current, frequency must stay within permissible ranges
- **Communication constraints**: Latency ≤ max_latency, packet integrity ≥ min_integrity
- **Audit frequency constraints**: f_audit ≥ f_min (regulatory minimum), max 5 audits/cycle

### Handling Dynamic vs. Static Conditions
- **Stable grids** (low demand variance):
  - Use lower smoothing factors (α_low), lower thresholds (β_low)
  - Wider acceptable ranges, fewer false alarms
  - RL discount factor (γ) = 0.9 for long-term stability

- **Dynamic grids** (renewable integration, load spikes):
  - Use higher smoothing factors (α_high), responsive thresholds (β_high)
  - Stricter acceptance criteria
  - More frequent audit cycles

## Testing & Validation Strategy

### Evaluation Metrics
1. **Audit Scheduling**: Cost efficiency (% reduction), audit coverage (% high-risk agents)
2. **Anomaly Detection**: TPR, TNR, FPR, FNR, accuracy (target: >90% accuracy)
3. **Response**: Risk mitigation (% reduction), response time (seconds)
4. **Scalability**: Convergence time (AGT), runtime vs. agent count

### Test Scenarios
- **Normal operation**: Baseline with no attacks/faults (validation data)
- **Physical faults**: Line faults, transformer failures, breaker malfunctions
- **Cyber-attacks**: FDI (false data injection), DoS, MITM, communication tampering
- **Cascading failures**: Coordinated attacks on breaker-substation chains

## Integration Points & Dependencies

### Data Sources
- **Real-world**: IEEE PES Power Grid Test Cases, NREL datasets, Smart Grid Dataset (SGDS)
- **Synthetic**: MATLAB Simulink fault scenarios + cyber-attack overlays
- **Metrics**: PMU readings (voltage, frequency, current) + communication logs + audit results

### Output/Feedback Loops
- Audit actions → Area/Substation controllers (adjustment commands)
- Response time measurements → Reinforce learning updates
- False positive/negative rates → Reward signal for RL policy refinement

## Common Pitfalls & Best Practices

1. **Baseline Staleness**: Always use adaptive baseline refinement (Eq. 10) in real-time settings; avoid frozen baselines
2. **Threshold Tuning**: Balance β adjustment factor (0.01-1.0 range) per grid type; over-tuning causes oscillation
3. **RL Convergence**: Ensure experience replay buffer is ≥2000 samples; use prioritized sampling for rare anomalies
4. **Cross-Layer Validation**: When modifying anomaly scores, verify they propagate correctly to audit scheduling layer
5. **Computational Budgets**: Keep inference <50ms; use batch processing for 100+ agents; monitor memory (2.1GB for 500 agents)

## When Modifying Core Algorithms

- **Changing anomaly score formula**: Update behavior analysis thresholds simultaneously; validate on synthetic cyber-attack dataset
- **Adjusting RL reward**: Retrain convergence to stabilization (10+ episodes); verify audit coverage targets
- **Adding new agent types**: Extend baseline matrices (B) with new metrics; update weight vectors (F_w)
- **Scaling to larger grids**: Validate convergence time remains <5 min; monitor memory/latency on representative grid size

## References to Key Conceptual Patterns
- **Embodied AI**: Audit agents perceive grid parameters → decide audit actions → influence operational outcomes
- **Multi-objective optimization**: Balance R_attack minimization with cost minimization (both critical)
- **Adaptive learning**: Continuous policy updates via RL; dynamic baseline/threshold refinement
