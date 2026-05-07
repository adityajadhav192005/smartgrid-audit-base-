from __future__ import annotations

from pathlib import Path


OUT_PATH = Path("rapidscada_demo/Config/Channels.xml")


def channel_block(
    chan_num: int,
    name: str,
    obj_num: int,
    device_num: int,
    tag_code: str,
    data_type: str,
    unit: str,
    lim_low: str,
    lim_high: str,
    extra: str = "",
) -> str:
    extra_lines = f"\n    {extra}" if extra else ""
    return (
        "  <Channel>\n"
        f"    <ChanNum>{chan_num}</ChanNum><Name>{name}</Name><ObjNum>{obj_num}</ObjNum><DeviceNum>{device_num}</DeviceNum>\n"
        f"    <TagCode>{tag_code}</TagCode><DataType>{data_type}</DataType><Unit>{unit}</Unit>{extra_lines}\n"
        f"    <LimLow>{lim_low}</LimLow><LimHigh>{lim_high}</LimHigh>\n"
        "  </Channel>\n"
    )


def build_channels_xml() -> str:
    lines: list[str] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<!--",
        "  Rapid SCADA Channel Definitions - SmartGridAudit Project",
        "  Import via: Configuration -> Channels -> Import -> From XML",
        "",
        "  300 channels total:",
        "    G01-G20  : Generators   (20 agents x 3 channels = 60)",
        "    S21-S50  : Substations  (30 agents x 3 channels = 90)",
        "    P51-P75  : PMUs         (25 agents x 3 channels = 75)",
        "    B76-B100 : Breakers     (25 agents x 3 channels = 75)",
        "-->",
        "<Channels>",
        "",
        "  <!-- Generators G01-G20 -->",
        "",
    ]

    for seq in range(1, 21):
        base = 101 + (seq - 1) * 3
        label = f"G{seq:02d}"
        lines.append(channel_block(base, f"{label} Voltage", seq, seq, f"{label}_VOL", "Double", "V", "220", "240", "<Formula>1</Formula><Signal>3</Signal><Archive>1</Archive>").rstrip())
        lines.append(channel_block(base + 1, f"{label} Current", seq, seq, f"{label}_CUR", "Double", "A", "0", "120").rstrip())
        lines.append(channel_block(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", "Double", "score", "0", "2").rstrip())
        lines.append("")

    lines.extend([
        "  <!-- Substations S21-S50 -->",
        "",
    ])

    for seq in range(21, 51):
        base = 201 + (seq - 21) * 3
        label = f"S{seq:02d}"
        lines.append(channel_block(base, f"{label} Load", seq, seq, f"{label}_LOD", "Double", "kW", "0", "500").rstrip())
        lines.append(channel_block(base + 1, f"{label} Latency", seq, seq, f"{label}_LAT", "Double", "ms", "0", "150").rstrip())
        lines.append(channel_block(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", "Double", "score", "0", "2").rstrip())
        lines.append("")

    lines.extend([
        "  <!-- PMUs P51-P75 -->",
        "",
    ])

    for seq in range(51, 76):
        base = 301 + (seq - 51) * 3
        label = f"P{seq:02d}"
        lines.append(channel_block(base, f"{label} Voltage", seq, seq, f"{label}_VOL", "Double", "V", "220", "240").rstrip())
        lines.append(channel_block(base + 1, f"{label} Frequency", seq, seq, f"{label}_FRQ", "Double", "Hz", "49.5", "50.5").rstrip())
        lines.append(channel_block(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", "Double", "score", "0", "2").rstrip())
        lines.append("")

    lines.extend([
        "  <!-- Breakers B76-B100 -->",
        "",
    ])

    for seq in range(76, 101):
        base = 401 + (seq - 76) * 3
        label = f"B{seq:02d}"
        lines.append(channel_block(base, f"{label} Status", seq, seq, f"{label}_STA", "Integer", "0/1", "0", "1").rstrip())
        lines.append(channel_block(base + 1, f"{label} Fault Count", seq, seq, f"{label}_FLT", "Integer", "count", "0", "100").rstrip())
        lines.append(channel_block(base + 2, f"{label} Anomaly Score", seq, seq, f"{label}_ANO", "Double", "score", "0", "2").rstrip())
        lines.append("")

    lines.append("</Channels>")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(build_channels_xml(), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
