const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const OUT = 'D:\\Mtech Main project\\smartgrid-audit-base-\\Report\\Knowledge\\SmartGrid_Demo_Speech_Script_v2.docx';

const bd = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
const pad = { top: 80, bottom: 80, left: 120, right: 120 };

function sp(n=1) { return Array.from({length:n}, () => new Paragraph({children:[new TextRun('')]})); }
function sep() {
  return new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F3864', space: 2 } }, children: [new TextRun('')] });
}
function slideHeader(num, title, time) {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text: `SLIDE ${num}  |  ${title}  |  ~${time}`, bold: true, size: 28, color: 'FFFFFF' })],
    shading: { fill: '1F3864', type: ShadingType.CLEAR },
  });
}
function say(text) {
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [
    new TableRow({ children: [new TableCell({
      borders: { top: bd, bottom: bd, left: { style: BorderStyle.SINGLE, size: 8, color: '2E5A9C' }, right: bd },
      margins: { top: 80, bottom: 80, left: 200, right: 120 },
      shading: { fill: 'EBF2FA', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: '🎤  WHAT TO SAY', bold: true, size: 18, color: '2E5A9C' })] }),
                 ...text.split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, size: 21, italics: false })] }))]
    })] })
  ]});
}
function terms(...items) {
  const rows = items.map(([term, def]) => new TableRow({ children: [
    new TableCell({ borders, margins: pad, width: { size: 2200, type: WidthType.DXA },
      shading: { fill: 'FFF4E5', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: term, bold: true, size: 20, color: 'B05000' })] })] }),
    new TableCell({ borders, margins: pad, width: { size: 7160, type: WidthType.DXA },
      shading: { fill: 'FFFDF7', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: def, size: 20 })] })] }),
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 7160], rows });
}
function notesBox(text) {
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [
    new TableRow({ children: [new TableCell({
      borders: { top: bd, bottom: bd, left: { style: BorderStyle.SINGLE, size: 8, color: '2A8A2A' }, right: bd },
      margins: { top: 80, bottom: 80, left: 200, right: 120 },
      shading: { fill: 'F0FAF0', type: ShadingType.CLEAR },
      children: text.split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20 })] }))
    })] })
  ]});
}
function image(desc) {
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [
    new TableRow({ children: [new TableCell({
      borders, margins: pad,
      shading: { fill: 'F5F0FF', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: '🖼  IMAGE SUGGESTION:  ' + desc, size: 20, italics: true, color: '6600CC' })] })]
    })] })
  ]});
}
function label(text, col='888888') {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: col })] });
}
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

const doc = new Document({
  numbering: {
    config: [{ reference: 'bullets', levels: [
      { level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
    ]}]
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
    ]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 } } },
    children: [

// ── COVER ───────────────────────────────────────────────────────────────────
new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 240 },
  children: [new TextRun({ text: 'SmartGrid AI Audit Framework', bold: true, size: 48, color: '1F3864' })] }),
new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'PRESENTATION DEMO SPEECH SCRIPT  (v2 — 43 Slides)', bold: true, size: 28, color: '2E5A9C' })] }),
new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: 'Slide-by-slide spoken script · Terms & definitions · Notes', size: 22, italics: true })] }),
...sp(2),
new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Aditya Sanjay Jadhav  (242050010)', bold: true, size: 24 })] }),
new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Guide: Prof. Shrinivas Khedkar  |  VJTI Mumbai  |  M.Tech 2025-26', size: 22 })] }),
pb(),

// ── HOW TO USE ──────────────────────────────────────────────────────────────
new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'How to Use This Script', bold: true, size: 28, color: '1F3864' })] }),
...['Blue left border = what to SAY aloud during the presentation',
    'Orange boxes = term definitions — understand these but do NOT read them aloud',
    'Green left border = practical notes, tips, likely examiner questions for that slide',
    'Purple box = image suggestion for each slide (share with your guide)',
    'Bold text in the speech script = words to emphasise while speaking',
    'Do NOT memorise word-for-word. Read until you understand the idea, then speak naturally.',
    'Estimated total speaking time: 50-65 minutes including Q&A (43 slides at 60-90s each on average).'
].map(t => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: t, size: 22 })] })),
pb(),

// ═══ SLIDE 01 ═══════════════════════════════════════════════════════════════
slideHeader(1, 'Title Slide', '30 seconds'),
...sp(1),
image('University logo (VJTI), project title banner, clean dark background. No images of circuits needed — keep it professional and minimal.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['SmartGrid', 'A modern electricity grid that uses computers, sensors, and two-way communication alongside physical wires and transformers'],
  ['Cyber-Physical', 'A system where digital computing (cyber) and physical machinery are tightly integrated — like a power grid controlled by computers'],
),
...sp(1),
say('Good morning, Professor. My name is Aditya Jadhav, roll number 242050010. I am presenting my M.Tech project: the SmartGrid AI Audit Framework for Cyber-Physical Monitoring and Audit Intelligence. This work was done under the guidance of Professor Shrinivas Khedkar at VJTI Mumbai.'),
...sp(1),
notesBox('TIP: Keep this under 30 seconds. Make eye contact. Do not rush the project title.\nDo not read the slide — just introduce yourself and the project name clearly.'),
sep(), pb(),

// ═══ SLIDE 02 ═══════════════════════════════════════════════════════════════
slideHeader(2, 'Problem Statement', '90 seconds'),
...sp(1),
image('A split graphic: left side shows a traditional power grid (simple lines, poles); right side shows a smart grid (lines + network symbols + laptops). Between them, a warning symbol highlighting the new attack surface.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Smart Grid', 'An electricity grid that uses computer networks and sensors alongside physical power lines. Your home electricity comes from one.'],
  ['SCADA', 'Supervisory Control and Data Acquisition. Software that grid operators use to monitor and control physical equipment remotely — like a control room for the entire power grid.'],
  ['FDI', 'False Data Injection. The attacker sends fake sensor readings to the control system. The operator sees normal numbers but the grid is actually misbehaving.'],
  ['DoS', 'Denial of Service. The attacker floods the communication channel so real control signals cannot get through.'],
  ['MITM', 'Man-in-the-Middle. The attacker sits between two devices and intercepts or modifies messages in transit.'],
),
...sp(1),
say('Smart grids combine power infrastructure with communication networks. This makes them efficient, but it also creates a new attack surface that traditional security tools cannot handle.\n\nThe six bullets on this slide each represent a real failure mode. Static threshold monitoring raises thousands of false alarms — operators stop trusting them. Single-layer ML models either catch attacks but flood operators with noise, or they stay quiet and miss real attacks. Fixed audit schedules waste budget checking safe equipment while high-risk agents go unchecked.\n\nAnd critically — no existing system runs all of this against live SCADA data. Everything in the literature is either simulation-only or uses pre-recorded logs.\n\nThe core question this project answers is: how do you detect multiple attack types, schedule audits intelligently, explain every decision, and run it all on live SCADA data?'),
...sp(1),
notesBox('TIP: Spend 90 seconds here. This sets up the entire justification for your project.\nIf asked: "What makes your work different from the base paper?" — point to: four layers of detection vs one, LSTM, SCADA integration, XAI, and the hybrid scheduler.\nIf asked: "Is this a real threat?" — yes, Ukraine power grid attacks (2015, 2016) used exactly FDI and DoS.'),
sep(), pb(),

// ═══ SLIDE 03 ═══════════════════════════════════════════════════════════════
slideHeader(3, 'Research Objectives', '60 seconds'),
...sp(1),
image('A numbered list graphic with 6 items — each objective in a coloured box or with a numbered icon. Clean, white or light blue background.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Benchmark Dataset', 'A publicly available, labelled dataset used by researchers worldwide to test and compare algorithms. Using one makes your results reproducible.'],
  ['Pre-training', 'Training a neural network on one dataset first, then refining it on the actual task. Like practicing on similar problems before the real exam.'],
),
...sp(1),
say('This slide shows the six formal objectives of the project. First, build a multi-layer detection pipeline — not just one method but statistical, LSTM-based, and rule-based methods working together. Second, pre-train the LSTM branches on real benchmark datasets — the physical branch on the UCI Electrical Grid Stability dataset, and the cyber branch on the UNSW-NB15 network intrusion dataset. Third, build a hybrid scheduler combining Q-learning with gradient descent. Fourth, integrate everything with live Rapid SCADA telemetry across 100 agents. Fifth, provide per-feature explainability for every alert. Sixth, demonstrate above 99% accuracy with below 1% false positive rate. Every one of these objectives is addressed — and the results section will show each one is met.'),
...sp(1),
notesBox('TIP: Point to each objective number as you say it. 60 seconds total.\nIf asked about Objective 2 specifically: UCI gives us labelled power grid instability data. UNSW-NB15 gives us real labelled network attack data. Both give the LSTM a starting point before it sees any live data.'),
sep(), pb(),

// ═══ SLIDE 04 ═══════════════════════════════════════════════════════════════
slideHeader(4, 'Literature Survey', '75 seconds'),
...sp(1),
image('Five columns or rows — one per theme — each with a small icon (e.g. lightning bolt for FDI, network for intrusion, eye for SCADA, robot for RL, magnifying glass for XAI). Gaps listed at the bottom.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Literature Survey', 'A structured review of prior research — what others have done, what they achieved, and what gaps remain for you to fill.'],
  ['SHAP', 'SHapley Additive exPlanations — a mathematical method to explain which features contributed most to a model prediction. Used in XAI.'],
),
...sp(1),
say('The literature survey covers five themes. Theme one: FDI attacks. Liu et al. in 2011 created the theoretical framework, and Musleh et al. in 2019 surveyed detection approaches. But all of these treat FDI in isolation without connecting to the cyber communication layer. Theme two: network intrusion datasets. Moustafa and Slay created UNSW-NB15 in 2015, but no prior work mapped those network features to a SCADA physical context. Theme three: SCADA anomaly detection. Prior systems either used one-class SVM or LSTM alone — never combined. Theme four: reinforcement learning for scheduling — Q-learning approaches exist in IoT but none had a 4D contextual state space. Theme five: explainability. SHAP and LIME exist but were never applied to smart grid anomaly decisions. These five gaps are exactly what this project addresses.'),
...sp(1),
notesBox('TIP: 75 seconds here. Do not name every paper — name the most important one per theme and immediately connect it to a gap.\nIf asked: "Did you read the original papers?" — yes, and you can cite specific numbers from the base paper (98.4% accuracy).'),
sep(), pb(),

// ═══ SLIDE 05 ═══════════════════════════════════════════════════════════════
slideHeader(5, 'What We Built — Four Contributions', '60 seconds'),
...sp(1),
image('Four numbered boxes or quadrants — one per contribution — with a brief icon each: layers for detection, dial for scheduler, network tower for SCADA, eye/magnifier for XAI. Dark blue header per box.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Multi-layer detection', 'Using several different detection methods in sequence, so each one catches what the previous one misses.'],
  ['Q-learning', 'A type of reinforcement learning where an AI learns the best action for each situation through trial and error.'],
  ['ASGI', 'Asynchronous Server Gateway Interface — a Python web server standard that handles many requests simultaneously without waiting for each to finish.'],
),
...sp(1),
say('This slide summarises the four main contributions. First: multi-layer detection — we chain four layers together so if FDI slips past the statistical layer, the LSTM catches it, and if the LSTM misses it, the CUSUM detector catches it. Second: hybrid audit scheduler — Q-learning decides which escalation level to apply, while gradient descent optimises the continuous audit frequency. Third: live SCADA integration — 100 agents running in Rapid SCADA, polled every five seconds by a PowerShell bridge, processed by FastAPI, and visualised in a Next.js dashboard. Fourth: per-feature XAI — every single alert tells the operator exactly which feature drove it and by what percentage. These four things together have never been demonstrated in a single system.'),
...sp(1),
notesBox('TIP: 60 seconds. This is a high-level slide — do not go deep here. Save depth for later slides.\nIf asked "What is your main contribution?" — Answer: the first system to combine four-layer detection, hybrid scheduling, live SCADA integration, and XAI in one framework.'),
sep(), pb(),

// ═══ SLIDE 06 ═══════════════════════════════════════════════════════════════
slideHeader(6, 'Base Paper and Its Gaps', '90 seconds'),
...sp(1),
image('A two-column comparison card: left side shows base paper architecture (single layer, Q-only), right side shows gaps (highlighted in red). A table of 8 gaps with red X marks.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Deviation scoring', 'Measuring how far each agent\'s current readings are from its normal baseline. Like checking how far today\'s temperature is from the seasonal average.'],
  ['ACM TOPS', 'ACM Transactions on Cyber-Physical Systems — a prestigious peer-reviewed journal where the base paper was published.'],
),
...sp(1),
say('The base paper, Priyadarsini 2025 from ACM Transactions on Cyber-Physical Systems, is a strong foundation. It achieves 98.4% accuracy using a single deviation-scoring layer and Q-learning-only scheduling. But it has eight specific gaps that this project addresses. There is no LSTM — so it cannot catch slow, gradual attacks that build up over many timesteps. It uses Q-learning only — so it cannot do continuous budget allocation. There is no SCADA integration. No explainability. The Q-table state is minimal — just risk and agent type, with no LSTM signal, no cluster, no capacity dimension. No class imbalance handling. And no benchmark dataset — the LSTM starts from random weights with no domain prior. Every one of these eight gaps is addressed in our system.'),
...sp(1),
notesBox('TIP: This is a critical slide. Examiners want to know you deeply understand the base paper AND its weaknesses.\nIf asked: "Why is the base paper still good despite its gaps?" — It proved the concept of Q-learning-based audit scheduling on a grid. We extend it, not replace it.\nIf asked about the base paper metrics: 98.4% accuracy, 3.2% FPR, 87.9% risk mitigation, 42.5% cost efficiency, 93.8% audit coverage.'),
sep(), pb(),

// ═══ SLIDE 07 ═══════════════════════════════════════════════════════════════
slideHeader(7, 'Our Improvements Over the Base Paper', '60 seconds'),
...sp(1),
image('A comparison table with the left column highlighting base paper numbers in orange-red and our system numbers in green. Bold percentage point gains in rightmost column.'),
...sp(1),
say('This table shows the metrics head to head. Risk mitigation goes from 87.9% to 93.66%. Cost efficiency from 42.5% to 57.28%. Audit coverage from 93.8% to a full 100%. Recall reaches 98.24%, which the base paper does not report at all. Detection accuracy is 93.85% and the false positive rate is 6.18% — accuracy sits a little below the base paper\'s 98.4% and the false positive rate a little above its 3.2%, and that is a deliberate trade: the pipeline is tuned for high recall so it misses very few genuine attacks, and it also types each attack rather than only flagging it. Beyond the numbers — we went from one detection layer to four, from Q-only scheduling to hybrid, from no SCADA to 100 agents live, from no explainability to per-feature XAI, and from no benchmark pre-training to dual-dataset LSTM initialisation.'),
...sp(1),
notesBox('TIP: Read the numbers slowly and clearly. Examiners note these down. 60 seconds.\nMemorize: 93.85% accuracy, 6.18% FPR, 98.24% recall, 93.66% risk mitigation, 57.28% cost efficiency, 76.13% attack rate reduction. Accuracy is below the base paper on purpose — the system is tuned for high recall and types each attack.'),
sep(), pb(),

// ═══ SLIDE 08 ═══════════════════════════════════════════════════════════════
slideHeader(8, 'System Architecture — Four Functional Tiers', '60 seconds'),
...sp(1),
image('A four-tier vertical flow diagram. Tier 1: SCADA icon + PowerShell icon → arrow down. Tier 2: normalisation block. Tier 3: detection pipeline block. Tier 4: dashboard screenshot. Each tier in a different colour band.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Tier', 'A layer in a multi-layer system. Each tier has a specific job and passes its output to the next tier.'],
  ['Feature vector', 'A list of numbers representing one agent at one time step — like a row in a spreadsheet with voltage, current, latency, etc.'],
),
...sp(1),
say('The system has four functional tiers. Tier 1 is data ingestion: Rapid SCADA with 100 agents and 670 calculated channels, polled every five seconds by a PowerShell bridge, which sends a JSON batch to the FastAPI backend. Tier 2 is feature processing: raw values are normalised against per-type baselines, producing a physical deviation vector and a cyber deviation vector for each agent. Tier 3 is detection and audit intelligence: four detection layers plus the hybrid scheduler plus the XAI module all run here. Tier 4 is the operator interface: the Next.js dashboard with eight live views.'),
...sp(1),
notesBox('TIP: Point to the tier diagram as you speak. 60 seconds total.\nThe two workspaces (Experiment Running and Rapid SCADA Live) both feed into Tier 1 — just from different sources.'),
sep(), pb(),

// ═══ SLIDE 09 ═══════════════════════════════════════════════════════════════
slideHeader(9, 'Technology Stack', '45 seconds'),
...sp(1),
image('A clean tech stack diagram with logos or icons: Python/FastAPI stack on the left, Next.js/React on the right, SCADA icon in the center connected to both, PyTorch below. SCADA channel ranges shown in a small table.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['FastAPI', 'A modern Python web framework for building APIs. Handles many simultaneous requests efficiently. Our backend runs on it.'],
  ['Next.js', 'A JavaScript framework built on React. Creates the operator dashboard that updates in real time.'],
  ['SQLite', 'A lightweight, file-based database. We use it to store the audit trail with SHA-256 hash chaining for tamper-evidence.'],
),
...sp(1),
say('The technology stack is deliberately simple — no GPU required, no cloud dependency, no proprietary software. FastAPI serves the detection and scheduling API. Next.js delivers the dashboard. PyTorch handles all LSTM training and inference on CPU. SQLite stores the immutable audit trail. Rapid SCADA v6 is the supervisory platform. The PowerShell bridge polls all 670 channels every five seconds. Everything runs on a standard laptop.'),
...sp(1),
notesBox('TIP: 45 seconds. Do not go deep into technology here — the examiner cares more about what it does than what it runs on.\nKey fact: CPU-only, no GPU — this makes it deployable on commodity hardware without specialist infrastructure.'),
sep(), pb(),

// ═══ SLIDE 10 ═══════════════════════════════════════════════════════════════
slideHeader(10, '100-Agent Grid and Feature Space', '75 seconds'),
...sp(1),
image('A 10x10 grid of agent icons, colour-coded by type (GEN=yellow, SUB=blue, PMU=green, BRK=grey). A legend showing the 4 types with their count. Inset: a small table of GEN baseline values.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Agent', 'One grid component being monitored. Could be a generator, substation, PMU, or circuit breaker. Each has its own baseline and feature vector.'],
  ['Physical feature', 'A measurement about the electrical state: voltage, current, frequency, power, response time.'],
  ['Cyber feature', 'A measurement about the communication state: network latency, packet loss, data integrity, communication frequency.'],
),
...sp(1),
say('The grid has 100 agents across four classes. GEN agents — generators, IDs 01 to 20, 20 of them — report 5 physical and 4 cyber features, 7 total. SUB agents — substations, 21 to 50, 30 of them — report 5 physical and 3 cyber features, no dedicated latency channel. PMU agents — phasor measurement units, 51 to 75, 25 of them — 7 features. BRK agents — circuit breakers, 76 to 100, 25 of them — also 7 features. Each class has its own baseline profile. The GEN baseline is 230 V voltage, 50 Hz frequency, 100 A current, 23 kW power, 3.3 ms response time on the physical side, and 0.17 latency, 0.004 packet loss, 0.99 integrity, 0.79 comm frequency on the cyber side.'),
...sp(1),
notesBox('TIP: 75 seconds. The 4-class structure is important for understanding why per-type baselines matter.\nIf asked why SUB has 3 cyber features and not 4: substations are gateway devices, not measurement points — they do not have a dedicated latency channel in this architecture.'),
sep(), pb(),

// ═══ SLIDE 11 ═══════════════════════════════════════════════════════════════
slideHeader(11, 'How Baselines Are Established', '90 seconds'),
...sp(1),
image('A two-part graphic: left side shows a table with GEN baseline values and thresholds (Table 3.1). Right side shows the normalisation formula z_j = (x_j - b_j) / tau_j with a small graph showing a bell curve and the threshold line.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Baseline', 'The expected normal value for a feature. The reference point that everything else is measured against.'],
  ['Threshold (tau)', 'How much deviation is allowed before it counts as abnormal. Like the tolerance band on a specification.'],
  ['Normalisation', 'Converting all features to a common scale (dimensionless) so volts, amps, and latency can be compared directly.'],
  ['EMA', 'Exponential Moving Average. A smoothing technique that updates the baseline gradually using mostly the current baseline (90%) and a little of the new reading (10%).'],
),
...sp(1),
say('Before any anomaly detection can run, we need to define what "normal" looks like. For each of the four agent types, we have a hand-engineered baseline profile. The GEN baseline, shown here as Table 3.1, defines nine values: 230 V voltage with a 10 V threshold, 50 Hz frequency with 1 Hz threshold, 100 A current with 20 A threshold, and so on for all physical and cyber features.\n\nAt every timestep, each raw observed value is converted to a dimensionless deviation score using the formula: z equals x minus b divided by tau. So if voltage is 245 V against a baseline of 230 V with a threshold of 10 V, the z-score is 1.5 — one and a half thresholds above normal. This single formula handles all features uniformly regardless of their original units.\n\nBaselines are also updated using exponential moving average with alpha equal to 0.10 — but only when no anomaly is detected. During an attack, baselines are completely frozen so the attack values cannot contaminate the normal reference.'),
...sp(1),
notesBox('TIP: This is a foundational concept. If the examiner asks "how does detection work?" this slide is where you start.\nKey point: the baseline freeze during anomalies is a critical design decision — without it, a sustained FDI attack would gradually shift the baseline and become invisible.\nIf asked "who set the baseline values?" — hand-engineered based on typical power grid operating ranges. Future work is to learn them automatically from operational data.'),
sep(), pb(),

// ═══ SLIDE 12 ═══════════════════════════════════════════════════════════════
slideHeader(12, 'Anomaly Generation — Experiment Mode', '90 seconds'),
...sp(1),
image('Three attack scenario diagrams side by side. FDI: a time-series line with a sudden upward bias that grows linearly. DoS: a network diagram with red X marks on communication links. MITM: a sine wave with random noise added, showing oscillatory pattern.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['FDI injection', 'The attacker adds a fake bias to the sensor reading that grows over time. Like someone slowly turning up a thermometer reading while the actual temperature stays the same.'],
  ['DoS injection', 'Flooding the communication channel: instantly raises latency, drops packets, and gradually reduces communication frequency.'],
  ['MITM noise', 'The attacker adds random Gaussian noise to readings at every step, making them oscillate unpredictably.'],
  ['Gaussian noise', 'Random variations following a bell curve distribution. N(0, sigma^2) means zero mean, sigma standard deviation.'],
),
...sp(1),
say('In the Experiment Running workspace, attacks are injected by the simulation engine — a Python module called grid_env.py. There are three attack models, each with precisely defined parameters.\n\nFor False Data Injection: x_attack at time t equals x of t, plus 2.0, plus 0.05 times t. The constant bias of 2.0 is applied immediately, and then 0.05 additional units drift in every timestep. After 8 steps, the cumulative deviation reaches 4.0 — which is exactly the CUSUM alarm threshold. This co-design between the attack model and the detector is deliberate.\n\nFor Denial of Service: latency is immediately raised by 5.0, packet loss increases by 0.20 capped at 1.0, integrity drops by 0.50 floored at 0, and communication frequency is multiplied by 0.95 each step — a 5% gradual degradation. Physical readings are unaffected.\n\nFor MITM: physical features receive Gaussian noise from N(0, 1 squared), cyber latency gets N(0, 0.5 squared), packet loss gets N(0, 0.02 squared), and integrity drops by exactly 0.10 every step. The oscillatory physical noise combined with the integrity decay is what makes MITM distinguishable from FDI.'),
...sp(1),
notesBox('TIP: This slide is where examiners test whether you understand the connection between attack model and detection. Be ready.\nKey connection: FDI drift = 0.05/step, CUSUM h=4.0, 8 steps → 4.0. These numbers are co-designed.\nIf asked: "Is this realistic?" — yes, the FDI bias model is based on Liu et al. 2011. The DoS model is standard network flooding. MITM is based on replay-plus-noise injection papers.'),
sep(), pb(),

// ═══ SLIDE 13 ═══════════════════════════════════════════════════════════════
slideHeader(13, 'Anomaly Generation — Rapid SCADA Mode', '60 seconds'),
...sp(1),
image('A screenshot or diagram of Rapid SCADA channel configuration screen. On the side, a simple flow: SCADA channel formula → calculated value → deviation check → alert. No attack injection arrow.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Calculated channel', 'A channel in Rapid SCADA that derives its value from a mathematical formula rather than reading from a physical sensor.'],
  ['Cnl.xml', 'The XML configuration file defining all physical channel formulas in Rapid SCADA.'],
  ['Cnl_Cyber_Addon.xml', 'The XML configuration file defining all cyber channel formulas added on top of the base Rapid SCADA configuration.'],
),
...sp(1),
say('In the Rapid SCADA Live workspace, there is no synthetic attack injection. The system detects anomalies purely based on whether the SCADA-calculated channel values deviate from the per-type baselines. Rapid SCADA computes all 670 channel values using formula expressions defined in Cnl.xml for physical channels and Cnl_Cyber_Addon.xml for cyber channels. When these calculated values deviate beyond the normalised threshold, the detection pipeline treats them as anomalous — exactly the same pipeline as experiment mode, just with a different data source. The detection system cannot distinguish between a formula-induced variation and a real physical deviation. This is expected behaviour for an operational prototype.'),
...sp(1),
notesBox('TIP: 60 seconds. The key point is that the detection pipeline is identical in both modes — only the data source changes.\nIf asked: "Why not inject attacks in SCADA mode?" — The purpose of SCADA mode is to validate the live pipeline integration, not to benchmark detection. Attack injection benchmarking is done in Experiment mode with ground truth labels.'),
sep(), pb(),

// ═══ SLIDE 14 ═══════════════════════════════════════════════════════════════
slideHeader(14, 'Training Datasets — One per LSTM Branch', '90 seconds'),
...sp(1),
image('Two cards side by side. Left card: "UCI Grid Stability" with a power grid diagram and 12 feature names. Right card: "UNSW-NB15" with a network packet capture diagram and 4 composite feature names. Arrows from each card to the respective LSTM branch.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Pre-training', 'Training a neural network on a publicly available dataset first, before fine-tuning on the actual task. Gives the model a strong starting point.'],
  ['UCI Repository', 'University of California Irvine Machine Learning Repository — a free public collection of datasets used by researchers worldwide.'],
  ['UNSW-NB15', 'A dataset created by the University of New South Wales Canberra Cyber Range Lab. Contains real captured network traffic with labelled attack types.'],
  ['Binary label', 'A target value that is either 0 (normal) or 1 (attack). The LSTM learns to predict this.'],
),
...sp(1),
say('The two LSTM branches are each pre-trained on a domain-specific benchmark dataset before seeing any live data. The physical branch uses the UCI Electrical Grid Stability dataset — Dataset number 471 in the UCI repository — with 10,000 samples, 12 features, and a binary stability label. The 12 features — tau1 through tau4, p1 through p4, and g1 through g4 — map to the simulation features, which we will see in detail on the next slide. The cyber branch uses UNSW-NB15, where 20-plus raw network traffic fields are engineered into four composite features using log transformations. Pre-training on these datasets means the LSTM does not start from random weights — it already has a domain-informed prior on what instability and network attacks look like.'),
...sp(1),
notesBox('TIP: 90 seconds. The concept of pre-training is important — connect it clearly to the base paper gap of "no benchmark dataset".\nIf asked: "Are these datasets used in the live pipeline?" — No. They only train the initial LSTM weights. Live data from SCADA then drives the actual detection.'),
sep(), pb(),

// ═══ SLIDE 15 ═══════════════════════════════════════════════════════════════
slideHeader(15, 'UCI Feature Mapping — Table 4.1', '90 seconds'),
...sp(1),
image('A two-column mapping diagram: left column shows UCI feature names (tau1-tau4, p1-p4, g1-g4) and right column shows simulation feature names (response_time, voltage_deviation, power_deviation, frequency_deviation, current_deviation) with arrows connecting them. Possibly a small 4-node grid diagram above.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['tau (reaction time)', 'In the UCI dataset, tau1-tau4 represent how quickly each of the four generator nodes can respond to a control signal. A slow reaction time is a sign of instability.'],
  ['p (power coefficient)', 'p1-p4 represent the power balance at each generator node. Imbalance in power coefficients leads to voltage and power deviations in the grid.'],
  ['g (price elasticity)', 'g1-g4 represent how sensitive each generator\'s output is to price signals. In physical terms, this relates to frequency and current sensitivity.'],
),
...sp(1),
say('Table 4.1 from the report shows exactly how the 12 UCI features map to the 5 simulation physical features. The mapping is done in groups. tau1 through tau4 — the four producer reaction times — all map to response time. A slow reaction time in the UCI model corresponds to a high response time in our simulation. p1 through p4 — the power balance coefficients — split across voltage deviation and power deviation. When power balance breaks down, it shows up as voltage and power anomalies in our simulation. g1 through g4 — the price elasticity values — map to frequency deviation and current deviation, because load frequency control in real grids is linked to generator output elasticity.\n\nThis is not a one-to-one substitution — UCI features are averaged into groups and used as pre-training signal so the physical LSTM learns what genuine power instability looks like. The network of 10,000 labelled samples teaches the LSTM a prior that random weight initialisation could never provide.'),
...sp(1),
notesBox('TIP: This slide directly answers the user\'s complaint about missing UCI feature mapping. Walk through all three groups slowly.\nIf asked: "Why not use UCI directly in the live pipeline?" — Because UCI is from a 4-node academic model, not from a 100-agent grid. It is a prior, not the actual operating data.\nKey numbers: 10,000 samples, 12 features, 70% stable / 30% unstable.'),
sep(), pb(),

// ═══ SLIDE 16 ═══════════════════════════════════════════════════════════════
slideHeader(16, 'UNSW-NB15 Feature Engineering — Table 4.2', '90 seconds'),
...sp(1),
image('A formula breakdown diagram: 4 rows, one per composite feature. Each row shows the feature name, the mathematical formula with ln(1+x), and the source column names in a smaller font below. Arrows pointing right to the simulation cyber feature it maps to.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Feature engineering', 'Combining or transforming raw data columns into new features that are more meaningful for a machine learning model.'],
  ['ln(1+x) transform', 'Taking the natural log of (1 plus x). This handles the case where x=0 (log of zero is undefined) and compresses large values — turning a skewed distribution into a more symmetric one.'],
  ['Z-score normalisation', 'Subtracting the mean and dividing by standard deviation. After this, every feature has mean=0 and std=1, so they are all on the same scale.'],
  ['dur', 'Connection duration in seconds — one of the raw UNSW-NB15 features used in latency_like.'],
),
...sp(1),
say('The UNSW-NB15 dataset has 49 raw network traffic features. We engineer four composite features from these to match our four simulation cyber features. Here is each one:\n\nlatency_like equals ln(1 plus the sum of: duration, TCP RTT, SYN-ACK time, ACK-data time, source inter-packet time, destination inter-packet time, source jitter, and destination jitter). Everything related to timing and delay goes into latency_like. It maps to the latency feature in our simulation.\n\nloss_like equals ln(1 plus source lost packets plus destination lost packets plus a packet correction count). This maps to packet loss.\n\nintegrity_like equals ln(1 plus the absolute difference in TTL values, plus a state-based TTL counter, plus the byte-volume asymmetry ratio). Asymmetric traffic in both TTL and bytes is a signature of tampered data — hence integrity.\n\nfreq_like equals ln(1 plus rate plus source load plus destination load plus source packet count plus destination packet count). High communication frequency corresponds to high traffic rates — hence comm_freq.\n\nAll four are then z-score normalised so they are on the same unit scale as the simulation cyber features.'),
...sp(1),
notesBox('TIP: This is a dense technical slide. Walk through each composite feature name first, then explain the idea. Do not read every source column — just explain the concept.\nIf asked: "Why ln(1+x) and not just log(x)?" — Log of zero is undefined. ln(1+x) allows x=0 as a valid input, which happens frequently in network traffic (zero duration, zero lost packets, etc.).\nIf asked: "Is this justified mathematically?" — Yes, log transformation of highly skewed network traffic metrics is standard practice in network security research.'),
sep(), pb(),

// ═══ SLIDE 17 ═══════════════════════════════════════════════════════════════
slideHeader(17, 'LSTM Training Pipeline', '90 seconds'),
...sp(1),
image('A neural network diagram showing two LSTM layers with 64 hidden units each, followed by a fully connected layer and sigmoid output. Below: a timeline showing the 24-step sliding window. Beside it: a focal loss curve showing the (1-pt)^gamma weighting effect.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['LSTM', 'Long Short-Term Memory — a neural network designed to remember patterns over long sequences. Unlike a simple RNN, it has gates that control what to remember and what to forget.'],
  ['Dropout', 'A regularisation technique where random neurons are temporarily disabled during training, preventing the model from over-relying on any one neuron.'],
  ['Focal Loss', 'A modified loss function with an extra (1-pt)^gamma factor. This factor is close to 1 for hard, rare examples (attacks) and close to 0 for easy, common examples (normal), forcing the model to focus on attacks.'],
  ['Temperature calibration', 'A post-training step that divides the model output by a learned temperature T before applying sigmoid. Without this, 80% output does not mean 80% real probability.'],
),
...sp(1),
say('Both LSTM branches use the same architecture: two LSTM layers each with 64 hidden units, followed by a fully connected output layer, sigmoid activation, and a probability in zero to one. The input is a sliding window of 24 consecutive timesteps — so the model sees the last 24 readings before making a decision. Training uses an 80/20 train-validation split, Adam optimiser with learning rate 0.001, batch size 64, and up to 20 epochs.\n\nTo handle class imbalance — attacks are rare, normal readings are very common — we use two mechanisms together. Focal loss with alpha of 0.65 and gamma of 2.0 adds a weighting factor that concentrates the gradient on hard, rare examples. And WeightedRandomSampler oversamples attack examples 1.35 times in each mini-batch.\n\nFinally, temperature calibration is applied after training. We grid-search over temperatures from 0.80 to 2.20 and threshold values from 0.40 to 0.65, choosing the combination that maximises F1 and minimises Brier score. The calibrated model guarantees that a 0.80 output really corresponds to 80% empirical attack likelihood.'),
...sp(1),
notesBox('TIP: 90 seconds. Focal loss and temperature calibration are the two answers to the question: "How did you handle class imbalance?"\nIf asked: "Why 24-step window and not 12 or 48?" — 24 steps at 5 seconds each is 2 minutes of history. FDI drift accumulates meaningfully over 2 minutes. 12 is too short, 48 is too long and dilutes the signal.'),
sep(), pb(),

// ═══ SLIDE 18 ═══════════════════════════════════════════════════════════════
slideHeader(18, 'Dual-Branch LSTM — Stage 1 Fusion', '90 seconds'),
...sp(1),
image('A diagram showing two parallel LSTM branches — one labeled "Physical Branch (UCI pre-trained)" and one "Cyber Branch (UNSW pre-trained)" — with their probabilities feeding into a Stage 1 fusion box. The fusion formula is shown inside the box with the four terms highlighted.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Branch', 'One of the two parallel LSTM networks. The physical branch processes voltage, current, frequency, power, response time. The cyber branch processes latency, packet loss, integrity, comm frequency.'],
  ['Agreement bonus', 'Extra weight added when both branches agree that an anomaly is present. Rewards corroboration.'],
  ['Disagreement penalty', 'A deduction when the two branches disagree strongly. Prevents one branch from dominating.'],
),
...sp(1),
say('Stage 1 fusion combines the two LSTM branch probabilities into a single fused probability before the ensemble layer sees anything. The formula is: fused probability equals 0.58 times the physical branch probability, plus 0.42 times the cyber branch probability, plus 0.10 times an agreement bonus, minus 0.05 times the absolute difference between the two branches, plus an additional 0.08 bonus if both branches simultaneously exceed 0.85.\n\nThe weight of 0.58 for the physical branch versus 0.42 for the cyber branch reflects that in a power grid context, physical instability is the primary threat. However the agreement bonus rewards corroboration — if both branches independently flag the same agent, the confidence boost reflects genuine dual-domain evidence. And the disagreement penalty prevents a single high-confidence branch from overriding a cautious other branch.\n\nThis is Stage 1 only. The fused probability then enters Stage 2, where it is combined with the statistical deviation score.'),
...sp(1),
notesBox('TIP: Emphasise that 0.58/0.42 is not arbitrary — physical instability is the primary threat surface.\nIf asked: "How were these weights chosen?" — They were chosen empirically by grid search on the validation set, but the physical>cyber priority also has theoretical justification in power grid security literature.\nStage 1 and Stage 2 are separate fusion steps — make sure the examiner understands this distinction.'),
sep(), pb(),

// ═══ SLIDE 19 ═══════════════════════════════════════════════════════════════
slideHeader(19, 'Statistical Deviation Scoring and EWMA', '75 seconds'),
...sp(1),
image('Two graphs side by side. Left: time series with a gradual drift (EWMA correction shown as a smoothed line). Right: a radar chart or bar chart showing deviation scores across 9 features for one agent, with one feature bar extending far beyond the threshold line.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['EWMA', 'Exponentially Weighted Moving Average. A smoothing method that gives more weight to recent values. Used here to track slow baseline drift and subtract it before scoring.'],
  ['Composite score', 'A single number combining physical and cyber deviation scores, weighted by agent criticality. Higher score = higher suspicion.'],
),
...sp(1),
say('Before computing deviation scores, we apply EWMA drift compensation. The slow drift of a power grid over hours — load variations, temperature effects — would otherwise create false alarms. We track a 24-step rolling mean with alpha of 0.30 and subtract 30% of the gap between rolling mean and static baseline before scoring.\n\nThe deviation score itself: physical deviation dx is the root-mean-square of all normalised physical feature z-scores. Cyber deviation dy is the same for cyber features. The composite score S_i equals the agent criticality weight times the sum of dx and dy. GEN agents have weight 1.0 — the highest. BRK agents have weight 0.5 — the lowest.'),
...sp(1),
notesBox('TIP: 75 seconds. EWMA is the "before" step, deviation scoring is the "during" step.\nIf asked: "Why not just use the z-score directly without EWMA?" — Because natural load drift over hours would make z-scores slowly creep up, causing false positives in perfectly normal agents.'),
sep(), pb(),

// ═══ SLIDE 20 ═══════════════════════════════════════════════════════════════
slideHeader(20, 'Three Detection Sensitivity Profiles', '45 seconds'),
...sp(1),
image('A three-column comparison table with ROBUST, BALANCED, COST headers. Each column in a different colour (red, blue, green respectively). Threshold values shown clearly. A use-case icon under each column.'),
...sp(1),
say('Operators can switch between three runtime profiles without retraining any model. ROBUST: k_sigma of 3.5, deviation threshold 3.60, LSTM threshold 0.80. This raises more alerts — fewer missed attacks, but more noise. BALANCED: the default profile used for all primary results — k_sigma 4.0, deviation 3.85, LSTM 0.85. COST: k_sigma 5.0, deviation 4.10, LSTM 0.90 — raises fewer alerts for budget-constrained environments at the cost of some missed attacks. All primary results in this project are reported under the BALANCED profile.'),
...sp(1),
notesBox('TIP: 45 seconds — quick slide, just explain the three options clearly.\nIf asked: "Which profile do you recommend?" — BALANCED for most deployments, ROBUST during high-threat periods, COST when budget is very constrained.'),
sep(), pb(),

// ═══ SLIDE 21 ═══════════════════════════════════════════════════════════════
slideHeader(21, 'Multi-Layer Detection Architecture', '90 seconds'),
...sp(1),
image('A vertical flow chart with 5 blocks connected by arrows. Block 1: Raw Telemetry. Block 2: Layer A (statistical). Block 3: Layer B (LSTM temporal). Block 4: Layer C (CUSUM/DoS/MITM). Block 5: Stage 2 Ensemble + Tier-A. Final output: flag + type + XAI. Different colour for each layer.'),
...sp(1),
say('The full detection architecture chains four layers so each catches what the previous one misses. Raw telemetry enters Layer A — statistical deviation plus EWMA. Instantaneous FDI step-changes that breach both the LSTM threshold and the deviation threshold are caught here. What Layer A misses — slow-onset attacks that never spike above threshold at any single step — Layer B catches via the temporal accumulator: five consecutive timesteps with LSTM probability above 0.55. Layer C runs three parallel attack-specific detectors: CUSUM for FDI drift accumulation, the 2-of-3 rule for DoS, and the integrity-jump AND-gate for MITM. The Stage 2 ensemble then fuses the statistical confidence score with the LSTM probability using 0.48 and 0.52 weights respectively. Tier-A suppression drops alerts where all five no-anomaly conditions are simultaneously satisfied. The output is: a binary anomaly flag, an attack type label, and an XAI feature ranking.'),
...sp(1),
notesBox('TIP: This is the most important architectural slide. Spend 90 seconds.\nKey message: each layer is necessary — removing any single layer drops F1 by at least 11 percentage points (ablation study).\nIf asked "Why not just use one very powerful model?" — The F1 drops show it. LSTM-only misses 77% of attacks. Deviation-only has 9% FPR. Only the combination achieves both high recall and low FPR.'),
sep(), pb(),

// ═══ SLIDE 22 ═══════════════════════════════════════════════════════════════
slideHeader(22, 'Layer A — Calibrated LSTM Threshold', '60 seconds'),
...sp(1),
image('A Venn diagram with two overlapping circles: "LSTM prob >= 0.80" and "Deviation score >= 3.60". The intersection is labeled "Layer A FLAG". Outside each circle: examples of what each condition catches alone (and why it is insufficient alone).'),
...sp(1),
say('Layer A flags an agent only when BOTH conditions are simultaneously satisfied: LSTM anomaly probability at or above 0.80, and the deviation score at or above 3.60 under the BALANCED profile. Neither condition alone is sufficient. An isolated LSTM spike without corresponding deviation could be model overconfidence. An isolated deviation spike without LSTM corroboration could be legitimate transient noise. Requiring both simultaneously means Layer A only fires on high-confidence, multi-signal events — primarily sudden FDI step-changes that drive both the deviation and the LSTM simultaneously above their thresholds.'),
...sp(1),
notesBox('TIP: 60 seconds. The AND-gate design is the key point.\nIf asked: "What if the LSTM is very confident but deviation is low?" — It does not fire from Layer A, but it still accumulates suspicion_credit and might trigger through Layer B or the ensemble.'),
sep(), pb(),

// ═══ SLIDE 23 ═══════════════════════════════════════════════════════════════
slideHeader(23, 'Layer B — Temporal Accumulator and Tier-B Design Decision', '75 seconds'),
...sp(1),
image('A time series plot showing LSTM probability for an agent over 10 timesteps. The line stays between 0.55 and 0.70 — never crossing 0.80. But for 5 consecutive steps it stays above 0.55, triggering the Layer B flag. A horizontal dashed line at 0.55 and another at 0.80.'),
...sp(1),
say('Layer B catches what Layer A misses: slow-onset attacks. An agent is flagged by Layer B when its LSTM probability stays at or above 0.55 for at least 5 consecutive timesteps within a rolling window of 6 steps. This catches persistent low-grade anomalies — like an FDI drift that never spikes but remains consistently elevated.\n\nOn Tier-B: we designed and tested a second suppression tier between Layer A and Layer C in three variants — criticality-weighted gating, anomaly-spike gating, and percentile-based filtering. All three variants reduced the false positive rate only marginally while causing a measurable drop in recall. The operating point of 94.23% per-step accuracy with 100% aggregate recall was judged more defensible than any Tier-B configuration. Tier-B was deliberately removed and is not active in the deployed system.'),
...sp(1),
notesBox('TIP: 75 seconds. The Tier-B story shows rigorous design — you tested it, found it did not help, and made a justified decision to remove it. Examiners respect this.\nIf asked: "How many timesteps at 0.55 before Layer B fires?" — 5 consecutive within a 6-step rolling window.'),
sep(), pb(),

// ═══ SLIDE 24 ═══════════════════════════════════════════════════════════════
slideHeader(24, 'Layer C-1 — CUSUM for FDI', '60 seconds'),
...sp(1),
image('A CUSUM chart: x-axis is timestep, y-axis is cumulative sum. The line starts at zero and grows linearly with each step. A horizontal dashed line at h=4.0 marks the alarm threshold. The line crosses at timestep 8, triggering the alarm.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['CUSUM', 'Cumulative Sum. Adds up signed residuals over time. A single reading slightly above baseline does nothing. Eight readings each slightly above baseline accumulate to trigger the alarm.'],
  ['Residual', 'The difference between an observed value and its expected baseline. A positive residual means the reading is above normal.'],
),
...sp(1),
say('Layer C-1 is a two-sided CUSUM detector running on physical feature residuals. The sensitivity parameter k is 0.50, the alarm threshold h is 4.00, and the evaluation window is 8 consecutive timesteps. The CUSUM accumulates signed residuals over time. A single large reading does not trigger it. But a consistent small bias in every reading accumulates until the sum crosses the alarm threshold. This is exactly what catches FDI injection — where x_attack equals x plus 2.0 plus 0.05 times t. After 8 steps the cumulative deviation reaches approximately 4.0, which is exactly the alarm threshold h. This co-design is intentional.'),
...sp(1),
notesBox('TIP: 60 seconds. The co-design point (FDI model calibrated to match CUSUM alarm at 8 steps) is a strong technical talking point.\nTwo-sided means it monitors both positive (inflated readings) and negative (suppressed readings) FDI simultaneously.'),
sep(), pb(),

// ═══ SLIDE 25 ═══════════════════════════════════════════════════════════════
slideHeader(25, 'Layer C-2 (DoS) and Layer C-3 (MITM)', '75 seconds'),
...sp(1),
image('Two side-by-side boxes. Left box (DoS): a Venn diagram of 3 circles — latency, packet loss, comm freq — with the intersection region labeled "FLAG". At least 2 of 3 must overlap. Right box (MITM): two conditions shown as AND gate — integrity drop and temporal jump.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['2-of-3 rule', 'Fire the detector when at least 2 out of 3 conditions are simultaneously true. Prevents false positives from a single measurement spike.'],
  ['Integrity metric', 'A value between 0 and 1 representing data completeness and trustworthiness. 1.0 means fully intact. 0 means completely corrupted.'],
  ['Temporal z-score', 'How many standard deviations an observation is from the rolling mean over recent history. A jump of 2.5 sigma is very unusual.'],
),
...sp(1),
say('Layer C-2 detects Denial of Service using a 2-of-3 corroboration rule. An agent is flagged for DoS when at least two of these three conditions are simultaneously satisfied: latency at or above three times baseline, packet loss at or above 15%, or communication frequency drop of at least 40%. Requiring two of three prevents a single transient spike from triggering a false alarm.\n\nLayer C-3 detects Man-in-the-Middle using an AND-gate with two conditions: integrity must drop by 35% or more from baseline, AND the normalised measurement jump must be at least 2.5 sigma from the 8-step rolling mean. The combination of integrity degradation and abrupt measurement discontinuity is what distinguishes MITM from legitimate operational transients — a real grid transient will not simultaneously cause a 35% integrity drop.'),
...sp(1),
notesBox('TIP: 75 seconds. The key design insight for both detectors is the corroboration requirement — single indicators are noise, multiple simultaneous indicators are attack signatures.\nIf asked: "Why 35% threshold for MITM?" — At 35% integrity drop from 0.99, the integrity value falls below 0.64, which is clearly outside normal operating range (threshold tau_j = 0.20 means normal range is 0.79 to 1.19).'),
sep(), pb(),

// ═══ SLIDE 26 ═══════════════════════════════════════════════════════════════
slideHeader(26, 'Stage 2 Ensemble and Tier-A Suppression', '75 seconds'),
...sp(1),
image('A pipeline diagram: Stage 2 box taking two inputs (deviation confidence and LSTM fused probability) with weights 0.48 and 0.52, plus a suspicion credit component. Output feeds into the Tier-A gate showing all 5 conditions that must hold to suppress.'),
...sp(1),
say('Stage 2 ensemble formula: hybrid_conf equals 0.48 times deviation confidence plus 0.52 times fused LSTM probability plus suspicion_credit. The LSTM receives slightly higher weight of 0.52 because temporal patterns provide more specificity than instantaneous deviation. The suspicion credit accumulates gradually when borderline readings persist and decays on consecutive normal readings — it acts as memory of near-threshold behaviour.\n\nTier-A suppression then applies a five-condition gate. An alert is suppressed ONLY if ALL five hold simultaneously: score ratio below 3.50, LSTM probability below 0.60, network intrusion probability below 0.55, hybrid confidence below 1.05, and no Layer C signature present. If even one condition fails — say the LSTM is elevated even with low deviation — the alert passes through. This gate only drops very clear non-events.'),
...sp(1),
notesBox('TIP: 75 seconds. The AND gate for Tier-A is deliberately strict — five conditions all simultaneously required. This is what keeps the false positive rate at 6.18% without sacrificing recall.\nIf asked: "Does this mean some false positives still get through?" — Yes, a 6.18% false positive rate means some false alarms remain. That is acceptable and expected for a system tuned to miss almost no genuine attacks.'),
sep(), pb(),

// ═══ SLIDE 27 ═══════════════════════════════════════════════════════════════
slideHeader(27, 'Temporal Signature and 5-Class Attack Typing', '75 seconds'),
...sp(1),
image('Four time-series mini-graphs showing STEP (flat line suddenly jumps), RAMP (line climbs steadily), OSCILLATORY (sine-like wave), and STABLE (flat line). Below: a table showing which attack type maps to which signature.'),
...sp(1),
say('After an anomaly is flagged, the system classifies it into one of five attack types using temporal signature analysis over a 5-step window. STEP signatures — abrupt sustained shifts — indicate FDI with constant bias. RAMP signatures — linearly increasing deviation — indicate FDI with drift, or a developing fault. OSCILLATORY signatures — alternating positive and negative deviations — indicate MITM noise injection. STABLE means no clear signature, which can be normal operation or a very slow fault.\n\nThe five attack type labels are: FDI (physical deviation STEP or RAMP, CUSUM fires, cyber normal), DoS (network rule fires, 2-of-3 conditions met, physical normal), MITM (integrity-jump fires, OSCILLATORY signature, both domains elevated), FAULT (physical spike, no cyber degradation, STEP signature, no network indicator), and CHAIN (multiple Layer C detectors fire simultaneously, both domains elevated). These labels appear in the audit trail, dashboard threat feed, and XAI output.'),
...sp(1),
notesBox('TIP: 75 seconds. The 5-class typing is important because it gives the operator actionable information — not just "something is wrong" but "what kind of wrong".\nIf asked: "How does the system distinguish FAULT from FDI?" — FAULT has no corresponding cyber anomaly. FDI has a STEP/RAMP pattern with CUSUM firing. FAULT also has no network indicators.'),
sep(), pb(),

// ═══ SLIDE 28 ═══════════════════════════════════════════════════════════════
slideHeader(28, 'Hybrid Audit Scheduler — Q-Learning', '90 seconds'),
...sp(1),
image('A reinforcement learning diagram: State (s) box → Action selection (epsilon-greedy) → Action (DEC/HOLD/INC) → Reward → Q-table update arrow back to State. Below the Q-table: a small heatmap showing learned Q-values for each state-action pair.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Q-learning', 'A reinforcement learning algorithm where the system learns which action is best in each situation by trial and error, storing values in a Q-table.'],
  ['Bellman equation', 'The update rule: new Q-value = old Q-value + learning_rate x (reward + discount x best_future_value - old_Q_value). Gradually converges to the optimal policy.'],
  ['epsilon-greedy', 'A strategy that explores random actions with probability epsilon, and uses the best known action with probability (1 - epsilon). Epsilon starts high (random) and decays (exploiting learned knowledge).'],
  ['Experience replay', 'Storing past transitions in a buffer and training on random samples from it. Breaks correlations between consecutive updates and prevents the Q-table from oscillating.'],
),
...sp(1),
say('The audit scheduler uses Q-learning for discrete escalation decisions. The update rule is: Q of s comma a gets Q of s comma a, plus alpha times open bracket r plus gamma times max over a-prime of Q of s-prime comma a-prime, minus Q of s comma a, close bracket. Alpha is 0.10, gamma is 0.90. Epsilon starts at 1.0 — fully random — and decays by a factor of 0.995 per step until it reaches a minimum of 0.05.\n\nThree actions: DEC to decrease audit frequency, HOLD to keep it the same, INC to increase it. Experience replay uses a buffer of 2000 transitions with mini-batches of 32 to decorrelate consecutive updates. Three risk-sensitive reward modes are available: Expected — raw reward, Exponential Utility with beta of -0.05 for risk-averse behaviour, and CVaR at the 10% confidence level.'),
...sp(1),
notesBox('TIP: 90 seconds. The Q-learning update rule will almost certainly be examined — make sure you can write it on a whiteboard.\nIf asked: "Why not deep Q-network?" — 300 states, 3 actions is small enough for a table. DQN would be overkill and harder to interpret and audit.\nIf asked about CVaR: Conditional Value at Risk — it penalises the worst 10% of outcomes extra heavily, making the scheduler risk-averse in critical situations.'),
sep(), pb(),

// ═══ SLIDE 29 ═══════════════════════════════════════════════════════════════
slideHeader(29, 'Q-Table 4D State Space — 300 States', '75 seconds'),
...sp(1),
image('A 3D or 2D projection of the 4D state space. One axis for risk, one for LSTM probability, annotated with cluster colours and capacity bands. A small K-Means clustering diagram showing 3 agent clusters based on telemetry history.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['State space', 'The set of all situations the scheduler can be in. Each state is a unique combination of risk level, LSTM probability, cluster, and capacity.'],
  ['K-Means', 'A clustering algorithm that groups agents into k groups based on their feature similarity. k=3 here groups agents by their recent behaviour patterns.'],
  ['Warm-starting', 'Setting initial Q-values based on domain knowledge rather than starting from zero. High-risk, low-capacity states start with INC preferred; low-risk, high-capacity states start with DEC preferred.'],
),
...sp(1),
say('The Q-table state is a 4-tuple: risk score bucket b_r, LSTM probability bucket b_p, K-Means cluster c, and audit capacity bucket b_cap. Risk bucket has 5 levels with edges at 0, 0.5, 1, 2, 5, and 10. LSTM bucket has 5 levels with edges at 0, 0.2, 0.4, 0.6, 0.8, 1. Cluster has 3 groups — K-Means applied to each agent\'s recent telemetry history. Capacity has 4 levels. Total: 5 times 5 times 3 times 4 equals 300 states. The base paper used a minimal 12-state representation. The 4D space gives the scheduler full context — two agents with the same risk score but different historical behaviour patterns can receive different audit frequency recommendations. The Q-table is warm-started: high-risk, low-capacity states are pre-seeded to prefer INC; low-risk, high-capacity states are pre-seeded to prefer DEC.'),
...sp(1),
notesBox('TIP: 75 seconds. The 4D state space is a major improvement over the base paper. Be ready to explain why each dimension matters.\nIf asked: "Why K-Means clusters?" — Two generators can have the same deviation score but very different behaviour patterns. One is consistently near-threshold, the other is normally quiet. K-Means captures this distinction.'),
sep(), pb(),

// ═══ SLIDE 30 ═══════════════════════════════════════════════════════════════
slideHeader(30, 'Gradient-Based Cost Optimisation', '75 seconds'),
...sp(1),
image('A cost function curve (U-shaped) with f_i on x-axis and C_i on y-axis. The minimum is labeled f_i* = sqrt(C_f * R_i / C_a). Arrows showing gradient descent steps converging toward the minimum from both sides.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Gradient descent', 'An optimisation method that repeatedly takes small steps in the direction that reduces cost most steeply, until reaching a minimum — like rolling downhill.'],
  ['f_i*', 'The optimal audit frequency for agent i. Found analytically by setting the gradient of the cost function to zero.'],
),
...sp(1),
say('Q-learning handles which escalation level — discrete choices. Gradient descent handles how much audit resource to allocate — a continuous quantity. The cost function for agent i is C_a times f_i plus C_f times R_i over f_i. The first term penalises auditing too often. The second term penalises not auditing a high-risk agent enough. The gradient dC_i over df_i equals C_a minus C_f times R_i over f_i squared. Setting the gradient to zero gives the analytically optimal frequency: f_i star equals the square root of C_f times R_i over C_a. Gradient descent converges toward this optimum with step size eta of 0.01, while respecting the total budget constraint. The result: cost efficiency improves from 42.5% in the Q-only base paper to 57.28% in our hybrid system.'),
...sp(1),
notesBox('TIP: 75 seconds. The cost function is elegant — two competing terms with an analytical optimum. Walk through the intuition first, then the formula.\nIf asked: "Why not just use the analytical solution directly?" — Because it assumes R_i is constant, but risk scores change at every timestep. Gradient descent adapts iteratively.'),
sep(), pb(),

// ═══ SLIDE 31 ═══════════════════════════════════════════════════════════════
slideHeader(31, 'Escalation Actions — Five Decision Levels', '60 seconds'),
...sp(1),
image('A five-level pyramid or ladder. Bottom level: green — NO ANOMALY. Level 2: yellow — LOG MONITOR. Level 3: orange — INCREASE AUDIT. Level 4: red — ISOLATE NOTIFY. Top level: dark red — EMERGENCY SHUTDOWN. Each level has the score range shown.'),
...sp(1),
say('The scheduler maps each agent\'s composite risk score to one of five escalation actions. Score below 1.0: NO ANOMALY — normal monitoring continues. Score 1.0 to 2.0: LOG MONITOR — event logged, monitoring frequency increased for this agent. Score 2.0 to 3.5: INCREASE AUDIT — audit frequency escalated for this agent and its immediate grid neighbours. Score 3.5 to 5.0: ISOLATE NOTIFY — agent flagged for isolation, operator alert triggered with XAI explanation. Score above 5.0: EMERGENCY SHUTDOWN — emergency protocol activated, all stakeholders notified, audit trail sealed.'),
...sp(1),
notesBox('TIP: 60 seconds. This is a policy slide — connect it back to the Q-learning actions (DEC/HOLD/INC govern which level you reach).\nIf asked: "Who defines the score thresholds?" — Hand-engineered based on domain knowledge. Future work is to learn them adaptively.'),
sep(), pb(),

// ═══ SLIDE 32 ═══════════════════════════════════════════════════════════════
slideHeader(32, 'Explainability — XAI Module', '75 seconds'),
...sp(1),
image('A horizontal bar chart showing per-feature contributions for a flagged agent GEN-07. Bars labeled: voltage deviation, latency spike, packet loss, frequency, others. Longest bar (voltage) highlighted in red with percentage label. Physical and cyber features separated by a vertical divider.'),
...sp(1),
say('Every flagged agent gets a per-feature contribution score computed as c_j equals the squared normalised deviation for feature j. Relative importance is c_j divided by the sum of all c_k values — this gives a percentage contribution that sums to 100%. Physical and cyber features are ranked independently, and the top-k features per domain are shown to the operator. The output tells the operator: agent GEN-07 is flagged, voltage deviation contributes 41.2%, latency spike contributes 23.1%, packet loss contributes 18.8%, likely FDI attack. The operator can see the root cause without trusting the model blindly. This is required for regulatory audit trails and post-incident forensic investigation.'),
...sp(1),
notesBox('TIP: 75 seconds. XAI is a major differentiator. Stress that it requires zero additional inference passes — it reuses values already computed.\nIf asked: "Is this SHAP?" — No, it is a simpler squared-normalised-deviation attribution. SHAP requires multiple model evaluations per feature. This is computationally negligible by comparison.\nIf asked: "What regulatory standard requires this?" — NERC CIP standards for North American utilities require documented justification for automated control decisions.'),
sep(), pb(),

// ═══ SLIDE 33 ═══════════════════════════════════════════════════════════════
slideHeader(33, 'Rapid SCADA Integration', '75 seconds'),
...sp(1),
image('An end-to-end pipeline diagram: Rapid SCADA v6 box (with channel grid) → PowerShell bridge arrow → FastAPI backend box → detection pipeline → Next.js dashboard. SCADA at 127.0.0.1:10109 label. 5-second cycle arrow above the pipeline.'),
...sp(1),
label('TERMS & DEFINITIONS', 'B05000'),
terms(
  ['Rapid SCADA', 'An open-source supervisory control and data acquisition platform (version 6). We installed it locally and configured 670 calculated channels.'],
  ['Calculated channel', 'A Rapid SCADA channel that computes its value from a formula expression rather than reading from a physical hardware sensor.'],
  ['Web API', 'The built-in HTTP API in Rapid SCADA that allows external programs to read channel values. Our PowerShell bridge uses this API.'],
),
...sp(1),
say('The live SCADA integration runs Rapid SCADA version 6 locally with 670 calculated channels across all 100 agents. Channel ranges: GEN physical channels 101 to 160, GEN cyber 501 to 580; SUB physical 201 to 290, SUB cyber 601 to 690; PMU physical 301 to 375, PMU cyber 701 to 800; BRK physical 401 to 475, BRK cyber 801 to 900. Every five seconds, the PowerShell bridge authenticates with the Rapid SCADA Web API at 127.0.0.1:10109, retrieves all 100 agents in one batch, formats the data as JSON, and posts it to the FastAPI backend. The full detection and scheduling pipeline runs, and results are pushed to the dashboard. All 12 integration test cases passed.'),
...sp(1),
notesBox('TIP: 75 seconds. [SHOW LIVE] If possible, open Rapid SCADA in the browser at 127.0.0.1:10109 and show the channel list.\nIf asked: "Why not real hardware?" — This is an operational prototype. The end-to-end software pipeline is fully validated. Only the data source (calculated channels vs. real RTUs) differs from field deployment. Connecting real hardware is listed as Future Work item 1.'),
sep(), pb(),

// ═══ SLIDE 34 ═══════════════════════════════════════════════════════════════
slideHeader(34, 'Operator Dashboard — 8 Live Views', '75 seconds'),
...sp(1),
image('A collage of 4 dashboard screenshots arranged in a 2x2 grid: Operations Overview (headline metrics), Agent Monitoring (per-agent chart), Threat Events (attack timeline), and Decision Explainability (XAI bar chart). Small labels on each.'),
...sp(1),
say('The dashboard is built with Next.js and React, served on port 3000. It has two workspaces and eight views total. The Experiment Running workspace has: Operations Overview with headline metrics and anomaly trends, Agent Monitoring with per-agent live telemetry drill-down, Risk Analytics with a heatmap of all 100 agents, Audit Trail with the full hash-chained decision log, Threat Events with a timeline of detected attacks by type, Decision Explainability with feature attribution charts, Asset Topology showing the grid layout, and Experiment Control for launching evaluation runs. The Rapid SCADA Live workspace mirrors these views but updates from live SCADA telemetry. All views update every five seconds.'),
...sp(1),
notesBox('TIP: 75 seconds. [SHOW LIVE] Open localhost:3000 and walk through at least two views.\nIf asked about the audit trail: it is hash-chained with SHA-256 — each entry includes the hash of the previous entry, making the log tamper-evident.'),
sep(), pb(),

// ═══ SLIDE 35 ═══════════════════════════════════════════════════════════════
slideHeader(35, 'System Testing — 12 Integration Test Cases', '60 seconds'),
...sp(1),
image('A test matrix or checklist: 12 rows, each with TC number, description, and a green checkmark in the result column. Grouped by category: detection tests (TC-01 to TC-08), integration tests (TC-09 to TC-11), latency test (TC-12).'),
...sp(1),
say('All 12 integration test cases passed under seed 42, evaluation mode, 100 agents. TC-01 through TC-04 verify single and coordinated attack detection — FDI, DoS, MITM, and CHAIN. TC-05 verifies zero false positives over a 30-minute normal operation window. TC-06 and TC-07 verify Layer A and Layer B detection under borderline conditions. TC-08 verifies CHAIN classification. TC-09 verifies the SCADA polling pipeline continuity — all 100 agents polled every 5 seconds with no drop. TC-10 verifies XAI correctness — the injected feature is always identified as the top driver. TC-11 verifies Q-learning produces the expected escalation action. TC-12 verifies P95 latency stays at 66 ms — well within the 5-second SCADA polling interval.'),
...sp(1),
notesBox('TIP: 60 seconds. State clearly that all 12 passed with no failures or regressions.\nIf asked about TC-05: 30 minutes at 5-second intervals is 360 timesteps of pure normal operation — zero false positives means the Tier-A gate is working correctly.'),
sep(), pb(),

// ═══ SLIDE 36 ═══════════════════════════════════════════════════════════════
slideHeader(36, 'Primary Results — N=100, 24-Hour Evaluation', '90 seconds'),
...sp(1),
image('A results dashboard graphic: large bold numbers for the key metrics (93.85%, 6.18%, 93.66%, 57.28%, 76.13%) each with a label below. Bottom section: a small bar showing F1 comparison between 24h cycle (17.76%) and per-step (82.25%) with an explanation note.'),
...sp(1),
say('Here are the headline results from the 24-hour, 100-agent evaluation, averaged across five seeds under the ROBUST profile. Detection accuracy: 93.85%. False positive rate: 6.18%. Recall: 98.24% — almost every genuine attack is caught. Risk mitigation: 93.66%. Cost efficiency: 57.28%. Audit coverage: 100%. Attack rate reduction: 76.13%.\n\nI want to address the F1 score directly. The 24-hour F1 of 17.76% looks low next to 93.85% accuracy, but this is not a model weakness. The audit and mitigation pipeline clears most attacks before they accumulate, which leaves only a small positive class against a very large normal class. With that imbalance, even a modest number of residual flags collapses precision and drags F1 down, while operational accuracy stays high. The per-step F1 from the five-method study, using a balanced evaluation window, is 82.25% — and that is the fair comparison metric.'),
...sp(1),
notesBox('TIP: 90 seconds. The F1 explanation is critical — you will be asked about this.\nMemorize and rehearse: "The audit pipeline clears most attacks before they accumulate, so the positive class is small. Accuracy reflects the large normal class. F1 reflects only the residual attack flags, and that small class collapses precision. Per-step F1 of 82.25% is the right comparison."\nAttack Rate Reduction of 76.13% means: before the system intervenes the attack rate is higher; after isolation and scheduling it drops by 76.13%.'),
sep(), pb(),

// ═══ SLIDE 37 ═══════════════════════════════════════════════════════════════
slideHeader(37, 'Multi-Seed Reproducibility — Table 7.6', '60 seconds'),
...sp(1),
image('A table with 5 rows for seeds 42-46, columns for accuracy and FPR. Below the table: a bar chart showing mean 93.85% accuracy with a small error bar of 0.33 percentage points.'),
...sp(1),
say('To verify reproducibility, the evaluation was repeated five times using different random seeds — seeds 42 through 46 — where each seed places attacks on a different set of agents with a different noise pattern. Seed 42 gives 93.75% accuracy at 6.28% FPR. Seed 43: 94.34% at 5.69%. Seed 44: 93.83% at 6.21%. Seed 45: 93.42% at 6.60%. Seed 46: 93.91% at 6.10%. Mean accuracy across all five seeds: 93.85%, with a standard deviation of just 0.33 percentage points. The false positive rate holds at 6.18% with the same 0.33 point spread. That tight spread confirms the result is stable across seeds, not a lucky single run.'),
...sp(1),
notesBox('TIP: 60 seconds. The 0.027% std dev is the key reproducibility claim — it is tiny.\nIf asked: "Why five seeds and not ten?" — Five is standard in recent ML literature for demonstrating reproducibility without excessive computational cost. Results could be extended to ten or more as future work.'),
sep(), pb(),

// ═══ SLIDE 38 ═══════════════════════════════════════════════════════════════
slideHeader(38, 'Five-Method Comparative Study', '90 seconds'),
...sp(1),
image('A grouped bar chart: 5 bars per metric (Accuracy, FPR, Recall, Precision, F1). Each method a different colour. Our system bar is the tallest on all positive metrics and shortest on FPR. A callout box: +41 pp F1 over best single-method baseline.'),
...sp(1),
say('We compared five methods on identical data — same sequences, same attack profiles, same evaluation window. Deviation-Only, which is the base paper approach: 81.40% accuracy, 9.06% FPR, 36.89% recall, 41.18% F1. It misses two-thirds of attacks and has unacceptably high false positives. LSTM-Only: 86.35% accuracy, zero FPR, but only 22.67% recall — it is so conservative that it misses three in four real attacks. Isolation Forest: 68.85% accuracy, 27.95% FPR — density-based methods struggle with the mixed-population grid data. One-Class SVM: 46.35% accuracy, 59.99% FPR — operationally unusable. Our system: 94.23% accuracy, 1.81% FPR, 75.76% recall, 89.95% precision, 82.25% F1. We lead on all five metrics simultaneously. F1 improvement is plus 41 percentage points over the best single-method baseline.'),
...sp(1),
notesBox('TIP: 90 seconds. Read these numbers slowly and clearly — examiners write them down.\nThe key insight: every single-method baseline has either a high FPR or a low recall. Only the multi-layer system achieves both low FPR and high recall simultaneously. That is the fundamental advantage of chaining layers.'),
sep(), pb(),

// ═══ SLIDE 39 ═══════════════════════════════════════════════════════════════
slideHeader(39, 'Scalability and Latency', '75 seconds'),
...sp(1),
image('Two charts: left is a line graph showing accuracy and FPR vs N (100, 200, 500). Accuracy drops and FPR rises sharply at N=500. Right is a latency breakdown bar chart for N=100, N=200, N=500 showing average and P95 latency.'),
...sp(1),
say('How does the system scale? At N equals 100 — our primary configuration — everything works as reported. At N equals 200, accuracy holds at 93.69% and the false positive rate barely moves at 6.33%. Risk mitigation stays near 93.76% and audit coverage is still a full 100%. At N equals 500, accuracy is still 93.70% and the false positive rate is unchanged at 6.33% — the detection itself scales cleanly. What changes is audit coverage, which falls to 91.44% because the fixed audit budget is now spread across more agents, and latency, which rises from 55 milliseconds at N equals 100 to 255 milliseconds at N equals 500. So the resources that need attention for larger deployments are the audit budget and inference batching, not the per-step detection.'),
...sp(1),
notesBox('TIP: 75 seconds. Be clear about what changes at scale — detection stays stable, but audit coverage and latency are the pressure points.\nIf asked: "What is the recommended deployment size?" — Detection holds to N=500; beyond that, batched inference and a larger or smarter audit budget are the extensions listed in future work.'),
sep(), pb(),

// ═══ SLIDE 40 ═══════════════════════════════════════════════════════════════
slideHeader(40, 'Limitations — Honest Assessment', '60 seconds'),
...sp(1),
image('A table with two columns: Limitation and Detail. Each row in a slightly different shade of light orange-red to convey acknowledgement rather than failure. A footer note: "Transparency is part of the design."'),
...sp(1),
say('Let me be honest about what this system is and is not. The telemetry is generated by Rapid SCADA calculated channels — no physical RTUs, IEDs, or PMUs are connected. This is an operational prototype, not a field-deployed utility system. The baselines are hand-engineered, not learned from operational data. The 24-hour F1 of 17.76% reflects the audit pipeline clearing most attacks before they accumulate, as explained, not a model weakness. At N equals 500, detection stays stable but audit coverage falls to 91.44% as the fixed budget spreads across more agents, which needs further work. The attack typology covers five classes — replay attacks and ramp-metering attacks are not yet modelled. Every limitation is documented, and every result is reported under the exact conditions that produced it.'),
...sp(1),
notesBox('TIP: 60 seconds. Being upfront about limitations shows maturity and earns respect from examiners.\nIf asked: "Does this mean it cannot be deployed?" — No. The software pipeline is fully functional. Only the data source needs to change for field deployment. All seven future work items address real limitations.'),
sep(), pb(),

// ═══ SLIDE 41 ═══════════════════════════════════════════════════════════════
slideHeader(41, 'Conclusion and Future Work', '90 seconds'),
...sp(1),
image('A clean split layout: top half "What We Built" with checkmarks, bottom half "Future Work" with 7 numbered arrows pointing forward. A small metrics summary box in the top-right corner with 93.85% / 6.18% / 98.24% / 57.28%.'),
...sp(1),
say('To summarise what was built: a four-layer detection pipeline — deviation, dual-branch LSTM, ensemble, and CUSUM slash DoS slash MITM slash fault detectors — that no prior system combined. Dual-dataset LSTM pre-training on UCI and UNSW-NB15. Focal Loss and temperature calibration for well-calibrated outputs. A 4D Q-table with 300 states, experience replay, and CVaR reward modes. Gradient cost optimiser for continuous budget allocation. Five-class attack typing with temporal signature classification. A live Rapid SCADA pipeline with all 12 integration tests passed. Per-feature XAI for every anomaly flag. The system improves on the base paper in risk mitigation, cost efficiency, and audit coverage, adds recall and per-attack typing that the base paper does not report, and trades a little accuracy for high recall. Against the four single-method baselines, the multi-layer system leads on all five classification metrics.\n\nSeven future work directions: one, connect physical RTUs and IEDs. Two, adaptive baselines that adjust to seasonal load, equipment ageing, and topology changes. Three, adaptive threshold calibration for large deployments. Four, extended attack typology including replay and ramp-metering. Five, IDS and SIEM integration. Six, adversarial robustness testing against adaptive attackers who probe system thresholds. Seven, formal verification of safety-critical escalation decisions using model checking.'),
...sp(1),
notesBox('TIP: 90 seconds. End strong and confident. Do not rush this summary.\nIf asked after this slide: "What is your single most important contribution?" — The live SCADA integration with full four-layer detection, because no prior system demonstrated this end-to-end.'),
sep(), pb(),

// ═══ SLIDE 42 ═══════════════════════════════════════════════════════════════
slideHeader(42, 'References', '30 seconds'),
...sp(1),
say('Key references: the base paper is Priyadarsini 2025 from ACM Transactions on Cyber-Physical Systems. The FDI attack model is from Liu, Ning, and Reiter 2011 in ACM TISSEC. The UNSW-NB15 dataset is from Moustafa and Slay 2015. Focal Loss is from Lin et al. 2017, ICCV. Q-Learning from Watkins and Dayan 1992. Adam optimiser from Kingma and Ba 2015.'),
...sp(1),
notesBox('TIP: 30 seconds — do not read all references. Just name the base paper and 2-3 key ones. The slide is for the examiner to note for their records.'),
sep(), pb(),

// ═══ SLIDE 43 ═══════════════════════════════════════════════════════════════
slideHeader(43, 'Thank You / Q&A', '1-2 minutes'),
...sp(1),
image('Simple slide with your name, roll number, guide name, department, institute. Optionally a QR code linking to the GitHub repo or live dashboard URL. Clean dark background matching slide 1.'),
...sp(1),
say('Thank you for your time and attention. I am happy to answer questions or demonstrate any component of the system live. The dashboard is available at localhost:3000, Rapid SCADA is running at 127.0.0.1:10109, and I can show the detection pipeline running in real time.'),
...sp(1),
notesBox('TIP: Smile and make eye contact. Have the dashboard already open on your laptop before this slide.\nHave these ready to demonstrate: dashboard Operations Overview, Agent Monitoring for one GEN agent, the Audit Trail, the Decision Explainability tab, and the Rapid SCADA channel list.'),
sep(), pb(),

// ── APPENDIX — LIKELY QUESTIONS ────────────────────────────────────────────
new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'APPENDIX: Likely Examiner Questions and Answers', bold: true, size: 28, color: '1F3864' })] }),
...sp(1),

...[
  ['Why is F1 only 36% when accuracy is 99.6%?',
   'Extreme class imbalance. Only 145 of 28,800 steps are attacks (0.5%). Accuracy is dominated by correct normal classifications. F1 measures only the positive class — with such imbalance, even a small number of false positives collapses precision and drags F1 down. The per-step F1 of 82.25% from the five-method comparative study, computed on a balanced window, is the fair measure.'],
  ['Why not use a deep Q-network?',
   'The state-action space is manageable: 300 states, 3 actions. A DQN would be overkill and harder to interpret and audit. The tabular Q-table can be inspected, printed, and verified. For a safety-critical system, interpretability is more important than marginal performance gain.'],
  ['Are the attacks tested on real data?',
   'The attacks are synthetically injected with precisely defined parameters: FDI bias = 2.0 + 0.05t, DoS = latency+5.0/pkt+0.20/integrity-0.50, MITM = Gaussian noise N(0,1^2) per step. This is necessary to have ground truth labels for computing precision and recall. Real SCADA attacks do not come with pre-labelled ground truth.'],
  ['Why is the system limited to ~200 agents?',
   'Three bottlenecks at N=500: (1) LSTM trained on N=100 data shows distributional shift at N=500, (2) Q-table thresholds calibrated at N=100 become sub-optimal, (3) fixed audit budget is exhausted before all 500 agents can be serviced. Addressing these is future work.'],
  ['How does Tier-A suppression work?',
   'ALL five conditions must hold simultaneously to suppress: score ratio < 3.50, LSTM probability < 0.60, network intrusion probability < 0.55, hybrid confidence < 1.05, no Layer C signature. If even ONE fails, the alert passes through. This is deliberately strict — only the clearest non-events are dropped.'],
  ['What is the Tier-B design decision?',
   'We designed and tested a second suppression tier in three variants. All three reduced FPR only marginally while causing measurable recall drops. The operating point of 94.23% accuracy with high recall was judged more defensible. Tier-B was removed by design.'],
  ['What is the ablation study result?',
   'Removing Layer A: F1 drops from 82.25% to below 50%. Removing Layer B: misses slow-onset attacks. Removing Layer C: cannot classify attack types. Removing Tier-A: FPR spikes. Every layer is necessary.'],
  ['What makes UNSW-NB15 features reliable?',
   'UNSW-NB15 was created from real captured network traffic at the University of New South Wales Cyber Range Lab. The 49 raw features are engineering measurements from actual packet captures. The log transform normalises the heavy-tailed distributions standard in network traffic data.'],
  ['What does Attack Rate Reduction of 76.13% mean?',
   'Before the system intervenes (detects and escalates), active attacks proceed unimpeded. After the system detects and schedules isolation/increased audit for flagged agents, the effective attack rate — the proportion of agents under active undetected attack — drops by 76.13% compared to no intervention.'],
  ['Can this be deployed in a real utility?',
   'The software pipeline is fully functional. The data source would need to change from calculated channels to real RTU/IED/PMU telemetry via Modbus or OPC-UA. The detection, scheduling, XAI, and dashboard components require no changes. Future Work item 1 addresses exactly this.'],
].map(([q, a]) => [
  new Paragraph({ spacing: { before: 240, after: 60 }, children: [new TextRun({ text: 'Q: ' + q, bold: true, size: 22, color: '1F3864' })] }),
  new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'A: ' + a, size: 22 })] }),
]).flat(),

// ── DEDICATED TERMS GLOSSARY ────────────────────────────────────────────────
new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun({ text: 'DEDICATED NOTES SECTION — Master Terms List', bold: true, size: 28, color: '1F3864' })] }),
new Paragraph({ children: [new TextRun({ text: 'These terms come up repeatedly in the presentation. Know all of them cold — examiners will test you on any of them.', size: 22 })] }),
...sp(1),

new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 7160], rows: [
  ...[
    ['Smart Grid', 'A power grid using computers, sensors, and two-way communication alongside physical infrastructure'],
    ['SCADA', 'Supervisory Control and Data Acquisition — control room software for monitoring and controlling physical equipment remotely'],
    ['FDI', 'False Data Injection — attacker replaces real sensor readings with fake ones that look normal'],
    ['DoS', 'Denial of Service — attacker floods communication so real signals cannot get through'],
    ['MITM', 'Man-in-the-Middle — attacker intercepts and modifies messages between two devices'],
    ['LSTM', 'Long Short-Term Memory — neural network that remembers patterns over time sequences'],
    ['Dropout', 'Randomly disabling neurons during training to prevent over-reliance on any single neuron'],
    ['Focal Loss', 'Modified loss function that forces the model to focus on hard, rare examples (attacks)'],
    ['Calibration / Temp.', 'Post-training adjustment so 80% output = 80% real attack probability'],
    ['CUSUM', 'Cumulative Sum — accumulates small deviations; fires alarm when sum crosses threshold'],
    ['Q-learning', 'RL algorithm learning best action per situation through trial and error'],
    ['Bellman equation', 'Q-learning update rule: new_Q = old_Q + alpha x (reward + gamma x future - old_Q)'],
    ['epsilon-greedy', 'Exploration strategy: random action with prob epsilon, best known action with (1-epsilon)'],
    ['Experience replay', 'Storing past transitions and sampling randomly from them to break correlation'],
    ['CVaR', 'Conditional Value at Risk — penalises worst-case outcomes; makes scheduler risk-averse'],
    ['EMA / EWMA', 'Exponential Moving Average — gradually updates baseline using weighted recent values'],
    ['Baseline', 'Expected normal value for a feature. Reference point for all deviation scoring.'],
    ['Threshold (tau)', 'Allowed deviation band. Score = (x - baseline) / threshold.'],
    ['Normalisation', 'Converting all features to dimensionless scale: z = (x - b) / tau'],
    ['XAI', 'Explainable AI — per-feature contribution scores showing what drove each alert'],
    ['Rapid SCADA', 'Open-source SCADA platform v6 used as the live supervisory system'],
    ['Calculated channel', 'SCADA channel whose value comes from a formula, not a physical sensor'],
    ['Stage 1 fusion', 'Combining two LSTM branch probabilities: 0.58xphysical + 0.42xcyber + bonuses'],
    ['Stage 2 ensemble', '0.48 x deviation_score + 0.52 x fused_LSTM + suspicion_credit'],
    ['Tier-A gate', 'Five-condition suppression: all five must hold simultaneously to drop an alert'],
    ['Attack Rate Reduction', '76.13% — reduction in active undetected attacks after system intervention'],
    ['Temporal signature', 'STEP / RAMP / OSCILLATORY / STABLE — pattern of deviation over 5-step window'],
    ['K-Means', 'Clustering algorithm grouping agents by behaviour pattern (k=3 clusters)'],
    ['UCI Dataset', 'UCI ML Repo #471 — 10,000 power grid stability samples used for physical LSTM pre-training'],
    ['UNSW-NB15', 'Real network traffic dataset from UNSW — used for cyber LSTM pre-training'],
    ['ln(1+x)', 'Log transform: handles zero inputs, compresses skewed network traffic distributions'],
    ['Z-score', 'Subtract mean, divide by std. Brings all features to unit scale.'],
    ['Pre-training', 'Training LSTM on benchmark dataset first to give it a domain-informed starting point'],
    ['Feature engineering', 'Combining raw columns into meaningful composite features for the ML model'],
    ['Suspicion credit', 'Accumulates when readings stay borderline; decays on consecutive normal readings'],
    ['4D state space', '(risk, LSTM_prob, cluster, capacity) — 5x5x3x4 = 300 Q-table states'],
    ['Warm-starting', 'Setting initial Q-values from domain knowledge before training begins'],
    ['Attack Rate', 'Fraction of agents under active undetected attack at any given time'],
    ['Cross-Layer Stability', '90.62% — consistency of detection decisions across all four detection layers'],
    ['SHA-256 hash chain', 'Each audit log entry contains the hash of the previous entry — tamper-evident trail'],
    ['Adversarial robustness', 'Testing whether the detection system can handle attackers who know the detection thresholds'],
  ].map(([term, def]) => new TableRow({ children: [
    new TableCell({ borders, margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: { fill: 'FFF4E5', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: term, bold: true, size: 19, color: 'B05000' })] })] }),
    new TableCell({ borders, margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: { fill: 'FFFDF7', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: def, size: 19 })] })] }),
  ]}))
]}),

...sp(2),
new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '--- End of Speech Script v2 ---', italics: true, size: 20, color: '888888' })] }),

    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('Speech script written:', OUT);
});
