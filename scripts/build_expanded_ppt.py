from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
import xml.etree.ElementTree as ET
import copy


PML = "http://schemas.openxmlformats.org/presentationml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
ODREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DML = "http://schemas.openxmlformats.org/drawingml/2006/main"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

NS = {
    "p": PML,
    "r": ODREL,
    "a": DML,
    "rel": REL,
    "ct": CT_NS,
}


def qn(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def duplicate_evidence_slide(
    tmp: Path,
    template_slide_no: int,
    new_slide_no: int,
    image_src: Path,
    image_target_name: str,
    title: str,
) -> None:
    slide_src = tmp / "ppt" / "slides" / f"slide{template_slide_no}.xml"
    rels_src = tmp / "ppt" / "slides" / "_rels" / f"slide{template_slide_no}.xml.rels"
    slide_dst = tmp / "ppt" / "slides" / f"slide{new_slide_no}.xml"
    rels_dst = tmp / "ppt" / "slides" / "_rels" / f"slide{new_slide_no}.xml.rels"

    shutil.copy2(slide_src, slide_dst)
    shutil.copy2(rels_src, rels_dst)

    media_dst = tmp / "ppt" / "media" / image_target_name
    shutil.copy2(image_src, media_dst)

    rels_tree = ET.parse(rels_dst)
    rels_root = rels_tree.getroot()
    first_image_rel = None
    for rel in rels_root.findall(qn(REL, "Relationship")):
        if rel.attrib.get("Type", "").endswith("/image"):
            first_image_rel = rel
            break
    if first_image_rel is None:
        raise RuntimeError(f"No image relationship found in template slide {template_slide_no}")
    first_image_rel.set("Target", f"../media/{image_target_name}")
    rels_tree.write(rels_dst, encoding="utf-8", xml_declaration=True)

    slide_tree = ET.parse(slide_dst)
    slide_root = slide_tree.getroot()
    sp_tree = slide_root.find(".//p:spTree", NS)
    if sp_tree is None:
        raise RuntimeError("Could not find spTree")

    text_shapes = []
    for sp in sp_tree.findall("p:sp", NS):
        texts = sp.findall(".//a:t", NS)
        if any((t.text or "").strip() for t in texts):
            text_shapes.append((sp, texts))

    if not text_shapes:
        raise RuntimeError("No text shapes found in template slide")

    title_shape, title_texts = text_shapes[0]
    for i, t in enumerate(title_texts):
        t.text = title if i == 0 else ""

    for sp, _ in text_shapes[1:]:
        sp_tree.remove(sp)

    slide_tree.write(slide_dst, encoding="utf-8", xml_declaration=True)


def append_slide_to_presentation(tmp: Path, slide_no: int) -> None:
    pres_rels = tmp / "ppt" / "_rels" / "presentation.xml.rels"
    pres_xml = tmp / "ppt" / "presentation.xml"
    ct_xml = tmp / "[Content_Types].xml"

    rels_tree = ET.parse(pres_rels)
    rels_root = rels_tree.getroot()
    existing_rel_nums = []
    for rel in rels_root.findall(qn(REL, "Relationship")):
        rid = rel.attrib.get("Id", "")
        if rid.startswith("rId") and rid[3:].isdigit():
            existing_rel_nums.append(int(rid[3:]))
    next_rid_num = max(existing_rel_nums) + 1
    next_rid = f"rId{next_rid_num}"
    rel_elem = ET.Element(
        qn(REL, "Relationship"),
        {
            "Id": next_rid,
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
            "Target": f"slides/slide{slide_no}.xml",
        },
    )
    rels_root.append(rel_elem)
    rels_tree.write(pres_rels, encoding="utf-8", xml_declaration=True)

    pres_tree = ET.parse(pres_xml)
    pres_root = pres_tree.getroot()
    sld_id_lst = pres_root.find(qn(PML, "sldIdLst"))
    if sld_id_lst is None:
        raise RuntimeError("Could not find sldIdLst")
    existing_ids = [int(el.attrib["id"]) for el in sld_id_lst.findall(qn(PML, "sldId"))]
    next_sld_id = max(existing_ids) + 1
    sld_elem = ET.Element(qn(PML, "sldId"), {"id": str(next_sld_id), qn(ODREL, "id"): next_rid})
    sld_id_lst.append(sld_elem)
    pres_tree.write(pres_xml, encoding="utf-8", xml_declaration=True)

    ct_tree = ET.parse(ct_xml)
    ct_root = ct_tree.getroot()
    override_path = f"/ppt/slides/slide{slide_no}.xml"
    exists = any(
        el.attrib.get("PartName") == override_path
        for el in ct_root.findall(qn(CT_NS, "Override"))
    )
    if not exists:
        ct_root.append(
            ET.Element(
                qn(CT_NS, "Override"),
                {
                    "PartName": override_path,
                    "ContentType": "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
                },
            )
        )
        ct_tree.write(ct_xml, encoding="utf-8", xml_declaration=True)


def reorder_presentation(tmp: Path, final_slide_numbers: list[int]) -> None:
    pres_xml = tmp / "ppt" / "presentation.xml"
    pres_rels = tmp / "ppt" / "_rels" / "presentation.xml.rels"

    rels_tree = ET.parse(pres_rels)
    rels_root = rels_tree.getroot()
    target_to_rid = {}
    for rel in rels_root.findall(qn(REL, "Relationship")):
        target = rel.attrib.get("Target", "")
        import re
        m = re.fullmatch(r"slides/slide(\d+)\.xml", target)
        if m:
            slide_no = int(m.group(1))
            target_to_rid[slide_no] = rel.attrib["Id"]

    pres_tree = ET.parse(pres_xml)
    pres_root = pres_tree.getroot()
    sld_id_lst = pres_root.find(qn(PML, "sldIdLst"))
    if sld_id_lst is None:
        raise RuntimeError("Could not find sldIdLst")

    rid_to_elem = {el.attrib[qn(ODREL, "id")]: el for el in sld_id_lst.findall(qn(PML, "sldId"))}
    reordered = [rid_to_elem[target_to_rid[n]] for n in final_slide_numbers]
    sld_id_lst[:] = reordered
    pres_tree.write(pres_xml, encoding="utf-8", xml_declaration=True)


def build_expanded_ppt(src: Path, dst: Path) -> None:
    tmp = dst.parent / "_pptx_expand_tmp"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)

    evidence = [
        ("Capability Comparison: Base Paper vs Proposed Framework", "basepaper_extension_matrix.png"),
        ("Development Progress of the SmartGrid AI Audit Framework", "development_timeline.png"),
        ("Asset and Topology View of the 100-Agent Model", "topology_view.png"),
        ("Explainability Evidence: Feature Contribution Snapshot", "xai_anomaly_view.png"),
        ("System Health and Pipeline Monitoring", "system_health.png"),
        ("Live Agent Verification: 100 Active, 0 Non-Live", "live_agent_trace2.png"),
        ("Audit Monitoring Snapshot from Rapid SCADA Live", "audit_trail.png"),
        ("Rapid SCADA Response Workflow", "response_mitigation.png"),
        ("Rapid SCADA Risk Analytics Dashboard", "risk_analytics.png"),
    ]

    try:
        with ZipFile(src, "r") as zin:
            zin.extractall(tmp)

        template_slide_no = 9
        start_slide_no = 32
        for i, (title, image_name) in enumerate(evidence, start=start_slide_no):
            image_path = src.parent / image_name
            duplicate_evidence_slide(
                tmp=tmp,
                template_slide_no=template_slide_no,
                new_slide_no=i,
                image_src=image_path,
                image_target_name=f"evidence_{i}{image_path.suffix.lower()}",
                title=title,
            )
            append_slide_to_presentation(tmp, i)

        final_order = [
            1, 2, 3, 4, 5, 6, 7,
            32, 33,
            8, 9, 10, 11, 12,
            34,
            13, 14, 15, 18, 17, 19, 20,
            35,
            21, 36, 22, 23, 37, 24, 25, 26, 38, 39, 40,
            27, 28, 29, 30, 31,
        ]
        reorder_presentation(tmp, final_order)

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
    dst = root / "Diagram" / "Final_ppt_expanded_40.pptx"
    build_expanded_ppt(src, dst)
    print(dst)


if __name__ == "__main__":
    main()
