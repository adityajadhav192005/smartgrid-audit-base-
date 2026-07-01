# Dataset, Mapping, Integrity Jump & Attack Signatures

---

## **PART 1: DATASET SPECIFICATION**

### **What Dataset You Used**

**Synthetic Smart Grid Dataset (Self-Generated)**
- **Total observations:** 28,800 timesteps (24 hours of continuous operation)
- **Time resolution:** 5 seconds per timestep (sampling rate = 12 Hz equivalent)
- **Total agents:** 100 distributed across the grid
- **Agent distribution:**
  - 25 Generators (GEN)
  - 25 Substations (SUB)
  - 25 PMU (Phasor Measurement Units)
  - 25 Breakers (BRK)

### **Features per Agent (5 dimensions)**

| Feature | Symbol | Range | Unit | Sampling |
|---------|--------|-------|------|----------|
| **Voltage** | V | 110–132 V | Volts (RMS) | Every 5s |
| **Current** | I | 0–150 A | Amperes (RMS) | Every 5s |
| **Frequency** | f | 49.8–50.2 | Hz | Every 5s |
| **Phase Angle** | θ | -180° to +180° | Degrees | Every 5s |
| **Power Factor** | PF | 0.90–1.0 | Dimensionless | Every 5s |

**Total features in dataset:** 100 agents × 5 features = **500 feature columns**

### **Attack Composition**

```
Total observations: 28,800
Attack events: 145 (0.5% of dataset)
Normal observations: 28,655 (99.5% of dataset)

Attack distribution:
├─ FDI (False Data Injection): 50 events (34%)
├─ DoS (Denial of Service): 45 events (31%)
├─ MITM (Man-in-the-Middle): 40 events (28%)
└─ Faults (natural, non-malicious): 10 events (7%)
```

---

## **PART 2: HOW DATA IS MAPPED INTO THE SYSTEM**

### **Step 1: Data Generation (Python Simulation)**

```
┌─────────────────────────────────────────┐
│  Scenario Generator (Python)            │
├─────────────────────────────────────────┤
│ Input:  Random seed (for reproducibility)
│ Process:
│  1. Initialize 100 agents with baseline
│  2. Simulate 24-hour load variation
│  3. Inject 145 attack events at random times
│  4. Add sensor noise (Gaussian, σ=0.01)
│ Output: agents_24h.csv (100 agents × 5 features × 28,800 steps)
└─────────────────────────────────────────┘
```

**Baseline Generation (Normal Operating State):**
```python
# For each agent type, realistic baselines:
GEN:   V=120V,  I=50A,   f=50.0Hz, θ=0°,   PF=0.95
SUB:   V=115V,  I=65A,   f=50.0Hz, θ=-15°, PF=0.92
PMU:   V=118V,  I=40A,   f=50.0Hz, θ=5°,   PF=0.96
BRK:   V=110V,  I=80A,   f=50.0Hz, θ=10°,  PF=0.91
```

**Load Variation (Diurnal pattern):**
```
Morning (6-9am):   30% load increase
Midday (10am-2pm): 80% load increase
Evening (5-8pm):   Peak (100% load)
Night (8pm-6am):   Light load (20-30%)

Load change = sinusoidal variation in V, I, f over 24 hours
```

### **Step 2: Feature Standardization (Z-Score Normalization)**

Each feature is standardized per agent:

```
Formula: x_normalized = (x - mean) / std_dev

Applied to:
- V_normalized = (V - μ_V) / σ_V
- I_normalized = (I - μ_I) / σ_I
- f_normalized = (f - μ_f) / σ_f
- θ_normalized = (θ - μ_θ) / σ_θ
- PF_normalized = (PF - μ_PF) / σ_PF

Where μ and σ are computed from normal (non-attack) observations only.
```

**Why normalization?**
- Feature scales differ widely (V: 110-132, I: 0-150, f: 49.8-50.2)
- Normalization brings all features to comparable scale [-3, +3]
- LSTM can now weigh features equally
- Deviation scoring becomes fair across features

### **Step 3: Baseline Profile Creation (Per Agent Type)**

```
┌──────────────────────────────────────────┐
│  Baseline Profile (computed from normal  │
│  observations only, attacks excluded)    │
├──────────────────────────────────────────┤
│                                          │
│  For each agent type (GEN, SUB, PMU, BRK)
│                                          │
│  Compute 5 statistics per feature:       │
│  ├─ μ (mean)                             │
│  ├─ σ (std dev)                          │
│  ├─ P_5 (5th percentile)                 │
│  ├─ P_95 (95th percentile)               │
│  └─ Seasonal pattern (hourly median)     │
│                                          │
└──────────────────────────────────────────┘

Example (GEN Agent #1):
  V: μ=120.0V, σ=0.8V, P5=118.5V, P95=121.2V
  I: μ=50.0A,  σ=2.5A, P5=46.2A,  P95=53.8A
  f: μ=50.00Hz, σ=0.02Hz
  θ: μ=0°, σ=1.5°
  PF: μ=0.95, σ=0.01
```

### **Step 4: Sliding Window Formation (For LSTM)**

Each timestep is combined with history to create sequences:

```
10-step window (for detection):
┌────────────────────────────────────────┐
│ t-9: V[t-9], I[t-9], f[t-9], θ[t-9], PF[t-9]
│ t-8: V[t-8], I[t-8], f[t-8], θ[t-8], PF[t-8]
│ ... (7 more steps) ...
│ t:   V[t],   I[t],   f[t],   θ[t],   PF[t]
└────────────────────────────────────────┘
     Total 50 features (10 steps × 5 features)
     Input to LSTM → Output: anomaly probability
```

### **Step 5: Deviation Score Computation**

```
Formula:
  dev = sqrt( mean((x_norm - baseline_x_norm)^2) )
  
Where:
  x_norm = (x - μ) / σ     [standardized feature]
  baseline_x_norm = expected value under normal operations
  
Per-feature deviations:
  dev_V  = |V_norm - baseline_V_norm|
  dev_I  = |I_norm - baseline_I_norm|
  dev_f  = |f_norm - baseline_f_norm|
  dev_θ  = |θ_norm - baseline_θ_norm|
  dev_PF = |PF_norm - baseline_PF_norm|
  
Aggregate:
  deviation = sqrt( (dev_V^2 + dev_I^2 + dev_f^2 + dev_θ^2 + dev_PF^2) / 5 )
```

**Example (Normal vs Attack):**
```
Normal observation:
  V=120.1V (baseline μ=120.0), deviation_V = 0.02
  I=50.2A  (baseline μ=50.0),  deviation_I = 0.03
  → aggregate deviation ≈ 0.025 ✓ (below threshold 0.7)

Attack observation (FDI):
  V=118.5V (baseline μ=120.0), deviation_V = 1.5
  I=47.0A  (baseline μ=50.0),  deviation_I = 3.0
  → aggregate deviation ≈ 2.1 ✓ (above threshold 0.7)
```

### **Step 6: Ensemble Scoring**

Final score combines deviation and LSTM:
```
s(t) = 0.48 × dev(t) + 0.52 × LSTM_prob(t)

Where:
  dev(t) = deviation score (0 to 1 scale, normalized)
  LSTM_prob(t) = anomaly probability (0 to 1)
  
Decision:
  IF s(t) > 0.715:  Anomaly detected
  ELSE:             Normal
```

---

## **PART 3: WHAT IS INTEGRITY JUMP?**

### **Definition**

**Integrity Jump** = An abrupt, mathematically impossible change in a measurement caused by MITM (Man-in-the-Middle) tampering.

In the context of the MITM detector, integrity jump refers to **two correlated metrics:**

1. **Integrity Score Drop** — A sudden loss of data consistency
2. **Temporal Jump** — A measurement change that violates physical laws

### **Integrity Score Calculation**

```
Integrity Score = confidence that data is authentic (0 to 1)

Computed per message/frame:
  integrity = 1.0 - (1 - CRC_match) - (1 - sequence_check) - (1 - physics_check)

Where:
  ✓ CRC_match = 1 if checksum valid, 0 if corrupted
  ✓ sequence_check = 1 if sequence number continuous, 0 if skipped/repeated
  ✓ physics_check = 1 if change within limits, 0 if impossible jump

Example:
  Frame 100: CRC✓, sequence OK, jump=0.3V < limit → integrity = 1.0
  Frame 101: CRC✓, sequence OK, jump=2.5V > limit → integrity = 0.7 ✗ DROP!
```

### **Physical Rate Limits (Physics Constraints)**

Power systems cannot change arbitrarily fast. Real physics enforces maximum rates:

```
Maximum allowable change per 5-second timestep:
├─ Voltage:   ±0.8V     (≈0.67% of 120V nominal)
├─ Current:   ±10A      (≈10% of typical load)
├─ Frequency: ±0.1Hz    (≈0.2% of 50Hz)
├─ Phase:     ±5°       (±5° per step)
└─ Power Factor: ±0.02  (≈2% per step)

These limits come from RMS calculations and normal system inertia.
```

### **MITM Jump-Logic Detector**

```
Algorithm:
  IF (ΔV > 0.8V) OR (ΔI > 10A) OR (Δf > 0.1Hz) 
     OR (Δθ > 5°) OR (ΔPF > 0.02):
     → Integrity violation detected
     → confidence = 1.0 (zero false positives — real physics cannot lie)
  ELSE:
     → Within normal limits
     → confidence = 0.0 (no alert)
```

### **Real Example: MITM Attack Signature**

```
Scenario: Attacker replaces voltage reading to hide a sag

t=100: Normal readings
  V_true = 119.8V (real measurement)
  V_reported = 119.8V (attacker hasn't intervened)
  
t=101: Real voltage drops (load increase)
  V_true = 117.2V ← Real sag from load
  V_reported = 121.0V ← Attacker substitutes fake value
  
ΔV = |121.0 - 119.8| = 1.2V > physical limit 0.8V
→ MITM DETECTED ✓
→ Real message: "Voltage jump 1.2V impossible. Data tampering!"

Why this works: Attacker cannot craft a value that BOTH:
  (a) Hides the real sag, AND
  (b) Remains within physics constraints

It's impossible → any value that hides the sag will violate physics.
```

---

## **PART 4: ATTACK SIGNATURES WITH EXAMPLES**

### **Attack Type 1: FDI (False Data Injection)**

**Definition:** Attacker modifies measurement values to trick the system.

**Signature Characteristics:**
```
├─ Magnitude: Usually SMALL (±0.1 to ±0.5V range to evade detection)
├─ Duration: SUSTAINED over multiple timesteps (5–50 steps)
├─ Pattern: Gradual drift or step-wise change
├─ Detector: CUSUM (accumulates small errors)
├─ Key metric: Cumulative deviation > threshold
```

**Real Example (Voltage Reduction FDI):**

```
Attacker Goal: Make grid appear to have less load than actual
                (profit motive: avoid expensive peak charges)

Scenario:
  t=0:   V_true=120.0V, V_reported=120.0V
  t=1:   V_true=119.8V, V_reported=119.6V ← Attack begins (-0.2V)
  t=2:   V_true=119.6V, V_reported=119.3V ← Continues (-0.3V)
  t=3:   V_true=119.4V, V_reported=119.0V ← Continues (-0.4V)
  t=4:   V_true=119.2V, V_reported=118.8V ← Continues (-0.4V)
  t=5:   V_true=119.0V, V_reported=118.5V ← Continues (-0.5V)

Analysis:
  Individual deviations: [0.2, 0.3, 0.4, 0.4, 0.5] ← Each small
  Ensemble per-step: s(t) = [0.18, 0.24, 0.30, 0.30, 0.35] ← All < 0.715
  
  Ensemble verdict: NO ALERT (looks normal)
  
  CUSUM accumulation:
    S(1) = max(0, 0 + (0.2 - 0.05)) = 0.15
    S(2) = max(0, 0.15 + (0.3 - 0.05)) = 0.40
    S(3) = max(0, 0.40 + (0.4 - 0.05)) = 0.75
    S(4) = max(0, 0.75 + (0.4 - 0.05)) = 1.10
    S(5) = max(0, 1.10 + (0.5 - 0.05)) = 1.55
  
  At t=6: S(6) = 1.55 + (0.6 - 0.05) = 2.1 > threshold 1.8
  
  CUSUM verdict: ✓ ALERT AT t=6
  Attack Type: FDI (sustained drift pattern)
```

---

### **Attack Type 2: DoS (Denial of Service)**

**Definition:** Attacker floods network, causing packets to drop or communication to stall.

**Signature Characteristics:**
```
├─ Magnitude: N/A (no measurement values)
├─ Duration: Short bursts (2–10 consecutive missing frames)
├─ Pattern: Repeated null/zero/identical values in raw data
├─ Detector: DoS counter (simple frame loss detection)
├─ Key metric: Consecutive missing frames ≥ threshold
```

**Real Example (DoS Attack Flooding):**

```
Attacker Goal: Disrupt real-time monitoring by overwhelming network
               (sabotage motive: prevent emergency response)

Scenario (Rapid SCADA data):
  t=0:   V=120.1V, I=51.2A, f=50.00Hz, timestamp=12:45:00 ✓
  t=1:   V=120.0V, I=51.1A, f=50.00Hz, timestamp=12:45:05 ✓
  t=2:   TIMEOUT: No data received (DoS flooding)
  t=3:   TIMEOUT: No data received
  t=4:   TIMEOUT: No data received
  t=5:   V=119.9V, I=50.9A, f=50.00Hz, timestamp=12:45:25 ✓ (network recovers)

Analysis:
  Ensemble: Cannot score missing frames
  
  DoS Counter:
    t=2: missing_count = 1
    t=3: missing_count = 2
    t=4: missing_count = 3 ≥ threshold(3) → FIRE ✓
  
  DoS verdict: ✓ ALERT AT t=4
  Attack Type: DoS (3 consecutive missing frames)
  
  Real Impact: 15-second communication gap during attack
              Normal operation resumes after t=5
```

---

### **Attack Type 3: MITM (Man-in-the-Middle)**

**Definition:** Attacker intercepts and modifies messages between entities.

**Signature Characteristics:**
```
├─ Magnitude: LARGE, abrupt (violates physics)
├─ Duration: Single or few frames (instantaneous tampering)
├─ Pattern: Impossible jump (physics violation)
├─ Detector: Jump-logic (physical rate limit check)
├─ Key metric: |ΔV| > 0.8V in 5-second step
```

**Real Example (Voltage Hiding MITM):**

```
Attacker Goal: Hide a real voltage sag to avoid triggering alerts
               (sabotage motive: cause grid instability undetected)

Scenario:
  t=100: V_true=119.8V, V_reported=119.8V ✓ Normal
  
  t=101: Real voltage sags due to fault
         V_true=117.0V (real physics: large load disconnected)
         V_reported=121.5V ← Attacker substitutes fake value
                             (to make grid appear stable)

Analysis:
  Real measurement: ΔV_true = 117.0 - 119.8 = -2.8V (large, realistic)
  
  Reported measurement: ΔV_reported = 121.5 - 119.8 = 1.7V
  
  Jump magnitude: |1.7V| > physical limit 0.8V? YES ✗
  
  MITM verdict: ✓ ALERT AT t=101
  Attack Type: MITM (voltage jump 1.7V exceeds physical rate)
  Confidence: 1.0 (zero false positives — physics is immutable)
  
  Real Impact: Attacker tried to hide a fault but jumped the gun
              Real sag would have caused 2.8V change naturally
              To hide it, had to jump to 121.5V (impossible in 5s)
              System detects the tampering, alerts human operator
```

---

### **Attack Type 4: Transient Fault (Natural, Not Malicious)**

**Definition:** Equipment failure or load event causes measurement spikes (not an attack).

**Signature Characteristics:**
```
├─ Magnitude: MODERATE (0.1–0.3V range)
├─ Duration: BRIEF (1–3 timesteps, then recovery)
├─ Pattern: Transient, Gaussian-like shape
├─ Detector: Suppression gate (filters physical noise)
├─ Key metric: Small deviation + no specialists firing
```

**Real Example (Motor Inrush Transient):**

```
Scenario: Large motor starts on the same feeder
          Normal operation, but causes brief voltage sag

t=0:   V=120.0V, I=50.0A ✓ (motor off)
t=1:   Motor contactor closes
       V=119.85V (inrush current draws 12A temporarily)
       I=62.0A (short-lived inrush)
t=2:   V=119.95V (recovering)
       I=51.5A (settling)
t=3:   V=120.0V, I=50.0A ✓ (normal again, motor now running steady)

Analysis:
  Per-timestep deviations:
    t=0: dev=0.00
    t=1: dev=0.15, LSTM_prob=0.28
         s = 0.48×0.15 + 0.52×0.28 = 0.219 < 0.715 ✗
    t=2: dev=0.05, LSTM_prob=0.22
         s = 0.48×0.05 + 0.52×0.22 = 0.139 < 0.715 ✗
    t=3: dev=0.00
  
  Ensemble: No alert (scores too low)
  
  Specialists:
    ├─ CUSUM: S does not accumulate (transient only) → no fire
    ├─ DoS: Frames present → no fire
    └─ MITM: |ΔV|=0.15V < 0.8V → no fire
  
  Suppression gate check (if ensemble were borderline):
    raw_dev = 0.15 < 0.1? NO (slightly above, but point is filters noise)
    specialists_fired = ALL FALSE ✓
    LSTM_prob = 0.28 < 0.30? YES ✓
    → Would suppress if ensemble scored slightly higher
  
  Final verdict: NO ALERT
  Reason: Physical noise, legitimate motor inrush
           System correctly ignores it
```

---

## **PART 5: ATTACK SIGNATURE SUMMARY TABLE**

| Attack Type | Magnitude | Duration | Pattern | Detector | Signature Example |
|-------------|-----------|----------|---------|----------|------------------|
| **FDI** | Small (0.1–0.5) | Sustained (5–50 steps) | Gradual drift | CUSUM | -0.2, -0.3, -0.4, -0.5V accumulates → 2.1 threshold hit |
| **DoS** | N/A (missing) | Brief (2–10 steps) | No frames / zeros | DoS Counter | 3 consecutive missing frames → alert |
| **MITM** | Large (>0.8) | Instantaneous | Physics violation | Jump-Logic | Voltage jump 1.7V > 0.8V limit → alert |
| **Transient Fault** | Moderate (0.1–0.3) | Very brief (1–3 steps) | Gaussian spike, recovers | Suppression Gate | Small dev + no specialist → suppressed |

---

## **PART 6: DATA FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GENERATION: agents_24h.csv                               │
│    100 agents × 5 features × 28,800 steps = 14.4M raw values
└─────────────────────────────────────────┬───────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. STANDARDIZATION: Z-score normalization per feature      │
│    x_norm = (x - μ) / σ                                     │
│    Scale: [-3, +3] (humans interpretable)                  │
└─────────────────────────────────────────┬───────────────────┘
                                          │
                    ┌─────────────────────┴──────────────────┐
                    │                                        │
                    ▼                                        ▼
        ┌──────────────────────┐            ┌──────────────────────┐
        │ 3a. DEVIATION SCORE  │            │ 3b. LSTM SEQUENCE    │
        │ dev = sqrt(mean(...))│            │ 10-step window       │
        │ Range: [0, 1]        │            │ → anomaly prob       │
        └──────────────────────┘            │ Range: [0, 1]        │
                    │                       └──────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
        ┌─────────────────────────────────────────────┐
        │ 4. LAYER A: ENSEMBLE FUSION                 │
        │ s(t) = 0.48×dev + 0.52×LSTM_prob           │
        │ If s(t) > 0.715: candidate alert            │
        └─────────────────────────────────────────────┘
                          │
                    ┌─────┴──────┬─────────────────────┐
                    │            │                     │
                    ▼            ▼                     ▼
        ┌──────────────────┐ ┌────────────┐ ┌──────────────────┐
        │ CUSUM Specialist │ │ DoS Counter│ │ MITM Jump-Logic  │
        │ Accumulated FDI  │ │ Comm loss  │ │ Physics violate  │
        │ S(t) > 1.8? →    │ │ frames≥3? │ │ |ΔV|>0.8V?      │
        └──────────────────┘ └────────────┘ └──────────────────┘
                    │            │                     │
                    └─────────────┼─────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────┐
        │ 5. OR-WITH-PRECEDENCE COMBINER          │
        │ If ANY specialist fires → alert=1.0     │
        │ Else if ensemble > 0.715 → alert=score  │
        └─────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ 6. FP SUPPRESSION GATE                  │
        │ If (dev<0.1 AND no_specialist AND      │
        │     LSTM<0.3) → SUPPRESS                │
        │ Else → ALERT                            │
        └─────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │ 7. FINAL DECISION                       │
        │ ├─ ALERT: FDI/DoS/MITM (type label)   │
        │ ├─ NO ALERT (noise suppressed)         │
        │ └─ Confidence score (0 to 1)           │
        └─────────────────────────────────────────┘
```

---

## **KEY TAKEAWAY**

Your dataset is **fully synthetic** (generated in Python) but:
1. **Realistic:** Features follow real power grid ranges and natural variation patterns
2. **Reproducible:** Same seed produces identical data (seed=42 in papers)
3. **Mapped into detection pipeline:** Raw → normalized → scored → ensemble → specialist check → suppression → final alert
4. **Attack-aware:** 145 injected attack events spanning 3 types (FDI, DoS, MITM) + faults
5. **Integrity-checked:** MITM detector uses physics constraints (0.8V/5s limit) to catch impossible jumps

The **integrity jump** is the core of MITM detection: any value that satisfies both "hides the real problem" AND "stays within physics" would be extremely rare — attackers can't do both simultaneously, so we catch them.
