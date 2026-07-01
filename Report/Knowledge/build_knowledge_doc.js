const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
        VerticalAlign, PageBreak, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');

const OUT = 'D:\\Mtech Main project\\smartgrid-audit-base-\\Report\\Knowledge\\SmartGrid_Complete_Project_Knowledge_v2.docx';

// ─── Helpers ───────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' };
const borders = { top: border, bottom: border, left: border, right: border };
const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, size: 28, color: '1F3864' })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, size: 24, color: '2E5A9C' })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, bold: true, size: 22, color: '1F5C99' })] });
}
function body(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, size: 22, ...opts })] });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [new TextRun({ text, size: 22 })]
  });
}
function bold(text) { return new TextRun({ text, bold: true, size: 22 }); }
function mono(text) { return new TextRun({ text, font: 'Consolas', size: 20, color: '8B0000' }); }
function sp(n = 1) { return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun('')] })); }
function sep() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2E5A9C', space: 2 } },
    children: [new TextRun('')]
  });
}
function infoBox(label, color, ...lines) {
  const cells = lines.map(l =>
    new TableRow({ children: [
      new TableCell({ borders, margins: cellPad, shading: { fill: color, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: l, size: 20, italics: true })] })] })
    ]})
  );
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: cells });
}
function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map(c => new TableCell({
      borders, margins: cellPad,
      shading: isHeader ? { fill: '1F3864', type: ShadingType.CLEAR } : { fill: isHeader ? '1F3864' : 'F8F9FA', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, bold: isHeader, color: isHeader ? 'FFFFFF' : '000000' })] })]
    }))
  });
}
function buildTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ children: headers.map((h, i) => new TableCell({
        borders, margins: cellPad, width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: '1F3864', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF' })] })]
      }))}),
      ...rows.map(row => new TableRow({ children: row.map((cell, i) => new TableCell({
        borders, margins: cellPad, width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: 'F8F9FA', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })]
      }))}))
    ]
  });
}

// ─── Document ──────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: 'bullet', text: '○', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]
    }]
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Calibri', color: '1F3864' },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Calibri', color: '2E5A9C' },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Calibri', color: '1F5C99' },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 } }
    },
    children: [

      // ── COVER PAGE ─────────────────────────────────────────────────────
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 240 },
        children: [new TextRun({ text: 'SmartGrid AI Audit Framework', bold: true, size: 48, color: '1F3864' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
        children: [new TextRun({ text: 'Cyber-Physical Monitoring and Audit Intelligence', size: 28, color: '2E5A9C' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 },
        children: [new TextRun({ text: 'COMPLETE PROJECT KNOWLEDGE DOCUMENT (v2)', bold: true, size: 26, color: '444444' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
        children: [new TextRun({ text: 'A-Z Reference: Architecture, Algorithms, Datasets, Results, and Implementation', size: 22, italics: true })] }),
      ...sp(2),
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Aditya Sanjay Jadhav  (242050010)', bold: true, size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Guide: Prof. Shrinivas Khedkar', size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Dept. of Computer Engineering & IT  |  VJTI Mumbai  |  M.Tech 2025-26', size: 22 })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ── SECTION 1 ── PROJECT OVERVIEW ───────────────────────────────────
      h1('1. Project Overview'),
      body('The SmartGrid AI Audit Framework is an end-to-end cyber-physical security monitoring and audit scheduling system designed for modern power grids. It combines multi-layer anomaly detection, hybrid audit scheduling, live SCADA integration, and per-feature explainability into a single unified pipeline.'),
      ...sp(1),

      h2('1.1 What Problem Does It Solve?'),
      body('Modern power grids are no longer isolated physical systems. They use SCADA systems, internet-connected sensors, and two-way communication to operate efficiently. This connectivity creates an attack surface that existing tools cannot adequately defend:'),
      bullet('Single-layer detection methods cannot distinguish physical noise from deliberate attacks'),
      bullet('LSTM models tuned for low false alarms miss up to 77% of stealthy attacks when used alone'),
      bullet('No prior system couples real-time detection to dynamic audit scheduling'),
      bullet('No prior system runs against live SCADA supervisory telemetry end-to-end'),
      bullet('No prior system provides per-feature explainability for every anomaly decision'),
      bullet('Fixed audit schedules waste budget on safe agents and under-audit high-risk ones'),
      ...sp(1),

      h2('1.2 Research Objectives'),
      body('Six formal objectives from Section 1.4 of the report:'),
      bullet('Objective 1: Build a multi-layer anomaly detection pipeline combining statistical deviation, dual-branch LSTM, and rule-based attack-specific classifiers'),
      bullet('Objective 2: Pre-train separate LSTM branches on public domain-specific datasets — UCI Electrical Grid Stability (physical branch) and UNSW-NB15 (cyber branch)'),
      bullet('Objective 3: Design a hybrid audit scheduler combining Q-learning (discrete escalation) with gradient descent (continuous budget allocation)'),
      bullet('Objective 4: Integrate the framework with live Rapid SCADA v6 for real-time 100-agent monitoring'),
      bullet('Objective 5: Provide per-feature XAI explainability for every anomaly flag'),
      bullet('Objective 6: Achieve detection accuracy above 99% with FPR below 1% on a 100-agent 24-hour evaluation'),
      ...sp(1),

      h2('1.3 What Was Built'),
      bullet('A four-layer anomaly detection pipeline (statistical + temporal LSTM + ensemble + attack-specific sub-detectors)'),
      bullet('A hybrid audit scheduler (tabular Q-learning with 4D state space + gradient descent cost optimisation)'),
      bullet('A feature-level explainability module (top-k contributing features per alert, per domain)'),
      bullet('Live integration with Rapid SCADA v6 via a PowerShell bridge (670 calculated channels)'),
      bullet('An eight-view Next.js operator dashboard for real-time monitoring'),
      bullet('Complete evaluation: 100 agents, 24h simulation, 28,800 steps, 3 attack types, 5 seeds'),
      ...sp(1),

      h2('1.4 Base Paper'),
      body('Reference: Priyadarsini S. (2025). AI-Driven Audit Framework for Distributed Multi-Agent Smart Grids. ACM Trans. Cyber-Physical Systems.'),
      body('The base paper uses single-layer deviation scoring with Q-learning-only scheduling. It achieves 98.4% accuracy, 3.2% FPR, 87.9% risk mitigation, 42.5% cost efficiency, and 93.8% audit coverage. It uses no LSTM, no SCADA integration, no explainability, and no benchmark datasets.'),
      ...sp(1),

      h2('1.5 Literature Survey — Five Themes'),
      bullet('Theme 1 — FDI Attacks: Liu et al. (2011) theoretical model; Liang et al. (2017) topology-aware FDI; Musleh et al. (2019) survey. Gap: all treat FDI in isolation, no cyber-layer integration.'),
      bullet('Theme 2 — Network Intrusion: Moustafa & Slay (2015) UNSW-NB15 creation; Hink et al. (2014) smart grid IDS features. Gap: cyber features not mapped to SCADA physical context.'),
      bullet('Theme 3 — SCADA Anomaly Detection: Nader et al. (2014) one-class SVM; Umer et al. (2022) LSTM for SCADA time series. Gap: no dual-domain physical+cyber combined scoring.'),
      bullet('Theme 4 — RL for Audit Scheduling: Huang et al. (2020) Q-learning for IoT resource allocation; Li et al. (2021) RL audit scheduling in cloud. Gap: no hybrid RL+gradient, no 4D contextual state.'),
      bullet('Theme 5 — Explainability in Security AI: Lundberg & Lee (2017) SHAP values; Ribeiro et al. (2016) LIME. Gap: no per-feature XAI for smart grid anomaly detection.'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 2 ── SYSTEM ARCHITECTURE ────────────────────────────────
      h1('2. System Architecture'),
      body('The framework operates across two workspaces sharing a common FastAPI backend:'),
      bullet('Experiment Running Workspace: simulation engine, controlled attack injection, benchmarking'),
      bullet('Rapid SCADA Live Workspace: connects to Rapid SCADA v6 with 670 calculated channels'),
      ...sp(1),

      h2('2.1 Four-Tier Data Flow'),
      bullet('Tier 1 — Data Ingestion: Rapid SCADA (100 agents, 670 channels) or simulation engine → PowerShell bridge → FastAPI backend'),
      bullet('Tier 2 — Feature Processing: Raw SCADA values → per-type baseline normalisation → physical deviation vector (dx) and cyber deviation vector (dy)'),
      bullet('Tier 3 — Detection and Audit Intelligence: Multi-layer anomaly detection + hybrid audit scheduler + XAI explainability'),
      bullet('Tier 4 — Operator Interface: Next.js dashboard, 8 live views across two workspaces'),
      ...sp(1),

      h2('2.2 Agent Types and SCADA Channel Allocation'),
      buildTable(
        ['Class', 'IDs', 'Count', 'Physical Ch', 'Cyber Ch', 'SCADA Physical Range', 'SCADA Cyber Range'],
        [
          ['GEN', 'GEN-01 to GEN-20', '20', '5', '4', '101-160', '501-580'],
          ['SUB', 'SUB-21 to SUB-50', '30', '5', '3', '201-290', '601-690'],
          ['PMU', 'PMU-51 to PMU-75', '25', '5', '4', '301-375', '701-800'],
          ['BRK', 'BRK-76 to BRK-100', '25', '5', '4', '401-475', '801-900'],
        ],
        [900, 1400, 700, 900, 800, 1400, 1260]
      ),
      ...sp(1),

      h2('2.3 Technology Stack'),
      buildTable(
        ['Component', 'Technology', 'Role'],
        [
          ['Backend API', 'FastAPI (Python/ASGI)', 'REST endpoints: /detect, /schedule, /explain, /agents'],
          ['Frontend', 'Next.js (React)', '8-view operator dashboard, two workspaces'],
          ['ML Framework', 'PyTorch (CPU-only)', 'LSTM training, inference, focal loss, temperature calibration'],
          ['Database', 'SQLite (audit_chain.db)', 'Immutable append-only audit trail with SHA-256 hash chaining'],
          ['SCADA Platform', 'Rapid SCADA v6', '670 calculated channels at 127.0.0.1:10109'],
          ['SCADA Bridge', 'PowerShell', 'Web API polling every 5 seconds, JSON batch output'],
        ],
        [1500, 2000, 5860]
      ),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 3 ── BASELINES ───────────────────────────────────────────
      h1('3. Baselines and Normalisation'),
      body('Each of the 4 agent types (GEN, SUB, PMU, BRK) has a separate hand-engineered baseline profile. Baselines define what "normal" looks like for each feature type. Every detection computation is relative to these baselines.'),
      ...sp(1),

      h2('3.1 GEN Baseline Profile (Table 3.1)'),
      buildTable(
        ['Feature', 'Baseline (b_j)', 'Threshold (tau_j)', 'Physical/Cyber'],
        [
          ['Voltage', '230.0 V', '10.0 V', 'Physical'],
          ['Frequency', '50.0 Hz', '1.0 Hz', 'Physical'],
          ['Current', '100.0 A', '20.0 A', 'Physical'],
          ['Power', '23.0 kW', '5.0 kW', 'Physical'],
          ['Response Time', '3.3 ms', '5.0 ms', 'Physical'],
          ['Latency', '0.17', '0.50', 'Cyber'],
          ['Packet Loss', '0.004', '0.05', 'Cyber'],
          ['Integrity', '0.99', '0.20', 'Cyber'],
          ['Comm Frequency', '0.79', '0.50', 'Cyber'],
        ],
        [2000, 1800, 1800, 1760]
      ),
      ...sp(1),

      h2('3.2 Normalisation Formula'),
      body('At every timestep, each raw observed value x_j is converted to a dimensionless deviation score:'),
      new Paragraph({ children: [mono('  z_j  =  (x_j - b_j) / tau_j')] }),
      body('where x_j = observed value, b_j = baseline, tau_j = threshold. This maps any feature to a common scale regardless of units (volts, amps, ms, fractions).'),
      ...sp(1),

      h2('3.3 Baseline Update Rule (EMA)'),
      body('Baselines are updated using an Exponential Moving Average with alpha = 0.10:'),
      new Paragraph({ children: [mono('  b_j(t+1) = 0.90 x b_j(t) + 0.10 x x_j(t)   if anomaly_flag = 0')] }),
      new Paragraph({ children: [mono('  b_j(t+1) = b_j(t)                             if anomaly_flag = 1')] }),
      body('Baselines are FROZEN during detected anomalies. This prevents attack-contaminated values from corrupting the baseline and making future attacks invisible.'),
      ...sp(1),

      h2('3.4 EWMA Drift Compensation'),
      body('Before deviation scoring, a slow drift correction removes natural baseline drift (load shifts over hours). Rolling mean tracked with alpha_ewma = 0.30 over a 24-timestep window. 30% of the difference between rolling mean and static baseline is subtracted from the observed value. Prevents false alarms during legitimate long-term load shifts.'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 4 ── THREAT MODEL AND ANOMALY GENERATION ────────────────
      h1('4. Threat Model and Anomaly Generation'),
      body('The adversary has partial insider knowledge: knows agent identifiers and approximate operating baselines but does not know detection algorithm internals or thresholds. Three attack types are modelled, each with precise injection parameters.'),
      ...sp(1),

      h2('4.1 Anomaly Generation — Experiment Mode (grid_env.py)'),
      body('In the Experiment Running workspace, attacks are injected by the simulation engine (grid_env.py). Three attack models with precisely defined injection parameters:'),
      ...sp(1),

      h3('False Data Injection (FDI)'),
      new Paragraph({ children: [mono('  x_attack(t) = x(t) + 2.0 + 0.05 x t')] }),
      body('Constant bias = 2.0 added immediately on attack start. Linear drift = 0.05 per timestep — cumulative bias grows each step. Applied to all physical features of the targeted agent. CUSUM alarm threshold (h=4.0) is reached after approximately 8 steps of sustained drift. This is the deliberate calibration — CUSUM and FDI are co-designed.'),
      ...sp(1),

      h3('Denial of Service (DoS)'),
      bullet('latency += 5.0 (immediate 5-unit latency spike)'),
      bullet('pkt_loss += 0.20 (capped at 1.0 — never exceeds 100%)'),
      bullet('integrity -= 0.50 (floored at 0 — never goes negative)'),
      bullet('comm_freq x= 0.95 (5% reduction per step — gradual communication degradation)'),
      body('Applied to cyber features only. Physical readings remain unaffected. Requires 2-of-3 Layer C conditions to fire.'),
      ...sp(1),

      h3('Man-in-the-Middle (MITM)'),
      bullet('Physical features: += N(0, 1.0^2) Gaussian noise per timestep'),
      bullet('Cyber latency: += N(0, 0.5^2) noise per timestep'),
      bullet('Cyber pkt_loss: += N(0, 0.02^2) noise per timestep'),
      bullet('Integrity: -= 0.10 per timestep (deterministic decay, floored at 0)'),
      body('The oscillatory Gaussian noise pattern in physical features (OSCILLATORY temporal signature) is what Layer C-3 detects alongside the integrity decay.'),
      ...sp(1),

      h2('4.2 Anomaly Generation — Rapid SCADA Mode'),
      body('In Rapid SCADA Live workspace, there is NO synthetic attack injection. Anomalies are detected purely by deviation from per-type baselines.'),
      bullet('Rapid SCADA calculates all 670 channel values using built-in formula expressions stored in Cnl.xml (physical) and Cnl_Cyber_Addon.xml (cyber)'),
      bullet('These formulas introduce controlled variation around the baseline values'),
      bullet('When calculated values deviate beyond the normalised threshold (z_j > k_sigma), the deviation scoring pipeline treats them as anomalous'),
      bullet('No physical injection — the detection responds to whatever the SCADA formulas produce'),
      bullet('Detection pipeline in SCADA mode is identical to Experiment mode: PowerShell bridge → FastAPI → normalisation → LSTM → Layer C → Tier-A → dashboard'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 5 ── DETECTION PIPELINE ─────────────────────────────────
      h1('5. Multi-Layer Detection Pipeline'),
      body('At every time step, the pipeline receives each agent\'s feature vector and returns: (a) binary anomaly flag, (b) attack-type label (FDI/DoS/MITM/FAULT/CHAIN), (c) XAI feature attribution.'),
      ...sp(1),

      h2('5.1 Layer A — Statistical Deviation Scoring'),
      body('Physical deviation: dx = sqrt[ (1/nx) x Sum( ((xj - bxj) / tau_xj)^2 ) ]'),
      body('Cyber deviation:  dy = sqrt[ (1/ny) x Sum( ((yj - byj) / tau_yj)^2 ) ]'),
      body('Composite score: S_i(t) = w_i x (dx + dy)'),
      body('Criticality weights: GEN=1.0, PMU=0.8, SUB=0.7, BRK=0.5'),
      body('An agent is flagged by Layer A when BOTH hold: LSTM probability >= 0.80 AND deviation score >= 3.60 (BALANCED profile). Both conditions must be met — neither alone is sufficient.'),
      ...sp(1),

      h2('5.2 Three Detection Sensitivity Profiles'),
      buildTable(
        ['Parameter', 'ROBUST', 'BALANCED (default)', 'COST'],
        [
          ['k_sigma', '3.5', '4.0', '5.0'],
          ['Deviation score threshold', '3.60', '3.85', '4.10'],
          ['LSTM probability threshold', '0.80', '0.85', '0.90'],
          ['Use case', 'High-security', 'General operations', 'Budget-constrained'],
        ],
        [2500, 1600, 2500, 2760]
      ),
      ...sp(1),

      h2('5.3 Layer B — LSTM Temporal Accumulator'),
      bullet('2-layer LSTM, 64 hidden units per layer, dropout = 0.20'),
      bullet('Fully connected output → sigmoid → probability in [0, 1]'),
      bullet('Sliding window: 24 consecutive timesteps per training sample'),
      bullet('Stage 1 fusion: fused_prob = 0.58 x grid_branch + 0.42 x network_branch + agreement bonus - disagreement penalty'),
      bullet('Temporal accumulator: flags when LSTM probability >= 0.55 for 5+ consecutive steps within a 6-step window'),
      body('Class imbalance handling: Focal Loss (alpha=0.65, gamma=2.0) + WeightedRandomSampler (positive scale=1.40, oversampling=1.35). Temperature calibration: grid search over T in [0.80, 2.20] to maximise F1 and minimise Brier score.'),
      ...sp(1),

      h2('5.4 Stage 2 Ensemble Fusion'),
      body('hybrid_conf = 0.48 x dev_conf + 0.52 x fused_LSTM_prob + suspicion_credit'),
      body('suspicion_credit accumulates when borderline readings persist and decays on consecutive normal readings.'),
      ...sp(1),

      h2('5.5 Layer C — Three Attack-Specific Detectors'),
      h3('C-1: CUSUM for FDI'),
      body('Two-sided CUSUM. Sensitivity k=0.50, alarm threshold h=4.00, window 8 steps. Fires when cumulative physical-feature residuals breach h=4.0 — calibrated to catch x_attack(t) = x(t)+2.0+0.05t after 8 steps.'),
      ...sp(1),
      h3('C-2: DoS Rule Detector'),
      body('2-of-3 rule: fires when at least 2 of these 3 conditions are simultaneously satisfied: (1) latency >= 3x baseline, (2) packet loss >= 0.15, (3) comm frequency drop >= 40%.'),
      ...sp(1),
      h3('C-3: MITM Integrity Detector'),
      body('AND-gate: (1) integrity drop >= 35% from baseline AND (2) normalised measurement jump >= 2.5 sigma over 8-step history. Distinguishes MITM from operational transients.'),
      ...sp(1),

      h2('5.6 Tier-A False Positive Suppression'),
      body('ALL 5 conditions must hold simultaneously to suppress an alert:'),
      bullet('Score ratio < 3.50 (deviation is marginal)'),
      bullet('LSTM anomaly probability < 0.60'),
      bullet('Network intrusion probability < 0.55'),
      bullet('Hybrid confidence < 1.05'),
      bullet('No Layer C signature present (no FDI/DoS/MITM/FAULT indicator)'),
      body('If even ONE condition fails, the alert is retained. This gate only suppresses very clear non-events.'),
      ...sp(1),

      h2('5.7 Temporal Signature and 5-Class Attack Typing'),
      buildTable(
        ['Signature', 'Pattern', 'Primary Attack'],
        [
          ['STEP', 'Abrupt sustained shift', 'FDI with constant bias'],
          ['RAMP', 'Linearly increasing deviation', 'FDI with drift, or gradual fault'],
          ['OSCILLATORY', 'Alternating +/- deviations', 'MITM noise injection'],
          ['STABLE', 'No significant pattern', 'Normal operation or very slow fault'],
        ],
        [1800, 3000, 4560]
      ),
      ...sp(1),
      buildTable(
        ['Attack Type', 'Detection Criteria'],
        [
          ['FDI', 'Physical deviation STEP/RAMP + CUSUM fires + cyber normal'],
          ['DoS', 'Network rule fires + 2-of-3 conditions + physical normal'],
          ['MITM', 'Integrity-jump fires + OSCILLATORY signature + both domains elevated'],
          ['FAULT', 'Physical spike + no cyber degradation + STEP + no network indicator'],
          ['CHAIN', 'Multiple Layer C detectors fire + both physical and cyber elevated'],
        ],
        [1500, 7860]
      ),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 6 ── DATASETS ────────────────────────────────────────────
      h1('6. Training Datasets'),
      body('Two benchmark datasets pre-train the LSTM branches before live training. They do NOT appear in the live telemetry pipeline — they only provide the initial weight prior.'),
      ...sp(1),

      h2('6.1 UCI Electrical Grid Stability Dataset (Physical LSTM Branch)'),
      bullet('UCI Repository Dataset #471'),
      bullet('10,000 samples, 12 features + 1 binary label'),
      bullet('Binary label: stable (0) / unstable (1) — 70% stable / 30% unstable'),
      bullet('Teaches the physical LSTM what power-flow instability looks like before live training'),
      ...sp(1),

      h3('UCI Feature Mapping — Table 4.1'),
      buildTable(
        ['UCI Feature Group', 'UCI Columns', 'Maps to Simulation Feature', 'Rationale'],
        [
          ['Response times', 'tau1, tau2, tau3, tau4', 'response_time', 'Producer reaction time maps directly to control latency'],
          ['Power coefficients', 'p1, p2, p3, p4', 'voltage_deviation / power_deviation', 'Power balance imbalance reflects voltage and power deviations'],
          ['Price elasticity', 'g1, g2, g3, g4', 'frequency_deviation / current_deviation', 'Elasticity relates to load-frequency and current dynamics'],
        ],
        [2000, 1800, 2200, 3360]
      ),
      body('The mapping is not direct injection. UCI features are averaged into groups and used as pre-training data so the physical LSTM learns power-flow instability patterns from a labelled dataset before it encounters live simulation or SCADA data.'),
      ...sp(1),

      h2('6.2 UNSW-NB15 Network Intrusion Dataset (Cyber LSTM Branch)'),
      bullet('UNSW Canberra Cyber Lab — real captured network traffic'),
      bullet('257,675 packets: 82K train / 175K test'),
      bullet('Binary label: normal (0) / attack (1)'),
      bullet('Teaches the cyber LSTM what network-level attack signatures look like'),
      ...sp(1),

      h3('UNSW-NB15 Feature Engineering — Table 4.2'),
      buildTable(
        ['Composite Feature', 'Formula', 'Source Columns', 'Maps to Simulation Feature'],
        [
          ['latency_like', 'ln(1 + sum)', 'dur + tcprtt + synack + ackdat + sinpkt + dinpkt + sjit + djit', 'latency'],
          ['loss_like', 'ln(1 + sum)', 'sloss + dloss + pkt_correction', 'pkt_loss'],
          ['integrity_like', 'ln(1 + sum)', '|sttl-dttl| + ct_state_ttl + |sbytes-dbytes| / max(sbytes+dbytes, 1)', 'integrity'],
          ['freq_like', 'ln(1 + sum)', 'rate + sload + dload + spkts + dpkts', 'comm_freq'],
        ],
        [1500, 1500, 3500, 2860]
      ),
      body('Processing pipeline: (1) Sum all source columns, (2) Apply ln(1+x) transform — handles zeros and compresses skew, (3) Z-score normalise — brings all features to unit scale. All four composite features then map one-to-one to the 4 simulation cyber features.'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 7 ── HYBRID AUDIT SCHEDULER ─────────────────────────────
      h1('7. Hybrid Audit Scheduler'),
      body('Two complementary methods combined. Q-learning handles which escalation level. Gradient descent handles how much audit resource to allocate. Neither method alone covers both dimensions.'),
      ...sp(1),

      h2('7.1 Q-Learning Component'),
      body('State: s = (b_risk, b_prob, c_cluster, b_cap) — 4-dimensional, 300 total states (5x5x3x4)'),
      buildTable(
        ['Dimension', 'Values', 'Edge Thresholds'],
        [
          ['b_risk (risk score bucket)', '5 levels', '0 / 0.5 / 1 / 2 / 5 / 10'],
          ['b_prob (LSTM probability bucket)', '5 levels', '0 / 0.2 / 0.4 / 0.6 / 0.8 / 1'],
          ['c_cluster (K-Means cluster)', '3 clusters', 'k=3 on agent telemetry history'],
          ['b_cap (audit capacity bucket)', '4 levels', '0 / 0.5 / 0.8 / 1 / 2'],
        ],
        [2500, 1500, 5360]
      ),
      body('Bellman update: Q(s,a) = Q(s,a) + alpha x [r + gamma x max Q(s\',a\') - Q(s,a)]'),
      body('alpha=0.10, gamma=0.90, epsilon-greedy starting at 1.0, decaying x0.995 to min 0.05'),
      body('Three actions: DEC (decrease audit frequency) | HOLD | INC (increase)'),
      body('Experience replay: buffer capacity=2000, mini-batch=32. Three reward modes: Expected, Exponential Utility (beta=-0.05), CVaR (alpha=10%).'),
      ...sp(1),

      h2('7.2 Gradient Descent Cost Optimisation'),
      body('Cost function: C_i = C_a x f_i + C_f x (R_i / f_i)'),
      body('Gradient: dC_i/df_i = C_a - C_f x (R_i / f_i^2)'),
      body('Update: f_i = f_i - eta x (dC_i/df_i)  with  eta=0.01'),
      body('Optimal frequency: f_i* = sqrt(C_f x R_i / C_a)'),
      body('Result: cost efficiency improves from 42.5% (Q-only, base paper) to 57.28% (hybrid).'),
      ...sp(1),

      h2('7.3 Escalation Actions — Five Decision Levels'),
      buildTable(
        ['Level', 'Action', 'Risk Score Range', 'Response'],
        [
          ['1', 'NO ANOMALY', 'Score < 1.0', 'No action; normal monitoring cycle continues'],
          ['2', 'LOG MONITOR', 'Score 1.0-2.0', 'Event logged to audit_chain.db; monitoring frequency increased'],
          ['3', 'INCREASE AUDIT', 'Score 2.0-3.5', 'Audit frequency escalated for agent AND its immediate neighbours'],
          ['4', 'ISOLATE NOTIFY', 'Score 3.5-5.0', 'Agent flagged for isolation; operator alert triggered; XAI delivered'],
          ['5', 'EMERGENCY SHUTDOWN', 'Score > 5.0', 'Emergency protocol triggered; all stakeholders notified; trail sealed'],
        ],
        [700, 1800, 1500, 4360]
      ),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 8 ── XAI ─────────────────────────────────────────────────
      h1('8. Explainability Module (XAI)'),
      body('Per-feature contribution: c_j = ((x_j - b_j) / tau_j)^2'),
      body('Relative importance: relative_j = c_j / Sum_k(c_k)'),
      body('Physical and cyber domains ranked independently. Top-k features shown per domain.'),
      body('No additional inference passes needed — reuses deviation values already computed. Physical features and cyber features have separate leaderboards per alert.'),
      body('Example output: "Agent GEN-07 flagged: voltage deviation 41.2%, latency anomaly 23.1%, packet loss 18.8%; likely FDI attack."'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 9 ── TESTING ─────────────────────────────────────────────
      h1('9. System Testing — 12 Integration Test Cases'),
      body('All 12 test cases passed. Tests cover detection, scheduling, SCADA integration, and XAI. Test environment: Experiment Running workspace, seed 43, BALANCED profile, 100 agents.'),
      ...sp(1),
      buildTable(
        ['Test Case', 'Description', 'Expected / Result'],
        [
          ['TC-01', 'Single FDI on one GEN agent', 'FDI detected; CUSUM fired within 8 steps — PASS'],
          ['TC-02', 'DoS attack on one SUB agent', 'DoS detected; 2-of-3 corroboration rule satisfied — PASS'],
          ['TC-03', 'MITM attack on one PMU agent', 'MITM detected; integrity drop + oscillatory signature — PASS'],
          ['TC-04', 'Coordinated FDI across 5 GEN agents', 'CHAIN attack classified; all 5 flagged — PASS'],
          ['TC-05', 'Normal operation 30-minute window', 'Zero false positives over full 30-minute run — PASS'],
          ['TC-06', 'Borderline LSTM spike (ROBUST profile)', 'Layer A catches when deviation also elevated — PASS'],
          ['TC-07', 'Slow FDI onset (drift 0.02/step)', 'Layer B temporal accumulator flags after 5 steps — PASS'],
          ['TC-08', 'Simultaneous FDI + DoS injection', 'CHAIN classification; both Layer C detectors fire — PASS'],
          ['TC-09', 'SCADA polling continuity (N=100)', 'All 100 agents polled and processed every 5s cycle — PASS'],
          ['TC-10', 'XAI feature ranking correctness', 'Injected feature identified as rank-1 driver — PASS'],
          ['TC-11', 'Q-learning escalation decision', 'DEC/HOLD/INC action matches expected risk bucket — PASS'],
          ['TC-12', 'End-to-end latency (N=100)', 'P95 latency = 66 ms, within 5s SCADA interval — PASS'],
        ],
        [1000, 2800, 5560]
      ),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 10 ── RESULTS ────────────────────────────────────────────
      h1('10. Experimental Results'),
      ...sp(1),

      h2('10.1 Primary System Metrics (N=100, 24-Hour Evaluation, Five-Seed Mean, Audit Protection Active)'),
      buildTable(
        ['Metric', 'Value'],
        [
          ['Detection Accuracy', '93.85%'],
          ['False Positive Rate', '6.18%'],
          ['Recall', '98.24%'],
          ['Risk Mitigation', '93.66%'],
          ['Cost Efficiency', '57.28%'],
          ['Audit Coverage', '100.00%'],
          ['Attack Rate Reduction', '76.13%'],
          ['Precision (24h)', '9.77%'],
          ['F1 Score (24h)', '17.76%'],
          ['Per-step F1 (5-method study)', '82.25%'],
          ['Cross-Layer Stability Index', '90.62%'],
          ['Average Pipeline Latency', '55.04 ms'],
          ['P95 Latency', '66.02 ms'],
        ],
        [4680, 4680]
      ),
      body('Note on precision and F1: The low 24h-cycle precision (9.77%) and F1 (17.76%) reflect the audit and mitigation pipeline removing most attack events before they accumulate, which leaves a small positive class against a large normal class. A modest count of residual flags then drives precision down even though operational accuracy stays high. The per-step F1 of 82.25% from the five-method comparative study is the accurate measure of per-decision quality.'),
      ...sp(1),

      h2('10.2 Multi-Seed Reproducibility — Table 7.6'),
      body('Five independent evaluation runs, N=100, where each seed places attacks on a different set of agents with a different noise pattern. The reported headline is the five-seed mean, which shows the results are stable across seeds rather than resting on a single run.'),
      buildTable(
        ['Seed', 'Detection Accuracy', 'False Positive Rate', 'Recall'],
        [
          ['42', '93.75%', '6.28%', '98.53%'],
          ['43', '94.34%', '5.69%', '99.01%'],
          ['44', '93.83%', '6.21%', '100.00%'],
          ['45', '93.42%', '6.60%', '97.22%'],
          ['46', '93.91%', '6.10%', '96.43%'],
          ['Mean', '93.85%', '6.18%', '98.24%'],
          ['Std Dev', '0.33%', '0.33%', '1.42%'],
        ],
        [2340, 2340, 2340, 2340]
      ),
      ...sp(1),

      h2('10.3 Five-Method Comparative Study'),
      buildTable(
        ['Method', 'Accuracy', 'FPR', 'Recall', 'Precision', 'F1'],
        [
          ['Deviation-Only (base paper)', '81.40%', '9.06%', '36.89%', '46.58%', '41.18%'],
          ['LSTM-Only', '86.35%', '0.00%', '22.67%', '100.00%', '36.96%'],
          ['Isolation Forest', '68.85%', '27.95%', '53.92%', '29.25%', '37.92%'],
          ['One-Class SVM', '46.35%', '59.99%', '75.93%', '21.33%', '33.31%'],
          ['Our System (Multi-Layer)', '94.23%', '1.81%', '75.76%', '89.95%', '82.25%'],
        ],
        [2000, 1200, 1200, 1200, 1200, 1560]
      ),
      ...sp(1),

      h2('10.4 Scalability Analysis'),
      buildTable(
        ['Agents', 'Accuracy', 'FPR', 'Risk Mit.', 'Cost Eff.', 'Coverage', 'Avg Lat.', 'P95 Lat.'],
        [
          ['N=100', '93.85%', '6.18%', '93.66%', '57.28%', '100%', '55 ms', '66 ms'],
          ['N=200', '93.69%', '6.33%', '93.76%', '65.76%', '100%', '103 ms', '124 ms'],
          ['N=500', '93.70%', '6.33%', '94.05%', '89.95%', '91.44%', '255 ms', '303 ms'],
        ],
        [900, 1000, 900, 1000, 900, 1000, 1000, 1000]
      ),
      body('Detection scales cleanly: accuracy stays within a fifth of a percentage point of 93.7% and false positive rate near 6.3% at all three sizes, while risk mitigation holds near 94%. Audit coverage stays at 100% to N=200 and falls to 91.44% at N=500, and cost efficiency rises from 57.28% to 89.95% as the fixed budget ratio conserves a larger share of audits. The resources that need attention for larger deployments are the audit budget and inference batching, not the per-step detection itself.'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 11 ── DASHBOARD ──────────────────────────────────────────
      h1('11. Operator Dashboard'),
      body('Built with Next.js — two workspaces, eight views. All views update on every SCADA poll cycle (5-second interval at N=100).'),
      bullet('Operations Overview: system-wide summary — headline metrics, top-10 risk-ranked agents, anomaly trend'),
      bullet('Agent Monitoring: per-agent drill-down with live telemetry traces, 4-colour status (green/yellow/orange/red)'),
      bullet('Risk Analytics: risk score histogram, 24h trend, heatmap by agent type and hour'),
      bullet('Audit Trail: hash-chained log of all audit decisions, searchable by agent/severity/time'),
      bullet('Threat Events: live timeline of detected attacks with type labels, confidence, timestamps'),
      bullet('Decision Explainability: feature attribution bar chart, text summary, Q-table action taken'),
      bullet('Asset Topology: 10x10 grid of agent icons colour-coded by anomaly status with dependency links'),
      bullet('Experiment Control / System Health: configure evaluation runs; SCADA bridge connectivity status'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 12 ── KEY FORMULAS ───────────────────────────────────────
      h1('12. Key Formulas Reference'),
      buildTable(
        ['Formula', 'Equation', 'Where Used'],
        [
          ['Normalisation', 'z_j = (x_j - b_j) / tau_j', 'Every detection step, all features'],
          ['Physical deviation', 'dx = sqrt[(1/nx) x Sum(z_j^2)]', 'Layer A deviation scoring'],
          ['Composite score', 'S_i(t) = w_i x (dx + dy)', 'Layer A, Tier-A gate'],
          ['Stage 1 LSTM fusion', 'fused = 0.58 x grid + 0.42 x net + bonuses - penalties', 'Layer B output'],
          ['Stage 2 ensemble', 'hybrid = 0.48 x dev_conf + 0.52 x fused_LSTM + suspicion_credit', 'Detection output'],
          ['XAI contribution', 'c_j = ((x_j - b_j) / tau_j)^2', 'Explainability module'],
          ['Bellman update', 'Q(s,a) = Q(s,a) + 0.10 x [r + 0.90 x max Q(s\',a\') - Q(s,a)]', 'Q-learning scheduler'],
          ['Gradient cost', 'C_i = C_a x f_i + C_f x (R_i / f_i)', 'Cost optimisation'],
          ['Optimal frequency', 'f_i* = sqrt(C_f x R_i / C_a)', 'Gradient descent target'],
          ['FDI injection', 'x_attack(t) = x(t) + 2.0 + 0.05 x t', 'Experiment mode simulation'],
          ['Focal Loss', 'L = -alpha x (1 - pt)^gamma x log(pt)', 'LSTM training (alpha=0.65, gamma=2.0)'],
          ['Baseline EMA', 'b_j(t+1) = 0.90 x b_j(t) + 0.10 x x_j(t)  if no anomaly', 'Baseline update'],
        ],
        [2000, 3200, 4160]
      ),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 13 ── LIMITATIONS AND FUTURE WORK ───────────────────────
      h1('13. Limitations and Future Work'),
      ...sp(1),

      h2('13.1 Acknowledged Limitations'),
      buildTable(
        ['Limitation', 'Detail'],
        [
          ['Calculated SCADA channels', 'Telemetry generated within Rapid SCADA — no physical RTUs, IEDs, or PMUs connected'],
          ['Operational prototype', 'Not a field-deployed utility system — validated under simulated telemetry'],
          ['Fixed baselines', 'Hand-engineered per-type baselines — not auto-learned from operational data'],
          ['Audit budget at large scale', 'Detection stays stable to N=500 (FPR near 6.3%), but audit coverage falls to 91.44% at N=500 as the fixed budget ratio is spread across more agents'],
          ['24h F1 of 17.76%', 'Reflects the audit and mitigation pipeline clearing most attacks before they accumulate, leaving a small positive class — not model weakness'],
          ['Attack typology', '5 classes modelled — replay attacks and ramp-metering attacks not yet covered'],
        ],
        [2500, 6860]
      ),
      ...sp(1),

      h2('13.2 Future Work (7 Directions)'),
      bullet('1. Replace calculated SCADA channels with physical RTU / IED / PMU telemetry via Modbus or OPC-UA'),
      bullet('2. Adaptive baseline models that adjust to seasonal load variation, equipment ageing, and topology changes, reducing reliance on static reference profiles'),
      bullet('3. Per-scale adaptive threshold calibration for deployments beyond 200 agents'),
      bullet('4. Extended attack typology: replay attacks, load redistribution, ramp-metering attacks'),
      bullet('5. IDS / SIEM integration for coordinated enterprise-level threat response'),
      bullet('6. Adversarial robustness testing against adaptive attackers who probe system thresholds'),
      bullet('7. Formal verification of safety-critical escalation decisions using model checking'),
      ...sp(1), sep(), ...sp(1),

      // ── SECTION 14 ── GLOSSARY ───────────────────────────────────────────
      h1('14. Glossary of Key Terms'),
      buildTable(
        ['Term', 'Plain-Language Definition'],
        [
          ['Smart Grid', 'A power grid that uses computers, sensors, and two-way communication alongside physical wires and transformers'],
          ['SCADA', 'Supervisory Control and Data Acquisition — software operators use to monitor and control physical equipment remotely'],
          ['FDI', 'False Data Injection — attacker sends fake sensor readings so operators see normal numbers while the grid is actually misbehaving'],
          ['DoS', 'Denial of Service — attacker floods the communication channel so real control signals cannot get through'],
          ['MITM', 'Man-in-the-Middle — attacker sits between two devices, intercepting or modifying messages in transit'],
          ['LSTM', 'Long Short-Term Memory — a type of neural network that can remember patterns over time, good for detecting slow-onset attacks'],
          ['CUSUM', 'Cumulative Sum — adds up small deviations over time; catches persistent bias that any single reading would miss'],
          ['Focal Loss', 'A modified loss function that forces the model to focus on hard, rare examples (attacks) rather than easy normal samples'],
          ['Q-learning', 'A reinforcement learning algorithm — system learns which actions lead to best outcomes through trial and error'],
          ['Bellman equation', 'The update rule for Q-learning: new estimate = old estimate + learning_rate x (reward + future value - old estimate)'],
          ['XAI', 'Explainable AI — provides a ranked list of which features caused each anomaly flag, so operators can verify decisions'],
          ['Rapid SCADA', 'Open-source SCADA platform (version 6) used as the live supervisory system in this project'],
          ['Baseline', 'The expected normal value for a feature; used as the reference point for deviation scoring'],
          ['Tier-A Gate', 'A 5-condition suppression filter that drops very clear false alarms before they reach the operator'],
          ['Temperature Calibration', 'A post-training step that adjusts LSTM output so 0.80 probability really means 80% empirical attack likelihood'],
          ['Calculated Channel', 'A SCADA channel that derives its value from a formula expression rather than a physical sensor reading'],
          ['EMA', 'Exponential Moving Average — a smoothing technique that gives more weight to recent values; used for baseline updates'],
          ['CVaR', 'Conditional Value at Risk — a risk measure that focuses on the worst-case tail outcomes; used as Q-learning reward mode'],
          ['Attack Rate Reduction', 'The percentage reduction in active attack count after the system intervenes — 76.13% in the 24h evaluation (five-seed mean)'],
        ],
        [2000, 7360]
      ),
      ...sp(1),

      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480 },
        children: [new TextRun({ text: '--- End of Knowledge Document v2 ---', italics: true, size: 20, color: '888888' })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('Knowledge doc written:', OUT);
});
