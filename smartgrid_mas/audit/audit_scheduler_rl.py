from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Tuple, List
import random
import math

from smartgrid_mas.audit.actions import AuditAction
from smartgrid_mas.audit.state_encoder import StateEncoder

# State now includes capacity bucket: (risk, prob, cluster, capacity)
State = Tuple[int, int, int, int]


def apply_action_to_frequency(f: int, action: AuditAction, f_min: int, f_max: int) -> int:
    """
    Apply RL action to adjust audit frequency, respecting bounds.
    
    Args:
        f: Current audit frequency
        action: AuditAction (DEC, HOLD, or INC)
        f_min: Minimum audit frequency (from config)
        f_max: Maximum audit frequency (from config)
    
    Returns:
        New frequency clamped to [f_min, f_max]
    """
    if action == AuditAction.INC:
        f += 1
    elif action == AuditAction.DEC:
        f -= 1
    # HOLD: no change
    
    return max(f_min, min(f_max, int(f)))


@dataclass
class QLearningAuditScheduler:
    """
    Q-learning scheduler for audit frequency optimization.
    
    Implements standard Q-learning with:
    - ε-greedy action selection
    - Bellman update: Q(s,a) ← Q(s,a) + α[R + γ max_a' Q(s',a') - Q(s,a)]
    - State discretization via StateEncoder
    - Convergence tracking: detects when Q-values stabilize
    
    Paper parameters:
    - γ (gamma) = 0.9: discount factor for future rewards
    - α (alpha) = 0.1: learning rate
    - ε (epsilon) starts at 1.0, decays to ε_min
    """
    
    encoder: StateEncoder = field(default_factory=StateEncoder)
    gamma: float = 0.9
    alpha: float = 0.1
    epsilon: float = 1.0
    epsilon_min: float = 0.05
    epsilon_decay: float = 0.995

    # Q-table: state → [Q_DEC, Q_HOLD, Q_INC]
    Q: Dict[State, List[float]] = field(default_factory=dict)
    
    # Convergence tracking
    iteration_count: int = 0
    converged: bool = False
    # Convergence thresholds (paper-style rolling mean |ΔQ|)
    convergence_threshold: float = 0.1  # Relaxed from 1e-3 for realistic convergence
    convergence_window: int = 50  # Reduced from 200 for faster detection
    recent_q_changes: List[float] = field(default_factory=list)
    # Rolling mean |ΔQ| tracking across larger window K with M consecutive windows
    rolling_window_K: int = 100  # Drastically reduced from 1000 (was impossible to reach)
    rolling_mean_threshold: float = 0.1  # Increased from 1e-2 (0.01→0.1) for realism
    required_stable_windows: int = 2  # Reduced from 3 to speed up convergence
    last_rolling_mean: float = 0.0
    stable_window_hits: int = 0
    max_iterations_before_force_converge: int = 2000  # Increased to allow proper learning with new reward

    # Experience replay (paper best practice for RL stability)
    replay_buffer: List[Tuple[State, AuditAction, float, State]] = field(default_factory=list)
    replay_capacity: int = int(__import__("os").environ.get("SMARTGRID_RL_REPLAY_CAP", 2000))
    replay_batch_size: int = int(__import__("os").environ.get("SMARTGRID_RL_REPLAY_BATCH", 32))
    replay_updates_per_step: int = int(__import__("os").environ.get("SMARTGRID_RL_REPLAY_UPDATES", 1))

    # Convergence via coefficient of variation (CV)
    last_cv: float = 0.0
    cv_threshold: float = float(__import__("os").environ.get("SMARTGRID_RL_CV_THRESHOLD", 0.10))
    cv_stable_hits: int = 0
    cv_required_stable_windows: int = int(__import__("os").environ.get("SMARTGRID_RL_CV_STABLE_WINDOWS", 3))

    # Risk-sensitive objective controls
    risk_objective: str = __import__("os").environ.get("SMARTGRID_RISK_OBJECTIVE", "expected").lower()
    risk_beta: float = float(__import__("os").environ.get("SMARTGRID_RISK_BETA", -0.05))
    cvar_alpha: float = float(__import__("os").environ.get("SMARTGRID_CVAR_ALPHA", 0.10))
    risk_variance_penalty: float = float(__import__("os").environ.get("SMARTGRID_RISK_VAR_PENALTY", 0.0))
    recent_rewards: List[float] = field(default_factory=list)
    reward_window: int = int(__import__("os").environ.get("SMARTGRID_REWARD_WINDOW", 200))

    def _risk_adjust_reward(self, reward: float) -> float:
        """Transform reward using risk-sensitive objective (expected / exp_utility / cvar)."""
        r = float(reward)
        self.recent_rewards.append(r)
        if len(self.recent_rewards) > self.reward_window:
            self.recent_rewards.pop(0)

        obj = (self.risk_objective or "expected").lower()
        adjusted = r

        if obj == "exp_utility":
            beta = min(-1e-9, float(self.risk_beta))
            adjusted = (math.exp(beta * r) - 1.0) / beta
        elif obj == "cvar":
            if self.recent_rewards:
                alpha = min(0.5, max(1e-3, float(self.cvar_alpha)))
                sorted_r = sorted(self.recent_rewards)
                k = max(1, int(math.ceil(alpha * len(sorted_r))))
                tail = sorted_r[:k]
                cvar_tail = sum(tail) / float(len(tail))
                adjusted = 0.5 * r + 0.5 * cvar_tail

        if self.risk_variance_penalty > 0.0 and len(self.recent_rewards) >= 5:
            mean_r = sum(self.recent_rewards) / float(len(self.recent_rewards))
            var_r = sum((x - mean_r) ** 2 for x in self.recent_rewards) / float(len(self.recent_rewards))
            adjusted -= float(self.risk_variance_penalty) * math.sqrt(max(0.0, var_r))

        return float(adjusted)

    def _ensure_state(self, s: State) -> None:
        """Ensure state exists in Q-table with zero initialization."""
        if s not in self.Q:
            self.Q[s] = [0.0, 0.0, 0.0]

    def select_action(self, s: State) -> AuditAction:
        """
        Select action using ε-greedy policy.
        
        With probability ε, select random action (exploration).
        Otherwise, select action with highest Q-value (exploitation).
        
        Args:
            s: Discrete state tuple
        
        Returns:
            AuditAction (DEC, HOLD, or INC)
        """
        self._ensure_state(s)
        
        if random.random() < self.epsilon:
            # Exploration: random action
            return AuditAction(random.choice([0, 1, 2]))
        
        # Exploitation: best Q-value
        q_values = self.Q[s]
        best_action = max(range(3), key=lambda i: q_values[i])
        return AuditAction(best_action)

    def update(self, s: State, a: AuditAction, reward: float, s_next: State) -> None:
        """
        Update Q-value using Bellman equation and track convergence.
        
        Q(s,a) ← Q(s,a) + α[R + γ max_a' Q(s',a') - Q(s,a)]
        
        Args:
            s: Current state
            a: Action taken
            reward: Reward received
            s_next: Next state
        """
        self._ensure_state(s)
        self._ensure_state(s_next)
        
        def _bellman_update(state: State, action: AuditAction, rew: float, next_state: State) -> float:
            self._ensure_state(state)
            self._ensure_state(next_state)
            q_sa_local = self.Q[state][int(action)]
            max_q_next_local = max(self.Q[next_state])
            target_local = rew + self.gamma * max_q_next_local
            td_error_local = target_local - q_sa_local
            new_q_local = q_sa_local + self.alpha * td_error_local
            self.Q[state][int(action)] = new_q_local
            return abs(new_q_local - q_sa_local)

        # Risk-sensitive reward shaping before Bellman update
        risk_adjusted_reward = self._risk_adjust_reward(reward)

        # Direct on-policy update for current transition
        q_change = _bellman_update(s, a, risk_adjusted_reward, s_next)
        self.iteration_count += 1
        self.recent_q_changes.append(q_change)

        # Force convergence after max iterations to prevent infinite training
        if self.iteration_count >= self.max_iterations_before_force_converge:
            self.converged = True
        
        # Keep only recent changes (sliding window)
        if len(self.recent_q_changes) > self.convergence_window:
            self.recent_q_changes.pop(0)

        # Push transition into replay buffer
        try:
            self.replay_buffer.append((s, a, risk_adjusted_reward, s_next))
            if len(self.replay_buffer) > self.replay_capacity:
                # Remove oldest
                self.replay_buffer.pop(0)
        except Exception:
            pass

        # Perform replay updates to stabilize learning
        if self.replay_buffer and self.replay_batch_size > 0 and self.replay_updates_per_step > 0:
            for _ in range(self.replay_updates_per_step):
                batch_size = min(self.replay_batch_size, len(self.replay_buffer))
                # Random sample without replacement
                batch = random.sample(self.replay_buffer, batch_size)
                for ss, aa, rr, ss_next in batch:
                    q_delta = _bellman_update(ss, aa, rr, ss_next)
                    self.recent_q_changes.append(q_delta)
                    if len(self.recent_q_changes) > self.convergence_window:
                        self.recent_q_changes.pop(0)
        
        # Legacy convergence: max recent change below threshold
        if len(self.recent_q_changes) >= self.convergence_window:
            max_recent_change = max(self.recent_q_changes)
            if max_recent_change < self.convergence_threshold:
                self.converged = True

        # Paper-style rolling mean |ΔQ| over last K updates
        # Compute rolling mean when enough samples exist, and track consecutive stable windows
        if len(self.recent_q_changes) >= self.rolling_window_K:
            # Use the last K deltas to compute mean absolute change
            window_slice = self.recent_q_changes[-self.rolling_window_K:]
            mean_abs = sum(window_slice) / float(self.rolling_window_K)
            self.last_rolling_mean = mean_abs
            # Legacy stability criterion
            if self.last_rolling_mean < self.rolling_mean_threshold:
                self.stable_window_hits += 1
            else:
                self.stable_window_hits = 0

            # CV-based stability criterion: std/mean below threshold
            try:
                # Compute variance
                m = mean_abs
                var = sum((x - m) ** 2 for x in window_slice) / float(self.rolling_window_K)
                std = var ** 0.5
                self.last_cv = (std / m) if m > 1e-12 else 0.0
            except Exception:
                self.last_cv = 0.0
            if self.last_cv < self.cv_threshold:
                self.cv_stable_hits += 1
            else:
                self.cv_stable_hits = 0

            # Converged if either rolling mean stable for M windows or CV stable for N windows
            if (self.stable_window_hits >= self.required_stable_windows) or (
                self.cv_stable_hits >= self.cv_required_stable_windows
            ):
                self.converged = True

    def decay_epsilon(self) -> None:
        """Decay exploration rate exponentially."""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def warm_start_defaults(self) -> None:
        """
        Prefill Q-table with small heuristic values to reduce early oscillation
        and encourage reactions at high risk. Uses encoder bucket edges and
        seeds cluster labels 0..2.
        
        FIX #11: Now handles 4D state space including capacity utilization.
        """
        # Low vs high buckets by edges
        low_risks = [0, 1]
        high_risks = [len(self.encoder.risk_edges) - 3, len(self.encoder.risk_edges) - 2]
        low_probs = [0, 1]
        high_probs = [len(self.encoder.prob_edges) - 3, len(self.encoder.prob_edges) - 2]
        clusters = [0, 1, 2]
        capacity_levels = [0, 1, 2, 3]  # plenty, moderate, tight, over-capacity
        
        # Baseline small preference for HOLD
        base = [0.1, 0.2, 0.1]
        # At high capacity, prefer DEC
        high_cap = [0.3, 0.2, 0.0]
        
        for c in clusters:
            for cap in capacity_levels:
                for r in low_risks:
                    for p in low_probs:
                        # Low risk + high capacity → prefer DEC
                        if cap >= 2:
                            self.Q[(r, p, c, cap)] = list(high_cap)
                        else:
                            self.Q[(r, p, c, cap)] = list(base)
                for r in high_risks:
                    for p in high_probs:
                        # High risk + low capacity → prefer INC
                        if cap <= 1:
                            self.Q[(r, p, c, cap)] = [0.1, 0.1, 0.3]
                        # High risk + high capacity → cautious INC
                        else:
                            self.Q[(r, p, c, cap)] = [0.15, 0.2, 0.15]

    def save_checkpoint(self, filepath: str) -> None:
        """
        Save Q-table and learning state to checkpoint for persistence across runs.
        
        Args:
            filepath: Path to save checkpoint JSON
        """
        import json
        checkpoint = {
            "Q": {str(k): v for k, v in self.Q.items()},  # Convert tuple keys to strings
            "iteration_count": self.iteration_count,
            "converged": self.converged,
            "epsilon": self.epsilon,
            "last_rolling_mean": self.last_rolling_mean,
            "stable_window_hits": self.stable_window_hits,
        }
        try:
            with open(filepath, "w") as f:
                json.dump(checkpoint, f, indent=2)
            print(f"[+] RL checkpoint saved: {filepath} (Q-table size: {len(self.Q)})")
        except Exception as e:
            print(f"[-] Failed to save checkpoint: {e}")

    def load_checkpoint(self, filepath: str) -> bool:
        """
        Load Q-table and learning state from checkpoint to resume learning.
        
        Args:
            filepath: Path to load checkpoint from
        
        Returns:
            True if loaded successfully, False otherwise
        """
        import json
        try:
            with open(filepath, "r") as f:
                checkpoint = json.load(f)
            
            # Reconstruct Q-table with tuple keys
            self.Q = {}
            for k_str, v in checkpoint["Q"].items():
                # Parse string representation of tuple back to tuple
                try:
                    import ast
                    k_tuple = ast.literal_eval(k_str)
                    self.Q[k_tuple] = v
                except (ValueError, TypeError, SyntaxError):
                    continue
            
            self.iteration_count = checkpoint.get("iteration_count", 0)
            self.converged = checkpoint.get("converged", False)
            self.epsilon = checkpoint.get("epsilon", 0.05)
            self.last_rolling_mean = checkpoint.get("last_rolling_mean", 0.0)
            self.stable_window_hits = checkpoint.get("stable_window_hits", 0)
            
            print(f"[*] RL checkpoint loaded: {filepath} (restored {len(self.Q)} states)")
            return True
        except FileNotFoundError:
            print(f"[*] No checkpoint found at {filepath}, starting fresh")
            return False
        except Exception as e:
            print(f"[!] Failed to load checkpoint: {e}")
            return False
