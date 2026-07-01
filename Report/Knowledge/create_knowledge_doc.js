const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat, TableOfContents } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Calibri", size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 28 : 24 })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size: 22, ...opts })]
  });
}

function boldPara(label, text) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [
      new TextRun({ text: label, bold: true, font: "Calibri", size: 22 }),
      new TextRun({ text, font: "Calibri", size: 22 })
    ]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size: 22 })]
  });
}

function makeRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders,
      margins: cellMargins,
      shading: isHeader ? { fill: "1F3664", type: ShadingType.CLEAR } : undefined,
      width: { size: c.width || 3120, type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({
          text: c.text,
          bold: isHeader,
          font: "Calibri",
          size: 20,
          color: isHeader ? "FFFFFF" : "262626"
        })]
      })]
    }))
  });
}

function simpleTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      makeRow(headers.map((h, i) => ({ text: h, width: colWidths[i] })), true),
      ...rows.map(row => makeRow(row.map((r, i) => ({ text: r, width: colWidths[i] }))))
    ]
  });
}

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }, {
        level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1440, hanging: 360 } } }
      }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri", color: "1F3664" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: "2B5797" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: "333333" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "SmartGrid AI Audit Framework | Complete Project Knowledge", italics: true, font: "Calibri", size: 18, color: "888888" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Page ", font: "Calibri", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18 })]
        })]
      })
    },
    children: [
      // TITLE PAGE
      new Paragraph({ spacing: { before: 3000 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "SmartGrid AI Audit Framework", font: "Calibri", size: 52, bold: true, color: "1F3664" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: "Cyber-Physical Monitoring and Audit Intelligence", font: "Calibri", size: 32, color: "2B5797" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: "COMPLETE PROJECT KNOWLEDGE DOCUMENT", font: "Calibri", size: 28, bold: true, color: "333333" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: "A-Z Reference: Architecture, Algorithms, Datasets, Results, and Implementation", font: "Calibri", size: 22, color: "666666" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [new TextRun({ text: "Aditya Sanjay Jadhav (242050010)", font: "Calibri", size: 24 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Guide: Prof. Shrinivas Khedkar", font: "Calibri", size: 24 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new TextRun({ text: "Dept. of Computer Engineering & IT | VJTI Mumbai", font: "Calibri", size: 22, color: "666666" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new TextRun({ text: "M.Tech 2025-26", font: "Calibri", size: 22, color: "666666" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // TABLE OF CONTENTS
      heading("Table of Contents", HeadingLevel.HEADING_1),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 1: PROJECT OVERVIEW =====
      heading("1. Project Overview", HeadingLevel.HEADING_1),
      para("The SmartGrid AI Audit Framework is an end-to-end cyber-physical security monitoring and audit scheduling system designed for modern smart electricity grids. It detects three categories of cyber attack (False Data Injection, Denial of Service, Man-in-the-Middle), schedules security audits dynamically based on risk, explains every detection decision to the operator, and runs against a live SCADA platform with 100 grid agents."),

      heading("1.1 What Problem Does It Solve?", HeadingLevel.HEADING_2),
      para("Modern power grids are no longer isolated physical systems. They use SCADA (Supervisory Control and Data Acquisition) systems, intelligent electronic devices, phasor measurement units (PMUs), and smart meters, all connected via communication networks. This connectivity enables real-time monitoring and efficient operation, but it also creates an attack surface that adversaries can exploit."),
      bullet("Single-layer detection methods (thresholds, CUSUM, EWMA) cannot distinguish physical noise from deliberate attacks"),
      bullet("Machine learning methods (Isolation Forest, One-Class SVM) have high false-positive rates on mixed agent populations"),
      bullet("LSTM models tuned for low false alarms miss up to 75% of stealthy attacks"),
      bullet("No prior system couples detection to dynamic audit scheduling"),
      bullet("No prior system runs against live SCADA data"),
      bullet("No prior system provides per-feature explainability for every alert"),

      heading("1.2 What Was Built", HeadingLevel.HEADING_2),
      bullet("A three-layer anomaly detection pipeline (statistical + LSTM + attack-specific sub-detectors)"),
      bullet("A hybrid audit scheduler (tabular Q-learning + gradient descent cost optimisation)"),
      bullet("A feature-level explainability module (top-5 contributing features per alert)"),
      bullet("Live integration with Rapid SCADA v6 via a PowerShell bridge"),
      bullet("An eight-view Next.js operator dashboard for real-time monitoring"),
      bullet("Complete evaluation: 100 agents, 24h simulation, 28,800 steps, 3 attack types, 10 seeds"),

      heading("1.3 Base Paper", HeadingLevel.HEADING_2),
      boldPara("Reference: ", "Priyadarsini S. (2025). AI-Driven Audit Framework for Distributed Multi-Agent Smart Grids. ACM Trans. Cyber-Physical Systems."),
      para("The base paper uses single-layer deviation scoring with Q-learning-only scheduling. It achieves 98.4% accuracy, 3.2% FPR, 87.9% risk mitigation, 42.5% cost efficiency, and 93.8% audit coverage. It has no multi-layer detection, no live SCADA, no explainability, and no method comparison."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 2: SYSTEM ARCHITECTURE =====
      heading("2. System Architecture", HeadingLevel.HEADING_1),
      para("The framework operates across two workspaces sharing a common FastAPI backend:"),
      bullet("Simulation Workspace: generates synthetic telemetry, injects attacks, runs controlled experiments"),
      bullet("Live SCADA Workspace: connects to Rapid SCADA v6 with 100 real-time calculated channels"),

      heading("2.1 Five-Tier Data Flow", HeadingLevel.HEADING_2),
      simpleTable(
        ["Tier", "Name", "Function"],
        [
          ["1", "Data", "Rapid SCADA or simulation engine generates raw telemetry"],
          ["2", "Ingestion", "PowerShell bridge (5s polling) or sim loop delivers JSON batches to FastAPI"],
          ["3", "Detection", "Multi-layer pipeline scores each agent: binary flag + attack type + confidence + XAI"],
          ["4", "Scheduling", "Hybrid Q-learning + gradient descent outputs per-agent audit frequencies under budget"],
          ["5", "Presentation", "Next.js dashboard displays 8 views via REST + WebSocket push"]
        ],
        [800, 1800, 6760]
      ),

      heading("2.2 Agent Types and Threat Mapping", HeadingLevel.HEADING_2),
      para("The system models N=100 autonomous grid agents across four types:"),
      simpleTable(
        ["Type", "IDs", "Count", "Key Features", "Primary Threat"],
        [
          ["GEN", "01-20", "20", "Voltage (230V), Current (100A), Power (23kW)", "FDI"],
          ["SUB", "21-50", "30", "Voltage, Power, Frequency (50Hz)", "MITM"],
          ["PMU", "51-75", "25", "Voltage, Current, Frequency, Power", "DoS"],
          ["BRK", "76-100", "25", "State (0/1), Power (0kW)", "Fault"]
        ],
        [900, 1200, 900, 3800, 1560]
      ),
      para("Each agent contributes 3 calculated channels to Rapid SCADA (300 total). Features are split into 3 physical + 4 cyber = 7 features per agent, processed separately by the dual-branch LSTM."),

      heading("2.3 Implementation Stack", HeadingLevel.HEADING_2),
      bullet("Backend: Python 3.11, FastAPI 0.110, Uvicorn 0.29, Pydantic v2 (36 REST + 1 WebSocket endpoint)"),
      bullet("ML: PyTorch 2.2, NumPy 1.26, SciPy 1.12 (dual-branch LSTM, ~180K params, 2 MB on disk, CPU only)"),
      bullet("Database: SQLite 3.45 (hash-chained audit ledger with SHA-256)"),
      bullet("SCADA: Rapid SCADA v6, PowerShell bridge (~830 lines) polling every 5 seconds"),
      bullet("Frontend: TypeScript 5.3, Next.js 14.2, React 18.3, Recharts 2.12, Tailwind CSS 3.4"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 3: THREAT MODEL =====
      heading("3. Threat Model", HeadingLevel.HEADING_1),
      para("The adversary has partial insider knowledge: knows agent identifiers and approximate operating baselines but does not know detection thresholds or Q-table state. This models an attacker who has done passive reconnaissance (e.g., monitoring unencrypted Modbus/DNP3 traffic) but has not penetrated the security back-end."),

      heading("3.1 False Data Injection (FDI)", HeadingLevel.HEADING_2),
      bullet("Target: GEN-01 through GEN-20 (generators)"),
      bullet("Method: +15% voltage bias on physical readings"),
      bullet("Timing: hours 0, 4, 8, 12, 16, 20 of the 24-hour run"),
      bullet("Design: stays below single-step detection threshold but accumulates statistical significance over multi-step windows"),
      bullet("Why generators: voltage and power readings feed directly into economic dispatch; biasing them can cause unnecessary load shedding"),

      heading("3.2 Denial of Service (DoS)", HeadingLevel.HEADING_2),
      bullet("Target: 5 random PMUs from PMU-51 to PMU-75 per event"),
      bullet("Method: cyber telemetry (latency, packet loss, comm frequency) forced to blackout profile for 30 consecutive steps"),
      bullet("Timing: Poisson process with mean inter-arrival 4 hours"),
      bullet("Why PMUs: loss of PMU data has outsized effect on state estimation accuracy"),

      heading("3.3 Man-in-the-Middle (MITM)", HeadingLevel.HEADING_2),
      bullet("Target: SUB-21 through SUB-50 (substations)"),
      bullet("Method: integrity score reduced 35%+ from baseline; physical-feature delta exceeds rate-of-change limit"),
      bullet("Timing: irregular intervals to avoid periodic detection"),
      bullet("Why substations: their gateway function makes them the natural interception point"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 4: DETECTION PIPELINE =====
      heading("4. Multi-Layer Detection Pipeline", HeadingLevel.HEADING_1),
      para("At every time step, the pipeline receives each agent's 7-feature vector and returns: (a) binary anomaly flag, (b) attack-type label {FDI, DOS, MITM, FAULT, NORMAL}, (c) confidence score in [0,1], (d) ranked top-5 feature attribution vector."),

      heading("4.1 Layer A: Statistical Deviation Scoring", HeadingLevel.HEADING_2),
      para("Based on Priyadarsini et al., extended with per-agent-type baselines. Each agent maintains a rolling baseline of W=200 normal-labelled steps."),
      boldPara("Physical deviation: ", "d_x = sqrt( (1/|F_x|) * sum( ((x_j - b_xj) / theta_xj)^2 ) )"),
      boldPara("Cyber deviation: ", "d_y = sqrt( (1/|F_y|) * sum( ((y_k - b_yk) / theta_yk)^2 ) )"),
      boldPara("Composite score: ", "S_i(t) = w_i * (d_x + d_y)"),
      para("Criticality weights: GEN=1.0, PMU=0.8, SUB=0.7, BRK=0.5. Mahalanobis threshold tau=3.60. Requires LSTM probability >= 0.80 to flag."),
      boldPara("Tier-A Suppression Gate: ", "If score ratio S_i(t)/S_mean(t) < 3.5 AND no behavioural signature AND LSTM probability < 0.60, the flag is suppressed. This removes physical-noise transients (thermal cycling, load steps). Result: 47% reduction in false audit escalations."),

      heading("4.2 Layer B: Dual-Branch LSTM", HeadingLevel.HEADING_2),
      bullet("Two parallel branches: grid branch (physical features) + network branch (cyber features)"),
      bullet("Input: sliding window w=12 steps, 7-element feature vector per branch"),
      bullet("Architecture: 2-layer LSTM, 64 hidden units/layer, dropout 0.2"),
      bullet("Fusion: w_grid=0.58, w_net=0.42, projected to sigmoid probability"),
      bullet("Training: 80/20 split, focal binary cross-entropy (gamma=2.0, alpha=0.5), Adam lr=1e-3, 20 epochs, patience 10, batch 64"),
      bullet("Temperature scaling calibration over {0.8, 1.0, 1.2, 1.5, 1.8, 2.2}"),
      boldPara("Temporal Accumulator: ", "If LSTM probability series has 5+ consecutive values >= 0.55 within 6-step window, flag is raised. Catches sustained low-amplitude attacks that never cross the 0.80 single-step bar."),

      heading("4.3 Layer C: Weighted Ensemble Fusion", HeadingLevel.HEADING_2),
      boldPara("Ensemble score: ", "E_i(t) = 0.48 * S_i_norm(t) + 0.52 * p_i(t)"),
      para("Weights chosen by grid search over alpha in {0.30, 0.35, ..., 0.70} minimising FPR+FNR on validation. The LSTM gets slightly higher weight because temporal patterns dominate the attack schedule."),

      heading("4.4 Attack-Specific Sub-Detectors", HeadingLevel.HEADING_2),
      boldPara("FDI CUSUM: ", "Two-sided cumulative sum on physical residuals. S+_t = max(0, S+_{t-1} + r_t - k), S-_t = min(0, S-_{t-1} + r_t + k). k=0.50, alarm threshold h_FDI=4.0 over 8 steps."),
      boldPara("DoS Rule Detector: ", "2-of-3 rule: latency >= 3x baseline, packet loss >= 0.15, comm frequency drop >= 40%. Severity threshold tau_DoS=15."),
      boldPara("MITM Integrity Detector: ", "AND-gate: integrity drop >= 35% from baseline AND temporal z-score >= 2.5 sigma from 8-step rolling mean."),

      heading("4.5 OR-with-Precedence Combiner", HeadingLevel.HEADING_2),
      para("Any layer firing flags the agent. If multiple fire, highest confidence wins. Type-specific labels (FDI, DOS, MITM) take precedence over generic SUSTAINED. Agent flagged by Layer A skips B and C re-evaluation for that step."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 5: HYBRID AUDIT SCHEDULER =====
      heading("5. Hybrid Audit Scheduler", HeadingLevel.HEADING_1),

      heading("5.1 State and Action Space", HeadingLevel.HEADING_2),
      para("State: tuple (b_r, b_t) where b_r in {0,1,2} = risk bin (low/medium/high) and b_t in {0,1,2,3} = agent type. Total: 3x4 = 12 states. Actions: ROUTINE (1 unit), PRIORITY (2 units), CRITICAL (5 units). Budget B=150 per cycle for N=100 agents."),

      heading("5.2 Q-Learning Update", HeadingLevel.HEADING_2),
      boldPara("Bellman: ", "Q(s,a) = Q(s,a) + lr * [ r_aud + gamma * max Q(s',a') - Q(s,a) ]"),
      para("lr=0.1, gamma=0.95, epsilon-greedy: epsilon starts at 1.0, decays at 0.995 to min 0.05."),
      boldPara("Reward: ", "+10 for catching attack in CRITICAL state; -5 for missed attack; -1 per budget unit spent."),

      heading("5.3 Gradient Descent Refinement", HeadingLevel.HEADING_2),
      boldPara("Cost function: ", "C_i(f_i) = C_a * f_i + C_f * (R_i / f_i)"),
      boldPara("Update: ", "f_i = f_i - eta * (C_a - C_f * (R_i / f_i^2))"),
      boldPara("Optimal frequency: ", "f_i* = sqrt(C_f * R_i / C_a), with C_a=1.0, C_f=10.0, eta=0.01, max 200 iterations."),
      para("After refinement, frequencies clipped to [1, 5] and rescaled to stay within budget B."),

      heading("5.4 Convergence Behaviour", HeadingLevel.HEADING_2),
      para("Q-table converged in ~200 episodes. CRITICAL agents received 3.2x more budget than ROUTINE. Converged allocation: ~65 units CRITICAL (13 agents), ~42 PRIORITY (21 agents), ~43 ROUTINE (43 agents), ~49 in reserve."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 6: EXPLAINABILITY =====
      heading("6. Explainability Module (XAI)", HeadingLevel.HEADING_1),
      boldPara("Formula: ", "c_j = [ ((x_j - b_j) / theta_j)^2 / sum( ((x_k - b_k) / theta_k)^2 ) ] * 100%"),
      para("Top-5 features reported per flagged agent with values, baselines, and percentage contributions. Refreshed every detection cycle."),
      boldPara("Example output: ", "\"Agent GEN-07 flagged: voltage deviation 41.2%, latency anomaly 23.1%, packet loss 18.8%; likely FDI attack.\""),
      para("No additional inference passes needed. Computation reuses values already computed in the deviation scoring step. Satisfies NERC CIP audit trail requirements."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 7: DATASETS =====
      heading("7. Datasets and Training", HeadingLevel.HEADING_1),

      heading("7.1 Default: Synthetic Telemetry", HeadingLevel.HEADING_2),
      para("By default the simulation engine generates all data synthetically. Each feature follows a sinusoidal baseline with Gaussian noise: x[j] = baseline + amplitude*sin(2*pi*t/288) + noise. Attack patterns are injected on top. Ground truth labels are written at generation time and withheld from the detector."),

      heading("7.2 Optional: UCI Grid Stability (Physical LSTM)", HeadingLevel.HEADING_2),
      bullet("Source: UCI Machine Learning Repository"),
      bullet("10,000 real power grid observations from a 4-node generator model"),
      bullet("12 features: tau, p, g for each of 4 generators"),
      bullet("Binary label: stabf (1=stable, 0=unstable). 70% stable / 30% unstable"),
      bullet("Used via environment variable at startup to train the Physical LSTM branch"),

      heading("7.3 Optional: UNSW-NB15 Network Intrusion (Cyber LSTM)", HeadingLevel.HEADING_2),
      bullet("Source: UNSW Canberra Cyber Lab (real captured traffic)"),
      bullet("257,675 packets: 82K train + 175K test"),
      bullet("42 raw features engineered down to 4 cyber metrics:"),
      bullet("latency_like = log(1 + dur + tcprtt + synack + ackdat + jitter)", 1),
      bullet("loss_like = log(1 + sloss + dloss + dropped_packets)", 1),
      bullet("integrity_like = log(1 + |sttl - dttl| + byte_asymmetry)", 1),
      bullet("freq_like = log(1 + rate + sload + dload + packets)", 1),
      bullet("Used via environment variable at startup to train the Cyber LSTM branch"),

      heading("7.4 Dual-Branch Fusion Formula", HeadingLevel.HEADING_2),
      para("fused = 0.58 * grid_prob + 0.42 * network_prob + 0.10 * agreement * joint_support - 0.05 * |grid_prob - network_prob| + 0.08 (if both >= 0.85). Threshold: fused > 0.715 triggers ALERT."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 8: EXPERIMENTAL SETUP =====
      heading("8. Experimental Setup", HeadingLevel.HEADING_1),
      simpleTable(
        ["Parameter", "Value"],
        [
          ["Agents (primary)", "N = 100"],
          ["Simulation duration", "24 hours (28,800 steps at 3 sec/step)"],
          ["Normal steps", "28,655 (99.5%)"],
          ["Anomalous steps", "145 (0.5%) - class imbalance ~198:1"],
          ["Attack types", "FDI (72 events), DoS (54), MITM (19)"],
          ["Features per agent", "7 (3 physical + 4 cyber)"],
          ["LSTM training", "Seeds 1-8 train, seeds 9-10 test"],
          ["LSTM optimizer", "Adam, lr=0.001, focal BCE, 20 epochs"],
          ["Q-table", "12 states (3 risk x 4 types), 3 actions"],
          ["Budget", "B = 150 units per cycle"],
          ["Baselines compared", "5 methods on identical data"],
          ["Scales tested", "N = 100, 200, 500"],
          ["Random seeds", "10 independent seeds"],
          ["Hardware", "Intel i7-10750H, 16GB RAM, 512GB SSD"]
        ],
        [3000, 6360]
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 9: RESULTS =====
      heading("9. Results", HeadingLevel.HEADING_1),

      heading("9.1 Primary System Metrics (N=100, 24h)", HeadingLevel.HEADING_2),
      simpleTable(
        ["Metric", "This Work", "Base Paper", "Gain"],
        [
          ["Accuracy", "99.61%", "98.4%", "+1.21 pp"],
          ["False Positive Rate", "0.39%", "3.2%", "-2.81 pp"],
          ["Recall", "100%", "---", "---"],
          ["Precision (24h)", "22.07%", "---", "---"],
          ["F1 (24h)", "36.16%", "---", "---"],
          ["Risk Mitigation", "100%", "87.9%", "+12.1 pp"],
          ["Cost Efficiency", "54.32%", "42.5%", "+11.82 pp"],
          ["Audit Coverage", "100%", "93.8%", "+6.2 pp"],
          ["Avg E2E Latency", "77.23 ms", "---", "---"],
          ["P95 Latency", "103.80 ms", "---", "---"]
        ],
        [2800, 1800, 1800, 2960]
      ),
      para("Note on F1: The 36.16% 24h-cycle F1 reflects extreme class imbalance (145 attacks in 28,800 steps). The per-step F1 from the five-method study is 82.25%, which better reflects per-decision quality."),

      heading("9.2 Per-Attack-Type Detection", HeadingLevel.HEADING_2),
      simpleTable(
        ["Attack", "Recall", "Precision", "F1", "FPR"],
        [
          ["FDI", "100%", "28.4%", "44.2%", "0.21%"],
          ["DoS", "100%", "31.1%", "47.4%", "0.12%"],
          ["MITM", "97.3%", "19.8%", "32.8%", "0.53%"]
        ],
        [1600, 1600, 1600, 1600, 2960]
      ),
      para("FDI caught by CUSUM accumulating +15% voltage bias. DoS caught by 2-of-3 network rule within first 3 steps. MITM misses 2.7% where integrity drop is marginally above 35% threshold."),

      heading("9.3 Five-Method Comparison (Per-Step)", HeadingLevel.HEADING_2),
      simpleTable(
        ["Method", "Accuracy", "FPR", "Recall", "F1"],
        [
          ["Deviation-Only (base paper)", "81.40%", "9.06%", "36.89%", "41.18%"],
          ["LSTM-Only", "86.35%", "0.00%", "22.67%", "36.96%"],
          ["Isolation Forest", "68.85%", "27.95%", "53.92%", "37.92%"],
          ["One-Class SVM", "46.35%", "59.99%", "75.93%", "33.31%"],
          ["Proposed (full system)", "94.23%", "1.81%", "75.76%", "82.25%"]
        ],
        [3000, 1400, 1400, 1400, 2160]
      ),
      para("The proposed system is the only method achieving accuracy >90%, FPR <2%, and F1 >80% simultaneously."),

      heading("9.4 Ablation Study", HeadingLevel.HEADING_2),
      simpleTable(
        ["Configuration", "F1", "Accuracy"],
        [
          ["Full system (all layers)", "82.25%", "94.23%"],
          ["Without Layer A (no deviation)", "36.96%", "86.35%"],
          ["Without Layer B (no LSTM)", "41.18%", "81.40%"],
          ["Without Layer C (no sub-detectors)", "71.20%", "91.10%"],
          ["Without Tier-A suppression", "68.40%", "87.50%"]
        ],
        [4680, 2340, 2340]
      ),
      para("Every layer is essential. Removing any single layer drops F1 by at least 11 percentage points. The Tier-A suppression gate alone accounts for 14 pp of F1."),

      heading("9.5 Scalability", HeadingLevel.HEADING_2),
      simpleTable(
        ["N", "Accuracy", "FPR", "Recall", "Cost Eff.", "Coverage", "Latency"],
        [
          ["100", "99.61%", "0.39%", "100%", "54.32%", "100%", "77 ms"],
          ["200", "99.28%", "0.72%", "75.74%", "63.89%", "99.50%", "164 ms"],
          ["500", "82.85%", "17.63%", "67.83%", "89.45%", "42.80%", "367 ms"]
        ],
        [800, 1300, 1300, 1300, 1300, 1300, 1960]
      ),
      para("Scales smoothly to 200 agents. At 500, LSTM distributional shift + Q-table coarseness + budget starvation cause degradation. Recommended deployment limit: ~200 without further optimisation."),

      heading("9.6 Latency Breakdown (N=100)", HeadingLevel.HEADING_2),
      simpleTable(
        ["Component", "Time"],
        [
          ["SCADA polling (bridge)", "12 ms"],
          ["Mahalanobis scoring", "8 ms"],
          ["LSTM inference", "45 ms"],
          ["Scheduler update", "9 ms"],
          ["Dashboard WebSocket push", "3 ms"],
          ["Total", "77 ms average, 104 ms P95"]
        ],
        [4680, 4680]
      ),

      heading("9.7 Live SCADA Deployment", HeadingLevel.HEADING_2),
      para("Ran full pipeline on Rapid SCADA v6 with 300 channels across 100 agents for 2 hours continuously. All 100 agent IDs (GEN-01 through BRK-100) confirmed active. 2,160 audit records with correct hash-chain linkage, zero chain breaks. 77 ms average latency matching simulation workspace."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 10: OPERATOR DASHBOARD =====
      heading("10. Operator Dashboard", HeadingLevel.HEADING_1),
      para("Next.js 14 single-page application with 8 views across simulation and live SCADA workspaces:"),
      bullet("Operations Overview: headline metrics, anomaly trend chart, top-10 risk-ranked agents"),
      bullet("Agent Monitoring: per-agent risk traces with 4-colour status (green/yellow/orange/red)"),
      bullet("Audit Trail: hash-chained log of all audit decisions, searchable by agent/severity/time"),
      bullet("Risk Analytics: risk score histogram, 24h trend, heatmap by agent type and hour"),
      bullet("Threat Events: live list of detected threats with agent ID, type, confidence, timestamp"),
      bullet("Decision Explainability: feature attribution bar chart, text summary, Q-table action taken"),
      bullet("System Health: backend status, LSTM version, SCADA bridge connectivity, latency percentiles"),
      bullet("Asset Topology: 10x10 grid of agent icons colour-coded by anomaly status, with dependency links"),
      para("Real-time updates via WebSocket on /ws/live endpoint, diff-encoded at each detection cycle (~5 seconds in live workspace)."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 11: KEY FORMULAS =====
      heading("11. Key Formulas Reference", HeadingLevel.HEADING_1),
      simpleTable(
        ["Name", "Formula", "Parameters"],
        [
          ["Physical deviation", "d_x = sqrt((1/|F_x|) * sum(((x_j-b_xj)/theta_xj)^2))", "F_x = physical features"],
          ["Cyber deviation", "d_y = sqrt((1/|F_y|) * sum(((y_k-b_yk)/theta_yk)^2))", "F_y = cyber features"],
          ["Composite score", "S_i(t) = w_i * (d_x + d_y)", "w_i = criticality weight"],
          ["Ensemble fusion", "E_i(t) = 0.48*S_norm + 0.52*p_i(t)", "alpha=0.48, beta=0.52"],
          ["CUSUM upper", "S+_t = max(0, S+_{t-1} + r_t - k)", "k=0.50, h_FDI=4.0"],
          ["CUSUM lower", "S-_t = min(0, S-_{t-1} + r_t + k)", "k=0.50"],
          ["Bellman Q-update", "Q(s,a) += lr*[r + gamma*maxQ(s',a') - Q(s,a)]", "lr=0.1, gamma=0.95"],
          ["Cost function", "C_i(f_i) = C_a*f_i + C_f*(R_i/f_i)", "C_a=1.0, C_f=10.0"],
          ["Optimal frequency", "f_i* = sqrt(C_f*R_i/C_a)", "---"],
          ["Feature attribution", "c_j = ((x_j-b_j)/theta_j)^2 / sum(...) * 100%", "Top-5 reported"]
        ],
        [2200, 4200, 2960]
      ),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 12: LIMITATIONS & FUTURE WORK =====
      heading("12. Limitations and Future Work", HeadingLevel.HEADING_1),

      heading("12.1 Acknowledged Limitations", HeadingLevel.HEADING_2),
      bullet("All telemetry is synthetic (Rapid SCADA calculated channels, not physical RTUs/IEDs)"),
      bullet("LSTM trained on fixed 24h trajectory; shows distributional drift at N=500"),
      bullet("Agent baselines are hand-specified, not learned from operational history"),
      bullet("Q-table uses fixed 12-state discretisation that becomes too coarse above ~200 agents"),
      bullet("24h F1 of 36.16% reflects class imbalance (145/28,800), not model weakness"),

      heading("12.2 Future Directions", HeadingLevel.HEADING_2),
      bullet("Real sensor integration: connect to physical PMUs/IEDs via Modbus or OPC-UA"),
      bullet("Online LSTM adaptation: continual learning on each new 24h window"),
      bullet("Continuous-state scheduler: replace tabular Q-table with deep Q-network"),
      bullet("Adaptive budget scaling: tie B to N and current threat level"),
      bullet("IDS/SIEM integration: replace engineered baselines with live network telemetry"),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 13: GLOSSARY =====
      heading("13. Glossary of Key Terms", HeadingLevel.HEADING_1),
      simpleTable(
        ["Term", "Definition"],
        [
          ["SCADA", "Supervisory Control and Data Acquisition. System for remote monitoring and control of industrial processes."],
          ["FDI", "False Data Injection. Attack that corrupts sensor readings to bias the grid state model."],
          ["DoS", "Denial of Service. Attack that floods or blocks communication channels."],
          ["MITM", "Man-in-the-Middle. Attack that intercepts and modifies messages between two devices."],
          ["PMU", "Phasor Measurement Unit. High-speed sensor measuring voltage/current phase angles."],
          ["LSTM", "Long Short-Term Memory. Recurrent neural network good at learning temporal sequences."],
          ["CUSUM", "Cumulative Sum control chart. Statistical test that detects persistent shifts in a signal."],
          ["Mahalanobis distance", "Distance metric that accounts for feature correlations, unlike Euclidean distance."],
          ["Q-learning", "Reinforcement learning algorithm that learns action values from reward signals."],
          ["Bellman equation", "Recursive formula for updating Q-values based on future expected reward."],
          ["Gradient descent", "Optimisation algorithm that moves parameters in the direction that reduces a cost function."],
          ["XAI", "Explainable AI. Methods that make machine learning decisions human-interpretable."],
          ["Epsilon-greedy", "Exploration strategy: with probability epsilon take random action, otherwise take best known."],
          ["Focal loss", "Modified cross-entropy that down-weights easy examples and focuses on hard ones."],
          ["Temperature scaling", "Post-training calibration that adjusts confidence of model outputs."],
          ["FPR", "False Positive Rate. Fraction of normal samples incorrectly flagged as anomalous."],
          ["F1 score", "Harmonic mean of precision and recall. Balances both error types."],
          ["NERC CIP", "North American Electric Reliability Corporation Critical Infrastructure Protection standards."],
          ["IEC 62443", "International standard for security of industrial automation and control systems."],
          ["Hash chain", "Audit records linked by SHA-256 hashes, ensuring tamper detection."]
        ],
        [2500, 6860]
      ),

      // END
      new Paragraph({ spacing: { before: 600 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "--- End of Document ---", font: "Calibri", size: 22, color: "888888", italics: true })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("D:\\Mtech Main project\\smartgrid-audit-base-\\Report\\Knowledge\\SmartGrid_Complete_Project_Knowledge.docx", buffer);
  console.log("Document 1 created: SmartGrid_Complete_Project_Knowledge.docx");
});
