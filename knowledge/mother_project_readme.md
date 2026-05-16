# SmartGrid AI Audit Framework - Mother Project README

This file is the consolidated truth-first entry point for the project knowledge folder.

It is written for three uses:

1. detailed reporting
2. research-paper writing
3. self-study and viva preparation

It does not invent numbers or claim results without a source. When the repository contains multiple metric snapshots from different stages, this README names the source file and the evaluation context instead of forcing them into one fake “final” number.

---

## 1. Project Identity

### 1.1 What the project is

This repository implements an end-to-end cyber-physical smart-grid security audit framework for a multi-agent system.

The system combines:

- deviation-based anomaly detection
- adaptive behavior analysis
- hybrid audit scheduling
- response and mitigation logic
- explainability at feature level
- experiment-mode evaluation across grid sizes
- a live Rapid SCADA telemetry pipeline
- a Next.js dashboard with separate experiment and live workspaces

The project is an operational prototype for academic research. It is not a field-deployed utility control system.

### 1.2 What the project is not

- not a commercial product
- not a physical substation deployment
- not a paper-only simulation with no implementation
- not a direct replacement for utility OT/SCADA systems

### 1.3 Core truth note

The live SCADA path is real, but the current live telemetry in this prototype comes from Rapid SCADA calculated channels rather than physical field hardware.

That means:

- the SCADA pipeline is real
- the backend ingestion pipeline is real
- the dashboard is real
- the current values are engineered inside Rapid SCADA
- cyber metrics are engineered or proxy-backed in the current prototype

This is normal for an academic CPS testbed, but it must be stated honestly in any report or viva.

---

## 2. Where The Truth Lives In This Repo

The knowledge folder contains several layers of documentation. Use the right file for the right job.

### 2.1 Master documentation files

| File | Role |
|---|---|
| [knowledge/mother_project_readme.md](mother_project_readme.md) | This consolidated master entry point |
| [knowledge/README.md](README.md) | Knowledge folder index and quick numbers |
| [knowledge/MASTER_PROJECT_REFERENCE.md](MASTER_PROJECT_REFERENCE.md) | Deep A-to-Z technical reference |
| [knowledge/README_FULL_PROJECT_CONTEXT.md](README_FULL_PROJECT_CONTEXT.md) | Full technical context, formulas, data flow, and implementation notes |
| [knowledge/README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md) | Rapid SCADA integration guide |
| [knowledge/INDUSTRIAL_SYSTEMS_PROTOCOL_ARCHITECTURE.md](INDUSTRIAL_SYSTEMS_PROTOCOL_ARCHITECTURE.md) | OT/IT and protocol architecture |
| [knowledge/MULTILAYER_DETECTION.md](MULTILAYER_DETECTION.md) | Multi-layer detection architecture |
| [knowledge/PROJECT_VS_BASEPAPER.md](PROJECT_VS_BASEPAPER.md) | Project vs base-paper comparison |
| [knowledge/report.md](report.md) | Research-style report draft |
| [knowledge/ACADEMIC_DOCUMENT.md](ACADEMIC_DOCUMENT.md) | Formal academic write-up |
| [knowledge/presentation_master.md](presentation_master.md) | Slide-by-slide presentation notes |
| [knowledge/VIVA_SPOKEN_SCRIPT_6_8_MIN.md](VIVA_SPOKEN_SCRIPT_6_8_MIN.md) | Short viva script |

### 2.2 Why this file exists

The other files are excellent, but they are fragmented by purpose.

This file stitches the verified parts together so you can:

- understand the whole project quickly
- write a coherent report without hunting across files
- explain the system honestly in a viva
- know which source to cite for which claim

---

## 3. System Overview

### 3.1 Main operational modes

The project has two main workspaces:

1. Experiment Running
2. Rapid SCADA Live

The split is deliberate.

- Experiment Running shows latest-run artifacts, synthetic attacks, audit scheduling, and evaluation metrics.
- Rapid SCADA Live shows current supervisory telemetry and live dashboard state.

This separation prevents experimental summaries from being mixed with live operational telemetry.

### 3.2 End-to-end architecture

```text
Rapid SCADA Webstation
  -> PowerShell bridge
  -> FastAPI backend
  -> anomaly scoring / behavior analysis / audit logic / response / XAI
  -> Next.js dashboard
```

### 3.3 Main components

- Rapid SCADA provides the live supervisory data source.
- A PowerShell bridge pulls current values from Rapid SCADA.
- The backend normalizes the data and runs scoring and response logic.
- The experiment runner generates synthetic attacks and evaluates the audit policy.
- The Next.js dashboard renders both live and experiment views.

---

## 4. Smart-Grid Model

### 4.1 Agent types

The project models the grid as a 100-agent system with four visible agent classes:

- Generators (`GEN-01` to `GEN-20`)
- Substations (`SUB-21` to `SUB-50`)
- PMUs (`PMU-51` to `PMU-75`)
- Breakers (`BRK-76` to `BRK-100`)

### 4.2 Why these agents matter

- Generators are high-impact because their output affects grid stability.
- Substations route and transform power.
- PMUs provide high-frequency monitoring.
- Breakers isolate faults and can prevent cascading failures.

### 4.3 Threat model

The documented threat classes include:

- false data injection
- denial of service
- man-in-the-middle tampering
- communication jamming
- coordinated breaker-substation attacks
- physical faults such as overcurrent, voltage sag, and breaker malfunction

The model is cyber-physical, so a cyber attack can create a physical fault cascade.

---

## 5. Live Rapid SCADA Path

### 5.1 What Rapid SCADA is used for here

Rapid SCADA provides:

- a web station UI
- a REST API for current values
- calculated channels for the 100-agent grid
- a real supervisory data path for the prototype

### 5.2 Important truth about the live data

The live telemetry values are generated inside Rapid SCADA by calculated channels.

They are not direct physical field-device measurements.

This matters because it should be stated explicitly in a report, especially if you are defending the work academically.

### 5.3 Live data flow

1. Rapid SCADA calculates current values for the 100-agent model.
2. The bridge reads those values from the Rapid SCADA Web API.
3. The backend converts tags into physical and cyber feature vectors.
4. The live pipeline computes score, probability, risk, audit action, and explanation.
5. The dashboard shows live state, alerts, and pipeline health.

### 5.4 Runtime launcher

The documented launcher is:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\scripts\start_local_demo.ps1 -OpenDashboard
```

The `.cmd` launcher is also documented as a bypass-friendly option.

### 5.5 Live topology

The Rapid SCADA guide documents a 100-agent grid and an enriched channel model.

Key points from the guide:

- the SCADA setup is real
- the channel values are calculated
- the 100-agent mapping is fixed
- the live bridge uses batched ingestion to avoid rate-limit instability

---

## 6. Experiment Running Path

### 6.1 What the experiment module does

Experiment mode is the offline evaluation and benchmark path.

It is used to:

- create agent populations such as `N=100`, `N=200`, `N=500`
- inject synthetic attacks and faults
- compare dynamic scheduling against fixed baseline scheduling
- compute attack-rate reduction, cost efficiency, risk mitigation, precision, recall, F1, and accuracy

### 6.2 Control and monitor pages

The experiment UI is intentionally separated from the live SCADA pages.

- `experiment/control` is the run-launch and configuration workspace
- `experiment/monitor` is the live experiment observation workspace

These pages are backed by dedicated source files in the app router, not by the Rapid SCADA pages.

---

## 7. Detection Logic

### 7.1 Base deviation scoring

The core explainable score is based on normalized deviation from a baseline.

The documented formula family is:

```text
z = (obs - base) / threshold
dx = sqrt(mean(((x - bx)/thx)^2))
dy = sqrt(mean(((y - by)/thy)^2))
S_i(t) = w_i × (dx + dy)
```

Where:

- `dx` is physical deviation
- `dy` is cyber deviation
- `w_i` is the criticality weight

### 7.2 Why the project extends the base paper

The base paper provides a single deviation-based detector. That is a good starting point, but the repository documents several extensions to handle stealthy or sustained attacks:

- calibrated LSTM thresholding
- temporal accumulator for sustained suspicion
- CUSUM drift detection for FDI
- network-rule detection for DoS
- integrity + temporal jump detection for MITM
- OR-with-precedence combination so a single agent is flagged once per timestep

### 7.3 Multi-layer detection architecture

The `MULTILAYER_DETECTION.md` document defines a three-part extension:

1. Layer A: calibrated LSTM threshold
2. Layer B: temporal accumulator for sustained low-amplitude attacks
3. Layer C: attack-type sub-detectors

This extension exists because single-threshold detectors can miss stealthy attacks that never cross a high-confidence bound in one timestep.

### 7.4 Explainability

The project keeps per-feature contribution values so an operator can see why a flag happened.

That is important for:

- academic defensibility
- operator trust
- audit traceability
- report writing

---

## 8. Audit Scheduling

### 8.1 Core idea

The audit scheduler balances:

- security
- risk coverage
- computational cost
- operational constraints

### 8.2 Documented scheduler family

The repository documents a hybrid audit policy:

- Q-learning for directional action selection
- gradient descent for continuous frequency refinement
- budget and capacity constraints

### 8.3 Why hybrid scheduling exists

Q-learning is useful for discrete audit decisions such as increase, hold, or decrease.

Gradient descent is useful for fine-tuning audit frequency once the direction is known.

### 8.4 Reward-shaping principle

The documentation emphasizes that missing attacks must cost more than performing audits.

That principle is the reason the reward function was revised in the project history.

The truthful report should say:

- cost and security must both be represented
- security cannot be a side effect of a cost-minimizing policy
- the reward function was adjusted because the earlier balance allowed under-auditing

---

## 9. Response Logic

### 9.1 Severity-based response

The response layer assigns actions based on severity and criticality.

Typical actions include:

- log anomaly
- increase audit frequency
- notify operator
- isolate agent
- emergency shutdown in the most severe cases

### 9.2 Why response matters

Detection alone is not enough.

If a system can detect a problem but cannot decide what to do next, then it is only a monitor, not a security framework.

---

## 10. Validation And Reported Snapshots

This repository contains multiple metric snapshots from different stages of the project.

Do not collapse them into one number without saying which document and which evaluation setting you are using.

### 10.1 Snapshot from the root README

The root [README.md](../README.md) reports a validated March 2026 status with these values:

| N | Cost Efficiency | Risk Mitigation | Accuracy | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| 100 | 83.55% | 67.62% | 99.56% | 0.2515 | 1.0000 |
| 200 | 84.75% | 71.33% | 99.55% | 0.2362 | 1.0000 |
| 500 | 92.65% | 72.08% | 99.54% | 0.2278 | 1.0000 |

### 10.2 Snapshot from the knowledge index

The knowledge index [knowledge/README.md](README.md) reports a later summary table with:

- detection accuracy: 99.76%
- false positive rate: 0.24%
- risk mitigation: 95.93%
- cost efficiency: 54.77%
- audit coverage: 100%
- recall: 100%

### 10.3 How to interpret the mismatch

These are not necessarily contradictions. They likely reflect different stages, different scenarios, or different evaluation definitions.

When writing the report, do this:

1. cite the exact source file
2. cite the exact scenario or dataset
3. avoid merging numbers from different stages into one “final” claim

### 10.4 Verified build and project health note

The master reference also records a build-time health snapshot:

- Python test suite: 67/71 passed
- backend health endpoint: 200 OK
- Next.js build: all pages compile
- SCADA bridge: 100 agents ingest correctly

If you want to cite health status, cite the source file and date, not just the number.

---

## 11. Research Paper Positioning

### 11.1 Base paper versus this implementation

The base paper establishes the idea of deviation scoring and dynamic audit optimization.

This repository turns that idea into a fuller system with:

- live SCADA integration
- a dashboard
- experiment/lifecycle separation
- richer detection logic
- audit control
- response logic
- documentation for viva and writing

### 11.2 How to describe the contribution honestly

The safest truthful wording is:

> The project extends the base paper into an operational prototype that combines live SCADA ingestion, explainable scoring, adaptive audit scheduling, and experiment-mode evaluation in one integrated system.

Avoid claiming that the live data is physical hardware data unless the system is actually connected to physical devices.

### 11.3 Good paper-writing angle

When writing the final paper or report, frame the system in layers:

1. problem and threat model
2. detection logic
3. audit scheduling
4. response logic
5. live SCADA integration
6. evaluation and limitations

That structure is already supported by the repository docs.

---

## 12. Implementation Map

### 12.1 Frontend

- Next.js app router pages under `web/src/app`
- experiment workspace pages
- rapid-scada workspace pages
- report and research views

### 12.2 Backend and runtime

- Python package `smartgrid_mas`
- API server and ingestion endpoints
- SCADA adapter and bridge scripts
- experiment runners and evaluation utilities

### 12.3 Knowledge folder usage

- `report.md` for narrative drafting
- `MASTER_PROJECT_REFERENCE.md` for detailed technical defense
- `README_RAPID_SCADA_PROJECT_GUIDE.md` for SCADA integration
- `MULTILAYER_DETECTION.md` for detector design
- `PROJECT_VS_BASEPAPER.md` for comparison tables and positioning

---

## 13. Run And Verify

### 13.1 Experiment mode

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-"
\.venv\Scripts\Activate.ps1
python -m smartgrid_mas.run_all
```

### 13.2 Full local demo

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\scripts\start_local_demo.ps1 -OpenDashboard
```

### 13.3 Production build for the dashboard

```powershell
cd "D:\Mtech Main project\smartgrid-audit-base-\web"
npm run build
```

### 13.4 What to check first when something breaks

1. missing page routes in the Next.js app router
2. SCADA bridge startup and API reachability
3. backend health endpoint
4. live telemetry tag mapping
5. experiment run logs

---

## 14. Report And Viva Use

### 14.1 If you are writing a detailed report

Use this order:

1. project summary
2. threat model and architecture
3. detection design
4. audit scheduler
5. live integration
6. evaluation snapshots
7. limitations and future work

### 14.2 If you are preparing a research paper

Use this order:

1. abstract
2. introduction and gap
3. system model
4. method
5. implementation
6. validation
7. comparison to the base paper

### 14.3 If you are self-studying

Read in this order:

1. [knowledge/README.md](README.md)
2. [knowledge/README_FULL_PROJECT_CONTEXT.md](README_FULL_PROJECT_CONTEXT.md)
3. [knowledge/README_RAPID_SCADA_PROJECT_GUIDE.md](README_RAPID_SCADA_PROJECT_GUIDE.md)
4. [knowledge/MULTILAYER_DETECTION.md](MULTILAYER_DETECTION.md)
5. [knowledge/PROJECT_VS_BASEPAPER.md](PROJECT_VS_BASEPAPER.md)
6. [knowledge/report.md](report.md)

---

## 15. Honest Limitations

These should be kept in any serious report:

1. live telemetry is currently SCADA-calculated rather than physical-field-device sourced
2. cyber tags are engineered/proxy-backed in the current prototype
3. some metric snapshots in the repo differ because they come from different stages or evaluation settings
4. the knowledge folder contains both current and historical documentation, so source traceability matters

---

## 16. Bottom Line

This repository is more than a paper summary.

It is a working academic prototype with:

- a live SCADA path
- a simulation/evaluation path
- a dashboard
- an explainable detection pipeline
- an adaptive audit strategy
- a substantial supporting knowledge base

If you are writing a final report or defending the work, treat this file as the master index, and cite the deeper documents only for the exact claim you need.
