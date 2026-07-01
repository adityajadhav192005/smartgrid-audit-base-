const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
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
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, font: "Calibri", size: 22, ...opts })]
  });
}

function speech(text) {
  return new Paragraph({
    spacing: { after: 140, line: 312 },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: "2B5797", space: 8 } },
    children: [new TextRun({ text, font: "Calibri", size: 22, italics: true })]
  });
}

function defBox(term, definition) {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    shading: { type: ShadingType.CLEAR, fill: "FFF3E0" },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({ text: term + ": ", bold: true, font: "Calibri", size: 21, color: "BF360C" }),
      new TextRun({ text: definition, font: "Calibri", size: 21 })
    ]
  });
}

function tip(text) {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    shading: { type: ShadingType.CLEAR, fill: "E8F5E9" },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({ text: "TIP: ", bold: true, font: "Calibri", size: 21, color: "2E7D32" }),
      new TextRun({ text, font: "Calibri", size: 21 })
    ]
  });
}

function slideHeader(num, title) {
  return new Paragraph({
    spacing: { before: 400, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: "1F3664" },
    indent: { left: 0, right: 0 },
    children: [new TextRun({ text: `  SLIDE ${num}: ${title}`, bold: true, font: "Calibri", size: 28, color: "FFFFFF" })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size: 22 })]
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
          children: [new TextRun({ text: "SmartGrid AI Audit Framework | Demo Speech Script", italics: true, font: "Calibri", size: 18, color: "888888" })]
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
        spacing: { before: 300 },
        children: [new TextRun({ text: "PRESENTATION DEMO SPEECH SCRIPT", font: "Calibri", size: 32, bold: true, color: "333333" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: "Slide-by-slide spoken script with term definitions, explanations, and demo cues", font: "Calibri", size: 22, color: "666666" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: "Aditya Sanjay Jadhav (242050010)", font: "Calibri", size: 24 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Guide: Prof. Shrinivas Khedkar | VJTI Mumbai | M.Tech 2025-26", font: "Calibri", size: 22, color: "666666" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // HOW TO USE
      heading("How to Use This Script", HeadingLevel.HEADING_1),
      bullet("Blue left-bordered text = what to SAY aloud during the presentation"),
      bullet("Orange boxes = term definitions for your own understanding (do not read these aloud)"),
      bullet("Green boxes = practical tips for that slide"),
      bullet("[SHOW LIVE] = open that file or URL on your laptop at that moment"),
      bullet("Bold words in the speech = words to emphasise while speaking"),
      bullet("Do not memorise word-for-word. Read until you understand the concept, then speak naturally."),
      para("Estimated total speaking time: 35-45 minutes including Q&A."),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SLIDE 1 ==========
      slideHeader(1, "Title Slide"),
      para("On screen: Project name, your name, roll number, guide name, VJTI Mumbai"),
      speech("Good morning, Professor. My name is Aditya Jadhav, roll number 242050010. I am presenting my M.Tech project, SmartGrid AI Audit Framework for Cyber-Physical Monitoring and Audit Intelligence. This project builds a complete cybersecurity monitoring system for modern electricity grids. It detects three types of cyber attack, schedules security audits using reinforcement learning, explains every detection decision to the operator, and runs on live SCADA data. I will walk through the full system today, from the problem statement to live demonstration."),
      tip("Keep this under 30 seconds. Make eye contact. Do not rush the project title."),

      // ========== SLIDE 2 ==========
      slideHeader(2, "Problem Statement"),
      defBox("Smart Grid", "An electricity grid that uses computer networks and sensors alongside physical power lines. Your home electricity comes from one. It has generators, substations, breakers, all connected and monitored by computers."),
      defBox("SCADA", "Supervisory Control and Data Acquisition. The software that grid operators use to monitor and control the physical equipment remotely."),
      defBox("FDI", "False Data Injection. The attacker sends fake sensor readings to the control system. The operator sees normal numbers but the grid is actually under attack."),
      defBox("DoS", "Denial of Service. The attacker floods the communication channel so real control signals cannot get through."),
      defBox("MITM", "Man-in-the-Middle. The attacker sits between two devices and intercepts or modifies messages in transit."),
      speech("Smart grids combine power infrastructure with communication networks. This connectivity improves efficiency but creates an attack surface. There are three main attack types we handle: FDI corrupts sensor readings, DoS blocks communication channels, and MITM intercepts messages in transit. The core problem is that traditional monitoring uses fixed thresholds and periodic audits. These miss slow, coordinated attacks. Single-layer detectors cannot tell the difference between a genuine attack and normal physical noise. And when an alert fires, operators have no way to know why it was raised. Our framework solves all of these problems together."),
      tip("Spend about 90 seconds. This sets up everything. If asked what makes your work different from the base paper, point to the six bullet points on screen."),

      // ========== SLIDE 3 ==========
      slideHeader(3, "Project Objectives"),
      speech("We have four main objectives. First, multi-layer detection: we combine statistical deviation scoring, a dual-branch LSTM for temporal patterns, weighted ensemble fusion, and three attack-specific detectors for FDI, DoS, and MITM. Second, a hybrid audit scheduler that pairs Q-learning for escalation decisions with gradient descent for continuous budget allocation. Third, live SCADA integration with Rapid SCADA monitoring 100 agents through a PowerShell bridge into our FastAPI backend. And fourth, per-feature explainability so operators understand exactly why each alert was raised, not just that something triggered. The goal is to surpass the base paper on every metric with honest, reproducible results."),
      tip("Point to each numbered objective as you mention it. 60-90 seconds."),

      // ========== SLIDE 4 ==========
      slideHeader(4, "Base Paper Deep Dive"),
      defBox("Deviation scoring", "Measuring how far each agent's current readings are from its normal baseline. Like checking how far today's temperature is from the average."),
      defBox("Q-learning", "A reinforcement learning algorithm. The system learns which actions lead to the best outcomes through trial and error, storing learned values in a table."),
      speech("The base paper by Priyadarsini, published in ACM Transactions on Cyber-Physical Systems in 2025, uses single-layer deviation-based scoring with Q-learning-only scheduling. It simulates 100 agents but has no live SCADA connection, no multi-layer detection, no explainability, and no comparison with other methods. It achieves 98.4% accuracy, 3.2% false positive rate, 87.9% risk mitigation, 42.5% cost efficiency, and 93.8% audit coverage. The right side of this slide shows exactly what the base paper lacks and what we add: four-layer detection instead of one, hybrid scheduling instead of Q-only, live SCADA, per-feature XAI, five-method benchmarking, and an operator dashboard."),
      tip("This is a critical slide. Examiners want to know you deeply understand the base paper AND what its weaknesses are. Be ready for questions like: Why is single-layer not enough? Why add gradient descent to Q-learning?"),

      // ========== SLIDE 5 ==========
      slideHeader(5, "Improvements Over Base Paper"),
      speech("This table shows our improvements head to head. Detection accuracy: 98.4% to 99.61%, a 1.21 percentage point gain. False positive rate: 3.2% down to 0.39%, a reduction of 2.81 points. Risk mitigation: 87.9% up to 100%. Cost efficiency: 42.5% to 54.32%, plus 11.82 points. Audit coverage: 93.8% to 100%. Plus we add three capabilities the base paper does not have at all: multi-layer detection, hybrid scheduling, live SCADA integration, and explainability. Every metric improved. Every gap addressed."),
      tip("Read the numbers slowly and clearly. Examiners will note these down. 60 seconds."),

      // ========== SLIDE 6 ==========
      slideHeader(6, "System Overview"),
      speech("This diagram shows the end-to-end flow. Data comes from either the simulation engine or Rapid SCADA. It passes through the detection pipeline, then the scheduler, then out to the operator dashboard. Two workspaces run in parallel: the Experiment workspace for controlled benchmarking, and the SCADA workspace for real-time operations. Both share the same FastAPI backend and detection logic."),
      tip("Point to the flow diagram as you speak. 30-45 seconds."),

      // ========== SLIDE 7 ==========
      slideHeader(7, "Five-Tier System Architecture"),
      defBox("FastAPI", "A Python web framework. Our backend runs on it. It receives data, runs the detection algorithms, and sends results to the dashboard."),
      defBox("WebSocket", "A persistent connection between browser and server. Unlike normal HTTP where the browser must keep asking for updates, WebSocket lets the server push new data automatically."),
      speech("The architecture has five tiers. Tier 1, Data and Ingestion: Rapid SCADA with 100 agents and 300 channels, plus the PowerShell bridge polling every 5 seconds. Tier 2, Detection: the FastAPI backend running Mahalanobis scoring, the dual-branch LSTM, and all sub-detectors. Tier 3, Scheduling and XAI: the Q-learning table, gradient optimiser, and the explainability module computing feature attributions. Tier 4, Presentation: the Next.js dashboard with 8 operational views delivered via REST and WebSocket. The five tiers from the journal paper map to these four visual boxes, with Ingestion and Data combined in Tier 1."),
      tip("If asked about the five-tier vs four-box discrepancy: Data and Ingestion are combined in one visual box for slide clarity, but they are logically separate tiers."),

      // ========== SLIDE 8 ==========
      slideHeader(8, "How Feature Values Are Generated"),
      defBox("Synthetic data", "Data generated by mathematical formulas (sine waves + noise) rather than real physical sensors. We use it because we need controlled ground truth labels to measure detection accuracy."),
      defBox("UCI Grid Stability", "A well-known academic dataset from the UCI Machine Learning Repository. Contains 10,000 real power grid measurements from a 4-generator model."),
      defBox("UNSW-NB15", "A real network traffic dataset from the University of New South Wales. Contains 257,675 actual network packets with labeled attack types."),
      speech("By default, the system generates all data synthetically using sine-wave baselines with Gaussian noise. Attacks are injected on top, and ground truth labels are set at generation time. Optionally, two real-world datasets can train the LSTM branches: UCI Grid Stability trains the physical branch with 10,000 real power grid observations, and UNSW-NB15 trains the cyber branch with 257,675 real network packets. These are loaded via environment variables at startup. The important thing to understand is: the datasets teach the LSTM what attacks look like, while the sine-wave formula creates what the LSTM scores during operation. They are completely separate concerns."),
      tip("If asked: Why synthetic data? Answer: We need exact ground truth labels to compute precision and recall. Real SCADA deployments rarely have labeled attack data."),

      // ========== SLIDE 9 ==========
      slideHeader(9, "Multi-Layer Detection Pipeline"),
      speech("The detection pipeline has four layers. Layer A: statistical deviation using Mahalanobis distance from each agent's normal baseline. It catches instantaneous spikes like FDI step-changes. Layer B: a dual-branch LSTM with short and long time windows. It captures temporal patterns that statistics miss. Layer C: weighted ensemble fusion combining 0.48 times the deviation score plus 0.52 times the LSTM probability, with a false-positive suppression gate. And finally, three parallel specialist detectors: CUSUM for FDI drift, a rate-rule for DoS communication dropouts, and a jump-logic detector for MITM integrity violations. Each layer catches what the previous one misses, and the OR-with-precedence combiner produces the final decision."),
      tip("[SHOW LIVE] Open the detection pipeline diagram at this point. 90 seconds for this slide."),

      // ========== SLIDE 10 ==========
      slideHeader(10, "Detection Layers A & B"),
      defBox("Mahalanobis distance", "Unlike simple Euclidean distance which treats all features equally, Mahalanobis accounts for correlations between features. If voltage and current normally move together, a case where voltage rises but current does not gets flagged."),
      defBox("Dual-branch LSTM", "Two separate LSTM neural networks running in parallel. One processes physical features (voltage, current, power), the other processes cyber features (latency, packet loss, integrity). They merge later."),
      speech("Layer A computes Mahalanobis distance from the learned normal baseline for each agent. It is normalised to a zero-to-one range and catches sudden step changes instantly without needing any history. Layer B runs two parallel LSTM branches: a short window of 10 steps for rapid transients and a long window of 30 steps for slow drifts. Each branch outputs an anomaly probability. They complement each other. Here is the key insight: deviation-only detection, which is what the base paper uses, gives 81.40% accuracy with 9.06% false positive rate. It misses slow attacks entirely. LSTM-only gives 86.35% accuracy but only 22.67% recall, meaning it misses three in four real attacks because it is too conservative. Combined, our system reaches 94.23% accuracy with 82.25% F1 and only 1.81% FPR. The table at the bottom shows the weight grid search we ran to find the optimal 0.48/0.52 split."),
      tip("This is a technical slide. Speak slowly. If asked: Why not just use a deeper LSTM? Answer: The 24-hour training window does not have enough labeled attacks for a larger model to converge."),

      // ========== SLIDE 11 ==========
      slideHeader(11, "Layer C + Attack-Specific Detectors"),
      defBox("CUSUM", "Cumulative Sum. A statistical test that adds up small deviations over time. If someone injects a tiny bias every step, CUSUM accumulates it until it crosses an alarm threshold."),
      defBox("OR-with-Precedence", "If ANY detector fires, the agent is flagged. If multiple fire, the most specific label wins. FDI/DoS/MITM labels take priority over a generic 'sustained anomaly' label."),
      speech("Layer C fuses the deviation and LSTM scores with weights 0.48 and 0.52. The suppression gate drops flags where the deviation is below 0.1 and no specialist detector fired, cutting false alarms. Three specialist detectors run in parallel. CUSUM tracks cumulative drift for FDI. The rule-based detector counts missing or zero frames for DoS. The integrity-jump detector checks whether value changes exceed physical rate limits for MITM. The OR-with-precedence combiner means any flag from any layer is enough. This gives us category-level classification that a single anomaly score cannot provide."),

      // ========== SLIDE 12 ==========
      slideHeader(12, "Hybrid Audit Scheduler"),
      defBox("Bellman equation", "The core formula of Q-learning. It says: update your estimate of how good an action is, based on the reward you actually got plus the best future reward you expect."),
      defBox("Gradient descent", "An optimisation method. Imagine rolling a ball downhill on a cost surface. Each step moves toward lower cost. Here it finds the cheapest audit frequency that still covers the risk."),
      speech("The scheduler runs in two steps. Step 1: Q-learning makes discrete decisions. The state encodes each agent's risk bin and type. Actions are ROUTINE, PRIORITY, or CRITICAL. Rewards are plus 10 for catching an attack while in CRITICAL state, minus 5 for a miss, minus 1 per budget unit spent. The Q-table has 12 states and 3 actions. Learning rate is 0.1, discount factor 0.95, epsilon decays from 1.0 to 0.05. Step 2: gradient descent refines the continuous audit frequency. It minimises the cost function C equals audit cost times frequency plus failure cost times risk divided by frequency. This converges to the closed-form optimum. Why hybrid? Q-learning handles discrete choices well but cannot optimise continuous allocation. Gradient descent handles continuous variables but cannot make categorical escalation decisions. Together they give 54.32% cost efficiency versus 42.5% for Q-learning alone."),
      tip("If asked: Why not deep Q-network? Answer: 12 states and 3 actions is small enough for a table. A DQN would be overkill and harder to interpret."),

      // ========== SLIDE 13 ==========
      slideHeader(13, "Explainability Module (XAI)"),
      defBox("Feature attribution", "Answering: which specific measurement caused this alert? If voltage is 7.5 standard deviations above normal and that contributes 41% of the anomaly score, voltage is the primary driver."),
      defBox("NERC CIP", "North American Electric Reliability Corporation Critical Infrastructure Protection. Industry standards that require documented justification for automated control decisions in power grids."),
      speech("For every flagged agent, we compute the gradient of the anomaly score with respect to each feature. The percentage contribution of feature j equals its squared normalised deviation divided by the total. We rank all features and show the top 5 to the operator with their values, baselines, and contribution percentages. No extra inference passes are needed because the computation reuses values already calculated during deviation scoring. The output looks like: Agent SUB-32 flagged, primary driver voltage deviation plus 2.8 sigma. This matters because operators need to verify alerts before taking action. Regulatory standards like NERC CIP require documented rationale. And it builds trust in the system so operators do not ignore alerts."),
      tip("[SHOW LIVE] Open the Decision Explainability tab in the dashboard. 60-90 seconds."),

      // ========== SLIDE 14 ==========
      slideHeader(14, "Full Case Study: FDI on GEN_07"),
      speech("This table walks through one complete detection from start to finish. At time step 4,200 seconds, generator agent GEN-07 reports voltage 1.15 per unit when normal is 1.0. The attacker injected a plus 15 percent bias. Step by step: the z-score normalisation shows voltage is 7.5 sigma above normal. Mahalanobis distance is 8.34, well above the gate threshold. The short LSTM gives probability 0.89, the long LSTM 0.81, combined 0.85. CUSUM has been accumulating since step 4,195 and fires. Ensemble fusion gives score 0.864. Both the dual-criterion gate conditions pass. The suppression gate confirms because deviation is high and CUSUM fired. The scheduler escalates GEN-07 to CRITICAL with 60 percent budget allocation. And the XAI module identifies voltage at 7.5 sigma as the primary driver. One complete pipeline trace from raw data to explained, scheduled alert."),
      tip("This is your strongest slide for showing you understand every component. Walk through it row by row. 2-3 minutes."),

      // ========== SLIDE 15 ==========
      slideHeader(15, "Rapid SCADA Integration"),
      defBox("Rapid SCADA", "An open-source SCADA platform (version 6). We installed it locally and configured 100 calculated channels representing our 100 grid agents."),
      defBox("Calculated channels", "Channels in Rapid SCADA that compute values from formulas rather than reading from physical sensors. We use these because we do not have physical power grid hardware."),
      speech("We deployed against Rapid SCADA version 6 running 100 agents across 300 calculated channels, 3 per agent with 7 features total (3 physical plus 4 cyber). The PowerShell bridge polls the SCADA web API every 5 seconds, packages the readings into a JSON batch, and sends it to the FastAPI backend. The full detection and scheduling pipeline runs on each batch. The dashboard reflects live anomaly scores on every poll cycle. Important note: current telemetry uses SCADA calculated channels, meaning simulated physics, not readings from physical field devices. This is an operational prototype demonstrating the full pipeline, not a deployed utility system."),
      tip("[SHOW LIVE] Open Rapid SCADA in the browser at 127.0.0.1:10109. 60 seconds."),

      // ========== SLIDE 16 ==========
      slideHeader(16, "Operator Dashboard: 8 Live Views"),
      speech("The dashboard is built with Next.js and React, served on port 3000. It has 8 views. Operations Overview shows system-wide health at a glance. Agent Monitoring lets you drill down into any agent's live telemetry. Audit Trail records every scheduler decision with timestamps. Risk Analytics gives a heatmap of risk scores. Threat Events shows a timeline of detected attacks. Decision Explainability shows the XAI feature contributions. System Health monitors backend latency and model status. Asset Topology shows the grid layout with agent connections. Real-time updates come through WebSocket, so the dashboard refreshes automatically every detection cycle without manual polling."),
      tip("[SHOW LIVE] Open localhost:3000 and walk through 2-3 views. Show both Experiment and SCADA workspaces. 90 seconds."),

      // ========== SLIDE 17 ==========
      slideHeader(17, "Experimental Setup"),
      speech("Our primary evaluation runs 100 agents over a 24-hour simulation with 28,800 time steps. Only 145 of those steps are genuine anomalies, giving a class imbalance of roughly 198 to 1. We inject all three attack types: 72 FDI events, 54 DoS events, and 19 MITM events. The LSTM trains on seeds 1 through 8 and is tested on seeds 9 and 10. The Q-table has 12 states (3 risk bins times 4 agent types) and 3 actions. We compare against 5 detection methods on identical data and test scalability at 100, 200, and 500 agents. All 12 test cases passed: SCADA connectivity, bridge pipeline, dashboard rendering, all 100 agents confirmed live."),

      // ========== SLIDES 18-19 ==========
      slideHeader(18, "Datasets Used"),
      speech("Two external datasets optionally supplement the synthetic training. UCI Grid Stability provides 10,000 real power grid observations to train the physical LSTM branch. UNSW-NB15 provides 257,675 real network packets to train the cyber LSTM branch. The 42 raw UNSW features are engineered down to 4 cyber metrics: latency-like, loss-like, integrity-like, and frequency-like, each computed as log-transformed combinations of relevant raw features."),

      slideHeader(19, "Dual-Branch LSTM Training"),
      speech("Both branches use the same architecture: a 2-layer LSTM with 64 hidden units feeding a sigmoid output. Physical branch uses 24-step windows, cyber uses 12-step windows. Both train with binary cross-entropy, Adam optimizer, learning rate 0.001, for 20 epochs. The fusion formula combines them with weight 0.58 on the physical branch and 0.42 on the cyber branch, plus a bonus when both branches agree and a penalty when they disagree. The physical branch gets higher weight because grid stability is the primary concern. The agreement bonus rewards corroboration; the disagreement penalty prevents single-branch false alarms."),

      // ========== SLIDE 20 ==========
      slideHeader(20, "Primary Results"),
      speech("Here are the headline numbers. 99.61% detection accuracy. 0.39% false positive rate. 100% risk mitigation. 54.32% cost efficiency. 100% audit coverage and 100% recall. Average latency 77 milliseconds. Now, you will notice the 24-hour F1 is only 36.16%. This is not because the model is weak. It is because of extreme class imbalance: only 145 attack steps out of 28,800 total. Accuracy is dominated by 28,655 correctly classified normal steps. The per-step F1 from our five-method comparison is 82.25%, which is a much better measure of per-decision quality."),
      tip("Examiners will ask about the low F1. Have this imbalance explanation ready. It is not a weakness, it is a measurement artefact."),

      // ========== SLIDE 21 ==========
      slideHeader(21, "Five-Method Comparison"),
      speech("We compared five methods on identical data. Deviation-only, which is the base paper approach: 81.40% accuracy, 9.06% FPR, 41.18% F1. It cannot tell noise from attacks. LSTM-only: 86.35% accuracy, zero false positives, but only 22.67% recall. It misses three in four real attacks. Isolation Forest: 68.85% accuracy with 27.95% FPR. Operationally unusable. One-Class SVM: the worst at 46.35% accuracy with 60% FPR. It flags the majority of normal states. Our full system: 94.23% accuracy, 1.81% FPR, 82.25% F1. It is the only method that simultaneously achieves accuracy above 90%, FPR below 2%, and F1 above 80%."),
      tip("Read this table slowly. These numbers prove your system is better. 90 seconds."),

      // ========== SLIDE 22 ==========
      slideHeader(22, "Visual Comparison"),
      speech("This chart visualises the same comparison. Our system leads on every axis. The F1 improvement is plus 44 percentage points over the best single-method baseline."),

      // ========== SLIDE 23 ==========
      slideHeader(23, "Scalability Analysis"),
      speech("At N equals 100, everything works perfectly. At N equals 200, accuracy barely changes from 99.61 to 99.28%. Risk mitigation drops to 75.74% because the fixed budget covers fewer agents per cycle. At N equals 500, accuracy drops to 82.85% and FPR rises to 17.63%. Three bottlenecks cause this: LSTM distributional shift because the model was trained on 100-agent data, Q-table coarseness because 12 states cover fewer risk gradations, and budget starvation because 150 units cannot cover 500 agents. Recommended deployment limit is about 200 agents without further optimisation. Fixes for 500-plus: distributed inference, adaptive threshold calibration, and budget scaling proportional to N."),

      // ========== SLIDE 24 ==========
      slideHeader(24, "Latency Analysis + Live Deployment"),
      speech("At N equals 100, average end-to-end latency is 77 milliseconds, well within the 5-second SCADA polling interval. LSTM inference accounts for 45 of those milliseconds. At 200 agents, 164 milliseconds. At 500, 367 milliseconds. Scaling is roughly linear up to 200, then super-linear due to LSTM batches exceeding L3 cache. The live pipeline was verified end-to-end: SCADA poll, PowerShell bridge, FastAPI detection, scheduler update, dashboard push. Full cycle completes within a single poll interval at N equals 100."),

      // ========== SLIDE 25 ==========
      slideHeader(25, "Discussion & Limitations"),
      speech("Let me be honest about what works and what does not. What works: multi-layer detection solves the recall versus FPR trade-off. Hybrid scheduling outperforms Q-only. SCADA pipeline is fully operational. XAI makes every alert traceable. Limitations: our telemetry comes from SCADA calculated channels, not physical sensors. Thresholds were fixed at N equals 100 and do not adapt. The 24-hour F1 reflects class imbalance. Scalability beyond 500 was not tested. Baselines are hand-engineered. This is a strong operational prototype. Physical field integration is the next step."),
      tip("Being upfront about limitations shows maturity. Examiners respect honesty."),

      // ========== SLIDE 26 ==========
      slideHeader(26, "Conclusion"),
      speech("To summarise. We built a four-layer detection pipeline that is the first to combine deviation, LSTM, ensemble, and CUSUM/DoS/MITM detectors. Our hybrid scheduler improves cost efficiency from 42.5% to 54.32% with 100% risk mitigation. We deployed end-to-end against live Rapid SCADA with 100 agents. We outperform the base paper on all 5 primary metrics and outperform all 4 baselines on all 5 classification metrics. Per-feature XAI makes every alert traceable. Future work: replace calculated channels with physical sensors, distributed inference for 500-plus agents, adaptive thresholds, and IDS/SIEM integration."),
      tip("Strong, clear summary. End with confidence. 60-90 seconds."),

      // ========== SLIDE 27 ==========
      slideHeader(27, "Key References"),
      speech("These are the key references. The base paper is Priyadarsini 2025 from ACM TOPS. Liu 2011 is the foundational FDI attack paper. We also build on Isolation Forest, One-Class SVM, deep learning fundamentals, Q-learning, and Adam optimiser."),
      tip("Do not read all references aloud. Just mention the base paper and 1-2 key ones if asked."),

      // ========== SLIDE 28 ==========
      slideHeader(28, "Thank You"),
      speech("Thank you for your time and attention. I am happy to take any questions or show a live demonstration of any component."),
      tip("Smile. Open the dashboard on your laptop so you are ready for live demo questions."),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== APPENDIX: LIKELY QUESTIONS =====
      heading("Appendix: Likely Questions and Answers", HeadingLevel.HEADING_1),

      para("Q: Why is F1 only 36% when accuracy is 99.6%?", { bold: true }),
      para("A: Extreme class imbalance. Only 145 of 28,800 steps are attacks (0.5%). Accuracy is dominated by correct normal classifications. The per-step F1 from the 5-method comparison is 82.25%, which better measures per-decision quality. In security systems, we optimise for recall (catching every attack) over precision."),

      para("Q: Why not use a deep Q-network instead of tabular Q-learning?", { bold: true }),
      para("A: The state-action space is tiny: 12 states, 3 actions. A DQN would be overkill and harder to interpret. The tabular Q-table can be inspected directly to understand what the system learned about each risk category."),

      para("Q: Is this tested on real attacks?", { bold: true }),
      para("A: The attacks are synthetically injected with known parameters (15% FDI bias, 30-step DoS blackout, 35% MITM integrity drop). This is necessary to have exact ground truth labels for computing precision and recall. Real attacks are rare and unlabeled. Optionally, real-world datasets (UCI and UNSW-NB15) can train the LSTM branches."),

      para("Q: Why does MITM have lower recall (97.3%) than FDI and DoS (100%)?", { bold: true }),
      para("A: The 2.7% miss rate comes from cases where the integrity drop was only marginally above the 35% threshold and the temporal z-jump was below 2.5 sigma due to the agent's recent variance. This is a conservative parameter setting that avoids flagging normal switching events as MITM attacks."),

      para("Q: How does the Tier-A suppression gate work?", { bold: true }),
      para("A: A candidate Layer A flag is dropped when three conditions hold simultaneously: the score ratio is below 3.5, no behavioural signature is present, and the LSTM probability is below 0.60. This filters out thermal cycling, load steps, and other physical-noise transients. Result: 47% reduction in spurious audit escalations."),

      para("Q: Why is the system limited to about 200 agents?", { bold: true }),
      para("A: Three specific bottlenecks at N=500: (1) LSTM trained on 100-agent data shows distributional shift, (2) the 12-state Q-table becomes too coarse for 500 risk levels, (3) fixed budget of 150 cannot cover 500 agents. Each has a targeted fix identified as future work."),

      para("Q: What is the ablation study?", { bold: true }),
      para("A: We disabled each layer one at a time. Without Layer A: F1 drops from 82.25% to 36.96%. Without Layer B: 41.18%. Without Layer C: 71.20%. Without Tier-A suppression: 68.40%. Every layer is essential."),

      // END
      new Paragraph({ spacing: { before: 600 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "--- End of Script ---", font: "Calibri", size: 22, color: "888888", italics: true })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("D:\\Mtech Main project\\smartgrid-audit-base-\\Report\\Knowledge\\SmartGrid_Demo_Speech_Script.docx", buffer);
  console.log("Document 2 created: SmartGrid_Demo_Speech_Script.docx");
});
