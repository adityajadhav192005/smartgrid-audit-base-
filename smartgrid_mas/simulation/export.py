"""
Export utilities for simulation results

CSV export for metrics and event logs.
"""

from __future__ import annotations
from typing import List, Dict, Any
import pandas as pd


def export_records_csv(records: List[Dict[str, Any]], path: str) -> None:
    """
    Export metrics or events to CSV.
    
    Args:
        records: List of dict records (metrics or events)
        path: Output CSV path
    """
    pd.DataFrame(records).to_csv(path, index=False)
    print(f"Exported {len(records)} records to {path}")
