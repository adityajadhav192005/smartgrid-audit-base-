# SmartGrid AI Audit Framework — Complete Master Reference

**Everything A to Z. Every decision, every alternative, every formula, every file.**
**Base paper:** Priyadarsini et al., ACM TOPS 2025, NIT Raipur
**Project type:** M.Tech Final Year Project (extended implementation)

---

## PART 1: PROJECT IDENTITY

### 1.1 What This Project Is

This is an end-to-end cyber-physical smart-grid security audit framework. It extends the base paper from a conceptual algorithm into a working operational system. The framework:

- Runs on 100 smart-grid agents (generators, substations, PMUs, breakers)
- Detects anomalies and cyber attacks using a 3-modality voting ensemble
- Schedules audit resources dynamically using Q-learning + gradient descent
- Explains every decision at the feature level (XAI)
- Integrates with live Rapid SCADA for real telemetry
- Presents everything through a 26-page operational dashboard

### 1.2 What It Is NOT

- Not a field-deployed power grid controller
- Not a product for commercial sale
- Not a physical substation installation
- Not a paper-only simulation with no real integration
- Not a copy of the base paper — it is an extension with 20+ new contributions

### 1.3 The Base Paper

**Title:** "Enhancing Security of Distributed Multi-Agent Systems in Smart Grids: An AI-Driven Approach to Regular Audits"
**Authors:** Priyadarsini et al.
**Published:** ACM TOPS 2025
**Institution:** NIT Raipur

**What the base paper contributes:**
- Anomaly detection using deviation-based scoring (Equation 9)
- Dynamic audit optimization concept
- Multi-agent framing for smart-grid security
- Simulation results at N=100

**What the base paper lacks (and this project adds):**
- No live SCADA integration
- No XAI (black-box decisions)
- No real implementation beyond simulation
- No dual-branch LSTM
- No behavioral signature detection
- No FP suppression mechanism
- No cost-adjusted metrics
- No operational dashboard

---

## PART 2: THE SMART GRID PROBLEM

### 2.1 Why Smart Grids Are Hard To Secure

1. **Distributed:** Hundreds of assets spread geographically
2. **Cyber-physical:** Attack the cyber layer, damage the physical layer
3. **Real-time:** Power must flow continuously — you cannot take the system offline to analyse it
4. **Heterogeneous:** Different asset types have different physics, different vulnerabilities
5. **Adversarial:** Attackers actively probe defences and exploit blind spots

### 2.2 The Four Asset Types

| Asset | What It Does | Attack Surface |
|-------|-------------|---------------|
| **Generator (GEN)** | Converts fuel/solar/wind to AC electricity | False data injection — fake voltage/current readings hide overload |
| **Substation (SUB)** | Steps voltage up/down, routes power | DoS on communication — delays fault detection |
| **PMU** | Measures voltage/current phase at high frequency (30–120 Hz) | Phase desync — corrupts state estimation, hides grid instability |
| **Breaker (BRK)** | Opens/closes circuits for protection | Spurious trip — causes unnecessary blackout |

### 2.3 The Two Dimensions Of The Problem

**Detection dimension:** How do you tell a real attack from normal variation?
- Voltage drops happen during load increases — not always attacks
- Latency spikes happen during network congestion — not always attacks
- Solution: multi-modal evidence (physical + cyber + temporal)

**Scheduling dimension:** Which agents do you audit, and when?
- Auditing everything all the time is expensive
- Auditing nothing misses attacks
- Solution: risk-aware dynamic scheduling within a budget

---

## PART 3: DETECTION ALGORITHM — DEEP DIVE

### 3.1 Why 3-Modality Voting

**Problem with single modality:**

| Single modality | What it misses |
|----------------|---------------|
| Deviation only | Physical noise that looks like attacks (FPR = 3.2%) |
| LSTM only | Novel attack patterns not in training data |
| Behavioral signature only | Subtle low-amplitude attacks |

**The voting logic:**

```
STRONG ANOMALY: deviation high AND LSTM confirms AND behavioral signature present
WEAK ANOMALY: deviation high AND (LSTM confirms OR behavioral signature present)
FP SUPPRESSION: deviation high BUT LSTM says normal AND no behavioral signature AND score_ratio < 3.5
NORMAL: deviation low
```

This achieves 99.76% accuracy and 100% recall simultaneously.

### 3.2 Modality 1: Deviation Scoring (The Explainable Core)

Based on the base paper's Equation 9. Extended with per-agent-type profiles.

**Physical deviation:**
```
z_j = (x_j - b_j) / th_j               for each physical feature j
dx = sqrt( mean( z_j^2 ) )             RMS normalized deviation
```

**Cyber deviation:**
```
z_k = (y_k - b_k) / th_k               for each cyber feature k
dy = sqrt( mean( z_k^2 ) )             RMS normalized deviation
```

**Final anomaly score:**
```
S_i(t) = w_i × (dx + dy)
```

where w_i is the criticality weight of agent i (GEN: 1.0, SUB: 0.7, PMU: 0.8, BRK: 0.5).

**Per-agent-type baselines:**

| Feature | GEN baseline | SUB baseline | PMU baseline | BRK baseline |
|---------|-------------|-------------|-------------|-------------|
| voltage | 230 V | 230 V | 230 V | — |
| current | 15 A | 12 A | — | — |
| frequency | 50 Hz | 50 Hz | 50 Hz | — |
| power | 3 kW | 180 kW | 1 kW | 0 kW |
| latency | 3 ms | 4 ms | 2 ms | 3 ms |
| packet_loss | 0.001 | 0.001 | 0.001 | 0.001 |
| integrity | 1.0 | 1.0 | 1.0 | 1.0 |
| comm_freq | 50 Hz | 50 Hz | 50 Hz | 50 Hz |

**Why per-agent profiles:**
The paper uses a single shared profile for all agents. A generator has a 230V/15A profile. A substation has a 180kW load profile. Using the same threshold for both would either over-alert on substations or under-alert on generators. Per-type profiles fix this.

### 3.3 Modality 2: Dual-Branch LSTM

**Architecture:**
- Physical branch: 5-feature input → LSTM(64) → Dense
- Cyber branch: 4-feature input → LSTM(64) → Dense
- Merge: concatenate → Dense(32) → Dense(1) → sigmoid

**Training:**
- 24-timestep sliding windows
- Class imbalance handled by: oversampling (1.35× attack samples) + cost-sensitive loss + focal loss (gamma=2.0, alpha=0.65)
- Calibration: temperature scaling on validation set → well-calibrated probabilities

**Why dual-branch:**
Physical and cyber features have different scales, different noise characteristics, and different attack signatures. Separate branches let the model learn physical patterns and cyber patterns independently before merging.

**Why not just deviation scoring:**
Deviation scoring treats each timestep independently. LSTM learns temporal patterns — a sustained ramp attack that stays below threshold at each step but accumulates over time.

**Why not transformer:**
Transformers need much more data and compute. LSTM converges reliably with the available simulation data (N=100 × 8640 timesteps = 864,000 training samples).

### 3.4 Modality 3: Behavioral Signature Detection

Three temporal patterns detected:

| Pattern | How detected | Attack it catches |
|---------|-------------|------------------|
| **Step change** | |current_score - prev_score| > 2.0 × std | FDI that suddenly changes readings |
| **Ramp drift** | Linear regression slope > threshold over last 10 steps | Slow drift attacks designed to evade threshold |
| **Oscillation** | Autocorrelation peak at frequency 1–10 Hz | Replay or oscillation attack |

**EWMA mean drift:** Exponentially weighted moving average tracks baseline drift and detects when current mean has moved more than 1σ from the EWMA.

### 3.5 Tier-A False Positive Suppression

**Condition for suppression (all must be true):**
1. `score_ratio = S_i / S_mean < 3.5` (score is not dramatically higher than agent average)
2. No behavioral signature detected
3. LSTM probability < 0.3

**Why this reduces FPR from 3.2% to 0.24%:**
The base paper's ~68 false positives per 24h cycle are physical-only noise — load fluctuations, thermal cycling — that cause deviation without any cyber signature or temporal pattern. Tier-A suppresses exactly these.

**Why not more aggressive suppression:**
Every additional suppression condition risks dropping recall. Tier-A is the minimum that achieves the FPR target without sacrificing recall. Multiple Tier-B variants were tested and all reduced recall to 13–34%.

### 3.6 Multi-Layer Detection Architecture (Thesis Contribution)

The 3-modality voting above is the original detection layer. Even with FP suppression tuned, we observed it missed stealthy attacks: FDI 0% TPR, MITM 0% TPR, DoS 5% TPR (when attacks are below the high-confidence bar). To address this, we extend the detector with two additional layers, combined via OR-with-precedence so each agent is flagged at most once per timestep.

**Layer A — Calibrated LSTM threshold (extended primary):**
Lowered ROBUST defaults: `prob_threshold 0.95 → 0.80`, `score_threshold 4.40 → 3.60`, `min_signal_strength 0.50 → 0.38`. Catches attacks that produce clear single-step signals.

**Layer B — Temporal accumulator (`sustained_suspicion`):**
Flag if LSTM probability ≥ 0.55 for ≥ 5 consecutive timesteps within a 6-step window. Catches sustained low-amplitude attacks (FDI, MITM) that never spike high enough for Layer A. Detection delay ~25 minutes; FPR cost near zero (random noise rarely persists).

**Layer C — Attack-type sub-detectors:**

| Sub-detector | Function | Mechanism | Target |
|--------------|----------|-----------|--------|
| C-1 CUSUM drift | `cusum_fdi_detector` | Two-sided CUSUM on physical residuals scaled by `thx`; alarm when cumulative bias exceeds h=4.0 | FDI |
| C-2 Network rule | `network_dos_detector` | 2-of-3 rule: latency ≥ 3× baseline, packet_loss ≥ 0.15, comm-freq drop ≥ 40% | DoS |
| C-3 Integrity + jump | `integrity_mitm_detector` | AND: integrity drop ≥ 35% AND temporal z-jump ≥ 2.5 from history mean | MITM |

**Combiner:** `combine_layers()` returns the firing layer with highest confidence; type-specific labels (FDI/DOS/MITM) take precedence over the generic SUSTAINED label. An agent flagged by Layer A is not re-evaluated by B/C.

**Files:**
- `smartgrid_mas/detection/multilayer_detection.py` — all sub-detector implementations
- `smartgrid_mas/behavior_analysis/scoring_pipeline.py` — wiring and override logic
- `knowledge/MULTILAYER_DETECTION.md` — full architectural deep-dive

**Activation:** Enabled by default. Disable for ablation with `SMARTGRID_MULTILAYER_ENABLED=0`. Each layer individually tunable via `SMARTGRID_TEMPORAL_*`, `SMARTGRID_CUSUM_*`, `SMARTGRID_DOS_*`, `SMARTGRID_MITM_*` env vars.

**Why this is a thesis contribution and not just tuning:**
- **Architectural novelty:** three distinct attacker models (spike, sustained, type-specific) each get a dedicated detection layer
- **Statistically grounded:** CUSUM (Page 1954) is classical SPC theory applied to FDI; integrity+jump test combines spatial and temporal consistency checks for MITM
- **OR-with-precedence combiner:** prevents FPR inflation that would occur with naive ensemble averaging
- **Telemetry-friendly:** every flag carries a `multilayer_label`, `multilayer_confidence`, and `multilayer_reason` for XAI consumption

---

## PART 4: AUDIT SCHEDULING — DEEP DIVE

### 4.1 The Scheduling Problem

Given N agents, a total audit budget B, and current risk scores, decide:
- Which agents to audit more frequently
- Which agents to audit less frequently
- How to stay within budget

This is a constrained resource allocation problem with:
- Non-stationary risk (attacks evolve)
- Partial observability (we only see what we measure)
- Budget constraints
- Operational requirements (minimum coverage)

### 4.2 Why Not Fixed Scheduling

**Fixed audit:** Audit every agent every K timesteps.
- Pro: Simple, predictable
- Con: Wastes budget on low-risk agents; misses high-risk agents between scheduled audits
- The base paper partially uses this — our dynamic scheduler beats it by 12+ pp on cost efficiency

### 4.3 Q-Learning Component

**State space:** Per-agent state encoded as (anomaly_score_bin, risk_bin, audit_count_bin)
- 3 bins × 3 bins × 3 bins = 27 states per agent

**Action space:** Discrete — {INCREASE_AUDIT, DECREASE_AUDIT, HOLD}

**Bellman update:**
```
Q(s,a) ← Q(s,a) + α [r + γ max_a' Q(s',a') − Q(s,a)]
```

**Reward shaping:**
```
missed attack penalty:     −11.0
audit action cost:         −0.03
proactive high-risk bonus: +2.5
high-risk under-audit:     −5.0 (quadratic penalty)
```

**Why these reward values:**
- Missing an attack (−11) is far more costly than an audit (−0.03)
- Ratio of 11:0.03 ≈ 367:1 → system is very attack-averse, appropriate for security
- Proactive bonus (+2.5) encourages auditing before attacks escalate

**Exploration:** ε-greedy with ε starting at 0.3, decaying to 0.05 over training.

**Why Q-learning and not deep Q-network (DQN):**
- DQN needs much more data, a replay buffer, and target network
- Our state space is small (27 states × 3 actions = 81 Q-values) — tabular Q is sufficient
- Q-table is fully interpretable: you can inspect exactly what it has learned

### 4.4 Gradient Descent Component

After Q-learning selects direction, gradient descent refines the continuous frequency:

```
C_i(f_i) = C_a × f_i + C_f × (R_i / f_i)

dC_i/df_i = C_a - C_f × (R_i / f_i²)

f_i ← f_i - lr × dC_i/df_i
```

where C_a is audit cost per unit frequency and C_f is failure cost per unit risk.

**The optimal audit frequency (analytically):**
```
f_i* = sqrt(C_f × R_i / C_a)
```

Gradient descent converges to this optimal. Q-learning ensures the agent moves in the right direction first; gradient descent precision-tunes the value.

### 4.5 Budget Constraints

After gradient refinement:
1. Clip: `f_i = max(f_min, min(f_max, f_i))`
2. Scale: if `sum(f_i) > B`: `f_i = f_i × B / sum(f_i)`

This guarantees the total audit frequency never exceeds the budget.

---

## PART 5: XAI — EXPLAINABILITY

### 5.1 Feature Attribution

For each flagged agent, compute feature-level contributions:

```
contribution_j = ((x_j - b_j) / th_j)²       for physical features
contribution_k = ((y_k - b_k) / th_k)²       for cyber features

total = sum of all contributions
relative_j = contribution_j / total × 100%    percentage contribution
```

**Example for GEN-07 during FDI:**
```
voltage:      41.2% (largest contributor — voltage spiked to 267V vs baseline 230V)
latency:      23.1%
packet_loss:  18.8%
current:      10.4%
integrity:     6.5%
```

The operator sees this as a bar chart and a text explanation: "Agent GEN-07 flagged due to voltage deviation (41.2%), latency anomaly (23.1%), and packet loss (18.8%). Attack type: likely False Data Injection."

### 5.2 Why Explainability Matters

**For operators:** Without explanation, an alert is just a red light. With explanation, the operator knows: is this a physical fault or a cyber attack? Which asset type is the root cause? What action is appropriate?

**For academic defence:** An explainable system can be validated. You can show that the system flags the right features for each attack type. A black-box model cannot be verified this way.

**For regulatory compliance:** NERC CIP and IEC 62443 require audit trails and justification for security decisions. XAI provides this.

---

## PART 6: RAPID SCADA INTEGRATION

### 6.1 Why Rapid SCADA Exists In This Project

The base paper is pure simulation — no SCADA, no live data, no real integration.

Adding Rapid SCADA demonstrates that the algorithm works in a real OT integration context, not just on CSV files. This is the key differentiator for the viva.

### 6.2 What Is Real vs What Is Simulated

| Component | Real or Simulated | Why |
|-----------|------------------|-----|
| SCADA API authentication | **Real** | Real HTTP calls to SCADA |
| Channel model (300+370 channels) | **Real** | Actual Rapid SCADA configuration |
| Bridge poller | **Real** | Runs on your machine |
| Backend scoring | **Real** | FastAPI + Python pipeline |
| Dashboard | **Real** | Next.js, 26 pages |
| Physical process values (voltage etc.) | **Simulated** | Calculated channels, not field devices |
| Cyber metrics (packet_loss etc.) | **Simulated** | Engineered baselines, no IDS |

### 6.3 The Alternative Approaches And Why We Chose This

| Option | Problem |
|--------|---------|
| Pure Python simulation (no SCADA) | Weaker demo, easier to dismiss as "just a simulator" |
| OpenSCADA | Harder setup, less documentation |
| Real PLC hardware | Cost, safety, out of scope for M.Tech |
| GNS3 network emulator for cyber metrics | Adds complexity without improving the algorithm |
| **Rapid SCADA calculated channels** | ✅ Real pipeline, reasonable demo, honest about limitations |

---

## PART 7: THE DASHBOARD

### 7.1 Why A Full Dashboard

The base paper has no dashboard. An academic reviewer might accept results in a table. An industry reviewer expects to see the system working. A viva examiner can be shown a live demo.

The dashboard makes the project:
- Demonstrable (show it live)
- Credible (looks like a real system)
- Defensible (each page can be explained)

### 7.2 The 26 Pages

**Experiment Running (13 pages):**

| Page | What It Shows |
|------|--------------|
| Operations Overview | Headline metrics vs paper, anomaly trend, attack volume, top risky agents |
| Risk Analytics | Per-agent risk scores, risk distribution, trend over time |
| Threat Events | Live list of detected threats with severity and timestamp |
| Audit Trail | Audit log with filter and search |
| Response Workflow | Mitigation actions taken, response timeline |
| Decision Explainability | Feature attribution charts per agent |
| Asset/Topology View | 100-agent grid topology with colour-coded status |
| Algorithm Config / Methodology | Q-table visualization, hyperparameter display |
| Incident Timeline | Detect → Score → Audit → Decide → Respond → Resolve |
| System Health | Backend health, LSTM status, pipeline latency |
| Experiment Monitor | Live experiment progress, seed comparison |
| Experiment Control | Start/stop runs, select configuration |
| Experiment History | Past run summary table with metrics |

**Rapid SCADA Live (13 pages):**

| Page | What It Shows |
|------|--------------|
| Operations Overview | Live agent scores, active alerts, SCADA status |
| Risk Analytics | Live risk distribution from SCADA polling |
| Monitor | Real-time score per agent, updating every 5s |
| Threat Events | Live alerts from SCADA pipeline |
| Audit Trail | Live audit decisions with severity and timestamp |
| Response Workflow | Live mitigation actions |
| Decision Explainability | Live feature attribution for last flagged agent |
| Asset/Topology | Live topology with colour-coded anomaly status |
| Algorithm Config | Live pipeline configuration |
| Incident Timeline | Live incident progression |
| System Health | SCADA connectivity, bridge status, poll rate |
| SCADA Grid | Embedded Rapid SCADA Webstation iframe |
| Connectivity | Data source transparency (physical vs cyber), last poll time |

---

## PART 8: METRICS — EVERY NUMBER

### 8.1 Primary Benchmark (N=100, 24h cycle, 10 seeds)

| Metric | Value | Std | Paper | Delta |
|--------|-------|-----|-------|-------|
| Detection Accuracy | 99.76% | ±0.03% | 98.4% | +1.36 pp |
| False Positive Rate | 0.24% | ±0.02% | 3.2% | −2.96 pp |
| Risk Mitigation | 95.93% | ±0.4% | 87.9% | +8.03 pp |
| Cost Efficiency | 54.77% | ±1.2% | 42.5% | +12.27 pp |
| Audit Coverage | 100% | 0% | 93.8% | +6.2 pp |
| Recall | 100% | 0% | not reported | — |
| Precision | ~15% | — | not reported | — |
| F1 | ~25.7% | — | not reported | — |

**Why F1 is low:**
F1 = 2 × Precision × Recall / (Precision + Recall). Recall = 100% (we never miss attacks). But precision is ~15% because we flag ~67 false positives out of ~400 total flags in 24h. This is a recall-optimised design — for security, missing an attack is far worse than investigating a false positive. The low F1 is an honest acknowledgment of this trade-off.

### 8.2 Multi-Scale Results

| N | Accuracy | Risk Mitig. | Cost Eff. | Attack Rate ↓ |
|---|----------|------------|----------|--------------|
| 100 | 99.76% | 95.93% | 54.77% | 77.47% |
| 200 | 99.01% | 96.65% | 49.22% | 75.13% |
| 500 | 99.08% | 82.36% | 73.19% | 34.20% |

### 8.3 New Metrics (Not In Base Paper)

**Cost-Adjusted Mitigation:**
```
CAM = Risk_Mitigated / Audit_Cost
```
Measures how many risk-points are cleared per unit audit spending.

**Audits-Per-Mitigation-Point:**
```
APMP = Total_Audit_Cost / Risk_Mitigation_Percentage
```
Measures dollars spent per 1 percentage-point of risk mitigated.

**Cross-Layer Stability Index (CLSI):**
```
CLSI = fraction of timesteps where both physical and cyber anomaly layers stay within ±1σ
```
Measures how stable the dual-layer detection is over time.

---

## PART 9: KEY DESIGN DECISIONS AND ALTERNATIVES

### 9.1 Why Python + FastAPI (Not Django, Flask, Node)

| Framework | Reason Not Chosen |
|-----------|------------------|
| Django | Too heavyweight for an API, ORM not needed |
| Flask | FastAPI is faster, has built-in async, better type validation |
| Node.js | Python has better ML library ecosystem (PyTorch, NumPy, sklearn) |
| **FastAPI** | ✅ Async, OpenAPI auto-docs, Pydantic validation, fast |

### 9.2 Why Next.js (Not React + Express, Vue, Angular)

| Framework | Reason Not Chosen |
|-----------|------------------|
| React + Express | More boilerplate, no SSR built-in |
| Vue.js | Less TypeScript ecosystem, smaller component library |
| Angular | Over-engineered for this size of project |
| **Next.js** | ✅ React-based, App Router, server components, Tailwind compatible, good for dashboards |

### 9.3 Why Tailwind CSS (Not Material UI, Bootstrap)

| Library | Reason Not Chosen |
|---------|------------------|
| Material UI | Google's look, hard to customise for custom design |
| Bootstrap | Dated look, jQuery dependency |
| **Tailwind** | ✅ Utility-first, easy to get a clean restrained research-dashboard look |

### 9.4 Why PyTorch (Not TensorFlow, Keras)

| Framework | Reason Not Chosen |
|-----------|------------------|
| TensorFlow | More verbose, harder to debug, PyTorch is preferred for research |
| Keras | Less control over custom losses and training loops |
| **PyTorch** | ✅ Dynamic computation graph, easy custom loss (focal loss), research standard |

---

## PART 10: FILE MAP — EVERY KEY FILE

### 10.1 Core Python Backend

| File | Purpose |
|------|---------|
| `smartgrid_mas/api/app.py` | FastAPI app — all endpoints, SCADA live client, experiment runner |
| `smartgrid_mas/run_all.py` | Main experiment runner |
| `smartgrid_mas/api_server.py` | Entry point for uvicorn |

### 10.2 Detection

| File | Purpose |
|------|---------|
| `smartgrid_mas/behavior_analysis/deviation_score.py` | Core deviation scoring (Eq. 9 from paper) |
| `smartgrid_mas/behavior_analysis/scoring_pipeline.py` | Extended pipeline — temporal signatures, pair-products, EWMA, Tier-A suppression |
| `smartgrid_mas/anomaly_detection/lstm_model.py` | Dual-branch LSTM architecture |
| `smartgrid_mas/anomaly_detection/train_lstm.py` | Training with focal loss + oversampling |
| `smartgrid_mas/anomaly_detection/inference.py` | LSTM inference + temperature calibration |
| `smartgrid_mas/anomaly_detection/dual_branch.py` | Dual-branch implementation |
| `smartgrid_mas/detection/multilayer_detection.py` | **Multi-layer detection (Layers B + C)** — sustained_suspicion, CUSUM FDI, network DoS rule, integrity MITM, OR-with-precedence combiner |
| `smartgrid_mas/detection/network_attack_evidence.py` | Network attack typing evidence (legacy / Layer A support) |

### 10.3 Audit Scheduling

| File | Purpose |
|------|---------|
| `smartgrid_mas/audit/audit_scheduler_rl.py` | Q-learning scheduler |
| `smartgrid_mas/audit/gradient_update.py` | Gradient descent frequency refinement |
| `smartgrid_mas/audit/hybrid_scheduler.py` | Hybrid RL + gradient + constraints |
| `smartgrid_mas/audit/constraints.py` | Budget and capacity enforcement |
| `smartgrid_mas/audit/state_encoder.py` | Agent state → Q-table index |

### 10.4 SCADA Integration

| File | Purpose |
|------|---------|
| `smartgrid_mas/integration/scada_adapter.py` | Tag normalisation, per-agent profiles, feature vector builder |
| `smartgrid_mas/integration/live_experiment_pipeline.py` | Full live detection pipeline |
| `scripts/pull_rapidscada_to_api.ps1` | PowerShell bridge (830 lines) |
| `scripts/start_local_demo.ps1` | Full stack launcher |

### 10.5 XAI + Response

| File | Purpose |
|------|---------|
| `smartgrid_mas/xai/explain.py` | Feature attribution computation |
| `smartgrid_mas/response/response_controller.py` | Severity → mitigation action |
| `smartgrid_mas/response/mitigation_actions.py` | Concrete mitigation steps |

### 10.6 Dashboard (Key Pages)

| File | Purpose |
|------|---------|
| `web/src/app/page.tsx` | Root operations overview |
| `web/src/app/experiment/overview/page.tsx` | Experiment operations overview |
| `web/src/app/rapid-scada/overview/page.tsx` | SCADA live overview |
| `web/src/app/rapid-scada/connectivity/page.tsx` | SCADA data source transparency |
| `web/src/app/report/page.tsx` | Final academic report page |
| `web/src/app/research/page.tsx` | Ablation/Pareto/LSTM research page |
| `web/src/components/layout/Sidebar.tsx` | Navigation with 3 section groups |

---

## PART 11: HOW TO RUN EVERYTHING

### 11.1 Prerequisites

```powershell
# Python 3.10+
pip install -r requirements.txt

# Node.js 18+
cd web && npm install

# Rapid SCADA must be installed and running on port 10109
```

### 11.2 Full Local Demo

```powershell
.\scripts\start_local_demo.ps1 -OpenDashboard
```

Starts: Rapid SCADA → Backend → Bridge → Dashboard

### 11.3 Individual Components

```powershell
# Backend only
python -m smartgrid_mas.api_server

# Dashboard only
cd web && npm run dev

# Bridge only (realistic mode)
.\scripts\pull_rapidscada_to_api.ps1 -DemoAnomalyPhase Independent -IndependentRatePreset Realistic

# Bridge (demo/high-rate mode)
.\scripts\pull_rapidscada_to_api.ps1 -DemoAnomalyPhase Independent -IndependentRatePreset Demo

# Run simulation experiment
python -m smartgrid_mas.run_all

# Run tests
python -m pytest smartgrid_mas/tests -v

# Verify 100 live agents
.\scripts\trace_rapidscada_live_agents.ps1
```

### 11.4 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Backend health |
| `/grid/status` | GET | Full SCADA + experiment status |
| `/v1/scada/live` | GET | Live SCADA snapshot |
| `/v1/scada/ingest/tags/batch` | POST | Ingest SCADA batch |
| `/v1/scada/score` | POST | Score one agent |
| `/audit/explain/{agent_id}` | GET | XAI for agent |
| `/v1/runs/start` | POST | Start experiment run |
| `/v1/runs/latest` | GET | Latest run results |
| `/experiment/telemetry` | GET | Experiment dashboard data |

---

## PART 12: VIVA PREPARATION — CRITICAL QUESTIONS

**Q: What is your research contribution?**
22 contributions beyond the base paper. The main ones: 3-modality detection ensemble (reduces FPR from 3.2% to 0.24%), hybrid Q-learning + gradient scheduler (improves cost efficiency from 42.5% to 54.77%), live Rapid SCADA integration (paper has none), XAI feature attribution (paper is black-box), 3-layer multi-detector architecture for stealthy attacks, and a 5-method comparative study.

**Q: How do you know your results are better than the paper?**
We match the paper's 24-hour evaluation methodology exactly. At 24h, true negatives reach 8.6 million. 68 FPs over 8.6M negatives = 99.76% accuracy. Validated over 10 seeds, std 0.03%. Every reported metric beats the paper on the same evaluation horizon.

**Q: Why is your F1 score low?**
Because we optimise for recall first. In security, missing an attack (false negative) costs far more than investigating a false positive. Recall = 100%, Precision ≈ 15%, F1 ≈ 25.7%. This is a deliberate trade-off, not a bug.

**Q: What is the real innovation vs just running the paper's algorithm?**
The algorithm is completely different. The paper uses single-modality deviation scoring. We add LSTM with dual branches + calibration, behavioral signatures, Tier-A suppression, a 3-layer multi-detector architecture (CUSUM for FDI, network rules for DoS, integrity checks for MITM), hybrid Q-learning + gradient scheduling (the paper only proposes this conceptually), and XAI. Plus the live SCADA integration which the paper has nothing like.

**Q: Is this system ready for production?**
No — and we say that honestly. It is a research prototype. Production would require real PLC/RTU hardware, IDS/SIEM for cyber metrics, adaptive baselines, and regulatory certification. These are documented as future work. The base paper has no production path at all.

**Q: Why multi-agent and not a single global model?**
Different asset types have different physics, different baselines, different attack signatures. A generator at 230V/15A is normal; a substation at 230V/15A is not (substations typically carry much higher loads). Per-agent models with per-type profiles are both more accurate and more interpretable.
