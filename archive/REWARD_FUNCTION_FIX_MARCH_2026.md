# Reward Function Weight Fix - March 1, 2026

## 🔴 Problem Identified

Experiment results showed **inverted priorities** in the RL reward function:
- **Risk Mitigation**: -5.98% (RL WORSE than baseline) ❌
- **Cost Efficiency**: 90% (RL OVER-optimizing for cost) ❌
- **Root Cause**: Cost penalty weight > Security penalty weight

### Detailed Issue
```
OLD WEIGHTS (BROKEN):
  λ_audit (cost penalty) = 0.5
  λ_attack (missed attacks penalty) = 2.0
  
  Result: Cost minimization (0.5) > Security (2.0)
          Agent learned to skip audits to save money
          Risk mitigation = -5.98% (RL has HIGHER risk than baseline!)
```

## ✅ Solution Implemented

**File**: `smartgrid_mas/environment/reward_function.py`

### Changes Made

#### 1. Reward Weights (Lines 15-18)
```python
# OLD
lambda_attack: float = float(os.environ.get("SMARTGRID_RW_ATTACK", 2.0))
lambda_audit: float = float(os.environ.get("SMARTGRID_RW_AUDIT", 0.5))

# NEW - SECURITY FIRST
lambda_attack: float = float(os.environ.get("SMARTGRID_RW_ATTACK", 5.0))  # +150%
lambda_audit: float = float(os.environ.get("SMARTGRID_RW_AUDIT", 0.2))   # -60%
```

#### 2. Detection Penalty Calculation (Lines 70-72)
```python
# OLD
alpha_1 = weights.lambda_audit   # FP weight
alpha_2 = 2.0                    # FN weight (hardcoded, inconsistent)

# NEW - Use lambda_attack for consistency
alpha_1 = weights.lambda_audit   # FP weight (0.2)
alpha_2 = weights.lambda_attack  # FN weight (5.0)
```

### New Penalty Structure
```
Penalty for False Positive (FP):   0.2 (audit cost)
Penalty for False Negative (FN):   5.0 (MISSED ATTACK - critical!)

Ratio: FN penalty is 25x higher than FP penalty
⚠️ Missing a real attack is 25x worse than a false alarm!
```

## 📊 Expected Impact

**Risk Mitigation Target**: -5.98% → **+10-15%** (POSITIVE)
- RL solution should now beat baseline on security AND cost
- Agent will prioritize detection over cost cutting

**Cost Efficiency Expected**: 90% → ~60-75% (paper target)
- RL will spend more on audits to catch attacks
- But still save compared to fixed baseline (f=1)

**Precision Improvement**: 0.24 → 0.35+ (target)
- With security priority, agent will be more selective
- Fewer false positives, better precision

## 🔧 Implementation Details

### Modified Weights Mapping
```
λ₁ (False Positive penalty)  = lambda_audit = 0.2
λ₂ (False Negative penalty)  = lambda_attack = 5.0

Paper Objective (Eq. 2):
  R_t = -(λ₁×FP + λ₂×FN)
      = -(0.2×FP + 5.0×FN)

Interpretation:
- Penalize unnecessary audits (FP): 0.2 per occurrence
- HEAVILY penalize missed attacks (FN): 5.0 per occurrence
- Stability pressure: -0.1 × mean_baseline_delta
- Detection bonus: +0.25 per verified block
```

### RL Agent's New Objective
```
SECURITY FIRST (25x emphasis on detecting real attacks)
↓
COST SECOND (light penalty for spending on audits)
↓
STABILITY THIRD (keep grid normal)

Result: Agent learns to audit more, but strategically
        High-risk agents get frequent audits
        Low-risk agents get sparse audits
        Total cost reduced vs baseline, risk IMPROVED
```

## 🚀 Validation Checklist

### During Re-training
- [ ] Monitor Q-value convergence (should stabilize by episode 10)
- [ ] Track risk_mitigation metric in logs
- [ ] Check that audit frequency increases (agent spends more)
- [ ] Verify cost stays under budget constraints

### After Re-training (N-Sweep Results)
```
Expected Metrics (Target from Paper):
├─ Attack Rate Reduction: 32-34% ✓ (currently 32.67%, acceptable)
├─ Precision: 0.35+ (currently 0.21-0.24, IMPROVE THIS)
├─ Risk Mitigation: +10-15% (currently -5.98%, CRITICAL)
├─ Cost Efficiency: 60-75% (currently 90%, adjust this)
├─ F1-Score: 0.40+ (currently 0.35, marginal)
└─ Audit Coverage: 93.8% (currently variable 85-100%)
```

## 📝 Documentation Updates

### copilot-instructions.md (Updated)
- ✅ Reward function section updated with new weights
- ✅ Fix #6 added to "Recent Critical Fixes" section
- ✅ Expected impact clearly documented
- ✅ File references provided

### This Document
- ✅ Problem statement
- ✅ Solution details
- ✅ Expected impact
- ✅ Validation checklist

## 🔄 Next Steps (In Order)

1. **Wait for re-training completion** (currently running)
2. **Extract results** from logs/N*/summary.json
3. **Verify risk_mitigation is now POSITIVE**
4. **Check if precision improved to 0.35+**
5. **Compare cost_efficiency to target 60-75%**
6. **If still issues, tune anomaly score threshold** (secondary fix)
7. **Document final results** in RESULTS_SUMMARY.md

## 📚 References

- **Paper Section**: 4.1.4 (Audit Scheduling) - Reward Function Design
- **Source File**: `smartgrid_mas/environment/reward_function.py`
- **Config File**: `smartgrid_mas/config/` (RewardWeights class)
- **Main Script**: `smartgrid_mas/run_all.py` (initiates training)

## ⚠️ Important Notes

1. **This is a CRITICAL fix** - Without this, risk mitigation will remain negative
2. **The fix rebalances the objective** - From cost-first to security-first
3. **Convergence may take longer** - More complex optimization landscape
4. **Verify against BOTH metrics** - Don't optimize for cost alone!
5. **Paper alignment is key** - Always validate against paper targets

---

**Status**: ✅ IMPLEMENTED  
**Date**: March 1, 2026, 19:09 UTC  
**Expected Completion**: Current run (est. 20:00 UTC)
