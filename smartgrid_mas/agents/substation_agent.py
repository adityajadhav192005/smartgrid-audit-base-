from __future__ import annotations
from smartgrid_mas.agents.base_agent import BaseAgent
from smartgrid_mas.agents.types import AgentType

class SubstationAgent(BaseAgent):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.agent_type = AgentType.SUBSTATION
