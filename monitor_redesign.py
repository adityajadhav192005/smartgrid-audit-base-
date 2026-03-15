"""
Monitor the complete redesign experiment - targeting to BEAT the paper!
"""
import json
import os
from datetime import datetime

PAPER_TARGETS = {
    'risk_mitigation': 0.879,  # 87.9% - WE MUST BEAT THIS
    'cost_efficiency': 0.425,  # 42.5%
    'precision': 0.35,         # Implied from 3.2% FPR
    'coverage': 1.0,           # 100%
    'anomaly_accuracy': 1.0,   # 100%
    'audit_delay_ms_max': 50.0 # transmission+decision delay budget
}

PRACTICAL_GATES = {
    'cost_efficiency_min': 0.44,
    'precision_min': 0.35,
    'coverage_min': 0.95,
    'anomaly_accuracy_min': 0.995,
    'audit_delay_ms_max': 50.0,
}

def load_results(n):
    path = f'logs/N{n}/summary.json'
    if not os.path.exists(path):
        return None
    with open(path, 'r') as f:
        return json.load(f)

def check_progress():
    print("\n" + "="*80)
    print("🚀 COMPLETE REDESIGN - PROGRESS CHECK")
    print("="*80)
    print(f"Time: {datetime.now().strftime('%H:%M:%S')}")
    print(f"\nPaper Targets to BEAT:")
    print(f"  Risk Mitigation: {PAPER_TARGETS['risk_mitigation']:.1%}")
    print(f"  Cost Efficiency: {PAPER_TARGETS['cost_efficiency']:.1%}")
    print(f"  Precision: {PAPER_TARGETS['precision']:.2f}")
    print(f"  Coverage: {PAPER_TARGETS['coverage']:.0%}")
    print(f"  Accuracy: {PAPER_TARGETS['anomaly_accuracy']:.0%}")
    print(f"  Audit Delay (max): {PAPER_TARGETS['audit_delay_ms_max']:.1f} ms")
    print(f"\nPractical Decision Gates:")
    print(f"  Cost Efficiency: >= {PRACTICAL_GATES['cost_efficiency_min']:.0%}")
    print(f"  Precision: >= {PRACTICAL_GATES['precision_min']:.2f}")
    print(f"  Coverage: >= {PRACTICAL_GATES['coverage_min']:.0%}")
    print(f"  Accuracy: >= {PRACTICAL_GATES['anomaly_accuracy_min']:.1%}")
    print(f"  Audit Delay (max): <= {PRACTICAL_GATES['audit_delay_ms_max']:.1f} ms")
    print("\n" + "-"*80)
    
    any_found = False
    for n in [100, 200, 500]:
        data = load_results(n)
        if data:
            any_found = True
            rm = data.get('risk_mitigation', 0)
            ce = data.get('cost_efficiency', 0)
            prec = data.get('precision', 0)
            cov = data.get('coverage_cycle_dynamic', data.get('coverage_dyn', data.get('coverage', 0)))
            acc = data.get('accuracy', 0)

            # End-to-end decision/transmission delay (explicit metric if available)
            if 'avg_end_to_end_delay_ms' in data:
                delay_ms = data.get('avg_end_to_end_delay_ms', 0.0)
            else:
                # Backward-compatible proxy for older summaries
                lstm_ms = data.get('avg_lstm_inference_time_ms', 0.0)
                sched_ms = data.get('avg_schedule_time_ms', 0.0)
                delay_ms = lstm_ms + sched_ms
            
            # Check if we beat the paper
            rm_beat = rm > PAPER_TARGETS['risk_mitigation']
            ce_match = 0.40 <= ce <= 0.80  # Reasonable range
            prec_beat = prec > PAPER_TARGETS['precision']
            cov_beat = cov >= PAPER_TARGETS['coverage']
            acc_beat = acc >= PAPER_TARGETS['anomaly_accuracy']
            delay_ok = delay_ms <= PAPER_TARGETS['audit_delay_ms_max']

            practical_cost_ok = ce >= PRACTICAL_GATES['cost_efficiency_min']
            practical_prec_ok = prec >= PRACTICAL_GATES['precision_min']
            practical_cov_ok = cov >= PRACTICAL_GATES['coverage_min']
            practical_acc_ok = acc >= PRACTICAL_GATES['anomaly_accuracy_min']
            practical_delay_ok = delay_ms <= PRACTICAL_GATES['audit_delay_ms_max']
            
            status = "✅ BEATING PAPER!" if (rm_beat and ce_match and prec_beat and cov_beat and acc_beat and delay_ok) else "⏳ In Progress..."
            practical_status = "✅ PRACTICAL GATE PASS" if (
                practical_cost_ok and practical_prec_ok and practical_cov_ok and practical_acc_ok and practical_delay_ok
            ) else "⏳ PRACTICAL GATE FAIL"
            
            print(f"\nN={n}: {status}")
            print(f"  Risk Mitigation: {rm:>7.2%} {'✅' if rm_beat else '❌'} (target: >{PAPER_TARGETS['risk_mitigation']:.1%})")
            print(f"  Cost Efficiency: {ce:>7.2%} {'✅' if ce_match else '⚠️'} (target: 40-80%)")
            print(f"  Precision: {prec:>12.4f} {'✅' if prec_beat else '❌'} (target: >{PAPER_TARGETS['precision']:.2f})")
            print(f"  Coverage: {cov:>13.2%} {'✅' if cov_beat else '❌'} (target: {PAPER_TARGETS['coverage']:.0%})")
            print(f"  Accuracy: {acc:>13.2%} {'✅' if acc_beat else '❌'} (target: {PAPER_TARGETS['anomaly_accuracy']:.0%})")
            print(f"  Audit Delay: {delay_ms:>10.2f} ms {'✅' if delay_ok else '❌'} (target: <={PAPER_TARGETS['audit_delay_ms_max']:.1f} ms)")
            print(f"  Practical Gate: {practical_status}")
    
    if not any_found:
        print("\n⏳ No results yet - experiment still running...")
    
    print("="*80 + "\n")

if __name__ == '__main__':
    check_progress()
