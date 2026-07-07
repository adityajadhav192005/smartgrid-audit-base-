# SmartGrid AI Audit Framework - Complete File Reference Guide

**For M.Tech Presentation - July 8, 2026**

Open these files to understand/ask questions about different parts of the project.

---

## 🎯 QUICK START - 5 Essential Files

| Purpose | File | What to Check |
|---------|------|---------------|
| **Run the experiment** | `smartgrid_mas/run_all.py` | Entry point, attack rates, agent pool |
| **Detection pipeline** | `smartgrid_mas/detection/multilayer_detection.py` | Layer A/B/C logic, fusion |
| **API endpoints** | `smartgrid_mas/api/app.py` | Live data, scoring, explanations |
| **Dashboard workflow** | `web/src/app/experiment/workflow/page.tsx` | 10-phase visualization |
| **Live data fetching** | `web/src/lib/experimentTelemetry.ts` | How dashboard gets real run data |

---

## 📊 BACKEND - Python (smartgrid_mas)

### 🚀 CORE ENTRY POINT
- **`run_all.py`** - Main experiment runner (N agents, seed, attack rates, ablation mode)
- **`__main__.py`** - Module entry point

### 🌐 CONFIGURATION & LOADING
- **`config/loader.py`** - Loads YAML config, env vars, runtime settings
- **`check_environment.py`** - Verifies dependencies, data files

### 🤖 AGENT POOL (100 agents: 20 gen, 30 sub, 25 PMU, 25 breaker)
- **`agents/base_agent.py`** - BaseAgent class, state tracking
- **`agents/types.py`** - Agent types (GENERATOR, SUBSTATION, PMU, BREAKER)
- **`agents/generator_agent.py`** - Generator-specific logic
- **`agents/substation_agent.py`** - Substation-specific logic
- **`agents/pmu_agent.py`** - PMU-specific logic
- **`agents/breaker_agent.py`** - Breaker-specific logic
- **`agents/state.py`** - Agent state management

### 📡 DATA & DATASETS
- **`data/real_dataset.py`** - Physical grid dataset (V, I, P, T, f, Q, Loss) 7 features
- **`data/network_intrusion_dataset.py`** - Network dataset (20 raw → 4 engineered features)
  - Latency-like = log(dur + RTT + SYN_ACK + ACK_DAT + jitter)
  - Loss-like = log(src_loss + dst_loss + packet_drop)
  - Integrity-like = log(|TTL_diff| + state_TTL + |bytes_diff|)
  - Frequency-like = log(rate + sload + dload + packets)
- **`data/cyber_attacks.py`** - Attack definitions (FDI, DoS, MITM, Fault)
- **`data/synthetic_faults.py`** - Fault generation

### 🧠 LSTM ANOMALY DETECTION
- **`anomaly_detection/lstm_model.py`** - LSTM architecture (2 layers, 64 hidden, dropout 0.2)
- **`anomaly_detection/dataset.py`** - SlidingWindowDataset (window=12 steps = 60 min)
- **`anomaly_detection/train_lstm.py`** - Training (focal BCE, gamma=2.0, alpha=0.5, calibration)
- **`anomaly_detection/dual_branch.py`** - Dual-branch fusion (w_grid=0.58, w_network=0.42)
- **`anomaly_detection/inference.py`** - Real-time scoring

### 🎯 DETECTION LAYERS (4-Layer + FP Gate)
- **`detection/multilayer_detection.py`** - Main detection orchestrator
  - **Layer A**: Deviation scoring (k-sigma test, k=4.0)
  - **Layer B**: Dual-branch LSTM (grid + network)
  - **Layer C**: 4 specialized sub-detectors
    - C-1: CUSUM (FDI)
    - C-2: DoS rules
    - C-3: MITM integrity-jump
    - C-4: Fault signature
  - **FP Gate**: False positive suppression
- **`detection/load_pretrained.py`** - Load trained LSTM models
- **`detection/unified_detector.py`** - Unified detection interface

### 📊 BEHAVIOR ANALYSIS (EMA, Baselines, Trends)
- **`behavior_analysis/deviation_score.py`** - Compute z-scores
- **`behavior_analysis/baseline_update.py`** - EMA baseline (α_low=0.05, α_high=0.5)
- **`behavior_analysis/threshold_update.py`** - k*σ threshold adjustment
- **`behavior_analysis/trend_clustering.py`** - K-means clustering (K=3 clusters)
- **`behavior_analysis/scoring_pipeline.py`** - Combine scores
- **`behavior_analysis/behavior_pipeline.py`** - Orchestrate all

### 🧮 AUDIT SCHEDULING (RL + Gradient)
- **`audit/audit_scheduler_rl.py`** - Q-Learning (300 states, 3 actions, α=0.4, γ=0.95)
- **`audit/hybrid_scheduler.py`** - Combines RL + Gradient descent
- **`audit/gradient_step.py`** - Gradient optimizer (lr=0.01, max_iter=200)
- **`audit/gradient_update.py`** - Gradient update logic
- **`audit/state_encoder.py`** - Encode state to 4D space (risk, tier, budget, time)
- **`audit/audit_executor.py`** - Execute audit actions
- **`audit/audit_validator.py`** - Validate audit outcomes (TP, FP, FN, TN)
- **`audit/audit_ledger.py`** - Track audit history
- **`audit/risk_score.py`** - Compute risk per agent
- **`audit/constraints.py`** - Budget, frequency constraints
- **`audit/actions.py`** - Mitigation actions

### 📋 RESPONSE & MITIGATION
- **`response/response_controller.py`** - Severity scoring + mitigation
- **`response/impact_factor.py`** - Impact based on criticality tier
- **`response/severity_scoring.py`** - Se = w_impact*I + w_likelihood*L
- **`response/mitigation_actions.py`** - Execute mitigation (isolate, monitor, etc.)

### 🌐 ENVIRONMENT (SCADA Simulation)
- **`environment/scenario_engine.py`** - Attack/fault scheduling
  - Attack rates: FDI=10%, DoS=5%, MITM=3%, Chain=20%, Fault=20%
  - Attack pool sampling per type
  - Coordinated chain pairs
- **`environment/grid_env.py`** - SCADA data generation
  - Physical: V, I, f (base 3, expanded to 7)
  - Cyber: latency, loss, integrity, freq (4 dims)
  - Attack/fault injection

### 📈 SIMULATION & METRICS
- **`simulation/run_simulation.py`** - 24h simulation loop (1440 timesteps × 5 min)
  - Connects 9 framework components per timestep
- **`simulation/metrics.py`** - Per-timestep & summary metrics
- **`simulation/export.py`** - Save CSV/JSON results
- **`simulation/eval_suite.py`** - Compile results across runs
- **`simulation/baseline_comparators.py`** - Baseline comparison (fixed f=1)

### 💡 XAI (Explainability)
- **`xai/explain.py`** - Feature contribution (c_j = ((x_j - b_j) / th_j)²)
- **`xai/export_shap_reasons.py`** - Export explanations to CSV

### 🔗 API & INTEGRATION
- **`api/app.py`** - FastAPI server (127.0.0.1:8000)
  - GET /grid/status → summary.json
  - GET /experiment/telemetry → dynamic_metrics.csv
  - GET /audit/explain/{agent_id} → shap_explanations.csv
  - POST /v1/scada/score → Real-time scoring
- **`api_server.py`** - API server launcher
- **`integration/scada_adapter.py`** - SCADA integration
- **`integration/ids_adapter.py`** - IDS integration
- **`integration/event_store.py`** - Event storage

### 🧪 TESTS
- **`tests/test_lstm_smoke.py`** - LSTM basic sanity
- **`tests/test_dual_branch.py`** - Dual-branch fusion
- **`tests/test_rl_scheduler.py`** - Q-Learning logic
- **`tests/test_gradient_hybrid.py`** - Hybrid optimizer
- **`tests/test_scenario_engine.py`** - Attack scenarios
- **`tests/test_deviation_score.py`** - Deviation scoring
- **`tests/test_behavior_updates.py`** - Baseline/threshold updates
- **`tests/test_trend_clustering.py`** - Trend clustering

---

## 🎨 FRONTEND - React/Next.js (web)

### 📱 DASHBOARD PAGES (Experiment Module)
| Page | File | Shows |
|------|------|-------|
| **Detection Workflow** | `web/src/app/experiment/workflow/page.tsx` | 10-phase attack-to-dashboard pipeline (LIVE DATA) ✨ NEW |
| Operations Overview | `web/src/app/experiment/overview/page.tsx` | Live KPIs, agent grid |
| Risk Analytics | `web/src/app/experiment/risk/page.tsx` | Risk distribution, heatmaps |
| Threat Events | `web/src/app/experiment/threats/page.tsx` | Attack list, timeline |
| Audit Trail | `web/src/app/experiment/audits/page.tsx` | Audit history |
| Response Workflow | `web/src/app/experiment/response/page.tsx` | Response actions, severity |
| Decision Explainability | `web/src/app/experiment/xai/page.tsx` | Feature importance, SHAP |
| Asset/Topology | `web/src/app/experiment/assets/page.tsx` | Grid visualization |
| Algorithm Config | `web/src/app/experiment/methodology/page.tsx` | Detection layers detail |
| Incident Timeline | `web/src/app/experiment/timeline/page.tsx` | Events timeline |
| System Health | `web/src/app/experiment/system/page.tsx` | Pipeline health metrics |
| Experiment Monitor | `web/src/app/experiment/monitor/page.tsx` | Live progress bars |
| Experiment Control | `web/src/app/experiment/control/page.tsx` | Run controls |
| Scalability | `web/src/app/experiment/scalability/page.tsx` | N=5,100,200,500 comparison |
| History | `web/src/app/experiment/history/page.tsx` | Past runs |

### 📡 DASHBOARD PAGES (Rapid SCADA - Live Module)
- Similar structure to Experiment (overview, risk, threats, audits, response, xai, etc.)

### 🔌 API ROUTES (Next.js Backend)
- **`web/src/app/api/proxy/experiment/telemetry/route.ts`** - Proxy to `/experiment/telemetry`
- **`web/src/app/api/proxy/grid/status/route.ts`** - Proxy to `/grid/status`
- **`web/src/app/api/proxy/runs/latest/route.ts`** - Proxy to `/v1/runs/latest`
- **`web/src/app/api/proxy/scalability/route.ts`** - Proxy to `/v1/scalability`
- **`web/src/app/api/proxy/audit/explain/{agent}/route.ts`** - Proxy to `/audit/explain/{id}`

### 📚 LIBRARIES & UTILITIES
- **`web/src/lib/experimentTelemetry.ts`** - Hook to fetch experiment run data
  - Types: ExperimentTrendPoint, ExperimentAgent, PerAttackMetric
  - `useExperimentTelemetry(8000ms)` - Auto-refresh every 8s
- **`web/src/lib/proxyClient.ts`** - API proxy client
  - Tries LOCAL (127.0.0.1:8000) → CONFIGURED → PUBLIC Cloud Run
- **`web/src/lib/liveTelemetry.ts`** - Live SCADA data fetching
- **`web/src/lib/latestRun.ts`** - Latest run metadata
- **`web/src/lib/mockData.ts`** - Demo fallback data
- **`web/src/lib/dashboardContext.tsx`** - Global context (SCADA connected status)

### 🎨 UI COMPONENTS
- **`web/src/components/ui/Badge.tsx`** - Severity badges (critical, high, medium, low)
- **`web/src/components/ui/KPIStatCard.tsx`** - KPI stat cards
- **`web/src/components/ui/ViewModeBanner.tsx`** - Mode indicator banner
- **`web/src/components/charts/index.tsx`** - Recharts wrappers
  - AnomalyTrendChart (LineChart)
  - AttackBarChart (BarChart)
  - AttackTypePie (PieChart)

### 🧭 LAYOUT
- **`web/src/components/layout/Sidebar.tsx`** - Navigation sidebar with all pages
- **`web/src/components/layout/TopBar.tsx`** - Top status bar
- **`web/src/components/layout/AppShell.tsx`** - Main layout wrapper
- **`web/src/app/layout.tsx`** - Root layout

### ⚙️ SETTINGS
- **`web/src/components/settings/SettingsConfigurationPanel.tsx`** - Runtime config panel
- **`web/src/app/api/settings/runtime/route.ts`** - Save runtime settings

---

## 📁 CONFIGURATION & DOCS

### Configuration
- **`smartgrid_mas/config/global_config.yaml`** - Master config (window, thresholds, RL params)
- **`smartgrid_mas/config/runtime_env.env`** - Runtime overrides (created by dashboard)

### Reports & Documentation
- **`Report/` folder** - Final report, presentations, papers
- **`Report/Knowledge/` folder** - Dataset docs, workflow explanations
- **`docs/` folder** - Additional documentation

---

## 📊 RESULTS & LOGS

### Output Files (After Running `python -m smartgrid_mas.run_all`)
- **`logs/N{n}_{seed}/`** - Run results folder
  - `summary.json` - Overall metrics (accuracy, F1, precision, recall, etc.)
  - `dynamic_metrics.csv` - Per-timestep metrics (288 rows × ~20 columns)
  - `baseline_metrics.csv` - Fixed f=1 baseline comparison
  - `shap_explanations.csv` - XAI feature contributions per agent
  - `audit_chain.db` - Audit ledger database

---

## 🎯 TO UNDERSTAND KEY CONCEPTS, READ THESE IN ORDER

### 1. **Dataset & LSTM Mapping**
   - Read: `data/real_dataset.py` → `data/network_intrusion_dataset.py`
   - Then: `anomaly_detection/lstm_model.py`

### 2. **Detection Pipeline**
   - Read: `detection/multilayer_detection.py`
   - Then: Zoom into layers:
     - `behavior_analysis/deviation_score.py` (Layer A)
     - `anomaly_detection/dual_branch.py` (Layer B)
     - `detection/` folder C-1,C-2,C-3,C-4 validators

### 3. **Attack Injection & Scenarios**
   - Read: `environment/scenario_engine.py` → `environment/grid_env.py`

### 4. **Audit Scheduling (RL)**
   - Read: `audit/audit_scheduler_rl.py` → `audit/hybrid_scheduler.py`

### 5. **Response & Mitigation**
   - Read: `response/response_controller.py`

### 6. **Dashboard Data Flow**
   - Read: `api/app.py` → `web/src/lib/experimentTelemetry.ts` → `web/src/app/experiment/workflow/page.tsx`

### 7. **How to Run**
   - Read: `run_all.py` → `simulation/run_simulation.py`

---

## 🚀 DEMO FLOW FOR PRESENTATION

1. **Start here**: Open `smartgrid_mas/run_all.py`
   - Show attack rates (FDI=10%, DoS=5%, etc.)
   - Show N_AGENTS=100, SEED=42
   
2. **Explain detection**: Open `detection/multilayer_detection.py`
   - Walk through Layer A→B→C→Fusion
   
3. **Show LSTM**: Open `anomaly_detection/lstm_model.py` + `anomaly_detection/dual_branch.py`
   - Physical: V, I, P, T, f, Q, Loss (7 channels, window=12)
   - Network: 4 engineered features (window=12)
   - Fusion: P_fused = 0.58*P_grid + 0.42*P_network + bonuses
   
4. **Audit Logic**: Open `audit/audit_scheduler_rl.py`
   - Show Q-table (300 states × 3 actions)
   - Show epsilon-greedy exploration
   
5. **API**: Open `api/app.py`
   - Show GET /grid/status, /experiment/telemetry, /audit/explain
   
6. **Dashboard**: Open `web/src/app/experiment/workflow/page.tsx`
   - Show 10-phase workflow with LIVE data OR fallback demo
   - This is THE presentation page for the workflow demo
   
7. **Results**: Open `logs/N100_42/summary.json`
   - Show Accuracy 92.65%, F1 82.25%, etc.

---

## 📌 CRITICAL NUMBERS TO MEMORIZE

| Metric | Value | Where |
|--------|-------|-------|
| Agents | 100 (20G, 30S, 25P, 25B) | run_all.py |
| Detection Accuracy | 92.65% | summary.json |
| F1 Score | 82.25% | summary.json |
| Precision | 89.95% | summary.json |
| Recall | 75.76% | summary.json |
| FPR | 1.81% | summary.json |
| LSTM Window | 12 timesteps (60 min) | global_config.yaml |
| k-sigma | 4.0 | global_config.yaml |
| Prob Threshold | 0.97 | global_config.yaml |
| Grid LSTM weight | 0.58 | dual_branch.py |
| Network LSTM weight | 0.42 | dual_branch.py |
| Focal BCE gamma | 2.0 | train_lstm.py |
| Q-alpha | 0.4 | audit_scheduler_rl.py |
| Q-gamma | 0.95 | audit_scheduler_rl.py |
| RL states | 300 | audit_scheduler_rl.py |
| RL actions | 3 (SKIP, MONITOR, AUDIT) | audit_scheduler_rl.py |
| Simulation duration | 24 hours | run_simulation.py |
| Timesteps | 1440 (× 5 min) | run_simulation.py |

---

## 💬 QUICK Q&A REFERENCE

**Q: How does the system detect FDI?**
A: Layer A (k-sigma) detects deviation, Layer B (grid LSTM) recognizes FDI pattern (V drop + I spike), C-1 (CUSUM) confirms sustained injection.

**Q: How does it detect DoS?**
A: Layer B (network LSTM) recognizes pattern (all 4 features degrade), C-2 (rules) confirms RTT>200ms AND loss>5%.

**Q: What's the difference between demo and live?**
A: Demo fallback example (Agent #5, FDI+DoS) vs. Live data from latest run (top agent by risk).

**Q: Can I change the attack rates?**
A: Yes, in `run_all.py` lines with FDI_RATE, DOS_RATE, etc.

**Q: How long does 1 run take?**
A: ~10-15 min for N=100, SEED=42 (depends on system).

**Q: Where are results saved?**
A: `logs/N100_42/` (summary.json, dynamic_metrics.csv, shap_explanations.csv).

**Q: Can I run with different N?**
A: Yes, `python -m smartgrid_mas.run_all --n-agents 200` (if supported).

---

**Generated: 2026-07-08 | For M.Tech Presentation**
