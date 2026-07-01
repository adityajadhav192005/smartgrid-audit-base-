# Complete Dataset Usage & LSTM Training — Simple Language Explanation

---

## **THE BIG PICTURE FIRST**

You have **TWO real datasets** and they train **TWO separate LSTM models** that run in parallel:

```
UCI Grid Stability (10K rows)   →  trains  →  Physical LSTM  (Branch 1)
                                                      ↓
                                              Detects power grid anomalies
                                              (voltage sags, FDI attacks)

UNSW-NB15 (257K rows)          →  trains  →  Cyber LSTM     (Branch 2)
                                                      ↓
                                              Detects network attacks
                                              (DoS floods, MITM)

                                              Branch 1 + Branch 2
                                                      ↓
                                              FUSION ENGINE (weights 0.58 + 0.42)
                                                      ↓
                                              Final anomaly probability → Alert
```

---

## **DATASET 1: UCI Grid Stability**

### **What it is:**
- **File:** `smartgrid_mas/data/anomaly_inputs/uci_grid_stability_prepared.csv`
- **Size:** 10,000 rows, 13 columns
- **Collected by:** Researchers at UCI studying 4-node power grid models
- **What it measures:** Whether a 4-generator power grid will stay stable

### **Its 12 features + 1 label:**

```
4 generators × 3 properties each = 12 features

tau1, tau2, tau3, tau4   ← How fast each generator reacts to changes
                            (seconds: 0.5 to 10s)
                            Think: "If I push this generator, how quickly does it respond?"

p1,   p2,   p3,   p4    ← How much power each generator is producing
                            (MW: 0 to 5 MW)
                            Note: p2, p3, p4 are NEGATIVE (they are consumers)
                            Think: "What's the power balance across the grid?"

g1,   g2,   g3,   g4    ← How well each generator dampens oscillations
                            (normalized 0 to 1)
                            Think: "If the grid shakes, how well does this generator absorb it?"

stabf                    ← Is the grid stable? 1=yes, 0=no
                            This is the LABEL we want to predict
```

### **Sample rows from the actual file:**
```
Row 1 (STABLE = 1):
tau=[2.96, 3.08, 8.38, 9.78]  p=[3.76, -0.78, -1.26, -1.72]  g=[0.65, 0.86, 0.89, 0.96]

Row 2 (UNSTABLE = 0):
tau=[9.30, 4.90, 3.05, 1.37]  p=[5.07, -1.94, -1.87, -1.26]  g=[0.41, 0.86, 0.56, 0.78]

Pattern the LSTM learns:
  tau high + p balanced + g high → STABLE ✓
  tau mixed + p unbalanced + g low → UNSTABLE ✗
```

---

## **DATASET 2: UNSW-NB15 Network Intrusion**

### **What it is:**
- **File 1:** `smartgrid_mas/data/network_intrusion/unsw_nb15_train.csv` (82,333 rows)
- **File 2:** `smartgrid_mas/data/network_intrusion/unsw_nb15_test.csv` (175,342 rows)
- **Total:** 257,675 real network packets
- **Collected by:** UNSW Canberra cyber lab — real network traffic with injected attacks
- **What it measures:** Whether a network packet/connection is normal or an attack

### **Its 42 features + 2 labels:**

```
The 42 raw features include:
  dur      = How long the connection lasted (seconds)
  proto    = Protocol type (tcp, udp, icmp, arp...)
  service  = What application (-,http,ftp,smtp,dns...)
  state    = Connection state (INT, FIN, CON, REQ...)
  spkts    = How many packets sent from source
  dpkts    = How many packets sent to destination
  sbytes   = Total bytes from source
  dbytes   = Total bytes to destination
  rate     = Packets per second
  sttl     = Time-to-live on source side
  dttl     = Time-to-live on destination side
  sload    = Source bits per second (load)
  dload    = Destination bits per second
  sloss    = Source packet loss count
  dloss    = Destination packet loss count
  sinpkt   = Source inter-packet time (ms)
  dinpkt   = Destination inter-packet time (ms)
  sjit     = Source jitter (variation in timing)
  djit     = Destination jitter
  swin     = TCP window size (source)
  tcprtt   = Round-trip time for TCP
  synack   = Time from SYN to SYN-ACK
  ackdat   = Time from SYN-ACK to ACK
  ... + 18 more statistical features

Labels:
  attack_cat = What attack type (Normal, DoS, Reconnaissance, Backdoor, etc.)
  label      = Binary (0=Normal, 1=Attack)
```

### **Label distribution in UNSW-NB15:**
```
TRAIN set (82,333 rows):
  Normal:         45,344 rows (55%) ← benign traffic
  DoS:            11,585 rows (14%) ← flood attacks
  Reconnaissance: 10,491 rows (13%) ← scanning/probing
  Backdoor:        5,292 rows  (6%) ← persistent access
  Analysis:        4,666 rows  (6%) ← file/packet analysis
  Exploitation:    2,954 rows  (4%) ← CVE exploits
  Worm:            2,001 rows  (2%) ← self-propagating
```

### **Key insight — Raw 42 features → Engineered to 4 cyber features:**

The code doesn't use all 42 features directly. Instead it **engineers them into 4 meaningful cyber metrics:**

```python
# File: smartgrid_mas/data/network_intrusion_dataset.py → _engineer_unsw_features()

# 1. LATENCY-LIKE (how delayed/slow is communication?)
latency_like = log(1 + dur + tcprtt + synack + ackdat + sinpkt + dinpkt + sjit + djit)
              ↑ combines 8 timing features into 1 number
              HIGH value = slow/delayed → possible DoS or congestion

# 2. LOSS-LIKE (how much data is being dropped?)
loss_like = log(1 + sloss + dloss + estimated_missing_packets)
            ↑ combines packet loss from both directions
            HIGH value = lots of drops → DoS flooding or link failure

# 3. INTEGRITY-LIKE (does the data look tampered?)
integrity_like = log(1 + |sttl - dttl| + ct_state_ttl + |sbytes - dbytes|/total)
                 ↑ checks TTL asymmetry + connection state anomalies + byte imbalance
                 HIGH value = something weird about packet structure → MITM

# 4. FREQUENCY-LIKE (how intense is the communication?)
freq_like = log(1 + rate + sload + dload + spkts + dpkts)
            ↑ combines all throughput/rate metrics
            HIGH value = extremely high traffic → DoS flood or data exfiltration

Final engineered output: [latency_like, loss_like, integrity_like, freq_like]
= 4 features per packet (from original 42)
```

**Why engineer down to 4?**
- These 4 map directly to what your simulation tracks as cyber metrics
- The physical simulation tracks: latency, packet_loss, integrity, comm_freq
- Same 4 dimensions → LSTM trained on UNSW applies directly to simulation

---

## **HOW BOTH DATASETS CONNECT TO YOUR SIMULATION**

### **The 9-feature vector per agent (5 physical + 4 cyber):**

```
PHYSICAL features (from UCI data patterns):
  x[0] = voltage          (V)
  x[1] = current          (I)
  x[2] = frequency        (f Hz)
  x[3] = phase_angle      (θ degrees)
  x[4] = power_factor     (PF)

CYBER features (from UNSW-NB15 patterns):
  x[5] = latency          (ms) ← matches latency_like from UNSW
  x[6] = packet_loss      (%)  ← matches loss_like from UNSW
  x[7] = integrity        (0-1)← matches integrity_like from UNSW
  x[8] = comm_freq        (Hz) ← matches freq_like from UNSW

Total per agent: 9 features (5 physical + 4 cyber)
```

---

## **HOW THE LSTM IS TRAINED ON EACH DATASET**

### **Physical LSTM Training (on UCI Data):**

```
Step 1: Load UCI data
        df = pd.read_csv("uci_grid_stability_prepared.csv")
        X = df[tau1..tau4, p1..p4, g1..g4]   # shape: (10000, 12)
        y = df["stabf"]                        # shape: (10000,)

Step 2: Adapt feature dimensions
        # UCI has 12 features, our LSTM needs 9 features
        # Code: _adapt_feature_dim(x, target_dim=9)
        # If UCI has MORE features: take first 9
        # If UCI has FEWER features: pad with zeros
        # Result: X_adapted shape: (10000, 9)

Step 3: Normalize per column
        mean = X.mean(axis=0)   # 9 values
        std  = X.std(axis=0)    # 9 values
        X_norm = (X - mean) / std

Step 4: Create sliding windows
        window_size = 24 (timesteps)
        For each i in range(len(X_norm) - 24):
            window = X_norm[i : i+24]   # shape (24, 9)
            label  = y[i+24]            # next label
        Result: 9976 sequences of shape (24, 9)

Step 5: Train LSTM
        Input:  (batch=64, sequence=24, features=9)
                        ↓
        LSTM Layer 1:   64 hidden units
                        ↓
        LSTM Layer 2:   64 hidden units
                        ↓
        Linear Layer:   64 → 1
                        ↓
        Sigmoid:        → probability (0 to 1)

        Loss function: Binary Cross-Entropy
        Optimizer:     Adam (lr=0.001)
        Epochs:        20

Step 6: Save model
        → lstm_pretrained.pt  (Physical LSTM weights)
```

**What the Physical LSTM learned from UCI:**
```
Unstable patterns (stabf=0 examples from UCI):
  → tau values very unequal (generators out of sync)
  → p values highly asymmetric (power imbalance)
  → g values low (weak damping)

These patterns GENERALIZE to your simulation:
  → voltage deviating from baseline = unstable signal
  → frequency drifting from 50Hz = power imbalance
  → power factor dropping = reactive power issue
```

---

### **Cyber LSTM Training (on UNSW-NB15 Data):**

```
Step 1: Load UNSW-NB15 data
        train_df = pd.read_csv("unsw_nb15_train.csv")  # 82,333 rows
        test_df  = pd.read_csv("unsw_nb15_test.csv")   # 175,342 rows

Step 2: Stratified sampling (balanced classes)
        # Don't use all 257K rows - too slow
        # Sample equally from each attack class:
        per_class = max_rows // num_classes
        sampled = df.groupby("label").apply(lambda g: g.sample(per_class))
        # Result: balanced Normal vs Attack dataset

Step 3: Engineer 4 cyber features (from raw 42)
        latency_like  = log(1 + dur + tcprtt + synack + ackdat + sinpkt + dinpkt + sjit + djit)
        loss_like     = log(1 + sloss + dloss + missing_packets_estimate)
        integrity_like= log(1 + |sttl - dttl| + ct_state_ttl + byte_asymmetry_ratio)
        freq_like     = log(1 + rate + sload + dload + spkts + dpkts)

        Why log(1 + x)? 
        → Compresses extreme outlier values (DoS creates rate=500,000 pps)
        → Prevents huge attack values from dominating

Step 4: Normalize (z-score)
        mean = X_cyber.mean(axis=0)   # 4 values
        std  = X_cyber.std(axis=0)    # 4 values
        X_cyber_norm = (X_cyber - mean) / std

Step 5: Create sliding windows
        window_size = 12 (shorter window for network LSTM)
        For each i in range(len(X_cyber_norm) - 12):
            window = X_cyber_norm[i : i+12]   # shape (12, 4)
            label  = y[i+12]                   # 0=normal, 1=attack

Step 6: Train Network LSTM
        Input:  (batch=64, sequence=12, features=4)
                        ↓
        LSTM Layer 1:   64 hidden units
                        ↓
        LSTM Layer 2:   64 hidden units
                        ↓
        Linear Layer:   64 → 1
                        ↓
        Sigmoid:        → probability (0 to 1)

        Loss function: Binary Cross-Entropy
        Optimizer:     Adam (lr=0.001)
        Epochs:        20

Step 7: Save model
        → lstm_network.pt  (Cyber LSTM weights)
```

**What the Cyber LSTM learned from UNSW-NB15:**
```
DoS attack patterns (from 11,585 UNSW samples):
  → freq_like VERY HIGH (packet flood: rate=50,000+ pps)
  → loss_like HIGH (congestion drops packets)
  → latency_like HIGH (network saturated)

MITM attack patterns (from backdoor/exploitation samples):
  → integrity_like HIGH (TTL asymmetry, byte imbalance)
  → timing patterns irregular (injected fake packets)

Normal patterns (from 45,344 UNSW samples):
  → All 4 features LOW and STABLE
  → No sudden spikes or sustained elevation
```

---

## **HOW BOTH MODELS RUN IN PARALLEL (At Runtime)**

```
At each 5-minute timestep, for EVERY agent:

┌─────────────────────────────────────────────────────────────┐
│  Agent GEN-01 at timestep t=150                             │
│                                                             │
│  Physical readings:                                         │
│  [V=119.5V, I=51A, f=49.98Hz, θ=0.5°, PF=0.94]            │
│  History: last 24 timesteps of same                         │
│                                                             │
│  Cyber readings:                                            │
│  [latency=52ms, packet_loss=0.02, integrity=0.98, freq=40] │
│  History: last 12 timesteps of same                         │
└───────────────────┬────────────────────┬────────────────────┘
                    │                    │
                    ▼                    ▼
        ┌───────────────────┐  ┌───────────────────────┐
        │  Physical LSTM    │  │  Cyber LSTM           │
        │  (lstm_pretrained │  │  (lstm_network.pt)    │
        │   .pt)            │  │                       │
        │                   │  │  Input: 12 steps of   │
        │  Input: 24 steps  │  │  4 cyber features     │
        │  of 9 features    │  │                       │
        │                   │  │  Window data looks    │
        │  Window data looks│  │  NORMAL (latency      │
        │  SLIGHTLY         │  │  low, loss low,       │
        │  ANOMALOUS        │  │  integrity normal,    │
        │  (voltage a bit   │  │  freq normal)         │
        │  low)             │  │                       │
        │                   │  │  → network_prob=0.18  │
        │  → grid_prob=0.72 │  │    (low)              │
        │    (elevated)     │  │                       │
        └─────────┬─────────┘  └───────────┬───────────┘
                  │                        │
                  └────────────┬───────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │  FUSION ENGINE                               │
        │  (smartgrid_mas/anomaly_detection/           │
        │   dual_branch.py → fuse_branch_probabilities)│
        │                                              │
        │  grid_prob    = 0.72  (physical anomaly!)    │
        │  network_prob = 0.18  (cyber normal)         │
        │                                              │
        │  Step 1: Weighted sum                        │
        │  weighted = 0.58×0.72 + 0.42×0.18           │
        │           = 0.418     + 0.076                │
        │           = 0.494                            │
        │                                              │
        │  Step 2: Agreement check                     │
        │  agreement = 1 - |0.72 - 0.18| = 0.46 (LOW) │
        │  agreement_bonus = 0.10 × 0.46 × 0.18 = 0.008│
        │                                              │
        │  Step 3: Disagreement penalty                │
        │  penalty = 0.05 × |0.72 - 0.18| = 0.027     │
        │                                              │
        │  Step 4: Final                               │
        │  fused = 0.494 + 0.008 - 0.027 = 0.475      │
        │                                              │
        │  Threshold = 0.715                           │
        │  0.475 < 0.715 → NO ALERT                   │
        │                                              │
        │  Interpretation:                             │
        │  "Physical looks weird, but network is fine  │
        │   → Probably just load variation, not attack" │
        └──────────────────────────────────────────────┘
```

**Now with an actual ATTACK (both layers triggered):**

```
Agent PMU-07 at timestep t=200 — FDI + DoS attack:

Physical: voltage=117V (big sag), current=45A (dropped)
Cyber: latency=890ms (up from 52ms!), packet_loss=0.45, freq=12

Physical LSTM: grid_prob = 0.89 (anomaly!)
Cyber LSTM:    network_prob = 0.82 (attack!)

Fusion:
  weighted = 0.58×0.89 + 0.42×0.82 = 0.516 + 0.344 = 0.860
  agreement = 1 - |0.89 - 0.82| = 0.93 (HIGH - they AGREE)
  agreement_bonus = 0.10 × 0.93 × 0.82 = 0.076
  penalty = 0.05 × 0.07 = 0.0035

  Both branches ≥ 0.85 → HIGH SUPPORT BONUS = +0.08

  fused = 0.860 + 0.076 - 0.0035 + 0.08 = 1.013 → clipped to 1.0

  1.0 > 0.715 → ALERT RAISED ✓
  Confidence = 1.0 (maximum)
  Type: COORDINATED ATTACK (both physical + cyber)
```

---

## **COMPLETE TRAINING + RUNTIME FLOW**

```
───────────────────────────────────────────────────
PHASE 1: OFFLINE TRAINING (done once before simulation)
───────────────────────────────────────────────────

File: run_all.py → _train_lstm_with_current_config()

    A. Load UCI Grid Stability (10K rows)
       real_dataset.py → load_real_training_corpus()
       - Auto-detect "stabf" label column
       - Normalize features
       - Adapt to 9 feature dimensions
       ↓
    B. Augment with synthetic data
       - Generate additional FDI, DoS, fault scenarios
       - Augment ratio: 20% synthetic + 80% real UCI data
       ↓
    C. Train Physical LSTM
       train_lstm(data=X, labels=y, window=24)
       - 2 LSTM layers, 64 hidden units
       - 20 epochs, batch=64, lr=0.001
       - Temperature calibration for probability accuracy
       ↓
    D. Save: lstm_pretrained.pt

File: run_all.py → _train_network_lstm_with_current_config()

    E. Load UNSW-NB15 (82K train + 175K test rows)
       network_intrusion_dataset.py → load_network_intrusion_corpus()
       - Stratified sampling per attack class
       - Engineer 42 features → 4 features
         [latency_like, loss_like, integrity_like, freq_like]
       - Normalize
       ↓
    F. Augment with synthetic cyber data
       - Generate additional DoS, MITM scenarios
       - Augment ratio: 25% synthetic + 75% real UNSW data
       ↓
    G. Train Cyber LSTM
       train_lstm(data=X_cyber, labels=y, window=12)
       - 2 LSTM layers, 64 hidden units
       - 20 epochs, batch=64, lr=0.001
       ↓
    H. Save: lstm_network.pt

───────────────────────────────────────────────────
PHASE 2: ONLINE INFERENCE (real-time per timestep)
───────────────────────────────────────────────────

For every agent at every timestep:

    I.  Collect 9 features: [V, I, f, θ, PF, lat, loss, integ, freq]
    
    J.  Physical branch: last 24 timesteps × 5 physical features
        → lstm_pretrained.pt → grid_prob ∈ [0, 1]
    
    K.  Cyber branch: last 12 timesteps × 4 cyber features
        → lstm_network.pt → network_prob ∈ [0, 1]
    
    L.  Fusion:
        fused = 0.58×grid_prob + 0.42×network_prob
              + agreement_bonus
              - disagreement_penalty
              + high_support_bonus (if both ≥ 0.85)
    
    M.  Decision:
        fused > 0.715 → ATTACK candidate
        Then: specialist detectors (CUSUM, DoS counter, MITM jump)
        Then: FP suppression gate
        → FINAL: Alert or No Alert

───────────────────────────────────────────────────
PHASE 3: EVALUATION
───────────────────────────────────────────────────

After 288 timesteps (24 hours × 5 min):

    N. Compare y_pred vs y_true (ground truth from attack injection)
    O. Compute DR, FPR, F1, Precision, Recall
    P. Log metrics to CSV → comparison tables
```

---

## **SUMMARY: Why Two Datasets?**

| Question | Answer |
|----------|--------|
| Why UCI? | Real power grid stability patterns → teaches LSTM what "normal grid behavior" looks like |
| Why UNSW-NB15? | Real cyber attack traffic → teaches LSTM what network intrusions look like |
| Why two separate LSTMs? | Physical and cyber attacks are independent — one model can't learn both well |
| Why 4 cyber features? | Engineer from 42 UNSW features → 4 meaningful metrics that match simulation |
| Why fuse with 0.58/0.42? | Physical attacks are primary concern (grid stability) → physical branch weighted more |
| Why agreement bonus? | When both branches agree on attack → much higher confidence → fewer false alarms |
| Why disagreement penalty? | One branch firing alone could be noise → reduce score when branches disagree |
