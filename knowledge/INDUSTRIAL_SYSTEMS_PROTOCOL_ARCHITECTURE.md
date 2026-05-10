# Industrial Systems and Protocol Architecture

**Project:** SmartGrid AI Audit Framework
**Context:** M.Tech final year project viva reference

---

## 1. What A Smart Grid Is

A smart grid is a modernised electrical power network that uses digital communication, sensor networks, and intelligent control to:

- Monitor the state of generation, transmission, and distribution assets in real time
- Detect and respond to faults, overloads, and cyber attacks automatically
- Enable bidirectional energy flows (solar, wind, storage, EVs feeding back to grid)
- Reduce operational cost through dynamic routing and demand response

**Why it is a cyber-physical system (CPS):**

A smart grid combines physical processes (electricity flowing through wires, transformers, breakers) with cyber processes (communication, control, monitoring). An attack on the cyber layer can cause physical damage — and vice versa. This is what makes security so difficult.

---

## 2. Key Asset Types In This Project

| Asset | Role | What Goes Wrong Under Attack |
|-------|------|------------------------------|
| **Generator (GEN)** | Produces electricity | False data injection fakes voltage/current readings, masking overload or shutdown |
| **Substation (SUB)** | Steps up/down voltage, routes power | DoS attack overwhelms communication, delays fault detection |
| **PMU (Phasor Measurement Unit)** | Measures voltage/current phase angles at 30-120 samples/sec | Phase desynchronisation attack corrupts state estimation |
| **Breaker (BRK)** | Switches circuits on/off for protection | Spurious trip commands cause blackouts |

---

## 3. The OT/IT Architecture Layers

Smart grids follow a layered architecture. Understanding this is important for the viva because examiners will ask about where your system sits.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5: Enterprise/IT (ERP, billing, analytics)        │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Supervisory (SCADA, DMS, EMS) ← This project  │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Site Control (HMI, historians, local servers)  │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Control Devices (PLCs, RTUs, IEDs)             │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Field Instrumentation (sensors, transducers)   │
├─────────────────────────────────────────────────────────┤
│  Layer 0: Physical Process (wires, transformers, meters) │
└─────────────────────────────────────────────────────────┘
```

**This project operates at Layer 4 (Supervisory):**
- Rapid SCADA is the supervisory platform (like a real utility's SCADA/EMS)
- The AI backend is an analytics layer sitting above SCADA
- The dashboard is the operator interface

In a real deployment:
- Layer 0–2 would be actual electrical hardware (generators, PLCs, RTUs)
- Layer 3 would have Modbus/OPC UA communication from field to SCADA
- Layer 4 is where this project connects

---

## 4. Industrial Communication Protocols

Examiners may ask about protocols. Know these:

| Protocol | Layer | Role | Used In This Project? |
|----------|-------|------|----------------------|
| **Modbus TCP/RTU** | 2-3 | Simple serial/TCP protocol for reading registers from PLCs/RTUs | No — would be used for field devices |
| **OPC UA** | 3-4 | Modern, secure, platform-independent process data exchange | No — production path for SCADA integration |
| **IEC 61850** | 2-4 | Standard for substation automation and protection | No — used in real substations |
| **DNP3** | 2-4 | SCADA-to-field protocol for utility grade systems | No |
| **MQTT** | 4-5 | Lightweight publish-subscribe for IoT/edge monitoring | No |
| **HTTP REST** | 4-5 | Web API for SCADA data extraction | **Yes** — Rapid SCADA GetCurData API |

**Why we use HTTP REST and not Modbus/OPC UA:**
- Rapid SCADA exposes its data through a web API
- This is sufficient for the supervisory monitoring purpose of this project
- Modbus/OPC UA would be needed if we were reading directly from PLCs

---

## 5. This Project's Protocol Stack

```
Physical: calculated channels in Rapid SCADA (simulated process values)
     ↓
Transport: HTTP REST (GetCurData)
     ↓
Bridge: PowerShell → normalise → batch JSON payload
     ↓
API: HTTP POST to FastAPI (/v1/scada/ingest/tags/batch)
     ↓
Processing: Python — scoring, LSTM, scheduling, XAI
     ↓
Dashboard: HTTP polling from Next.js → FastAPI proxy routes
```

This is a valid industrial architecture pattern. Real SCADA analytics platforms (OSIsoft PI, AspenTech, GE Predix) use exactly this layered approach — SCADA provides data, an analytics layer processes it, a dashboard presents it.

---

## 6. Comparison With Alternatives

### 6.1 Why Not Use A Real PLC/RTU?

| Reason | Explanation |
|--------|-------------|
| Cost | Siemens S7-1200 PLC costs ₹15,000–₹50,000, not available for M.Tech budget |
| Safety | Real electrical equipment requires lab certification and safety training |
| Scope | Our contribution is the AI algorithm, not the hardware integration |
| Precedent | The base paper (Priyadarsini et al.) uses pure Python simulation with no hardware |

A real PLC would make the project stronger for industry, but it is not necessary for an M.Tech research contribution.

### 6.2 Why Not Use OpenADR or DERMS?

OpenADR (Open Automated Demand Response) and DERMS (Distributed Energy Resource Management Systems) are real-time demand-response protocols. They are relevant for smart grid energy management but not for the anomaly detection and security audit problem this project solves.

### 6.3 Why Not Use Modbus Instead of HTTP?

- Rapid SCADA's primary external interface for analytics is its HTTP API
- Modbus would require a different SCADA product or custom driver
- HTTP REST is perfectly appropriate for supervisory analytics (not field control)

---

## 7. The AI Layer Architecture

### 7.1 Why Multi-Agent And Not A Central Model

**Alternative: One central LSTM over all agents**
- Problem: Different agent types (GEN/SUB/PMU/BRK) have different physics, different baselines, different attack signatures
- A single model conflates them and reduces sensitivity
- Harder to explain which agent is anomalous

**Why multi-agent:**
- Each agent maintains its own state, baseline, and anomaly score
- Per-agent-type profiles allow different thresholds for different asset classes
- Results are per-agent, not grid-average — operationally useful

### 7.2 Why Deviation Scoring And Not Pure Deep Learning

| Approach | Pros | Cons |
|----------|------|------|
| Pure threshold rules | Explainable, fast | No adaptation, misses novel attacks |
| Pure LSTM/deep learning | Learns complex patterns | Black box, needs lots of data, fragile |
| **Deviation scoring (ours)** | Explainable, interpretable, auditable | Needs good baselines |
| SVM/Random Forest | Reasonable accuracy | No temporal awareness, not per-agent |
| Isolation Forest | Unsupervised anomaly detection | No audit scheduling integration |

The paper's approach (and ours) uses deviation scoring as the explainable core, with LSTM as a secondary confirmation signal. This hybrid gives both explainability and sensitivity.

### 7.3 Why Q-Learning For Audit Scheduling

**Alternative: Fixed periodic audit** — audit every agent every K timesteps
- Wastes budget on low-risk agents
- Misses high-risk agents that spike between audits

**Alternative: Pure heuristic** — audit if score > threshold
- Reactive, not predictive
- No budget awareness

**Why Q-learning:**
- Learns to anticipate risk rather than just react
- Handles budget constraints naturally through reward shaping
- Adapts over time as attack patterns change

**Why hybrid (Q-learning + gradient descent):**
- Q-learning gives discrete directional action (increase/decrease/hold)
- Gradient descent refines the continuous frequency value
- Constraints enforce hard budget and capacity limits
- Together: discrete direction + continuous precision + feasibility = hybrid scheduler

---

## 8. Deployment Context

### 8.1 Where This Would Sit In A Real Utility

```
Substation (Modbus/OPC UA) → Rapid SCADA → SmartGrid Backend → Operator Dashboard
Control Room EMS           ↗               ↓
PMU Measurement System    ↗               Blockchain Ledger
IDS/SIEM (Snort)         ↗               Federated Learning Hub
```

### 8.2 What Would Change In Production

| Component | Research Prototype | Production |
|-----------|-------------------|-----------|
| SCADA values | Calculated channels | Real PLC/RTU/PMU measurements |
| Cyber metrics | Engineered baselines | Snort/Suricata IDS feed |
| Baselines | Hand-set | Learned from historical data |
| LSTM checkpoint | Trained on simulation | Retrained on real utility data |
| Blockchain | SQLite-backed audit chain | Hyperledger Fabric or Ethereum |
| Federated learning | FedAvg across simulated clusters | Real distributed deployment |

---

## 9. Security Architecture

### 9.1 Attack Types Handled

| Attack Type | Layer | Detection Mechanism |
|-------------|-------|---------------------|
| False Data Injection (FDI) | Physical | Voltage/current deviation exceeds threshold |
| DoS on substation communication | Cyber | Latency spike, comm_freq drop |
| PMU phase desynchronisation | Physical + Cyber | Frequency deviation, integrity ↓ |
| Spurious breaker trip | Physical | Status → 0 with no current explanation |
| Replay attack | Cyber | Integrity score degradation |
| Coordinated multi-point attack | Physical + Cyber | Multiple agents flag simultaneously |

### 9.2 Defense In Depth

This project implements multiple layers of detection (defense in depth):

1. **Deviation scoring** — first line, explainable, fast
2. **LSTM anomaly probability** — second line, temporal pattern detection
3. **Behavioral signature** — third line, temporal step/ramp/oscillation patterns
4. **Tier-A FP suppression** — reduces false positives from physical-only outliers
5. **Blockchain audit ledger** — tamper-evident record of all audit decisions
6. **Federated learning** — aggregated knowledge across agent clusters

---

## 10. Standards And Regulatory Context

Examiners may ask about standards:

| Standard | What It Covers | Relevance |
|----------|---------------|-----------|
| **IEC 62351** | Security for power system communication | Cyber security at the protocol level |
| **IEC 62443** | Industrial cybersecurity management | IACS security levels framework |
| **NERC CIP** | North American grid reliability standards | Critical infrastructure protection |
| **NIST Cybersecurity Framework** | Identify, Protect, Detect, Respond, Recover | Framework our project maps onto |
| **IEEE 1686** | Substation IED cyber security | Device-level security |

**How our project maps to NIST CSF:**
- **Identify:** Asset inventory through the 100-agent topology view
- **Protect:** Audit scheduling increases inspection of high-risk assets
- **Detect:** 3-modality anomaly detection (deviation + LSTM + behavioral)
- **Respond:** Response workflow and mitigation actions
- **Recover:** Audit trail and blockchain ledger for post-incident analysis
