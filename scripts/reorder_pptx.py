from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
import xml.etree.ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"


def reorder_pptx(src: Path, dst: Path, order: list[int]) -> None:
    tmp = dst.parent / "_pptx_reorder_tmp"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)
    try:
        with ZipFile(src, "r") as zin:
            zin.extractall(tmp)

        presentation_xml = tmp / "ppt" / "presentation.xml"
        tree = ET.parse(presentation_xml)
        root = tree.getroot()
        sld_id_lst = root.find(f"{{{P_NS}}}sldIdLst")
        if sld_id_lst is None:
            raise RuntimeError("Could not find sldIdLst in presentation.xml")

        slides = list(sld_id_lst)
        if len(slides) < max(order):
            raise ValueError(f"Requested slide index exceeds slide count ({len(slides)})")

        reordered = [slides[i - 1] for i in order]
        sld_id_lst[:] = reordered
        tree.write(presentation_xml, encoding="utf-8", xml_declaration=True)

        if dst.exists():
            dst.unlink()
        with ZipFile(dst, "w", ZIP_DEFLATED) as zout:
            for file in sorted(tmp.rglob("*")):
                if file.is_file():
                    zout.write(file, file.relative_to(tmp).as_posix())
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = root / "Diagram" / "Final ppt.pptx"
    dst = root / "Diagram" / "Final_ppt_cleaned_30.pptx"

    order = [
        1,  # Title
        2,  # Problem Statement
        3,  # Motivation
        4,  # Objectives
        5,  # Research Gap
        6,  # Base Paper Overview
        7,  # Base Paper Limitations
        8,  # Proposed System Overview
        9,  # System Architecture
        10, # Two-Workspace Design
        11, # Rapid SCADA Integration
        12, # 100-Agent SCADA Grid
        13, # Algorithm Overview / live-vs-simulated note is already embedded in nearby slides
        14, # Algorithm Flow
        15, # Feature Categories and Baseline Mapping
        18, # Mathematical Formulations and Methodology
        17, # Evaluation Metrics
        19, # Audit Decision Logic
        20, # Explainability
        21, # Implementation Stack
        22, # Testing and Validation
        23, # Live SCADA Validation
        24, # Primary Thesis Result
        25, # Base Paper vs Proposed System
        26, # Scaled Results
        27, # Discussion
        28, # Limitations
        29, # Conclusion
        30, # Future Work
        31, # Thank You
    ]

    reorder_pptx(src, dst, order)
    print(dst)


if __name__ == "__main__":
    main()
