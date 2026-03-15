import json

for n in [100, 200, 500]:
    path = f'logs/N{n}/summary.json'
    with open(path) as f:
        s = json.load(f)
    
    print(f"\n{'='*60}")
    print(f"N={n}")
    print(f"{'='*60}")
    print(f"Baseline Cost (fixed f=1):       ${s.get('executed_cost_baseline', 0):.2f}")
    print(f"Dynamic Cost (RL audit):         ${s.get('executed_cost_dynamic', 0):.2f}")
    print(f"Cost Efficiency:                 {s.get('cost_efficiency', 0):.2%}")
    print()
    print(f"Baseline Coverage:               {s.get('coverage_baseline', 0):.1%}")
    print(f"Dynamic Coverage:                {s.get('coverage_dynamic', 0):.1%}")
    print()
    print(f"Risk Mitigation:                 {s.get('attack_reduction', 0):.2%}")
    print()
    
    # Compute ratio
    base = s.get('executed_cost_baseline', 1)
    dyn = s.get('executed_cost_dynamic', 0)
    ratio = dyn / base if base > 0 else 0
    print(f"Cost Ratio (Dynamic/Baseline):   {ratio:.2f}x")
    print(f"To achieve +60% efficiency:      Need ~0.40x baseline cost")
    
