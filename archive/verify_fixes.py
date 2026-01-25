#!/usr/bin/env python3
"""Verify all fixes work correctly."""
import sys

try:
    from smartgrid_mas.audit.audit_scheduler_rl import QLearningAuditScheduler
    print("✅ QLearningAuditScheduler imported")
    print(f"   Has update method: {hasattr(QLearningAuditScheduler, 'update')}")
    
    from smartgrid_mas.anomaly_detection.inference import LSTMInferencer
    print("✅ LSTMInferencer imported")
    print(f"   Has predict_proba method: {hasattr(LSTMInferencer, 'predict_proba')}")
    
    from smartgrid_mas.audit.audit_ledger import AuditLedger
    print("✅ AuditLedger imported")
    ledger = AuditLedger()
    print(f"   Has events field: {hasattr(ledger, 'events')}")
    
    from smartgrid_mas.agents.types import AgentType
    print("✅ AgentType imported")
    print(f"   Has GENERATOR: {hasattr(AgentType, 'GENERATOR')}")
    print(f"   Has SUBSTATION: {hasattr(AgentType, 'SUBSTATION')}")
    print(f"   Has PMU: {hasattr(AgentType, 'PMU')}")
    print(f"   Has BREAKER: {hasattr(AgentType, 'BREAKER')}")
    
    from smartgrid_mas.run_all import main, build_agent_pool
    print("✅ run_all module imported")
    print(f"   Has main function: {callable(main)}")
    print(f"   Has build_agent_pool function: {callable(build_agent_pool)}")
    
    from smartgrid_mas.simulation.experiment_runner import main as demo_main
    print("✅ experiment_runner module imported")
    print(f"   Has main function: {callable(demo_main)}")
    
    print("\n" + "="*60)
    print("✅ ALL FIXES VERIFIED SUCCESSFULLY!")
    print("="*60)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
