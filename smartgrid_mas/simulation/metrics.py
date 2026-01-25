"""
Metrics tracking for simulation runs

Logs per-timestep metrics: attack rate, deviation, risk, audit costs.
Paper alignment: tracks R_attack, cost components, system state evolution.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict

from smartgrid_mas.audit.audit_outcomes import AuditOutcome
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.audit.risk_score import compute_global_risk


@dataclass
class MetricsLogger:
    """
    Records simulation metrics at each timestep.
    
    Paper metrics tracked:
    - attack_rate (R_attack): proportion of anomalous agents
    - mean_deviation: average deviation score across agents
    - global_risk: aggregated risk from all agents
    - total_audits: sum of audit frequencies
    - audit_cost: total cost for audits this step
    """
    records: List[Dict] = field(default_factory=list)
    
    def log_step(
        self,
        t: int,
        agents: List[BaseAgent],
        audit_cost_per_audit: float,
        ledger=None,
        budget: float | None = None,
        truth: Dict[str, int] | None = None,
        outcomes: Dict[str, AuditOutcome] | None = None,
        constraint_stats: Dict[str, float] | None = None,
    ) -> None:
        """
        Log metrics for current timestep.
        
        Args:
            t: Current timestep
            agents: List of all agents with current state
            audit_cost_per_audit: Cost per audit (C_a from paper)
            ledger: Optional AuditLedger for tracking actual audits executed
            budget: Optional total budget for coverage/spend tracking
        """
        n = len(agents)
        anomalous_flags = 0
        dev_sum = 0.0
        freq_sum = 0
        truth_attacks = 0
        flagged_by_id: Dict[str, int] = {}
        
        for a in agents:
            if a.last_state is None:
                continue
            flag_val = int(a.last_state.anomaly_flag)
            anomalous_flags += flag_val
            dev_sum += float(a.last_state.deviation_score)
            freq_sum += int(a.audit_frequency)
            flagged_by_id[a.agent_id] = flag_val
            if truth is not None:
                truth_attacks += int(truth.get(a.agent_id, 0))
        
        # Truth-based attack rate (preferred) and flag-based rate (legacy)
        attack_rate_truth = float(truth_attacks / n) if (n and truth is not None) else None
        attack_rate_flagged = float(anomalous_flags / n) if n else 0.0
        # Paper metric: proportion of agents flagged anomalous (a_i)
        attack_rate = attack_rate_flagged
        mean_dev = float(dev_sum / n) if n else 0.0
        # Compute global risk with outcome-aware dampening
        global_risk, components = compute_global_risk(agents)
        # Compute mitigation-aware effective attack rate by clearing flags for
        # audited agents that are CLEAN or FALSE_ALARM at this timestep.
        attack_rate_effective = None
        global_risk_effective = None
        if ledger is not None:
            audited_ids = {e.agent_id for e in ledger.audits_at_timestep(t)}
            dampened = 0.0
            for aid, r_comp in components.items():
                if aid in audited_ids:
                    # If an audit happened, adjust risk based on outcome (paper: audits mitigate risk)
                    if outcomes and aid in outcomes:
                        outcome = outcomes[aid]
                        if outcome in (AuditOutcome.CLEAN, AuditOutcome.FALSE_ALARM):
                            r_adj = 0.0  # verified safe → clear risk
                            # Also clear anomaly flag for effective rate if it was set
                            if flagged_by_id.get(aid, 0) == 1:
                                anomalous_flags = max(0, anomalous_flags - 1)
                                flagged_by_id[aid] = 0
                        elif outcome == AuditOutcome.CONFIRMED_ANOMALY:
                            r_adj = 0.5 * r_comp  # mitigated but still monitored
                        else:  # MISSED_ANOMALY
                            r_adj = r_comp
                    else:
                        r_adj = 0.5 * r_comp  # generic mitigation when outcome unknown
                    dampened += r_adj
                else:
                    dampened += r_comp
            global_risk_effective = float(dampened)
            if n:
                attack_rate_effective = float(anomalous_flags / n)
        intended_spend = float(freq_sum * audit_cost_per_audit)
        
        # Executed audits and spend (from ledger if available)
        audits_executed = 0
        total_spend = 0.0
        coverage = 0.0
        remaining = None
        
        if ledger is not None:
            audits_executed = len([e for e in ledger.events if e.t == t])
            total_spend = float(ledger.total_spend)
            coverage = float(ledger.coverage(n))
            if budget is not None:
                remaining = float(ledger.remaining_budget(budget))
        
        self.records.append({
            "t": t,
            "attack_rate": attack_rate,
            "attack_rate_truth": attack_rate_truth,
            "attack_rate_flagged": attack_rate_flagged,
            "attack_rate_effective": attack_rate_effective,
            "mean_deviation": mean_dev,
            "global_risk": global_risk,
            "global_risk_effective": global_risk_effective,
            "freq_sum": freq_sum,  # scheduler intent
            "intended_spend": intended_spend,
            "audits_executed": audits_executed,  # reality
            "total_spend": total_spend,
            "coverage": coverage,
            "remaining_budget": remaining,
        })

        if constraint_stats is not None:
            self.records[-1]["requested_audits"] = constraint_stats.get("requested_audits", 0.0)
            self.records[-1]["requested_audits_raw"] = constraint_stats.get("requested_audits_raw", constraint_stats.get("requested_audits", 0.0))
            self.records[-1]["allowed_audits_cap"] = constraint_stats.get("allowed_by_cap", 0.0)
            self.records[-1]["allowed_audits_budget"] = constraint_stats.get("allowed_by_budget", 0.0)
            self.records[-1]["allowed_audits_final"] = constraint_stats.get("allowed_final", 0.0)
            self.records[-1]["assigned_audits"] = constraint_stats.get("assigned_audits", 0.0)
            self.records[-1]["high_risk_denied"] = constraint_stats.get("high_risk_denied", 0.0)
