from smartgrid_mas.config.loader import load_config

def test_load_config():
    cfg = load_config("smartgrid_mas/config/global_config.yaml")
    assert cfg["audit"]["risk_threshold"] == 0.5
    assert cfg["audit"]["audit_budget_ratio"] == 0.07
    assert cfg["audit"]["max_audits_per_cycle"] == 100  # Config has 100 as informational
    assert cfg["rl"]["gamma"] == 0.9
    assert cfg["gradient"]["lr"] == 0.01

if __name__ == "__main__":
    test_load_config()
    print("✓ Config test passed")
