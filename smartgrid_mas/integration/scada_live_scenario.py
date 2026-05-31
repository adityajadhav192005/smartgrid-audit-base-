"""
ScadaLiveScenario — Organic attack simulation for the SCADA live pipeline.

The Rapid SCADA calculated channels produce smooth sinusoidal data that never
deviates from baseline.  In a real grid, attacks happen naturally.  This module
injects realistic FDI / DoS / MITM attack patterns into the tag data as it
arrives at the backend — so the detection pipeline has something to detect
without requiring the operator to click the manual injection button.

Attack lifecycle:
    1. Every poll cycle, the scheduler rolls dice for new attacks.
    2. Active attacks persist for a random duration (3-12 polls).
    3. When an attack expires, the agent returns to clean data.
    4. A cooldown prevents the same agent from being re-attacked immediately.

Toggle with env var SMARTGRID_LIVE_SCENARIO=1  (default: enabled).
"""

from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class LiveAttackType(str, Enum):
    NONE = "NONE"
    FDI = "FDI"
    DOS = "DOS"
    MITM = "MITM"


@dataclass
class _ActiveAttack:
    """Tracks one ongoing attack on a specific agent."""
    attack_type: LiveAttackType
    remaining_polls: int          # how many more polls this attack lasts
    severity: float = 0.6         # 0.0-1.0 intensity multiplier
    started_at: float = 0.0       # time.time() when started


@dataclass
class ScadaLiveScenarioConfig:
    """
    Tuning knobs — all overridable via environment variables.
    """
    enabled: bool = True

    # Probability that *any* new attack wave starts on a given poll cycle
    wave_probability: float = float(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_WAVE_PROB", "0.25"))

    # How many agents to hit per wave (min, max)
    wave_size_min: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_WAVE_MIN", "3"))
    wave_size_max: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_WAVE_MAX", "12"))

    # Attack duration in poll cycles (min, max)
    duration_min: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_DUR_MIN", "3"))
    duration_max: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_DUR_MAX", "12"))

    # Cooldown after attack ends (poll cycles before agent can be re-targeted)
    cooldown_polls: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_COOLDOWN", "8"))

    # Attack type weights  (FDI is most common in smart grids)
    fdi_weight: float = 0.45
    dos_weight: float = 0.30
    mitm_weight: float = 0.25

    # Severity range
    severity_min: float = 0.4
    severity_max: float = 0.9

    # Maximum concurrent attacked agents (cap to avoid overwhelming the grid)
    max_concurrent: int = int(os.environ.get(
        "SMARTGRID_LIVE_SCENARIO_MAX_CONCURRENT", "20"))


class ScadaLiveScenario:
    """
    Manages organic attack simulation for the SCADA live pipeline.

    Usage:
        scenario = ScadaLiveScenario()
        # On each poll batch:
        corrupted_records = scenario.apply(records)
    """

    def __init__(self, cfg: ScadaLiveScenarioConfig | None = None):
        env_toggle = os.environ.get("SMARTGRID_LIVE_SCENARIO", "1").strip()
        self.cfg = cfg or ScadaLiveScenarioConfig(
            enabled=env_toggle in ("1", "true", "yes", "on"),
        )
        self._active: Dict[str, _ActiveAttack] = {}   # agent_id → attack
        self._cooldown: Dict[str, int] = {}            # agent_id → remaining cooldown polls
        self._poll_count: int = 0
        self._rng = random.Random(int(time.time()) % 100_000)
        self._all_agent_ids: List[str] = []

    # ------------------------------------------------------------------
    #  Public API
    # ------------------------------------------------------------------

    def apply(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Called once per batch poll.  Mutates tag values in-place for attacked
        agents and returns the (possibly modified) record list.
        """
        if not self.cfg.enabled:
            return records

        self._poll_count += 1

        # Collect all agent IDs on first call
        if not self._all_agent_ids:
            self._all_agent_ids = [r.get("agent_id", "") for r in records if r.get("agent_id")]

        # 1. Tick cooldowns
        expired_cooldowns = []
        for aid, remaining in self._cooldown.items():
            if remaining <= 1:
                expired_cooldowns.append(aid)
            else:
                self._cooldown[aid] = remaining - 1
        for aid in expired_cooldowns:
            del self._cooldown[aid]

        # 2. Tick active attacks  (decrement duration, expire finished ones)
        expired_attacks = []
        for aid, atk in self._active.items():
            atk.remaining_polls -= 1
            if atk.remaining_polls <= 0:
                expired_attacks.append(aid)
        for aid in expired_attacks:
            del self._active[aid]
            self._cooldown[aid] = self.cfg.cooldown_polls

        # 3. Maybe start a new attack wave
        if (self._rng.random() < self.cfg.wave_probability
                and len(self._active) < self.cfg.max_concurrent):
            self._start_wave()

        # 4. Apply active attacks to matching records
        for rec in records:
            aid = rec.get("agent_id", "")
            if aid in self._active:
                atk = self._active[aid]
                self._corrupt_tags(rec, atk)

        return records

    def get_active_attacks(self) -> Dict[str, str]:
        """Returns {agent_id: attack_type} for the dashboard status display."""
        return {aid: atk.attack_type.value for aid, atk in self._active.items()}

    @property
    def active_count(self) -> int:
        return len(self._active)

    # ------------------------------------------------------------------
    #  Internal
    # ------------------------------------------------------------------

    def _start_wave(self) -> None:
        """Pick random agents and assign them fresh attacks."""
        # Agents available = not currently attacked, not on cooldown
        available = [
            aid for aid in self._all_agent_ids
            if aid not in self._active and aid not in self._cooldown
        ]
        if not available:
            return

        wave_size = self._rng.randint(self.cfg.wave_size_min, self.cfg.wave_size_max)
        # Don't exceed max_concurrent cap
        wave_size = min(wave_size, self.cfg.max_concurrent - len(self._active))
        wave_size = min(wave_size, len(available))
        if wave_size <= 0:
            return

        targets = self._rng.sample(available, wave_size)
        attack_type = self._pick_attack_type()

        for aid in targets:
            duration = self._rng.randint(self.cfg.duration_min, self.cfg.duration_max)
            severity = self._rng.uniform(self.cfg.severity_min, self.cfg.severity_max)
            self._active[aid] = _ActiveAttack(
                attack_type=attack_type,
                remaining_polls=duration,
                severity=severity,
                started_at=time.time(),
            )

    def _pick_attack_type(self) -> LiveAttackType:
        """Weighted random selection of attack type."""
        roll = self._rng.random()
        if roll < self.cfg.fdi_weight:
            return LiveAttackType.FDI
        elif roll < self.cfg.fdi_weight + self.cfg.dos_weight:
            return LiveAttackType.DOS
        else:
            return LiveAttackType.MITM

    def _corrupt_tags(self, record: Dict[str, Any], atk: _ActiveAttack) -> None:
        """
        Modify the tag values to simulate an attack.
        Mirrors the corruption patterns from grid_env.py and the injection API.
        """
        tags: Dict[str, Any] = record.get("tags", {})
        if not tags:
            return

        s = atk.severity  # 0.4 – 0.9
        jitter = self._rng.uniform(0.8, 1.2)  # slight per-poll variation

        if atk.attack_type == LiveAttackType.FDI:
            # False Data Injection: corrupt physical measurements
            if "voltage" in tags:
                tags["voltage"] = float(tags["voltage"]) * (1.0 + s * 0.35 * jitter)
            if "current" in tags:
                tags["current"] = float(tags["current"]) * (1.0 + s * 0.25 * jitter)
            if "frequency" in tags:
                tags["frequency"] = float(tags["frequency"]) * (1.0 - s * 0.08 * jitter)
            # Small integrity hit (stealthy FDI)
            if "integrity" in tags:
                tags["integrity"] = max(0.0, float(tags["integrity"]) - s * 0.05)

        elif atk.attack_type == LiveAttackType.DOS:
            # Denial of Service: spike latency/packet_loss, drop comm
            if "latency" in tags:
                tags["latency"] = float(tags["latency"]) + s * 2.5 * jitter
            if "packet_loss" in tags:
                tags["packet_loss"] = min(1.0, float(tags["packet_loss"]) + s * 0.18 * jitter)
            if "comm_freq" in tags:
                tags["comm_freq"] = max(0.0, float(tags["comm_freq"]) * (1.0 - s * 0.45))
            # Slight physical ripple from communication loss
            if "current" in tags:
                tags["current"] = float(tags["current"]) * (1.0 + s * 0.08)
            # DoS can trip breakers (protection relay response)
            if "breaker_status" in tags and s > 0.6:
                tags["breaker_status"] = 0.0

        elif atk.attack_type == LiveAttackType.MITM:
            # Man-in-the-Middle: integrity drop + measurement jumps
            if "integrity" in tags:
                tags["integrity"] = max(0.0, float(tags["integrity"]) - s * 0.40 * jitter)
            if "latency" in tags:
                tags["latency"] = float(tags["latency"]) + s * 1.2 * jitter
            if "voltage" in tags:
                tags["voltage"] = float(tags["voltage"]) * (1.0 + s * 0.20 * jitter)
            if "packet_loss" in tags:
                tags["packet_loss"] = min(1.0, float(tags["packet_loss"]) + s * 0.06)
            # Severe MITM can trip breakers (integrity below protection threshold)
            if "breaker_status" in tags and s > 0.7:
                tags["breaker_status"] = 0.0

        record["tags"] = tags
