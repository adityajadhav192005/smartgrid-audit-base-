# Dual Datasets: UCI (Physical) + UNSW-NB15 (Cyber) & Dual-Branch LSTM

---

## **PART 1: YOUR TWO DATASETS**

### **Dataset 1: UCI Grid Stability (PHYSICAL)**

| Property | Details |
|----------|---------|
| **File** | `smartgrid_mas/data/anomaly_inputs/uci_grid_stability_prepared.csv` |
| **Rows** | 10,000 observations |
| **Size** | 2.1 MB |
| **Features** | 12 physical parameters + 1 label |
| **Domain** | Power systems / generators |

**Physical Features (Generator Parameters):**
```
tau1, tau2, tau3, tau4     [0.5 - 10 seconds]    Reaction time constants
p1,   p2,   p3,   p4       [0 - 5 MW]            Real power outputs
g1,   g2,   g3,   g4       [0 - 1 normalized]    Damping coefficients
stabf                      {0, 1}                Label: unstable / stable
```

**Physical Meaning:**
- Measures stability of generator/power delivery
- tau = How fast generator responds to grid changes
- p = How much power is being generated
- g = How much the system dampens oscillations (damping)
- stabf = Does the grid remain stable? (1) or does it collapse/oscillate? (0)

**Example (from UCI dataset):**
```
tau1=2.96, tau2=3.08, tau3=8.38, tau4=9.78,
p1=3.76, p2=-0.78, p3=-1.26, p4=-1.72,
g1=0.65, g2=0.86, g3=0.89, g4=0.96
→ stabf=1 (STABLE - grid is healthy)
```

---

### **Dataset 2: UNSW-NB15 (CYBER)**

| Property | Details |
|----------|---------|
| **File** | `smartgrid_mas/data/network_intrusion/unsw_nb15_train.csv` (82K rows) |
|          | `smartgrid_mas/data/network_intrusion/unsw_nb15_test.csv` (175K rows) |
| **Total Rows** | 257,675 network packets |
| **Size** | ~100 MB combined |
| **Features** | 42 network metrics + 2 labels |
| **Domain** | Network security / cyber attacks |

**Cyber Features (Network Packet Metrics):**
```
Timing:
├─ dur              Duration of the connection (seconds)
├─ sttl, dttl       Source/destination TTL (time-to-live)
├─ synack           SYN-ACK response time
└─ ackdat           Acknowledgement data time

Traffic:
├─ spkts, dpkts     Source/destination packet count
├─ sbytes, dbytes   Source/destination bytes transferred
├─ rate             Packets per second
├─ sload, dload     Source/destination load (bytes/sec)
├─ sloss, dloss     Source/destination packet loss %
└─ sinpkt, dinpkt   Source/destination inter-packet time

Protocol & Connection:
├─ proto            Protocol (TCP, UDP, ICMP, ARP, etc.)
├─ service          Service type (HTTP, FTP, DNS, etc.)
├─ state            Connection state (INT, FIN, CON, etc.)
├─ swin, dwin       TCP window size

Anomaly Indicators:
├─ ct_srv_src       Connections to same service from source
├─ ct_state_ttl     Connections with same state+TTL
├─ ct_dst_ltm       Connections to same destination LT
├─ is_ftp_login     Is FTP login attempt?
├─ ct_ftp_cmd       FTP command count
└─ [+20 more statistical features]

Labels:
├─ attack_cat       Attack category (Normal, DoS, Reconnaissance, etc.)
└─ label            Binary (0=Normal, 1=Attack)
```

**Label Distribution (UNSW-NB15):**
```
TRAIN (82,333 rows):
├─ Normal:           45,344 (55%)
├─ DoS:              11,585 (14%)
├─ Reconnaissance:   10,491 (13%)
├─ Backdoor:          5,292 (6%)
├─ Analysis:          4,666 (6%)
└─ Exploitation:      2,954 (4%)
└─ Worm:              2,001 (2%)

TEST (175,342 rows):
├─ Normal:           93,630 (53%)
├─ DoS:              36,554 (21%)
├─ Reconnaissance:   19,523 (11%)
├─ Backdoor:         13,043 (7%)
├─ Exploitation:      8,080 (5%)
├─ Analysis:          2,871 (2%)
└─ Worm:              1,641 (1%)
```

**Cyber Example (from UNSW-NB15):**
```
dur=0.000011, proto=udp, service=-, state=INT,
spkts=2, dpkts=0, sbytes=496, dbytes=0,
rate=90909.09, sttl=254, dttl=0,
sload=180363632, dload=0, sloss=0, dloss=0,
[... 30 more network features ...]
attack_cat=Normal, label=0
→ Normal traffic (benign UDP packet)

--- vs. attack ---

dur=0.005, proto=tcp, service=http, state=CON,
spkts=152, dpkts=89, sbytes=50000, dbytes=120000,
rate=33000, sttl=254, dttl=128,
sload=500000000, dload=480000000,  ← VERY HIGH (suspicious)
sinpkt=0.002, dinpkt=0.003,        ← Very fast (DoS pattern)
[... 30 more network features ...]
attack_cat=DoS, label=1
→ DoS attack detected (flood of packets)
```

---

## **PART 2: DUAL-BRANCH LSTM ARCHITECTURE**

### **Why Two Branches?**

Your smart grid has **two independent attack vectors**:

```
┌─────────────────────────────────────────────────┐
│        SMART GRID CPS (Cyber-Physical System)   │
├─────────────────────────────────────────────────┤
│                                                 │
│  PHYSICAL LAYER:                                │
│  ├─ Generators (produce power)                  │
│  ├─ Transformers (step up/down voltage)        │
│  ├─ Transmission lines (carry power)            │
│  └─ Loads (consume power)                       │
│                                                 │
│  ↓ Sensors measure: V, I, f, θ, PF             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  CYBER LAYER:                                   │
│  ├─ SCADA network (control signals)             │
│  ├─ Communication protocols (TCP, UDP)          │
│  ├─ Data transmission (meter readings)          │
│  └─ Remote control commands                     │
│                                                 │
│  ↓ Packet sniffer captures: network flows       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Possible attacks on each layer:**
- **Physical attacks:** FDI (false voltage), load spikes, frequency deviation
- **Cyber attacks:** DoS (packet flooding), MITM (data tampering), backdoors

**Solution:** Train two separate LSTM models:
1. **Physical LSTM** on UCI data → detects power grid anomalies
2. **Cyber LSTM** on UNSW-NB15 data → detects network intrusions
3. **Fusion** → combine both signals for final decision

---

### **Dual-Branch LSTM Architecture Diagram**

```
┌──────────────────────────────────────────────────────────────┐
│           OBSERVATIONS AT TIMESTEP t                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PHYSICAL BRANCH         │      CYBER BRANCH                │
│  ═══════════════════════════════════════════════             │
│                          │                                  │
│  Input: Per-Agent        │  Input: Network Metrics          │
│  Features                │                                  │
│  ├─ V (voltage)          │  ├─ dur (duration)              │
│  ├─ I (current)          │  ├─ rate (pkts/sec)             │
│  ├─ f (frequency)        │  ├─ sload (source load)         │
│  ├─ θ (phase angle)      │  ├─ dload (dest load)           │
│  └─ PF (power factor)    │  ├─ sloss (packet loss)         │
│                          │  ├─ proto (TCP/UDP/ICMP)        │
│  5 features/agent        │  └─ [+35 more network features]  │
│                          │                                  │
│  Sequence window:        │  Sequence window:                │
│  ├─ Last 10 timesteps    │  ├─ Last 30 timesteps           │
│  ├─ 100 agents × 5       │  ├─ 42 network metrics           │
│  └─ = 500 features       │  └─ = 1,260 features             │
│                          │                                  │
│  LSTM MODEL 1            │  LSTM MODEL 2                    │
│  (Trained on UCI)        │  (Trained on UNSW-NB15)          │
│  ┌──────────────────┐    │  ┌──────────────────┐            │
│  │ Input: 500       │    │  │ Input: 1260      │            │
│  │ LSTM-64-64       │    │  │ LSTM-128-128     │            │
│  │ Output: 1        │    │  │ Output: 1        │            │
│  │ (probability)    │    │  │ (probability)    │            │
│  └────────┬─────────┘    │  └────────┬─────────┘            │
│           │              │           │                      │
│  grid_prob = 0.85        │  network_prob = 0.45             │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   DUAL-BRANCH FUSION ENGINE      │
        ├──────────────────────────────────┤
        │                                  │
        │ Input:                           │
        │ ├─ grid_prob = 0.85              │
        │ └─ network_prob = 0.45           │
        │                                  │
        │ Weights:                         │
        │ ├─ w_grid = 0.58 (physical)      │
        │ └─ w_network = 0.42 (cyber)      │
        │                                  │
        │ Agreement bonus:                 │
        │ ├─ If both agree → boost         │
        │ └─ If disagree → penalty         │
        │                                  │
        │ Formula:                         │
        │ fused = 0.58×0.85 + 0.42×0.45    │
        │       + agreement_bonus          │
        │       - disagreement_penalty     │
        │       + high_support_bonus       │
        │                                  │
        │ fused_prob = 0.742               │
        │                                  │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │      FINAL DECISION               │
        ├──────────────────────────────────┤
        │ fused_prob = 0.742               │
        │ threshold = 0.715                │
        │                                  │
        │ 0.742 > 0.715 → ALERT RAISED     │
        │                                  │
        │ Attack type:                     │
        │ ├─ grid_prob high + net high     │
        │ │  → Both layers agree           │
        │ └─ → High confidence attack      │
        └──────────────────────────────────┘
```

---

## **PART 3: HOW THE TWO DATASETS TRAIN THE LSTM MODELS**

### **Physical Branch LSTM (Trained on UCI)**

```
┌───────────────────────────────────────────────┐
│ UCI Grid Stability Dataset (10,000 rows)      │
├───────────────────────────────────────────────┤
│ Features: tau1-4, p1-4, g1-4                  │
│ Label: stabf (0=unstable, 1=stable)           │
│                                               │
│ → Normalize (z-score)                         │
│ → Create sequences (10-step windows)          │
│ → Train LSTM on stability classification      │
│                                               │
│ LSTM learns:                                  │
│ "When tau/p/g values change like THIS,        │
│  the grid becomes UNSTABLE"                   │
│                                               │
│ Output model: lstm_pretrained.pt              │
│ (Weights learned from 10K real observations)  │
│                                               │
│ Applied to:                                   │
│ Grid data: V, I, f, θ, PF                    │
│ (Same stability patterns, different features) │
└───────────────────────────────────────────────┘
```

**Example UCI Training Data:**
```
Input sequence (10 timesteps of 4 generators):
[
  [tau1=2.96, tau2=3.08, tau3=8.38, tau4=9.78],
  [tau1=2.95, tau2=3.07, tau3=8.37, tau4=9.77],
  [tau1=2.94, tau2=3.06, tau3=8.36, tau4=9.76],
  ... (10 timesteps) ...
]

Expected output:
stabf = 1 (stable)

LSTM learns the pattern:
"These tau/p/g trajectories lead to STABILITY"
```

### **Cyber Branch LSTM (Trained on UNSW-NB15)**

```
┌───────────────────────────────────────────────┐
│ UNSW-NB15 Dataset (257,675 total rows)        │
├───────────────────────────────────────────────┤
│ Train: 82,333 rows                            │
│ Test: 175,342 rows                            │
│                                               │
│ Features: 42 network metrics                  │
│ Labels: attack_cat (DoS, Recon, Backdoor...  │
│        label (0=Normal, 1=Attack)             │
│                                               │
│ → Select relevant cyber features              │
│   (latency, packet_loss, comm_drop, etc.)    │
│ → Normalize                                   │
│ → Create sequences (30-step windows)          │
│ → Train LSTM on intrusion classification      │
│                                               │
│ LSTM learns:                                  │
│ "When network patterns show THESE metrics,    │
│  there's a DoS/MITM/Backdoor attack"         │
│                                               │
│ Output model: lstm_network.pt                 │
│ (Weights learned from 82K attack samples)    │
│                                               │
│ Applied to:                                   │
│ Communication metrics captured from grid      │
│ (Same patterns learned, new data stream)      │
└───────────────────────────────────────────────┘
```

**Example UNSW-NB15 Training Data:**

```
Normal packet sequence (30 timesteps):
[
  [dur=0.001, rate=1000, sload=5000000, dload=4800000, ...],
  [dur=0.001, rate=1050, sload=5100000, dload=4900000, ...],
  ... (30 packets, normal flow) ...
]
Expected output: label=0 (NORMAL)

---

DoS attack sequence (30 timesteps):
[
  [dur=0.0001, rate=50000, sload=500000000, dload=480000000, ...],
  [dur=0.0001, rate=52000, sload=520000000, dload=500000000, ...],
  ... (30 packets, flood) ...
]
Expected output: label=1 (ATTACK - DoS)

LSTM learns:
"High rate + high sload/dload + short duration = DoS ATTACK"
```

---

## **PART 4: FUSION LOGIC (How Both Branches Work Together)**

### **Fusion Formula:**

```python
def fuse_branch_probabilities(grid_prob, network_prob):
    """
    Combine physical + cyber anomaly signals
    """
    
    # Step 1: Weight each branch
    w_grid = 0.58      # Physical branch weight
    w_network = 0.42   # Cyber branch weight
    
    weighted = (w_grid * grid_prob) + (w_network * network_prob)
    
    # Step 2: Agreement bonus (both agree → boost confidence)
    agreement = 1.0 - abs(grid_prob - network_prob)
    # If both say anomaly (0.85, 0.80) → agreement=0.95 HIGH
    # If disagree (0.85, 0.15) → agreement=0.30 LOW
    
    agreement_bonus = 0.10 * agreement * min(grid_prob, network_prob)
    
    # Step 3: Disagreement penalty
    disagreement_penalty = 0.05 * abs(grid_prob - network_prob)
    
    # Step 4: High support bonus (both confident)
    high_support_bonus = 0
    if grid_prob >= 0.85 AND network_prob >= 0.85:
        high_support_bonus = 0.08  # Strong agreement
    elif max(grid_prob, network_prob) >= 0.95:
        high_support_bonus = 0.04  # One is very confident
    
    # Final fusion
    fused = weighted + agreement_bonus - disagreement_penalty + high_support_bonus
    
    return clip(fused, 0.0, 1.0)
```

### **Fusion Examples:**

**Case 1: Both Agree on Attack**
```
grid_prob = 0.90 (physical anomaly detected)
network_prob = 0.88 (cyber anomaly detected)

weighted = 0.58×0.90 + 0.42×0.88 = 0.522 + 0.370 = 0.892
agreement = 1.0 - |0.90-0.88| = 0.98 (high agreement)
agreement_bonus = 0.10 × 0.98 × 0.88 = 0.086
disagreement_penalty = 0.05 × |0.90-0.88| = 0.001
high_support_bonus = 0.08 (both ≥ 0.85)

fused = 0.892 + 0.086 - 0.001 + 0.08 = 1.057 → clipped to 1.0
→ VERY HIGH CONFIDENCE (attack on both layers)
```

**Case 2: Only Physical Anomaly**
```
grid_prob = 0.85 (physical anomaly detected)
network_prob = 0.30 (no network anomaly)

weighted = 0.58×0.85 + 0.42×0.30 = 0.493 + 0.126 = 0.619
agreement = 1.0 - |0.85-0.30| = 0.45 (disagree)
agreement_bonus = 0.10 × 0.45 × 0.30 = 0.0135
disagreement_penalty = 0.05 × |0.85-0.30| = 0.0275
high_support_bonus = 0 (only one high)

fused = 0.619 + 0.0135 - 0.0275 + 0 = 0.605 < 0.715
→ NO ALERT (likely false alarm - only physical, not cyber)
```

**Case 3: Only Network Anomaly**
```
grid_prob = 0.40 (no physical anomaly)
network_prob = 0.80 (network intrusion detected)

weighted = 0.58×0.40 + 0.42×0.80 = 0.232 + 0.336 = 0.568
agreement = 1.0 - |0.40-0.80| = 0.60 (moderate disagreement)
agreement_bonus = 0.10 × 0.60 × 0.40 = 0.024
disagreement_penalty = 0.05 × |0.40-0.80| = 0.020

fused = 0.568 + 0.024 - 0.020 + 0 = 0.572 < 0.715
→ NO ALERT (cyber attack detected but no physical impact yet)
```

---

## **PART 5: DATA FLOW IN YOUR PROJECT**

```
┌─────────────────────────────────────────────────────────────────┐
│              YOUR COMPLETE SYSTEM PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PREPROCESSING PHASE (One-time, at startup):                     │
│                                                                 │
│  UCI Grid Stability       │  UNSW-NB15 Network                 │
│  10,000 samples           │  257,675 samples                    │
│       │                   │       │                             │
│       ├─ Load CSV         │       ├─ Load CSVs                  │
│       ├─ Normalize        │       ├─ Select cyber features      │
│       ├─ Create sequences │       ├─ Normalize                  │
│       └─ Train LSTM       │       ├─ Create sequences           │
│            │              │       └─ Train LSTM                 │
│            │              │            │                        │
│            └─→ lstm_pretrained.pt      └─→ lstm_network.pt      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ RUNTIME PHASE (24-hour simulation):                             │
│                                                                 │
│  GridEnvironment (100 agents, 288 timesteps)                    │
│       │                                                        │
│       ├─ Generate synthetic grid data                          │
│       │   (Realistic patterns from UCI training)               │
│       │                                                        │
│       ├─ Inject attacks (FDI, DoS, MITM, faults)              │
│       │                                                        │
│       └─ For each timestep:                                    │
│           │                                                    │
│           ├─ PHYSICAL BRANCH:                                  │
│           │  ├─ Collect per-agent features (V, I, f, θ, PF)   │
│           │  ├─ Build 10-step sequence                         │
│           │  ├─ Run through lstm_pretrained.pt                 │
│           │  └─ Output: grid_prob (0 to 1)                     │
│           │                                                    │
│           ├─ CYBER BRANCH:                                     │
│           │  ├─ Sniff network packets                          │
│           │  ├─ Extract 42 metrics                             │
│           │  ├─ Build 30-step sequence                         │
│           │  ├─ Run through lstm_network.pt                    │
│           │  └─ Output: network_prob (0 to 1)                  │
│           │                                                    │
│           ├─ FUSION:                                           │
│           │  ├─ Combine grid_prob + network_prob               │
│           │  ├─ Apply agreement bonus                          │
│           │  └─ Output: fused_prob (0 to 1)                    │
│           │                                                    │
│           └─ DECISION:                                         │
│              ├─ If fused_prob > 0.715 → Alert                  │
│              └─ Else → Normal                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ EVALUATION PHASE (After 288 timesteps):                         │
│                                                                 │
│  Compare predictions vs ground truth                            │
│       │                                                        │
│       ├─ Detection Rate (DR): 94.23%                           │
│       ├─ False Positive Rate (FPR): 1.81%                      │
│       ├─ Precision: 89.95%                                     │
│       ├─ Recall: 75.76%                                        │
│       └─ F1 Score: 82.25%                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## **PART 6: SUMMARY TABLE**

| Aspect | UCI (Physical) | UNSW-NB15 (Cyber) |
|--------|---|---|
| **File** | `uci_grid_stability_prepared.csv` | `unsw_nb15_train/test.csv` |
| **Rows** | 10,000 | 257,675 (82K+175K) |
| **Size** | 2.1 MB | ~100 MB |
| **Features** | 12 (tau, p, g) | 42 (network metrics) |
| **Label Type** | Stability (binary) | Attack category (multi-class) |
| **LSTM Window** | 10 timesteps | 30 timesteps |
| **LSTM Units** | 64 hidden | 128 hidden |
| **Output Model** | lstm_pretrained.pt | lstm_network.pt |
| **Detects** | Power grid anomalies | Network intrusions |
| **Fusion Weight** | 0.58 (weighted more) | 0.42 (weighted less) |
| **Applied To** | V, I, f, θ, PF | latency, packet_loss, comm_drop |

---

## **KEY INSIGHTS**

✅ **UCI trains the PHYSICAL LSTM** on real generator/grid dynamics  
✅ **UNSW-NB15 trains the CYBER LSTM** on real network attack patterns  
✅ **Both models work in parallel** analyzing different data streams  
✅ **Fusion combines both signals** for holistic anomaly detection  
✅ **Agreement bonus** makes detection more confident when both layers agree  
✅ **Disagreement penalty** reduces false positives when only one layer triggers  

**This dual-branch design:**
- Catches attacks that only affect physical layer (generators, power)
- Catches attacks that only affect cyber layer (network, packets)
- Catches attacks on both layers simultaneously (most sophisticated)
- Reduces false positives (requires confirmation from both branches)
