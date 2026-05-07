from __future__ import annotations

from pathlib import Path
import xml.etree.ElementTree as ET


OUT_DIR = Path("rapidscada_demo/ProjectBaseXML")
ET.register_namespace("xsi", "http://www.w3.org/2001/XMLSchema-instance")
ET.register_namespace("xsd", "http://www.w3.org/2001/XMLSchema")


def indent(elem: ET.Element, level: int = 0) -> None:
    i = "\n" + level * "  "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + "  "
        for child in elem:
            indent(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = i
    if level and (not elem.tail or not elem.tail.strip()):
        elem.tail = i


def text_node(parent: ET.Element, name: str, value: str | int | None, nil: bool = False) -> None:
    node = ET.SubElement(parent, name)
    if nil:
        node.set("{http://www.w3.org/2001/XMLSchema-instance}nil", "true")
    elif value is not None:
        node.text = str(value)


def build_cnl_xml() -> ET.ElementTree:
    root = ET.Element("ArrayOfCnl")

    def add_cnl(
        cnl_num: int,
        name: str,
        obj_num: int,
        device_num: int,
        tag_code: str,
        cnl_type_id: int,
        code: str = "",
        formula_enabled: bool = False,
        in_formula: str = "",
        out_formula: str = "",
        quantity_id: int | None = None,
        unit_id: int | None = None,
        format_id: int | None = None,
        out_format_id: int | None = None,
    ) -> None:
        cnl = ET.SubElement(root, "Cnl")
        text_node(cnl, "CnlNum", cnl_num)
        text_node(cnl, "Active", "true")
        text_node(cnl, "Name", name)
        text_node(cnl, "Code", code)
        text_node(cnl, "DataTypeID", None, nil=True)
        text_node(cnl, "DataLen", None, nil=True)
        text_node(cnl, "CnlTypeID", cnl_type_id)
        text_node(cnl, "ObjNum", obj_num)
        text_node(cnl, "DeviceNum", device_num)
        text_node(cnl, "TagNum", None, nil=True)
        text_node(cnl, "TagCode", tag_code)
        text_node(cnl, "FormulaEnabled", "true" if formula_enabled else "false")
        text_node(cnl, "InFormula", in_formula)
        text_node(cnl, "OutFormula", out_formula)
        text_node(cnl, "FormatID", format_id if format_id is not None else None, nil=format_id is None)
        text_node(cnl, "OutFormatID", out_format_id if out_format_id is not None else None, nil=out_format_id is None)
        text_node(cnl, "QuantityID", quantity_id if quantity_id is not None else None, nil=quantity_id is None)
        text_node(cnl, "UnitID", unit_id if unit_id is not None else None, nil=unit_id is None)
        text_node(cnl, "LimID", None, nil=True)
        text_node(cnl, "ArchiveMask", None, nil=True)
        text_node(cnl, "EventMask", None, nil=True)

    for seq in range(1, 21):
        base = 101 + ((seq - 1) * 3)
        label = f"G{seq:02d}"
        phase = (seq - 1) * 0.35
        voltage_formula = f"230 + {1.8 + ((seq - 1) % 3) * 0.2:.2f} * Sin(Now() * 40 + {phase:.2f})"
        current_formula = f"13 + {2.2 + ((seq - 1) % 4) * 0.25:.2f} * Cos(Now() * 38 + {phase:.2f})"
        anomaly_formula = f"Abs(Sin(Now() * 12 + {phase:.2f})) * {0.22 + ((seq - 1) % 3) * 0.04:.2f}"
        add_cnl(base, f"{label} Voltage", seq, seq, f"{label}_VOL", 3, formula_enabled=True, in_formula=voltage_formula)
        add_cnl(base + 1, f"{label} Current", seq, seq, f"{label}_CUR", 3, formula_enabled=True, in_formula=current_formula)
        add_cnl(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", 3, formula_enabled=True, in_formula=anomaly_formula)

    for seq in range(21, 51):
        base = 201 + ((seq - 21) * 3)
        label = f"S{seq:02d}"
        phase = (seq - 21) * 0.27
        load_formula = f"170 + {22 + ((seq - 21) % 5) * 4:.2f} * Sin(Now() * 24 + {phase:.2f})"
        latency_formula = f"3.2 + Abs(Cos(Now() * 16 + {phase:.2f})) * {1.1 + ((seq - 21) % 4) * 0.2:.2f}"
        anomaly_formula = f"Abs(Sin(Now() * 9 + {phase:.2f})) * {0.18 + ((seq - 21) % 3) * 0.05:.2f}"
        add_cnl(base, f"{label} Load", seq, seq, f"{label}_LOD", 3, formula_enabled=True, in_formula=load_formula)
        add_cnl(base + 1, f"{label} Latency", seq, seq, f"{label}_LAT", 3, formula_enabled=True, in_formula=latency_formula)
        add_cnl(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", 3, formula_enabled=True, in_formula=anomaly_formula)

    for seq in range(51, 76):
        base = 301 + ((seq - 51) * 3)
        label = f"P{seq:02d}"
        phase = (seq - 51) * 0.21
        voltage_formula = f"230 + {1.2 + ((seq - 51) % 4) * 0.15:.2f} * Sin(Now() * 28 + {phase:.2f})"
        frequency_formula = f"50 + Sin(Now() * 18 + {phase:.2f}) * {0.04 + ((seq - 51) % 3) * 0.005:.3f}"
        anomaly_formula = f"Abs(Cos(Now() * 10 + {phase:.2f})) * {0.12 + ((seq - 51) % 4) * 0.03:.2f}"
        add_cnl(base, f"{label} Voltage", seq, seq, f"{label}_VOL", 3, formula_enabled=True, in_formula=voltage_formula)
        add_cnl(base + 1, f"{label} Frequency", seq, seq, f"{label}_FRQ", 3, formula_enabled=True, in_formula=frequency_formula)
        add_cnl(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", 3, formula_enabled=True, in_formula=anomaly_formula)

    for seq in range(76, 101):
        base = 401 + ((seq - 76) * 3)
        label = f"B{seq:02d}"
        phase = (seq - 76) * 0.45
        status_formula = f"Abs(Sin(Now() * 6 + {phase:.2f})) > 0.14 ? 1 : 0"
        fault_formula = f"Abs(Sin(Now() * 6 + {phase:.2f})) > 0.14 ? 0 : 1"
        anomaly_formula = f"Abs(Sin(Now() * 6 + {phase:.2f})) > 0.14 ? 0.12 : 0.88"
        add_cnl(base, f"{label} Status", seq, seq, f"{label}_STA", 3, formula_enabled=True, in_formula=status_formula, format_id=21)
        add_cnl(base + 1, f"{label} Fault Count", seq, seq, f"{label}_FLT", 3, formula_enabled=True, in_formula=fault_formula)
        add_cnl(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", 3, formula_enabled=True, in_formula=anomaly_formula)

    indent(root)
    return ET.ElementTree(root)


def build_obj_xml() -> ET.ElementTree:
    root = ET.Element("ArrayOfObj")

    def add_obj(obj_num: int, name: str, code: str, parent: int | None) -> None:
        obj = ET.SubElement(root, "Obj")
        text_node(obj, "ObjNum", obj_num)
        text_node(obj, "Name", name)
        text_node(obj, "Code", code)
        text_node(obj, "ParentObjNum", parent if parent is not None else None, nil=parent is None)

    add_obj(1000, "SmartGrid", "GRID", None)
    for seq in range(1, 21):
        add_obj(seq, f"Generator {seq:02d}", f"G{seq:02d}", 1000)
    for seq in range(21, 51):
        add_obj(seq, f"Substation {seq:02d}", f"S{seq:02d}", 1000)
    for seq in range(51, 76):
        add_obj(seq, f"PMU {seq:02d}", f"P{seq:02d}", 1000)
    for seq in range(76, 101):
        add_obj(seq, f"Breaker {seq:02d}", f"B{seq:02d}", 1000)

    indent(root)
    return ET.ElementTree(root)


def build_device_xml() -> ET.ElementTree:
    root = ET.Element("ArrayOfDevice")

    def add_device(device_num: int, name: str, code: str, dev_type_id: int, comm_line_num: int) -> None:
        device = ET.SubElement(root, "Device")
        text_node(device, "DeviceNum", device_num)
        text_node(device, "Name", name)
        text_node(device, "Code", code)
        text_node(device, "DevTypeID", dev_type_id)
        text_node(device, "NumAddress", None, nil=True)
        text_node(device, "StrAddress", "")
        text_node(device, "CommLineNum", comm_line_num)
        text_node(device, "Descr", "")

    for seq in range(1, 21):
        add_device(seq, f"Generator {seq:02d} Simulator", f"G{seq:02d}", 230, 1)
    for seq in range(21, 51):
        add_device(seq, f"Substation {seq:02d} Simulator", f"S{seq:02d}", 230, 2)
    for seq in range(51, 76):
        add_device(seq, f"PMU {seq:02d} Simulator", f"P{seq:02d}", 230, 3)
    for seq in range(76, 101):
        add_device(seq, f"Breaker {seq:02d} Simulator", f"B{seq:02d}", 230, 4)

    indent(root)
    return ET.ElementTree(root)


def build_commline_xml() -> ET.ElementTree:
    root = ET.Element("ArrayOfCommLine")
    for idx, name in enumerate(
        ["Generator Line", "Substation Line", "PMU Line", "Breaker Line"],
        start=1,
    ):
        line = ET.SubElement(root, "CommLine")
        text_node(line, "CommLineNum", idx)
        text_node(line, "Name", name)
        text_node(line, "Descr", "")

    indent(root)
    return ET.ElementTree(root)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_cnl_xml().write(OUT_DIR / "Cnl.xml", encoding="utf-8", xml_declaration=True)
    build_obj_xml().write(OUT_DIR / "Obj.xml", encoding="utf-8", xml_declaration=True)
    build_device_xml().write(OUT_DIR / "Device.xml", encoding="utf-8", xml_declaration=True)
    build_commline_xml().write(OUT_DIR / "CommLine.xml", encoding="utf-8", xml_declaration=True)
    print(f"Wrote Rapid SCADA BaseXML pack to {OUT_DIR}")


if __name__ == "__main__":
    main()
