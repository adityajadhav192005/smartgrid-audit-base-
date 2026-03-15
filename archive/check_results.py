import json

for n in [100, 200, 500]:
    path = f'logs/N{n}/summary.json'
    try:
        with open(path) as f:
            s = json.load(f)
        cost_eff = s.get("cost_efficiency", None)
        attack_red = s.get("attack_reduction", None)
        precision = s.get("precision", None)
        recall = s.get("recall", None)
        accuracy = s.get("accuracy", None)
        fpr = s.get("false_positive_rate", None)
        
        print(f"\n{'='*80}")
        print(f"N={n}")
        print(f"{'='*80}")
        print(f"Cost Efficiency:      {cost_eff:>8.2%}" if cost_eff else f"Cost Efficiency:      N/A")
        print(f"Attack Reduction:     {attack_red:>8.2%}" if attack_red else f"Attack Reduction:     N/A")
        print(f"Precision:            {precision:>8.3f}" if precision else f"Precision:            N/A")
        print(f"Recall:               {recall:>8.3f}" if recall else f"Recall:               N/A")
        print(f"Accuracy:             {accuracy:>8.1%}" if accuracy else f"Accuracy:             N/A")
        print(f"False Positive Rate:  {fpr:>8.1%}" if fpr else f"False Positive Rate:  N/A")
        
        # Paper targets
        print(f"\n{'PAPER TARGETS':^80}")
        print(f"Cost Efficiency:      {'60-75%':>8}")
        print(f"Attack Reduction:     {'10-15%':>8}")
        print(f"Precision:            {'0.30-0.40':>8}")
        print(f"Recall:               {'0.85-0.95':>8}")
        
        # Verdict
        print(f"\n{'STATUS':^80}")
        status_list = []
        if cost_eff and cost_eff >= 0.30: status_list.append(f"✅ Cost: {cost_eff:.0%}")
        elif cost_eff: status_list.append(f"❌ Cost: {cost_eff:.0%}")
        if attack_red and 0.10 <= attack_red <= 0.15: status_list.append(f"✅ Risk: {attack_red:.1%}")
        elif attack_red and attack_red >= 0.08: status_list.append(f"🟡 Risk: {attack_red:.1%}")
        else: status_list.append(f"❌ Risk: {attack_red:.1%}" if attack_red else "❌ Risk: N/A")
        print(" | ".join(status_list))
        
    except FileNotFoundError:
        print(f"N={n}: summary.json not found at {path}")
    except Exception as e:
        print(f"N={n}: Error reading {path}: {e}")
