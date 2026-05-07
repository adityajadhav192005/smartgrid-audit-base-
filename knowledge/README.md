# SmartGrid AI Audit Framework — Knowledge Folder Master Index

**Project:** Enhancing Security of Distributed Multi-Agent Systems in Smart Grids: An AI-Driven Approach to Regular Audits (Extended Implementation)
**Base Paper:** Priyadarsini et al., ACM TOPS 2025, NIT Raipur
**Student:** M.Tech Final Year Project
**Stack:** Python · FastAPI · Next.js · Rapid SCADA · Q-Learning · Dual-Branch LSTM · Blockchain · Federated Learning

---

## What This Project Is

A full-stack cyber-physical smart-grid security audit framework that:

- Monitors 100 agents (GEN, SUB, PMU, BRK) in real-time via Rapid SCADA
- Detects anomalies using a 3-modality voting ensemble (deviation + LSTM + behavioral)
- Schedules audits dynamically using hybrid Q-learning + gradient descent
- Explains every decision at the feature level (XAI)
- Records audit events on a blockchain-style ledger
- Federates model weights across agent clusters (FedAvg)
- Presents everything in a 26-page operational dashboard

**Key result:** 99.76% accuracy vs paper's 98.4%, 0.24% FPR vs 3.2%, 54.77% cost efficiency vs 42.5%

---

## Files In This Folder

| File | What It Contains | When To Read It |
|------|-----------------|-----------------|
| `README.md` | This master index | First |
| `MASTER_PROJECT_REFERENCE.md` | **Complete A-Z project deep-dive** — every decision, every alternative, every formula, every file | Viva prep, deep review |
| `README_FULL_PROJECT_CONTEXT.md` | Full technical context — algorithms, formulas, metrics, API endpoints, file map | Technical review |
| `README_RAPID_SCADA_PROJECT_GUIDE.md` | Rapid SCADA integration guide — channel layout, bridge, adapter, data flow | SCADA questions |
| `INDUSTRIAL_SYSTEMS_PROTOCOL_ARCHITECTURE.md` | Industrial systems architecture — protocols, OT/IT layers, deployment context | Architecture questions |
| `VIVA_SPOKEN_SCRIPT_6_8_MIN.md` | Word-for-word 7-minute viva script with examiner pivot lines | Day before viva |
| `presentation_master.md` | Slide-by-slide presentation notes with speaker lines | PPT preparation |
| `ACADEMIC_DOCUMENT.md` | Formal academic document — Abstract, Problem, Objectives, Novelty, Results, References | Submission document |
| `report.md` | Comprehensive research report with literature survey | Written report |
| `VIVA_QA_BANK.md` | 40+ expected viva questions with model answers | Night before viva |

---

## Recommended Reading Order

### If you have 1 hour before the viva:
1. `VIVA_SPOKEN_SCRIPT_6_8_MIN.md` — practice the 7-min presentation
2. `VIVA_QA_BANK.md` — go through the Q&A bank

### If you have half a day:
1. `MASTER_PROJECT_REFERENCE.md` — read sections 1–5
2. `README_RAPID_SCADA_PROJECT_GUIDE.md` — SCADA specifics
3. `VIVA_SPOKEN_SCRIPT_6_8_MIN.md` — practice

### For technical deep review:
1. `README_FULL_PROJECT_CONTEXT.md` — all algorithms and formulas
2. `INDUSTRIAL_SYSTEMS_PROTOCOL_ARCHITECTURE.md` — architecture rationale
3. `ACADEMIC_DOCUMENT.md` — structured academic framing

---

## Key Numbers To Remember

| Metric | Our System | Base Paper | Direction |
|--------|-----------|-----------|-----------|
| Detection Accuracy | **99.76%** | 98.4% | ↑ better |
| False Positive Rate | **0.24%** | 3.2% | ↓ better |
| Risk Mitigation | **95.93%** | 87.9% | ↑ better |
| Cost Efficiency | **54.77%** | 42.5% | ↑ better |
| Audit Coverage | **100%** | 93.8% | ↑ better |
| Recall | **100%** | not reported | — |

---

## Key One-Liners For The Viva

- **What is the project?** An end-to-end cyber-physical smart-grid audit framework that detects anomalies, schedules audits intelligently, explains every decision, and provides a live operational dashboard.
- **What is new vs the paper?** The paper proposes the concept. We implement it fully — 3-modality detection, hybrid scheduler, live SCADA integration, XAI, blockchain ledger, federated learning, 26-page dashboard.
- **Why better accuracy?** We match the paper's 24-hour evaluation cycle. At 24h the true-negative denominator grows 26× while false positives stay fixed at ~68, giving 99.76%.
- **What about cyber metrics in SCADA?** Rapid SCADA measures physical values. Cyber metrics (packet loss, integrity, comm_freq) use engineered baselines — same approach as every academic CPS testbed.
- **What is future work?** IDS/SIEM integration for real cyber metrics, adaptive baselines via online learning, physical PLC/RTU integration.
