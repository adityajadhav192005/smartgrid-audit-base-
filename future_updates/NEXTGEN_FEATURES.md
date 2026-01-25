# Smart Grid Audit Framework - Next-Gen Features

## Executive Summary

This document outlines advanced integration capabilities that transform the Smart Grid Audit Framework from a standalone research prototype into a **production-ready, enterprise-grade cybersecurity platform**. These next-generation features enable:

1. **SCADA System Integration** - Real-time data ingestion and supervisory control
2. **Explainable AI (XAI)** - Transparent anomaly explanations for operators
3. **Federated Learning** - Privacy-preserving multi-grid collaboration
4. **Universal API Architecture** - RESTful and GraphQL interfaces for ecosystem integration

**Deployment Timeline:** 6-8 weeks after optimization roadmap completion

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Unified Entry)                  │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ REST API     │ GraphQL API  │ WebSocket    │ Federated    │  │
│  │ Port: 8000   │ Port: 8001   │ (Real-time)  │ Port: 8080   │  │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘  │
└─────────┼──────────────┼──────────────┼──────────────┼──────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Smart Grid Audit Framework (Core)                   │
│  ┌────────────────┬────────────────┬────────────────────────┐   │
│  │ Anomaly        │ RL-Based       │ Explainability         │   │
│  │ Detection      │ Audit Scheduler│ Engine (XAI)           │   │
│  └────────┬───────┴────────┬───────┴────────────┬───────────┘   │
└───────────┼────────────────┼────────────────────┼───────────────┘
            │                │                    │
            ▼                ▼                    ▼
┌─────────────────┬────────────────────┬──────────────────────────┐
│ SCADA Systems   │ Control Centers    │ Federated Grid Partners  │
│ • IEC 61850     │ • IEEE C37.118    │ • Distributed Training   │
│ • DNP3          │ • Modbus          │ • Privacy-Preserving     │
│ • PMU Data      │ • HMI Dashboards  │ • Model Aggregation      │
└─────────────────┴────────────────────┴──────────────────────────┘
```

---

## Feature 1: SCADA System Integration (REST API)

### Objective

Enable **real-time bidirectional communication** with Supervisory Control and Data Acquisition (SCADA) systems used by utilities for grid monitoring and control.

### Use Cases

1. **PMU Data Ingestion** - Consume phasor measurements at 30-60 Hz
2. **Supervisory Control** - Execute audit-driven control commands (breaker trips, load shedding)
3. **Anomaly Alerting** - Push security alerts to HMI dashboards
4. **Status Monitoring** - Provide grid health metrics to control centers

### Technical Specifications

#### Protocol Compatibility

| Protocol | Standard | Use Case | Update Rate |
|----------|----------|----------|-------------|
| IEC 61850 (MMS) | ISO/IEC 61850 | Substation automation, PMU data | 30-60 Hz |
| IEEE C37.118 | Synchrophasor standard | Real-time phase angle measurements | 50-60 Hz |
| DNP3 | IEEE 1815 | Legacy RTU/SCADA communication | 1-5 Hz |
| Modbus TCP/IP | De facto standard | PLC/HMI integration | 1-10 Hz |

#### REST API Endpoints

**Base URL:** `http://<server>:8000/api/v1`

##### 1. PMU Data Ingestion

```http
POST /scada/ingest/pmu
Content-Type: application/json
Authorization: Bearer <scada_token>

{
    "timestamp": "2026-01-21T10:15:30.123Z",
    "pmu_id": "PMU_SUB001",
    "agent_id": 42,
    "measurements": {
        "voltage_magnitude": 138.5,      // kV
        "current_magnitude": 450.2,      // A
        "frequency": 59.98,              // Hz
        "phase_angle": 12.5,             // degrees
        "rocof": 0.02                    // Hz/s (Rate of Change of Frequency)
    },
    "quality_flags": {
        "valid": true,
        "accuracy_class": "0.1"
    }
}
```

**Response:**
```json
{
    "status": "accepted",
    "anomaly_score": 0.87,
    "classification": "normal",
    "next_audit_scheduled": "2026-01-21T10:20:00Z"
}
```

##### 2. Supervisory Control Commands

```http
POST /scada/command
Content-Type: application/json
Authorization: Bearer <admin_token>

{
    "command_type": "breaker_trip",
    "target_agents": [42, 43, 44],
    "reason": "Anomaly detected: FDI attack suspected",
    "priority": "high",
    "confirmation_required": true
}
```

**Response:**
```json
{
    "command_id": "CMD_20260121_00123",
    "status": "pending_confirmation",
    "affected_agents": [42, 43, 44],
    "estimated_impact": {
        "load_shed": "12.5 MW",
        "affected_customers": 4200
    },
    "confirmation_url": "/scada/command/CMD_20260121_00123/confirm"
}
```

##### 3. Real-Time Anomaly Stream

```http
GET /scada/anomalies/stream
Accept: text/event-stream
Authorization: Bearer <scada_token>

# Server-Sent Events (SSE) Stream
```

**Event Format:**
```
event: anomaly_detected
data: {
    "timestamp": "2026-01-21T10:15:32.456Z",
    "agent_id": 42,
    "anomaly_score": 1.52,
    "classification": "high_severity",
    "contributing_factors": ["voltage_spike", "communication_latency"],
    "recommended_action": "immediate_audit"
}

event: audit_completed
data: {
    "timestamp": "2026-01-21T10:16:05.789Z",
    "agent_id": 42,
    "audit_result": "confirmed_attack",
    "attack_type": "FDI",
    "recommended_response": "isolate_agent"
}
```

##### 4. Grid Status Dashboard

```http
GET /scada/status
Authorization: Bearer <scada_token>

Response:
{
    "grid_state": "dynamic",
    "total_agents": 100,
    "anomalous_agents": 8,
    "active_audits": 3,
    "risk_level": "medium",
    "metrics": {
        "attack_rate": 0.08,
        "cost_efficiency": 0.6523,
        "audit_coverage": 0.92
    },
    "recent_alerts": [
        {
            "timestamp": "2026-01-21T10:15:32Z",
            "severity": "high",
            "message": "FDI attack detected on PMU_SUB001"
        }
    ]
}
```

### Implementation Details

**Technology Stack:**
- **Framework:** FastAPI 0.109+ (async support, auto-documentation)
- **Authentication:** OAuth2 with JWT tokens, SCADA-specific credentials
- **Validation:** Pydantic models with IEC 61850 field constraints
- **Protocol Translation:** pyiec61850, dnp3-python libraries
- **Rate Limiting:** 1000 requests/minute per SCADA client

**File Structure:**
```
smartgrid_mas/
├── api/
│   ├── __init__.py
│   ├── rest_api.py              # Main FastAPI application
│   ├── models/
│   │   ├── scada_models.py      # Pydantic schemas
│   │   ├── pmu_reading.py
│   │   └── command_schemas.py
│   ├── routers/
│   │   ├── scada_router.py      # SCADA endpoints
│   │   ├── anomaly_router.py    # Anomaly endpoints
│   │   └── audit_router.py      # Audit endpoints
│   ├── middleware/
│   │   ├── auth.py              # JWT authentication
│   │   └── rate_limiter.py      # Request throttling
│   └── utils/
│       ├── protocol_translator.py  # IEC 61850 / DNP3 converters
│       └── validation.py        # SCADA data validation
```

**Sample Implementation (rest_api.py):**
```python
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional
import asyncio

app = FastAPI(
    title="Smart Grid Audit Framework - SCADA API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Security
security = HTTPBearer()

# Models
class PMUReading(BaseModel):
    timestamp: datetime
    pmu_id: str
    agent_id: int = Field(..., ge=0, le=10000)
    voltage_magnitude: float = Field(..., gt=0, le=500)  # kV
    current_magnitude: float = Field(..., ge=0, le=5000)  # A
    frequency: float = Field(..., ge=59.0, le=61.0)  # Hz (North America)
    phase_angle: float = Field(..., ge=-180, le=180)  # degrees
    
    @validator('frequency')
    def validate_frequency(cls, v):
        if not (59.5 <= v <= 60.5):  # Warning range
            logging.warning(f"Frequency outside normal range: {v} Hz")
        return v

class SCADACommand(BaseModel):
    command_type: str = Field(..., regex="^(breaker_trip|load_shed|reclose|audit)$")
    target_agents: List[int]
    reason: str
    priority: str = Field(..., regex="^(low|medium|high|critical)$")
    confirmation_required: bool = True

class AnomalyAlert(BaseModel):
    timestamp: datetime
    agent_id: int
    anomaly_score: float
    classification: str
    contributing_factors: List[str]
    recommended_action: str

# Endpoints
@app.post("/api/v1/scada/ingest/pmu", status_code=202)
async def ingest_pmu_data(
    reading: PMUReading,
    background_tasks: BackgroundTasks,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Ingest PMU measurements from SCADA system.
    
    - Validates IEC 61850 compliance
    - Computes anomaly score in real-time
    - Triggers audit if threshold exceeded
    """
    # Authenticate SCADA client
    verify_scada_credentials(credentials.credentials)
    
    # Background anomaly detection (non-blocking)
    background_tasks.add_task(process_pmu_reading, reading)
    
    # Immediate response for low-latency requirement
    return {
        "status": "accepted",
        "pmu_id": reading.pmu_id,
        "processing_time_ms": 15
    }

@app.post("/api/v1/scada/command")
async def execute_command(
    command: SCADACommand,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Execute supervisory control command.
    
    - Requires admin-level authentication
    - Logs all commands for audit trail
    - Returns confirmation for high-priority actions
    """
    # Admin authentication required
    if not verify_admin_credentials(credentials.credentials):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Execute command via framework core
    result = await framework_core.execute_command(
        command_type=command.command_type,
        targets=command.target_agents,
        priority=command.priority
    )
    
    return {
        "command_id": result.command_id,
        "status": "executed" if not command.confirmation_required else "pending_confirmation",
        "affected_agents": command.target_agents
    }

@app.get("/api/v1/scada/status")
async def get_grid_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Retrieve current grid health and audit status.
    
    - Real-time metrics from framework core
    - Aggregated anomaly counts
    - Active audit schedules
    """
    verify_scada_credentials(credentials.credentials)
    
    status = await framework_core.get_current_status()
    
    return {
        "grid_state": status.grid_state,
        "total_agents": status.n_agents,
        "anomalous_agents": status.n_anomalies,
        "risk_level": status.risk_classification,
        "metrics": {
            "attack_rate": status.attack_rate,
            "cost_efficiency": status.cost_efficiency,
            "audit_coverage": status.audit_coverage
        }
    }

# Helper functions
def verify_scada_credentials(token: str) -> bool:
    """Validate SCADA client JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("scope") == "scada"
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

async def process_pmu_reading(reading: PMUReading):
    """Background task for anomaly detection."""
    # Interface with framework core
    score = anomaly_detector.compute_score(reading)
    
    if score >= ANOMALY_THRESHOLD:
        # Trigger audit via RL scheduler
        await rl_scheduler.schedule_audit(reading.agent_id, priority="high")
```

### Deployment Configuration

**Docker Compose (docker-compose-api.yml):**
```yaml
version: '3.8'

services:
  rest-api:
    build: ./smartgrid_mas/api
    ports:
      - "8000:8000"
    environment:
      - SCADA_TOKEN_SECRET=${SCADA_TOKEN_SECRET}
      - DATABASE_URL=postgresql://user:pass@postgres:5432/smartgrid
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    command: uvicorn smartgrid_mas.api.rest_api:app --host 0.0.0.0 --port 8000 --workers 4

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: smartgrid
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres-data:
```

**Launch Command:**
```bash
docker-compose -f docker-compose-api.yml up -d
```

---

## Feature 2: Explainable AI (XAI) - GraphQL API

### Objective

Provide **transparent, interpretable explanations** for anomaly detections and audit decisions, enabling human operators to understand and trust AI-driven security actions.

### Motivation

**Problem:** Black-box AI decisions undermine operator confidence
- "Why was agent #42 flagged as anomalous?"
- "What factors contributed to this audit decision?"
- "How did the baseline adapt over time?"

**Solution:** GraphQL API with SHAP-based feature importance and Q-value decomposition

### Use Cases

1. **Anomaly Explanation** - Decompose anomaly scores into contributing factors
2. **Audit Decision Rationale** - Explain RL policy choices with Q-value analysis
3. **Baseline Evolution** - Visualize adaptive learning over time
4. **Risk-Benefit Trade-off** - Show Pareto frontier for cost vs. risk

### Technical Specifications

#### GraphQL Schema

**Base URL:** `http://<server>:8001/graphql`

**Core Types:**
```graphql
type Agent {
    id: Int!
    type: AgentType!
    current_metrics: Metrics!
    baseline_metrics: Metrics!
    anomaly_history: [AnomalyEvent!]!
    audit_history: [AuditEvent!]!
}

type Metrics {
    voltage: Float!
    current: Float!
    frequency: Float!
    phase_angle: Float
    communication_latency: Float
    timestamp: DateTime!
}

type AnomalyEvent {
    timestamp: DateTime!
    anomaly_score: Float!
    classification: String!
    contributing_factors: [FeatureContribution!]!
    deviation_breakdown: DeviationBreakdown!
    shap_values: ShapExplanation!
}

type FeatureContribution {
    feature_name: String!
    contribution: Float!  # Normalized contribution to anomaly score
    current_value: Float!
    baseline_value: Float!
    threshold_value: Float!
    deviation_magnitude: Float!
}

type ShapExplanation {
    base_value: Float!  # Expected score for normal agent
    feature_impacts: [ShapValue!]!
    visualization_url: String  # Link to force plot
}

type ShapValue {
    feature: String!
    shap_value: Float!  # Contribution to final score
    feature_value: Float!
}

type AuditDecision {
    timestamp: DateTime!
    agent_id: Int!
    action_taken: String!  # "audit", "skip", "defer"
    q_values: QValueBreakdown!
    reason: String!
    alternative_actions: [AlternativeAction!]!
    risk_benefit_analysis: RiskBenefit!
}

type QValueBreakdown {
    selected_action: String!
    q_value: Float!
    component_breakdown: [QComponent!]!
}

type QComponent {
    component: String!  # "false_positive_penalty", "cost_penalty", "risk_penalty"
    value: Float!
    weight: Float!
}

type AlternativeAction {
    action: String!
    q_value: Float!
    difference_from_selected: Float!
    trade_offs: String!
}

type RiskBenefit {
    expected_risk_reduction: Float!
    expected_cost: Float!
    cost_per_risk_unit: Float!
    recommendation: String!
}
```

**Query Interface:**
```graphql
type Query {
    # Explain why an agent was flagged as anomalous
    explain_anomaly(agent_id: Int!, timestamp: DateTime): AnomalyEvent!
    
    # Explain RL audit decision
    explain_audit_decision(agent_id: Int!, timestamp: DateTime): AuditDecision!
    
    # Compare current vs. historical baselines
    compare_baselines(
        agent_id: Int!, 
        start_time: DateTime!, 
        end_time: DateTime!
    ): BaselineEvolution!
    
    # Analyze risk-cost trade-offs
    risk_mitigation_analysis: RiskCostAnalysis!
    
    # Get top contributing factors across all anomalies
    global_feature_importance(time_window: Int!): [GlobalFeatureImportance!]!
}

type Subscription {
    # Real-time anomaly stream with explanations
    anomaly_stream: AnomalyEvent!
    
    # Real-time audit decision stream
    audit_execution_stream: AuditDecision!
}
```

#### Example Queries

**Query 1: Explain Anomaly**
```graphql
query ExplainAnomaly {
    explain_anomaly(agent_id: 42, timestamp: "2026-01-21T10:15:32Z") {
        anomaly_score
        classification
        contributing_factors {
            feature_name
            contribution
            current_value
            baseline_value
            deviation_magnitude
        }
        shap_values {
            base_value
            feature_impacts {
                feature
                shap_value
                feature_value
            }
        }
    }
}
```

**Response:**
```json
{
    "data": {
        "explain_anomaly": {
            "anomaly_score": 1.52,
            "classification": "high_severity",
            "contributing_factors": [
                {
                    "feature_name": "voltage_magnitude",
                    "contribution": 0.68,
                    "current_value": 152.3,
                    "baseline_value": 138.5,
                    "deviation_magnitude": 0.996
                },
                {
                    "feature_name": "communication_latency",
                    "contribution": 0.24,
                    "current_value": 285.0,
                    "baseline_value": 120.0,
                    "deviation_magnitude": 1.375
                },
                {
                    "feature_name": "frequency",
                    "contribution": 0.08,
                    "current_value": 59.85,
                    "baseline_value": 59.98,
                    "deviation_magnitude": 0.217
                }
            ],
            "shap_values": {
                "base_value": 0.35,
                "feature_impacts": [
                    {"feature": "voltage_magnitude", "shap_value": 0.82, "feature_value": 152.3},
                    {"feature": "communication_latency", "shap_value": 0.31, "feature_value": 285.0},
                    {"feature": "frequency", "shap_value": 0.04, "feature_value": 59.85}
                ]
            }
        }
    }
}
```

**Query 2: Explain Audit Decision**
```graphql
query ExplainAudit {
    explain_audit_decision(agent_id: 42) {
        action_taken
        reason
        q_values {
            selected_action
            q_value
            component_breakdown {
                component
                value
                weight
            }
        }
        alternative_actions {
            action
            q_value
            difference_from_selected
            trade_offs
        }
        risk_benefit_analysis {
            expected_risk_reduction
            expected_cost
            cost_per_risk_unit
            recommendation
        }
    }
}
```

**Response:**
```json
{
    "data": {
        "explain_audit_decision": {
            "action_taken": "immediate_audit",
            "reason": "High anomaly score (1.52) with critical agent type (generator)",
            "q_values": {
                "selected_action": "immediate_audit",
                "q_value": 0.87,
                "component_breakdown": [
                    {"component": "false_positive_penalty", "value": -0.05, "weight": 0.25},
                    {"component": "false_negative_penalty", "value": -0.22, "weight": 0.25},
                    {"component": "cost_penalty", "value": -0.18, "weight": 0.35},
                    {"component": "risk_penalty", "value": -0.12, "weight": 0.15}
                ]
            },
            "alternative_actions": [
                {
                    "action": "defer_audit",
                    "q_value": 0.62,
                    "difference_from_selected": -0.25,
                    "trade_offs": "Lower cost (-$50) but 15% higher risk"
                },
                {
                    "action": "skip_audit",
                    "q_value": 0.45,
                    "difference_from_selected": -0.42,
                    "trade_offs": "Lowest cost (-$100) but 35% higher risk"
                }
            ],
            "risk_benefit_analysis": {
                "expected_risk_reduction": 0.12,
                "expected_cost": 100.0,
                "cost_per_risk_unit": 833.33,
                "recommendation": "Audit recommended: High-value risk reduction"
            }
        }
    }
}
```

### Implementation Details

**Technology Stack:**
- **Framework:** Strawberry GraphQL (Python-native, type-safe)
- **XAI Libraries:** SHAP (Shapley values), LIME (local explanations)
- **Visualization:** Plotly for interactive force plots
- **Caching:** Redis for expensive SHAP computations

**File Structure:**
```
smartgrid_mas/
├── xai/
│   ├── __init__.py
│   ├── explainability_engine.py  # Core XAI logic
│   ├── shap_explainer.py         # SHAP-based feature importance
│   ├── q_value_decomposer.py     # RL decision breakdown
│   └── visualization.py          # Force plots, Pareto frontiers
├── api/
│   ├── graphql_api.py            # Strawberry schema
│   ├── resolvers/
│   │   ├── anomaly_resolvers.py
│   │   ├── audit_resolvers.py
│   │   └── baseline_resolvers.py
│   └── subscriptions/
│       └── real_time_streams.py
```

**Sample Implementation (graphql_api.py):**
```python
import strawberry
from strawberry.fastapi import GraphQLRouter
from typing import List, Optional
from datetime import datetime
import numpy as np

# Strawberry Types
@strawberry.type
class FeatureContribution:
    feature_name: str
    contribution: float
    current_value: float
    baseline_value: float
    deviation_magnitude: float

@strawberry.type
class ShapValue:
    feature: str
    shap_value: float
    feature_value: float

@strawberry.type
class ShapExplanation:
    base_value: float
    feature_impacts: List[ShapValue]

@strawberry.type
class AnomalyEvent:
    timestamp: datetime
    anomaly_score: float
    classification: str
    contributing_factors: List[FeatureContribution]
    shap_values: ShapExplanation

# Resolvers
@strawberry.type
class Query:
    @strawberry.field
    async def explain_anomaly(
        self, 
        agent_id: int, 
        timestamp: Optional[datetime] = None
    ) -> AnomalyEvent:
        """
        Explain anomaly detection using SHAP feature importance.
        
        Returns:
            Detailed breakdown of contributing factors with SHAP values
        """
        # Retrieve anomaly event from database
        event = await db.get_anomaly_event(agent_id, timestamp)
        
        # Compute SHAP explanations
        explainer = ShapExplainer(framework_core.anomaly_detector)
        shap_values = explainer.explain_instance(
            agent_id=agent_id,
            features=event.features
        )
        
        # Decompose anomaly score into feature contributions
        contributions = []
        for feature_name, feature_value in event.features.items():
            contrib = compute_feature_contribution(
                feature_name=feature_name,
                current_value=feature_value,
                baseline=event.baseline[feature_name],
                threshold=event.thresholds[feature_name],
                weight=event.criticality_weights[feature_name]
            )
            contributions.append(contrib)
        
        # Sort by contribution magnitude
        contributions.sort(key=lambda x: abs(x.contribution), reverse=True)
        
        return AnomalyEvent(
            timestamp=event.timestamp,
            anomaly_score=event.score,
            classification=event.classification,
            contributing_factors=contributions,
            shap_values=ShapExplanation(
                base_value=shap_values.base_value,
                feature_impacts=[
                    ShapValue(
                        feature=name,
                        shap_value=value,
                        feature_value=event.features[name]
                    )
                    for name, value in shap_values.values.items()
                ]
            )
        )
    
    @strawberry.field
    async def explain_audit_decision(
        self, 
        agent_id: int, 
        timestamp: Optional[datetime] = None
    ) -> AuditDecision:
        """
        Explain RL audit decision with Q-value decomposition.
        
        Returns:
            Breakdown of Q-values, alternative actions, risk-benefit analysis
        """
        # Retrieve audit decision from RL scheduler
        decision = await rl_scheduler.get_decision(agent_id, timestamp)
        
        # Decompose Q-value into reward components
        q_breakdown = QValueDecomposer.decompose(
            state=decision.state,
            action=decision.action,
            reward_weights=config.rl.reward_weights
        )
        
        # Generate alternative action analysis
        alternatives = []
        for action in ["defer_audit", "skip_audit"]:
            alt_q = rl_scheduler.q_table[decision.state][action]
            trade_off = analyze_trade_off(
                selected_action=decision.action,
                alternative_action=action,
                q_difference=decision.q_value - alt_q
            )
            alternatives.append(AlternativeAction(
                action=action,
                q_value=alt_q,
                difference_from_selected=alt_q - decision.q_value,
                trade_offs=trade_off
            ))
        
        # Risk-benefit analysis
        risk_benefit = compute_risk_benefit(
            audit_cost=config.audit.audit_cost,
            expected_risk_reduction=decision.expected_risk_reduction
        )
        
        return AuditDecision(
            timestamp=decision.timestamp,
            agent_id=agent_id,
            action_taken=decision.action,
            q_values=q_breakdown,
            reason=decision.reason,
            alternative_actions=alternatives,
            risk_benefit_analysis=risk_benefit
        )

# Schema
schema = strawberry.Schema(query=Query)
graphql_app = GraphQLRouter(schema)
```

### Deployment

**Launch Command:**
```bash
uvicorn smartgrid_mas.api.graphql_api:graphql_app --host 0.0.0.0 --port 8001
```

**GraphQL Playground:** `http://localhost:8001/graphql`

---

## Feature 3: Federated Learning Integration

### Objective

Enable **privacy-preserving collaborative learning** across multiple smart grids, allowing utilities to improve anomaly detection and audit policies without sharing sensitive operational data.

### Motivation

**Problem:** Single-grid training limits generalization
- Each grid has unique operational patterns
- Limited attack scenarios for training
- Data sharing restricted by regulations (NERC CIP, GDPR)

**Solution:** Federated Learning with Flower framework
- Train local models on each grid
- Share model updates (not raw data)
- Aggregate global model across grids

### Use Cases

1. **Multi-Utility Collaboration** - Share learned attack patterns without exposing grid topology
2. **Rare Event Learning** - Aggregate rare attack scenarios from multiple grids
3. **Transfer Learning** - Bootstrap new grids with global model
4. **Continual Learning** - Adapt to evolving attack vectors across utility ecosystem

### Technical Specifications

#### Federated Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               Federated Server (Coordinator)                  │
│  • Global Model Aggregation (FedAvg)                         │
│  • Q-Table Aggregation (Weighted by Grid Size)              │
│  • LSTM Anomaly Detector Aggregation                         │
│  Port: 8080 (gRPC)                                           │
└──────────┬──────────────┬──────────────┬────────────────────┘
           │              │              │
           ▼              ▼              ▼
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │ Grid A  │    │ Grid B  │    │ Grid C  │
     │ (100    │    │ (250    │    │ (150    │
     │ agents) │    │ agents) │    │ agents) │
     └─────────┘    └─────────┘    └─────────┘
     Local Model    Local Model    Local Model
     • Train on     • Train on     • Train on
       local data     local data     local data
     • Share Δθ     • Share Δθ     • Share Δθ
       (gradients)    (gradients)    (gradients)
```

#### Aggregation Strategy

**FedAvg for LSTM Anomaly Detector:**
$$
\theta_{\text{global}}^{(t+1)} = \sum_{i=1}^{N} \frac{n_i}{n_{\text{total}}} \theta_i^{(t+1)}
$$

Where:
- $\theta_i$ = Local model parameters for grid $i$
- $n_i$ = Number of agents in grid $i$
- $n_{\text{total}}$ = Total agents across all grids

**Weighted Q-Table Aggregation:**
$$
Q_{\text{global}}(s, a) = \sum_{i=1}^{N} w_i \cdot Q_i(s, a)
$$

Where:
- $w_i = \frac{n_i}{n_{\text{total}}}$ = Weight proportional to grid size
- $Q_i(s, a)$ = Local Q-table for grid $i$

### Implementation Details

**Technology Stack:**
- **Framework:** Flower (flwr.dev) - Production-grade federated learning
- **Communication:** gRPC for efficient model transfer
- **Privacy:** Differential privacy with Gaussian noise injection
- **Compression:** Model quantization (FP32 → FP16) for bandwidth efficiency

**File Structure:**
```
smartgrid_mas/
├── federated/
│   ├── __init__.py
│   ├── federated_server.py       # Flower server
│   ├── federated_client.py       # Flower client
│   ├── aggregation_strategy.py   # Custom FedAvg with Q-tables
│   ├── privacy.py                # Differential privacy mechanisms
│   └── compression.py            # Model quantization
```

**Sample Implementation (federated_server.py):**
```python
import flwr as fl
from flwr.server.strategy import FedAvg
from typing import List, Tuple, Dict, Optional
import numpy as np

class SmartGridFederatedStrategy(FedAvg):
    """
    Custom federated averaging for Smart Grid Audit Framework.
    
    Features:
    - Weighted aggregation by grid size
    - Q-table aggregation for RL policies
    - LSTM weight aggregation for anomaly detection
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.global_q_table = {}
    
    def aggregate_fit(
        self,
        rnd: int,
        results: List[Tuple[fl.server.client_proxy.ClientProxy, fl.common.FitRes]],
        failures: List[BaseException],
    ) -> Tuple[Optional[fl.common.Parameters], Dict[str, fl.common.Scalar]]:
        """
        Aggregate model updates from all grids.
        
        Args:
            rnd: Current training round
            results: List of (client, fit_result) tuples
            failures: List of exceptions from failed clients
        
        Returns:
            Aggregated global model parameters and metrics
        """
        # Extract local models and grid sizes
        weights_results = []
        grid_sizes = []
        q_tables = []
        
        for client, fit_res in results:
            # Extract LSTM weights
            weights = fl.common.parameters_to_ndarrays(fit_res.parameters)
            weights_results.append(weights)
            
            # Extract grid size from metrics
            grid_size = fit_res.metrics.get("grid_size", 100)
            grid_sizes.append(grid_size)
            
            # Extract Q-table
            q_table = fit_res.metrics.get("q_table", {})
            q_tables.append(q_table)
        
        # Compute aggregation weights (proportional to grid size)
        total_agents = sum(grid_sizes)
        aggregation_weights = [n / total_agents for n in grid_sizes]
        
        # Aggregate LSTM weights (FedAvg)
        aggregated_weights = [
            np.sum([w[i] * agg_w for w, agg_w in zip(weights_results, aggregation_weights)], axis=0)
            for i in range(len(weights_results[0]))
        ]
        
        # Aggregate Q-tables
        self.global_q_table = self._aggregate_q_tables(q_tables, aggregation_weights)
        
        # Convert back to Parameters
        aggregated_params = fl.common.ndarrays_to_parameters(aggregated_weights)
        
        # Compute global metrics
        metrics = {
            "round": rnd,
            "num_grids": len(results),
            "total_agents": total_agents,
            "avg_local_accuracy": np.mean([
                fit_res.metrics.get("accuracy", 0.0) for _, fit_res in results
            ])
        }
        
        return aggregated_params, metrics
    
    def _aggregate_q_tables(
        self, 
        q_tables: List[Dict], 
        weights: List[float]
    ) -> Dict:
        """
        Aggregate Q-tables from multiple grids.
        
        Args:
            q_tables: List of local Q-tables {(state, action): q_value}
            weights: Aggregation weights per grid
        
        Returns:
            Global Q-table
        """
        global_q = {}
        
        # Get all unique state-action pairs
        all_state_actions = set()
        for q_table in q_tables:
            all_state_actions.update(q_table.keys())
        
        # Weighted average for each state-action pair
        for state_action in all_state_actions:
            weighted_sum = 0.0
            total_weight = 0.0
            
            for q_table, weight in zip(q_tables, weights):
                if state_action in q_table:
                    weighted_sum += q_table[state_action] * weight
                    total_weight += weight
            
            # Avoid division by zero (if state-action not seen by some grids)
            global_q[state_action] = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        return global_q

# Start Federated Server
def start_server(num_rounds: int = 10, min_clients: int = 3):
    """
    Launch federated learning server.
    
    Args:
        num_rounds: Number of training rounds
        min_clients: Minimum grids required to start training
    """
    strategy = SmartGridFederatedStrategy(
        fraction_fit=1.0,  # Use all available clients per round
        min_fit_clients=min_clients,
        min_available_clients=min_clients,
    )
    
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=num_rounds),
        strategy=strategy,
    )

if __name__ == "__main__":
    start_server(num_rounds=20, min_clients=3)
```

**Sample Implementation (federated_client.py):**
```python
import flwr as fl
import numpy as np
from smartgrid_mas.pipeline import Pipeline

class SmartGridFederatedClient(fl.client.NumPyClient):
    """
    Federated learning client for individual smart grid.
    
    Responsibilities:
    - Train local LSTM anomaly detector
    - Train local RL audit policy (Q-learning)
    - Share model updates without raw data
    """
    
    def __init__(self, grid_id: str, config_path: str):
        self.grid_id = grid_id
        self.pipeline = Pipeline(config_path)
        self.local_q_table = {}
    
    def get_parameters(self, config: Dict) -> List[np.ndarray]:
        """
        Return current local model parameters.
        
        Returns:
            LSTM weights as NumPy arrays
        """
        # Extract LSTM model weights
        lstm_model = self.pipeline.anomaly_detector.lstm_model
        return [layer.get_weights() for layer in lstm_model.layers]
    
    def fit(
        self, 
        parameters: List[np.ndarray], 
        config: Dict
    ) -> Tuple[List[np.ndarray], int, Dict]:
        """
        Train local model on grid-specific data.
        
        Args:
            parameters: Global model parameters from server
            config: Training configuration
        
        Returns:
            Updated parameters, number of samples, metrics
        """
        # Update local model with global parameters
        lstm_model = self.pipeline.anomaly_detector.lstm_model
        for layer, weights in zip(lstm_model.layers, parameters):
            layer.set_weights(weights)
        
        # Train on local data
        results = self.pipeline.run(modes=['dynamic'])
        
        # Train RL policy
        self.local_q_table = self.pipeline.rl_scheduler.q_table
        
        # Get updated parameters
        updated_params = self.get_parameters(config)
        
        # Metrics to share
        metrics = {
            "grid_id": self.grid_id,
            "grid_size": self.pipeline.config.simulation.n_agents,
            "accuracy": results['evaluation']['accuracy'],
            "q_table": self.local_q_table,  # Share Q-table
            "num_anomalies": results['evaluation']['n_anomalies']
        }
        
        return updated_params, self.pipeline.config.simulation.n_agents, metrics
    
    def evaluate(
        self, 
        parameters: List[np.ndarray], 
        config: Dict
    ) -> Tuple[float, int, Dict]:
        """
        Evaluate global model on local test data.
        
        Returns:
            Loss, number of samples, metrics
        """
        # Update local model
        lstm_model = self.pipeline.anomaly_detector.lstm_model
        for layer, weights in zip(lstm_model.layers, parameters):
            layer.set_weights(weights)
        
        # Evaluate on local test set
        test_results = self.pipeline.evaluate_on_test_set()
        
        loss = test_results['loss']
        accuracy = test_results['accuracy']
        n_samples = test_results['n_test_samples']
        
        return loss, n_samples, {"accuracy": accuracy}

# Start Federated Client
def start_client(grid_id: str, server_address: str = "localhost:8080"):
    """
    Launch federated learning client for a specific grid.
    
    Args:
        grid_id: Unique identifier for this grid
        server_address: Federated server address
    """
    client = SmartGridFederatedClient(
        grid_id=grid_id,
        config_path=f"config_{grid_id}.json"
    )
    
    fl.client.start_numpy_client(
        server_address=server_address,
        client=client
    )

if __name__ == "__main__":
    import sys
    grid_id = sys.argv[1] if len(sys.argv) > 1 else "grid_a"
    start_client(grid_id=grid_id)
```

### Privacy Guarantees

**Differential Privacy (DP):**
```python
def add_noise_to_gradients(gradients: List[np.ndarray], epsilon: float = 1.0):
    """
    Add Gaussian noise to gradients for differential privacy.
    
    Args:
        gradients: Model gradients
        epsilon: Privacy budget (lower = more privacy)
    
    Returns:
        Noisy gradients satisfying (ε, δ)-DP
    """
    noisy_gradients = []
    for grad in gradients:
        # Compute L2 sensitivity
        sensitivity = np.linalg.norm(grad)
        
        # Gaussian noise scaled by sensitivity and epsilon
        noise_scale = sensitivity / epsilon
        noise = np.random.normal(0, noise_scale, grad.shape)
        
        noisy_gradients.append(grad + noise)
    
    return noisy_gradients
```

### Deployment

**Launch Server:**
```bash
python -m smartgrid_mas.federated.federated_server --rounds 20 --min-clients 3
```

**Launch Clients (on separate grids):**
```bash
# Grid A
python -m smartgrid_mas.federated.federated_client --grid-id grid_a --server localhost:8080

# Grid B
python -m smartgrid_mas.federated.federated_client --grid-id grid_b --server localhost:8080

# Grid C
python -m smartgrid_mas.federated.federated_client --grid-id grid_c --server localhost:8080
```

---

## Feature 4: Unified API Gateway

### Objective

Provide a **single entry point** for all external integrations, routing requests to appropriate backend services (REST, GraphQL, WebSocket, Federated).

### Architecture

```
                      ┌─────────────────────────┐
                      │   API Gateway (Nginx)   │
                      │   Port: 80 / 443 (TLS)  │
                      └────────────┬────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  REST API        │   │  GraphQL API     │   │  WebSocket       │
│  /api/v1/*       │   │  /graphql        │   │  /ws/stream      │
│  Port: 8000      │   │  Port: 8001      │   │  Port: 8002      │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

### Configuration (nginx.conf)

```nginx
upstream rest_api {
    server rest-api:8000;
}

upstream graphql_api {
    server graphql-api:8001;
}

upstream websocket_stream {
    server websocket-server:8002;
}

server {
    listen 80;
    server_name smartgrid-audit.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smartgrid-audit.example.com;
    
    ssl_certificate /etc/ssl/certs/smartgrid.crt;
    ssl_certificate_key /etc/ssl/private/smartgrid.key;
    
    # REST API routes
    location /api/v1/ {
        proxy_pass http://rest_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
    }
    
    # GraphQL routes
    location /graphql {
        proxy_pass http://graphql_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket routes
    location /ws/stream {
        proxy_pass http://websocket_stream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    
    # Health check
    location /health {
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

---

## Implementation Roadmap

### Phase 1: SCADA Integration (Weeks 1-2)
- [ ] Implement REST API with FastAPI
- [ ] Create PMU ingestion endpoint
- [ ] Implement supervisory control commands
- [ ] Add IEC 61850 / DNP3 protocol translation
- [ ] Deploy with Docker Compose
- [ ] Test with synthetic SCADA data

### Phase 2: XAI Module (Weeks 3-4)
- [ ] Implement SHAP explainer for anomaly detection
- [ ] Create Q-value decomposer for RL decisions
- [ ] Build GraphQL schema with Strawberry
- [ ] Implement anomaly/audit explanation resolvers
- [ ] Add real-time subscriptions
- [ ] Create interactive visualizations (Plotly)

### Phase 3: Federated Learning (Weeks 5-6)
- [ ] Implement Flower server with custom strategy
- [ ] Implement Flower client for individual grids
- [ ] Create Q-table aggregation logic
- [ ] Add differential privacy mechanisms
- [ ] Test with 3 simulated grids
- [ ] Measure convergence and privacy guarantees

### Phase 4: Integration & Deployment (Weeks 7-8)
- [ ] Set up API Gateway (Nginx)
- [ ] Configure SSL/TLS certificates
- [ ] Implement rate limiting and authentication
- [ ] Create unified Docker Compose for all services
- [ ] Write comprehensive API documentation
- [ ] Conduct end-to-end integration tests

---

## Success Metrics

### API Performance
- **REST API Latency:** <100ms for 95th percentile
- **GraphQL Query Time:** <500ms for complex explanations
- **WebSocket Throughput:** 1000 messages/second
- **Federated Convergence:** <50 rounds for global model

### Integration Quality
- **SCADA Compatibility:** IEC 61850, DNP3, Modbus support
- **XAI Fidelity:** SHAP values match manual analysis
- **Privacy Guarantees:** (ε=1.0, δ=1e-5)-differential privacy
- **API Uptime:** >99.9% availability

### User Impact
- **Operator Trust:** 80% confidence in XAI explanations
- **Multi-Grid Accuracy:** +15% anomaly detection improvement
- **Integration Time:** <2 days for new SCADA system
- **Documentation Quality:** 100% endpoint coverage

---

## References

### Standards & Protocols
- IEC 61850: Communication networks and systems for power utility automation
- IEEE C37.118: Synchrophasor measurements for power systems
- DNP3 (IEEE 1815): Distributed Network Protocol
- NERC CIP: Critical Infrastructure Protection standards

### Frameworks & Libraries
- FastAPI: https://fastapi.tiangolo.com/
- Strawberry GraphQL: https://strawberry.rocks/
- Flower Federated Learning: https://flower.dev/
- SHAP (Explainable AI): https://github.com/slundberg/shap
- LIME: https://github.com/marcotcr/lime

### Research Papers
- "Federated Learning for Smart Grids" - IEEE Transactions on Smart Grid (2021)
- "Explainable Anomaly Detection in Cyber-Physical Systems" - ACM CCS (2022)
- "Real-Time SCADA Data Analysis Using Deep Learning" - IEEE Power & Energy (2023)

---

**Document Version:** 1.0  
**Last Updated:** January 21, 2026  
**Status:** Design Specification  
**Estimated Implementation:** 8 weeks (post-optimization)
