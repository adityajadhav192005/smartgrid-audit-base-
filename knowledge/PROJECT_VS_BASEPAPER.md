# Project vs Base Paper: Complete A-Z Comparison

**Project:** SmartGrid AI Audit Framework (Extended Implementation)
**Base Paper:** Priyadarsini et al., "Enhancing Security of Distributed Multi-Agent Systems in Smart Grids," ACM TOPS 2025, NIT Raipur

---

## 1. Scope and Implementation

| Aspect | Base Paper | Our Project |
|--------|-----------|-------------|
| **Nature** | Theoretical framework + limited simulation | Full operational prototype |
| **Codebase** | Not published | ~15,000 lines Python + ~8,000 lines TypeScript |
| **Stack** | MATLAB/unspecified simulation | Python, FastAPI, Next.js, Rapid SCADA, SQLite, PyTorch |
| **Deployment** | None | Cloud Run + local SCADA + Vercel dashboard |
| **Reproducibility** | Partial (equations given, code absent) | Fully reproducible (open source, documented) |

---

## 2. Architecture Comparison

### Base Paper Architecture
```
[Simulated Data] -> [Deviation Scoring] -> [Q-learning Scheduler] -> [Results]
```
Single-layer, offline, no operational integration.

### Our Architecture
```
[Rapid SCADA Webstation] -> [PowerShell Bridge] -> [FastAPI Backend]
  |-- Deviation Scoring
  |-- Dual-Branch LSTM (physical + cyber)
  |-- Behavioral Signature Detection
  |-- 3-Layer Multi-Detector (CUSUM, DoS rules, MITM detector)
  |-- Hybrid Q-Learning + Gradient Scheduler
  |-- Response & Mitigation Engine
  |-- XAI Feature Attribution
  |-- Blockchain Audit Ledger
  |-- Federated Learning (FedAvg)
       -> [Next.js Dashboard (26 pages)]
```
Multi-layer, real-time, live SCADA integration.

### Key Architectural Differences

| Component | Base Paper | Our Project | Why It Matters |
|-----------|-----------|-------------|----------------|
| Data source | Simulated only | Live Rapid SCADA (100 agents) | Operational relevance |
| Detection layers | 1 (deviation scoring) | 4 (deviation + LSTM + behavioral + multi-layer) | Catches stealthy attacks |
| Scheduling | Q-learning only | Q-learning + gradient descent (hybrid) | Continuous frequency optimization |
| Explainability | None | Feature-level XAI with per-feature contribution | Operator trust and auditability |
| Audit trail | None | Hash-chained blockchain ledger (SQLite) | Tamper evidence |
| Privacy | Not addressed | Federated learning (FedAvg, 4 clusters) | Multi-utility deployment |
| Dashboard | None | 26-page Next.js operational UI | Operational readiness |
| API | None | 36-endpoint FastAPI REST API | Integration-ready |

---

## 3. Detection Algorithm Comparison

### Base Paper: Single-Modality Deviation Scoring
```
S_i(t) = w_i * (d_x + d_y)
d_x = sqrt(mean(((x - bx) / thx)^2))
d_y = sqrt(mean(((y - by) / thy)^2))
Flag if S_i > threshold
```
- Single threshold, single modality
- No temporal analysis
- No ML component
- No behavioral signatures
- High FPR from physical noise

### Our System: 3-Modality Voting Ensemble + 3-Layer Multi-Detector

**Modality 1: Enhanced Deviation Scoring (extends base paper)**
- Same formula as base paper, plus per-agent-type profile thresholds
- Adaptive thresholds that adjust based on risk context
- EWMA drift compensation for baseline shift

**Modality 2: Dual-Branch LSTM**
- 24-timestep sliding window, 9 features
- Separate physical and cyber branches
- Temperature-scaled calibrated probability output
- Focal loss + oversampling for class imbalance

**Modality 3: Behavioral Signature Detection**
- Step change detector (sudden jumps)
- Ramp drift detector (sustained directional trend)
- Oscillation detector (sinusoidal patterns)

**3-Layer Multi-Detector Architecture (thesis contribution):**

| Layer | Name | What It Catches | Method |
|-------|------|----------------|--------|
| A | Calibrated LSTM threshold | Obvious single-step attacks | prob >= 0.80 AND score >= 3.60 |
| B | Temporal accumulator | Sustained low-amplitude attacks | LSTM prob >= 0.55 for >= 5 consecutive steps |
| C-1 | CUSUM drift detector | FDI (false data injection) | Two-sided CUSUM on physical residuals (Page 1954) |
| C-2 | Network rule detector | DoS (denial of service) | 2-of-3: latency >= 3x, packet_loss >= 0.15, comm_drop >= 40% |
| C-3 | Integrity + temporal jump | MITM (man in the middle) | AND: integrity drop >= 35%, z-jump >= 2.5 sigma |

**Combiner:** OR-with-precedence. Any layer firing flags the agent. Type-specific labels (FDI/DOS/MITM) override generic SUSTAINED.

**Tier-A FP Suppression:** If score_ratio < 3.5 AND no behavioral signature AND LSTM probability < 0.3, suppress the flag. Eliminates physical-only noise.

---

## 4. Comparative Evaluation: 5 Methods on Same Data

All methods evaluated on the same 24-hour simulation with 100 agents, identical attack scenarios (seed=42). Score-based methods (Deviation-Only, LSTM-Only) given best threshold via sweep.

| Method | Accuracy | FPR | Recall | Precision | F1 | FNR |
|--------|----------|-----|--------|-----------|-----|-----|
| Deviation-Only (base paper approach) | 81.40% | 9.06% | 36.89% | 46.58% | 41.18% | 63.11% |
| LSTM-Only | 86.35% | 0.00% | 22.67% | 100.00% | 36.96% | 77.33% |
| Isolation Forest | 68.85% | 27.95% | 53.92% | 29.25% | 37.92% | 46.08% |
| One-Class SVM | 46.35% | 59.99% | 75.93% | 21.33% | 33.31% | 24.07% |
| **Our System (3-Modality + Multi-Layer)** | **94.23%** | **1.81%** | **75.76%** | **89.95%** | **82.25%** | **24.24%** |

### Analysis

- **Deviation-Only** has high FPR (9.06%) and low recall (36.89%). Without LSTM confirmation or FP suppression, it flags physical noise as attacks.
- **LSTM-Only** achieves 0% FPR but only 22.67% recall. The LSTM is conservative and misses most attacks. High precision (100%) but useless if it catches only 1 in 4 attacks.
- **Isolation Forest** is the best unsupervised baseline but still has 27.95% FPR and only 53.92% recall. It learns normal patterns but lacks domain knowledge about attack types.
- **One-Class SVM** has the worst accuracy (46.35%) and highest FPR (59.99%). Novelty detection is too sensitive for this feature space.
- **Our System** achieves the best accuracy (94.23%), lowest FPR (1.81%), and highest F1 (82.25%). The multi-modal ensemble combines the strengths of all approaches while suppressing their weaknesses.

### Why Our System Wins

Each component addresses a weakness of the others:
1. **Deviation scoring** catches large deviations that LSTM might miss due to calibration
2. **LSTM** provides temporal context that deviation scoring lacks
3. **Behavioral signatures** give domain-specific attack fingerprinting
4. **Multi-layer detection** catches stealthy attacks (FDI, MITM) invisible to single-step detectors
5. **FP suppression** eliminates false alarms that would plague any single modality

No single method can achieve high recall AND low FPR. The ensemble does.

---

## 5. Audit Scheduling Comparison

| Aspect | Base Paper | Our Project |
|--------|-----------|-------------|
| **Method** | Q-learning only | Hybrid Q-learning + gradient descent |
| **Action space** | Discrete (increase/decrease/hold) | Discrete Q-selection + continuous gradient refinement |
| **Budget enforcement** | Mentioned conceptually | Implemented (per-agent cap + global budget) |
| **Reward function** | Generic penalty for missed attacks | Detailed: -11.0 missed attack, -0.03 audit cost, +2.5 proactive high-risk, -5.0 under-auditing |
| **Cost function** | Not specified | C_i = C_a * f_i + C_f * (R_i / f_i), gradient: dC/df = C_a - C_f * R_i / f_i^2 |
| **Result** | High-risk agents get more audits (conceptual) | High-risk agents get 3-5x more audits (measured) |

---

## 6. Metrics Comparison

### Head-to-Head Results

| Metric | Base Paper | Our System (24h cycle) | Our System (per-step) | Delta |
|--------|-----------|----------------------|----------------------|-------|
| Detection Accuracy | 98.4% | **99.76%** | 94.23% | +1.36 pp (24h) |
| False Positive Rate | 3.2% | **0.24%** | 1.81% | -2.96 pp (24h) |
| Risk Mitigation | 87.9% | **95.93%** | N/A | +8.03 pp |
| Cost Efficiency | 42.5% | **54.77%** | N/A | +12.27 pp |
| Audit Coverage | 93.8% | **100%** | N/A | +6.2 pp |
| Recall | Not reported | **100%** (24h) | 75.76% (per-step) | N/A |

**Note on two accuracy figures:** The 99.76% comes from the full 24-hour evaluation cycle (paper methodology, Section 5.4.3), where true negatives dominate the denominator. The 94.23% comes from the per-timestep method comparison, which is a stricter per-observation metric. Both are legitimate; they answer different questions.

### New Metrics Not in Base Paper

| Metric | Value | What It Measures |
|--------|-------|-----------------|
| Cost-Adjusted Mitigation | Computed per run | Risk mitigated per unit cost |
| Audits-per-Mitigation-Point | Computed per run | Efficiency of audit allocation |
| Cross-Layer Stability Index (CLSI) | Computed per run | Consistency across detection layers |
| F1 Score | 82.25% | Balance of precision and recall |

---

## 7. Feature Comparison Matrix

| Feature | Base Paper | Our Project |
|---------|-----------|-------------|
| Deviation scoring | Yes | Yes (enhanced with profiles) |
| LSTM anomaly detection | No | Yes (dual-branch) |
| Behavioral signature detection | No | Yes (step, ramp, oscillation) |
| Multi-layer detection (CUSUM, DoS rules, MITM) | No | Yes |
| FP suppression | No | Yes (Tier-A) |
| Q-learning audit scheduling | Yes | Yes (enhanced reward function) |
| Gradient descent refinement | No | Yes |
| Budget constraints | Conceptual | Implemented |
| Live SCADA integration | No | Yes (Rapid SCADA, 100 agents) |
| Feature-level XAI | No | Yes |
| Blockchain audit ledger | No | Yes (hash-chained) |
| Federated learning | No | Yes (FedAvg, 4 clusters) |
| Operational dashboard | No | Yes (26 pages, 2 workspaces) |
| REST API | No | Yes (36 endpoints) |
| Cloud deployment | No | Yes (Cloud Run) |
| Per-agent-type profiles | No | Yes (GEN/SUB/PMU/BRK) |
| Adaptive thresholds | No | Yes (risk-context based) |
| Multi-scale validation | No | Yes (N=100, 200, 500) |
| Statistical significance | No | Yes (10 seeds, std 0.03%) |
| Method comparison study | No | Yes (5 baselines) |
| Attack-type classification | No | Yes (FDI/DOS/MITM/FAULT) |

---

## 8. Contributions Summary

### Base Paper Contributions (Priyadarsini et al.)
1. Deviation-based anomaly scoring formula
2. Q-learning dynamic audit scheduling concept
3. Simulation framework for MAS security evaluation
4. Risk mitigation metric definition

### Our Additional Contributions (24 total)
1. 3-modality voting ensemble (deviation + LSTM + behavioral)
2. Tier-A false positive suppression
3. Dual-branch LSTM with physical and cyber branches
4. Temporal behavioral signature detection
5. Calibrated LSTM probability via temperature scaling
6. Hybrid Q-learning + gradient scheduler
7. Per-agent-type profiles (GEN/SUB/PMU/BRK different baselines)
8. Cost-adjusted mitigation KPI
9. Audits-per-mitigation-point KPI
10. Cross-layer stability index (CLSI)
11. Live Rapid SCADA integration
12. PowerShell bridge with batch ingest
13. 670-channel SCADA model (300 base + 370 cyber addon)
14. Blockchain audit ledger (hash-chained tamper evidence)
15. Federated learning with FedAvg (4 agent clusters)
16. Feature-level XAI with ranked contributions
17. 26-page operational dashboard
18. Dual workspace (experiment vs live SCADA)
19. Multi-scale validation (N=100, 200, 500)
20. Statistical significance testing (10-seed mean + std)
21. Three-layer multi-detector architecture
22. CUSUM-based FDI drift detection
23. Rule-based DoS detection (2-of-3 corroboration)
24. Integrity + temporal-jump MITM detection

---

## 9. Limitations Comparison

| Limitation | Base Paper | Our Project |
|-----------|-----------|-------------|
| Synthetic data only | Yes | Yes (both physical and cyber) |
| No real field devices | Yes | Yes (Rapid SCADA calculated channels) |
| No IDS/SIEM integration | Yes | Yes (cyber metrics are baselines) |
| Single evaluation environment | Yes | Partially addressed (multi-scale) |
| No adaptive baselines | Yes | Yes (hand-set, not learned) |
| No comparison with other methods | Yes | **No** (5-method comparison now implemented) |
| No explainability | Yes | **No** (XAI implemented) |
| No tamper-evident logging | Yes | **No** (blockchain ledger) |
| No privacy-preserving learning | Yes | **No** (federated learning) |
| No operational dashboard | Yes | **No** (26-page dashboard) |

---

## 10. SCADA Integration Comparison

| Aspect | Base Paper | Our Project |
|--------|-----------|-------------|
| SCADA platform | None | Rapid SCADA v6 |
| Live agents | 0 | 100 |
| Data source | 100% simulated | Rapid SCADA calculated channels (physical) + engineered baselines (cyber) |
| Bridge | None | PowerShell script with 5-second polling |
| API integration | None | REST API batch ingest (/v1/scada/ingest/tags/batch) |
| Dashboard workspace | None | Dedicated 13-page Rapid SCADA Live workspace |

**Honest note:** Both physical and cyber readings are synthetic. The bridge generates values, writes them into Rapid SCADA, and reads them back. Rapid SCADA acts as a pass-through industrial data broker. No actual PLCs or sensors are connected. This is standard practice in academic CPS research, and the base paper has no SCADA integration at all.

---

## 11. Technology Stack Comparison

| Layer | Base Paper | Our Project |
|-------|-----------|-------------|
| Language | Not specified | Python 3.14 + TypeScript |
| ML Framework | Not specified | PyTorch |
| Backend | None | FastAPI (36 routes) |
| Frontend | None | Next.js (26 pages) |
| SCADA | None | Rapid SCADA v6 |
| Database | None | SQLite (audit chain + telemetry) |
| ML Models | Conceptual | Trained LSTM checkpoints (.pt files) |
| Deployment | None | Cloud Run + Vercel |
| Monitoring | None | Health endpoints + system health dashboard page |

---

## 12. Future Work Comparison

| Direction | Base Paper Mentions | Our Status |
|-----------|-------------------|------------|
| IDS/SIEM integration | Implied | Documented as top priority future work |
| Adaptive baselines | Implied | Not yet; online learning planned |
| Physical device integration | Not mentioned | Planned (Modbus/OPC UA) |
| Precision improvement | Not mentioned | Identified (cost-sensitive tuning) |
| Larger scale (N>500) | Mentioned | Validated at N=500, plan for N=1000+ |
| Privacy-preserving learning | Mentioned as future | **Implemented** (FedAvg) |
| Explainability | Mentioned as future | **Implemented** (XAI) |
| Tamper-evident audit | Mentioned as future | **Implemented** (blockchain) |

---

## 13. Conclusion

The base paper provides a valuable theoretical framework for dynamic audit scheduling in smart grids. Our project takes that framework and:

1. **Implements it fully** — from paper equations to working code
2. **Extends it significantly** — 24 additional contributions beyond the paper
3. **Validates it rigorously** — 5-method comparison, multi-scale testing, statistical significance
4. **Operationalizes it** — live SCADA integration, dashboard, API, deployment
5. **Improves every metric** — accuracy, FPR, risk mitigation, cost efficiency, coverage

The key insight is that a theoretical framework becomes useful only when it can be deployed, explained, and trusted. Our project bridges that gap.
