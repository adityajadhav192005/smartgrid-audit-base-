from __future__ import annotations
from typing import List, Dict, Tuple

from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler, apply_action_to_frequency
from smartgrid_mas.audit.actions import AuditAction
from smartgrid_mas.environment.reward_function import compute_reward
from smartgrid_mas.environment.reward_outcome import outcome_reward, OutcomeRewardConfig
from smartgrid_mas.audit.audit_outcomes import AuditOutcome
from smartgrid_mas.audit.constraints import enforce_audit_constraints


def rl_schedule_step(
    agents: List[BaseAgent],
    scheduler: QLearningAuditScheduler,
    risk_threshold: float,
    f_min: int,
    f_max: int,
    max_audits_per_cycle: int,
    audit_cost_per_audit: float,
    operational_cost: float,
    budget_ratio: float,
) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, int], Dict[str, tuple]]:
    """
    Execute one RL scheduling step across all agents.
    
    Pipeline:
    1. For each agent:
       a. Encode state (risk, anomaly_prob, cluster)
       b. Select action (ε-greedy)
       c. Apply action to frequency
       d. Compute reward
       e. Perform Bellman Q-update
    2. Decay epsilon
    3. Enforce budget/max audits constraints
    
    Args:
        agents: List of agents with populated last_state
        scheduler: QLearningAuditScheduler instance
        risk_threshold: Risk level threshold for rewards
        f_min, f_max: Audit frequency bounds
        max_audits_per_cycle: Total audit budget
        audit_cost_per_audit: Cost per audit
        operational_cost: Total operational cost
        budget_ratio: Budget as fraction of operational cost
    
    Returns:
        actions: Dict agent_id → action (0/1/2)
        rewards: Dict agent_id → scalar reward
        frequencies: Dict agent_id → final frequency after constraints
        state_before: Dict agent_id → encoded state tuple (for post-audit updates)
    """
    actions: Dict[str, int] = {}
    rewards: Dict[str, float] = {}
    state_before: Dict[str, tuple] = {}
    rewards: Dict[str, float] = {}

    # Pre-compute budget allowance for soft penalties (keeps reward scale consistent)
    budget_allowed = float(budget_ratio * operational_cost)
    max_by_budget = int(budget_allowed // audit_cost_per_audit) if audit_cost_per_audit > 0 else max_audits_per_cycle
    allowed_total = max(1, min(max_audits_per_cycle, max_by_budget))

    # Risk-weighted throttle: cap allowed audits based on number of high-risk agents
    risk_high = sum(1 for a in agents if a.last_state and a.last_state.risk_score >= risk_threshold)
    if risk_high > 0:
        allowed_total = max(1, min(allowed_total, risk_high * f_max))
    
    # === PAPER CASCADE DETECTION (K-means clustering integration) ===
    # When K-means identifies multiple agents in same anomalous cluster (cluster_label=1),
    # boost audit capacity slightly for early chain-attack detection
    cluster_counts = {}
    for a in agents:
        if a.last_state and hasattr(a.last_state, 'cluster_label'):
            c_lbl = getattr(a.last_state, 'cluster_label', None)
            if c_lbl is not None:
                cluster_counts[c_lbl] = cluster_counts.get(c_lbl, 0) + 1
    
    # If anomalous cluster has 3+ agents, slightly increase audit budget for cascade detection
    anomalous_cluster_size = cluster_counts.get(1, 0)  # cluster_label=1 is anomalous per K-means
    if anomalous_cluster_size >= 3:
        allowed_total = max(allowed_total, int(allowed_total * 1.15))  # 15% boost for cascade risk

    # ─────────────────────────────────────────────────────────
    # Step 1: Per-agent RL decision
    # ─────────────────────────────────────────────────────────
    for agent in agents:
        if agent.last_state is None:
            continue
        
        st = agent.last_state
        
        # Encode state from current observations
        s = scheduler.encoder.encode(
            risk=st.risk_score,
            anomaly_prob=st.anomaly_prob,
            cluster_label=st.cluster_label,
        )
        
        # Store state before action (for post-audit RL updates)
        state_before[agent.agent_id] = s

        # Select action using ε-greedy
        act = scheduler.select_action(s)
        
        # Apply action to frequency
        new_f = apply_action_to_frequency(agent.audit_frequency, act, f_min, f_max)
        agent.set_audit_frequency(new_f, f_min, f_max)
        st.audit_frequency = agent.audit_frequency

        # Compute reward for this step
        # Track previous risk to grant mitigation bonus when risk drops
        prev_risk = getattr(agent, "_prev_reward_risk", st.risk_score)

        # Projected budget utilization after this action (pre-constraint)
        projected_total = sum(a.audit_frequency for a in agents)
        budget_utilization = float(projected_total) / float(allowed_total)
        
        # Compute mean baseline delta (GROUND TRUTH FOR PHYSICS)
        # This is the physical deviation from baseline (voltage/frequency)
        mean_baseline_delta = float(sum(a.last_state.baseline_delta if a.last_state else 0.0 for a in agents)) / max(1, len(agents))
        
        # Count attacks stopped (for security reward)
        attacks_stopped = sum(1 for a in agents if a.last_state and a.last_state.anomaly_flag == 1 and a.audit_frequency > 0)
        
        # v12 FIX: Compute SYSTEM-LEVEL C_failure (prevents free-rider problem)
        # Sum of unprotected risk across ALL agents in the system
        system_c_failure = 0.0
        for a in agents:
            if a.last_state:
                # Each agent contributes their unprotected risk to system failure cost
                agent_cost = float(a.audit_frequency) * audit_cost_per_audit
                max_cost = 5.0 * audit_cost_per_audit  # f_max=5
                coverage = min(1.0, agent_cost / max_cost) if max_cost > 0 else 0.0
                system_c_failure += a.last_state.risk_score * (1.0 - coverage)
        
        # This agent's contribution to total audit cost
        agent_audit_cost = float(agent.audit_frequency) * audit_cost_per_audit
        
        # Compute total audit cost this cycle
        total_audit_cost = float(sum(a.audit_frequency for a in agents)) * audit_cost_per_audit

        # Baseline-equivalent spend (~10% of agents per step) with +35% target
        baseline_equiv_cost = float(len(agents) * audit_cost_per_audit * 0.10 * 0.65)
        over_budget_excess = max(0.0, total_audit_cost - baseline_equiv_cost)

        r = compute_reward(
            st,
            act,
            risk_threshold=risk_threshold,
            mean_baseline_delta=mean_baseline_delta,
            attacks_stopped=attacks_stopped,
            audit_cost=agent_audit_cost,
            over_budget_excess=over_budget_excess,
            prev_risk=prev_risk,
            budget_utilization=budget_utilization,
            num_agents=len(agents),
            system_c_failure=system_c_failure,
        )

        # Next state (includes updated capacity after action)
        # FIX #11: RL now sees how its action affects capacity utilization
        new_total_freq = sum(a.audit_frequency for a in agents if a.last_state)
        new_capacity_utilization = float(new_total_freq) / float(max(1, allowed_total))
        
        s_next = scheduler.encoder.encode(
            risk=st.risk_score,
            anomaly_prob=st.anomaly_prob,
            cluster_label=st.cluster_label,
            capacity_utilization=new_capacity_utilization,
        )

        # Bellman update
        scheduler.update(s, act, r, s_next)
        agent._prev_reward_risk = st.risk_score
        
        actions[agent.agent_id] = int(act)
        rewards[agent.agent_id] = float(r)

    # ─────────────────────────────────────────────────────────
    # Step 2: Decay epsilon for exploration
    # ─────────────────────────────────────────────────────────
    scheduler.decay_epsilon()

    # ─────────────────────────────────────────────────────────
    # Step 3: Enforce paper constraints with dynamic capacity
    # ─────────────────────────────────────────────────────────
    freqs = enforce_audit_constraints(
        agents=agents,
        f_min=f_min,
        f_max=f_max,
        max_audits_per_cycle=max_audits_per_cycle,
        audit_cost_per_audit=audit_cost_per_audit,
        operational_cost=operational_cost,
        budget_ratio=budget_ratio,
        mean_baseline_delta=mean_baseline_delta,
    )

    return actions, rewards, freqs, state_before


def rl_post_audit_update(
    scheduler: QLearningAuditScheduler,
    state_before: Dict[str, tuple],
    actions_taken: Dict[str, int],
    outcomes: Dict[str, AuditOutcome],
    reward_cfg: OutcomeRewardConfig | None = None,
) -> Dict[str, float]:
    """
    Apply extra RL learning signal based on audit outcomes.
    
    This creates a true perception-action loop:
    1. Agent observes state → selects action (audit frequency)
    2. Audit executed → produces outcome (TP/TN/FP/FN)
    3. Outcome generates reward → updates Q-values
    4. Future actions influenced by audit results
    
    Args:
        scheduler: Q-learning scheduler to update
        state_before: agent_id → encoded state tuple when action was chosen
        actions_taken: agent_id → action index taken
        outcomes: agent_id → AuditOutcome from audit validation
        reward_cfg: Reward configuration (uses defaults if None)
        
    Returns:
        Dict mapping agent_id → outcome reward received
        
    Paper alignment: "Audit outcomes inform future scheduling decisions"
    """
    outcome_rewards = {}
    
    for aid, outcome in outcomes.items():
        if aid not in state_before or aid not in actions_taken:
            continue
        
        s = state_before[aid]
        a = AuditAction(actions_taken[aid])
        r_extra = outcome_reward(outcome, reward_cfg)
        
        # Update Q-table with outcome-based reward
        # Use same state for s_next (on-policy shaping at same timestep)
        scheduler.update(s, a, r_extra, s)
        
        outcome_rewards[aid] = r_extra
    
    return outcome_rewards
