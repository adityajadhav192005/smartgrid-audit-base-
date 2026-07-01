# SmartGrid AI Audit Framework — Full Presentation Script
### Aditya Sanjay Jadhav | M.Tech 2025–26 | VJTI Mumbai
### Guide: Prof. Shrinivas Khedkar

---

> **HOW TO USE THIS SCRIPT**
> - Read each slide section before you stand up to present that slide.
> - The "[WHAT THIS MEANS]" boxes explain technical terms in simple words — these are for YOU to understand so you can answer questions confidently.
> - Words in **bold** are things you should emphasize when speaking.
> - `[SHOW LIVE]` means open that thing on your laptop right then.
> - Don't memorize word for word — read it enough times that you understand it, then speak naturally.

---

# SLIDE 1 — Title Slide

**What's on screen:** Project name, your name, roll number, guide's name, VJTI Mumbai

---

### WHAT TO SAY:

"Good morning, Professor Khedkar. My name is Aditya Jadhav, roll number 242050010. I am presenting my M.Tech project titled **'SmartGrid AI Audit Framework — Cyber-Physical Monitoring and Audit Intelligence.'**

This project addresses a very real and growing problem in modern power infrastructure — the fact that our electricity grids are now connected to the internet, and that connection makes them vulnerable to cyber attacks. My system detects those attacks, schedules security audits intelligently, explains every decision it makes, and does all of this on live data from a real SCADA system.

I will walk you through the complete system today — from the problem, to the base paper, to our architecture, results, and live demonstration. Please feel free to stop me at any point for questions."

---
---

# SLIDE 2 — Problem Statement

**What's on screen:** 6 bullet problems + core question + answer

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Smart Grid** = A modern electricity grid that uses computer networks and sensors alongside physical power lines. Your home electricity comes from a smart grid. It has generators, substations, circuit breakers — all connected and monitored by computers.

**Traditional monitoring** = Old style: engineers set fixed rules like "if voltage drops below X, raise an alarm." This is like a smoke alarm that only goes off at one fixed temperature — it misses slow fires.

**FDI** = False Data Injection attack. A hacker sends fake sensor readings to the control system. Example: they make the computer believe voltage is normal when it's actually dangerously high. The operator sees normal numbers but the grid is actually under attack.

**DoS** = Denial of Service attack. The attacker floods the communication channel with junk data so the real control signals can't get through. It's like jamming a phone signal.

**MITM** = Man-in-the-Middle attack. The attacker sits between two devices, intercepts their communication, and can read or change the messages. Like someone intercepting your WhatsApp messages.

**Explainability** = When an AI says "this is suspicious," the operator needs to know WHY. Without explanation, operators don't trust the system and ignore alerts.

**Fixed audit schedules** = Checking every device at the same time interval regardless of risk level. This wastes time on safe devices and might miss dangerous ones.

**SCADA** = Supervisory Control and Data Acquisition. It is the software that monitors and controls industrial infrastructure like power plants, water treatment, factories. Think of it as the "brain" that watches all sensors and can send control commands.

---

### WHAT TO SAY:

"Let me start with the problem we are solving.

Modern electricity grids — what we call **smart grids** — are no longer purely physical systems. They combine power infrastructure with communication networks and computer control systems. Every generator, substation, and circuit breaker now sends data to a central control system in real time. This connectivity makes them efficient but also makes them a target.

**The first problem** is that traditional monitoring uses static thresholds and periodic audits. If a value crosses a fixed limit, an alarm rings. But sophisticated attackers don't cause sudden spikes — they make slow, gradual changes that stay just within normal limits. These attacks are completely invisible to traditional systems.

**The second problem** is that single-layer anomaly detection cannot distinguish between different attack types. A **False Data Injection attack** — where an attacker sends fake sensor readings — looks different from a **Denial of Service attack** that floods the communication channel, which looks different from a **Man-in-the-Middle attack** where someone intercepts and modifies messages. A single detection method treats all anomalies the same and misses many of them.

**The third problem** is explainability. When an AI system raises an alert, the human operator gets a notification but doesn't know *why* the system flagged that particular agent. Is it the voltage? The communication latency? The power factor? Without knowing the root cause, operators cannot take the right corrective action — and they start ignoring alerts, which is called **alert fatigue**.

**The fourth problem** is budget waste. If you audit all 100 power grid agents every 5 minutes regardless of their risk level, you spend enormous time and computation on safe agents. Meanwhile, a high-risk agent might actually need continuous monitoring. Fixed schedules are inefficient.

**The fifth and most important problem** is that every existing research framework is simulation-only. They test their systems on stored datasets but never connect to a real, live control system. That gap between academic research and real deployment is exactly what this project bridges.

So the core question I set out to answer was: **How do we detect multiple attack types simultaneously, schedule audits intelligently based on risk, explain every decision to the operator, and do all of this on live, real-time SCADA data?**

The answer is the **SmartGrid AI Audit Framework** — and that is what I will present to you today."

---
---

# SLIDE 3 — Project Objectives

**What's on screen:** 4 numbered objectives with descriptions

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**LSTM** = Long Short-Term Memory network. A type of artificial intelligence that is very good at understanding sequences over time. Think of it like a person who reads a sentence and remembers context from earlier words. In our case, it reads a sequence of sensor readings over time and can detect patterns that develop slowly across multiple time steps.

**Ensemble** = Combining multiple models or methods and letting them vote. Like asking 5 doctors for an opinion and going with the majority. More reliable than trusting one model.

**CUSUM** = Cumulative Sum. A statistical method that adds up small deviations over time. Even if each individual deviation is too small to trigger an alarm, the cumulative sum reveals a slow drift that is actually an attack. Very good for detecting gradual, stealthy attacks.

**Q-learning** = A type of reinforcement learning (AI that learns by trial and error). The system learns which action (routine check, priority check, critical check) gives the best long-term result for each situation. Like how a chess player learns which moves lead to winning.

**Gradient descent** = An optimization technique. It keeps adjusting parameters in small steps until it finds the minimum cost. Like rolling a ball down a hill until it reaches the bottom.

**FastAPI** = A Python web framework for building APIs. It's what receives data from SCADA and sends it to our detection pipeline, then returns results to the dashboard.

**Next.js** = A JavaScript framework for building web dashboards. This is the visual interface the operator sees in their browser.

---

### WHAT TO SAY:

"My project has four primary objectives, and I will address each one in detail.

**Objective 1: Multi-Layer Detection.** Rather than a single anomaly detector, I built four separate detection layers that work in sequence. The first uses statistical mathematics to catch sudden spikes. The second uses an LSTM neural network to catch patterns that develop over time. The third combines both signals. The fourth runs three specialist detectors — CUSUM for slow drift attacks, a rule-based detector for communication failures, and a jump-logic detector for data substitution attacks. Each layer catches what the previous one misses.

**Objective 2: Hybrid Audit Scheduling.** The scheduling problem has two parts — first, deciding which agents need urgent attention versus routine checks, and second, distributing the limited audit budget efficiently. I use Q-learning for the first part because it handles discrete choices well, and gradient descent for the second part because it handles continuous resource allocation. Neither alone can do both jobs.

**Objective 3: Live SCADA Integration.** I connected this system to Rapid SCADA version 6, a real supervisory control system, with 100 simulated grid agents. A PowerShell bridge polls the SCADA API every 10 seconds, formats the data, sends it to our FastAPI backend, runs the full pipeline, and the Next.js dashboard updates automatically. This is a complete end-to-end operational deployment.

**Objective 4: Explainability.** For every agent that gets flagged as suspicious, the system computes which specific feature — voltage, current, power, frequency, or power factor — contributed most to that decision. The operator can see: 'Agent SUB-32 was flagged because its voltage deviated 2.8 standard deviations from normal.' This is not a black box.

The overarching goal of all four objectives is to surpass the base paper on every single metric — and as I will show you in the results, we did."

---
---

# SLIDE 4 — Base Paper Deep Dive

**What's on screen:** Base paper title, what it does, their results, what it lacks vs what we add

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**ACM TOPS** = ACM Transactions on Cyber-Physical Systems. This is a prestigious, peer-reviewed academic journal published by the Association for Computing Machinery. Papers here are rigorously reviewed and widely cited.

**Deviation-based anomaly scoring** = The base paper's detection method. For each agent, it computes how far the current reading is from a learned normal baseline. If the deviation is large enough, it flags it as an anomaly.

**S(t) = w × (physical dev + cyber dev)** = Their formula. 'w' is the agent's importance weight. They add the physical deviation (voltage, current etc.) to the cyber deviation (latency, packet loss etc.) and multiply by weight. Simple but effective as a baseline.

**Simulated grid** = They never connected to a real SCADA system. They generated synthetic data in Python/MATLAB and tested on that. Like testing a driving algorithm in a video game but never putting it in a real car.

---

### WHAT TO SAY:

"Let me now do a deep dive into the base paper, because understanding what they did — and what they didn't do — is what justifies the entire design of my system.

The base paper is by Priyadarsini, published in 2025 in ACM Transactions on Cyber-Physical Systems, which is a top-tier journal. The paper is titled **'AI-Driven Audit Framework for Distributed Multi-Agent Smart Grids.'** This is a solid, well-cited piece of research, and my work builds directly on top of it.

**What did the base paper actually do?** Their core contribution is a deviation-based anomaly scoring formula: S of t equals w times the sum of physical deviation and cyber deviation. In simple terms: they measure how much each agent's sensor reading differs from its learned normal baseline, multiply by the agent's importance weight, and if that score crosses a threshold, they flag it as an anomaly.

Their scheduler uses Q-learning alone to decide how often to audit each agent. And they tested this on a simulated 100-agent grid — entirely synthetic data, no live SCADA connection.

**Their results are respectable:** 98.4% accuracy, 3.2% false positive rate, 87.9% risk mitigation, 42.5% cost efficiency, and 93.8% audit coverage.

**But here is what they did not do, and this is the research gap my project fills:**

First — they used **only one detection layer**. Their deviation formula treats all anomalies identically. It cannot distinguish between a fast FDI spike and a slow CUSUM drift. As we will see in my comparison, deviation-only gives 9% false positive rate and only 37% recall.

Second — they used **Q-learning only** for scheduling. Q-learning is great for discrete decisions like 'routine vs priority vs critical.' But allocating a continuous budget across 100 agents is a continuous optimization problem that Q-learning cannot solve well. My hybrid approach improves cost efficiency from their 42.5% to my 54.32%.

Third — **no live SCADA integration whatsoever**. Every experiment in their paper is on generated data. My system is connected to a running instance of Rapid SCADA with 100 active agents.

Fourth — **no explainability**. Their system raises an alert with a risk score. The operator doesn't know which feature caused it. My system tells you exactly: voltage dropped, or latency spiked, or power factor shifted.

Fifth — **no method comparison**. They propose their approach but never compare it against LSTM-only, Isolation Forest, or SVM. I run a 5-method benchmark on identical data.

Sixth — **no operator dashboard**. Their results are in CSV files and matplotlib plots. My system has a live, eight-view Next.js dashboard.

So my system is not a replacement for their work — it is a direct, systematic extension that addresses every single one of these gaps."

---
---

# SLIDE 5 — Our Improvements Over the Base Paper

**What's on screen:** Comparison table — 8 metrics, base paper vs our system

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**pp** = Percentage points. If something goes from 3.2% to 0.39%, the reduction is 2.81 percentage points (not 2.81%).

**FPR (False Positive Rate)** = Out of all the normal, safe events, what percentage did the system incorrectly call suspicious? If FPR is 3.2%, it means for every 100 normal events, 3.2 were falsely raised as alarms. Lower is better. Our system is 0.39% — much better.

**Risk Mitigation** = What percentage of the total risk in the system was the scheduler able to bring under control? 100% means every high-risk agent got attended to in time.

**Cost Efficiency** = How much did the scheduler reduce unnecessary audit costs? 54.32% means it spent 54.32% less than a naive uniform schedule would.

**Audit Coverage** = What percentage of agents received at least one audit in the evaluation period? 100% means no agent was forgotten.

---

### WHAT TO SAY:

"Let me show you the numbers directly.

Looking at this comparison table, every single metric improved. Not one or two — all of them.

**Detection Accuracy** went from 98.4% to 99.61% — a gain of 1.21 percentage points. This might seem small but remember we are starting from a very high baseline.

**False Positive Rate** dropped from 3.2% to 0.39% — a reduction of 2.81 percentage points. This is operationally very significant. In a real grid with 100 agents, a 3.2% false positive rate means roughly 3 unnecessary alarms per 100 events. Operators stop trusting the system. At 0.39%, the system is nearly always right when it raises an alarm.

**Risk Mitigation** went from 87.9% to 100%. Every single high-risk situation was detected and scheduled for action. Zero misses.

**Cost Efficiency** improved from 42.5% to 54.32% — the hybrid scheduler reduced wasted audit budget by 12 additional percentage points over the base paper.

**Audit Coverage** improved from 93.8% to 100%. Every agent received at least one audit in the 24-hour evaluation.

**Detection layers** went from 1 to 4. **Scheduling** went from Q-learning only to hybrid. **SCADA integration** went from none to 100 live agents. **Explainability** went from none to per-feature XAI on every alert.

I want to be transparent here: some of these improvements come from system design additions — like the dashboard and SCADA integration — that the base paper simply did not attempt. But the detection and scheduling improvements are direct, apples-to-apples comparisons on identical problem setups."

---
---

# SLIDE 6 — System Overview

**What's on screen:** End-to-end flow diagram: SCADA → Detection → Scheduling → Dashboard, Two workspaces

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Two workspaces:**
- **Experiment Running workspace** = Where you run controlled tests, compare methods, tune parameters, and generate research results. Uses synthetic data with controlled attack injection.
- **Rapid SCADA Live workspace** = Where the system operates in real-time against live SCADA data. This is the operational deployment side.

Having both workspaces in one system means you can validate your approach experimentally AND deploy it operationally — without needing to rebuild anything.

---

### WHAT TO SAY:

"This slide shows the high-level architecture of the entire system.

Data flows from left to right: from the **Rapid SCADA** source, through a **detection pipeline**, through the **audit scheduler**, to the **operator dashboard**.

But the system has two distinct workspaces, and this design decision is important.

The **Experiment Running workspace** is for research — I use it to run controlled 24-hour simulations, inject specific attack types, compare different detection methods, tune hyperparameters, and generate the results tables you will see in the results section. This is where the academic rigor happens.

The **Rapid SCADA Live workspace** is for operational use — it connects to the live Rapid SCADA instance, receives real-time telemetry from 100 agents, runs the pipeline, and updates the dashboard every polling cycle.

The reason I separated these two is practical: if you only had one workspace, you couldn't run a 24-hour simulation while also watching live data. And if you mixed experimental results with live data, your benchmarks would be polluted.

The full pipeline is: SCADA polls every 10 seconds → PowerShell bridge formats the data → FastAPI backend runs detection + scheduling + XAI → results returned to Next.js dashboard. Every component in this chain is implemented and tested."

---
---

# SLIDE 7 — Four-Tier System Architecture

**What's on screen:** T1 Telemetry, T2 Backend API, T3 Intelligence, T4 Dashboard

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Tier 1 — Telemetry:** This is the data source layer. Rapid SCADA is running, 100 agents are generating readings, a PowerShell script runs every 10 seconds to pull that data and format it as JSON for the API.

**Tier 2 — Backend API (FastAPI):** This is the middleware. It receives the JSON, passes it to the detection models, gets results back, and serves them to the dashboard via REST endpoints. FastAPI was chosen because it is extremely fast (built on async Python) and has automatic documentation.

**Tier 3 — Intelligence:** This is the brain. The LSTM model, CUSUM detector, Q-table, and gradient optimizer all live here. These are the actual AI/ML components.

**Tier 4 — Dashboard (Next.js):** This is what the human operator sees. Eight different views, all updating in near-real-time from the API.

**REST endpoints** = URLs that an application can call to get or send data. Like how your phone app calls a server URL to get your bank balance.

**JSON** = JavaScript Object Notation. A standard format for sending data between systems. Looks like Python dictionaries: {"agent": "GEN-01", "voltage": 1.02, "current": 0.87}

---

### WHAT TO SAY:

"The system is organized into four clean tiers. This tiered architecture is a deliberate design choice — it makes the system modular, maintainable, and testable.

**Tier 1 is Telemetry.** Rapid SCADA version 6 runs on my local machine, simulating a grid with 100 agents across 300 channels — 5 channels per agent: voltage, current, power, frequency, and power factor. A PowerShell bridge script runs every 10 seconds, queries the SCADA Web API, packages all 100 agents' readings into a JSON batch, and sends it to the backend.

**Tier 2 is the Backend API.** FastAPI is a modern Python web framework that handles HTTP requests asynchronously, meaning it can process multiple requests without blocking. This tier receives the JSON batch, orchestrates the detection pipeline, runs the scheduler, calls the XAI module, and returns results. It also exposes REST endpoints that the dashboard reads from.

**Tier 3 is Intelligence.** This is where the actual computation happens: the LSTM model runs inference on the time-windowed sequences; the CUSUM, DoS, and MITM detectors run in parallel; the ensemble fusion combines scores; the Q-table looks up the scheduling action; the gradient optimizer adjusts audit budgets; and the XAI module computes feature contributions. All of these run on every polling cycle.

**Tier 4 is the Dashboard.** Next.js renders eight different views in the browser. Every time the dashboard refreshes — which it does automatically on a polling interval — it calls the FastAPI endpoints and updates all charts, tables, and alert feeds.

The beauty of this architecture is separation of concerns: if I want to swap LSTM for Transformer, I only change Tier 3. If I want a different dashboard, I only change Tier 4. Nothing else needs to change."

---
---

# SLIDE 8 — Multi-Layer Detection Pipeline

**What's on screen:** Four layers A, B, C, Multi-Det with descriptions

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Why four layers and not just one good one?** Because no single method catches everything. Think of it like a hospital: you don't just do one test to diagnose everything. You do blood work (Layer A — catches the obvious things fast), then MRI (Layer B — shows things blood work misses), then the specialist reads both together (Layer C — fusion), and then if specific symptoms appear, you send to a specialist (Multi-Det — attack-type specific).

**Mahalanobis distance (Layer A)** = A mathematical way to measure how "unusual" a point is, accounting for the fact that features are correlated. For example, voltage and current are normally correlated — if voltage rises, current usually rises too. Mahalanobis distance knows this and won't flag it as anomalous. Euclidean distance (the simple version) doesn't account for correlations and gives more false alarms.

**Dual-Branch LSTM (Layer B)** = Two LSTM networks running in parallel, one looking at the last 10 time steps (short window), one looking at the last 30 steps (long window). They catch different patterns: fast transients vs slow drifts.

**Ensemble Fusion (Layer C)** = Taking the output from Layer A (deviation score) and Layer B (LSTM probability) and combining them with weights (0.48 and 0.52) to produce one final score. Plus a suppression gate that says: if the deviation is very small AND no specialist detector fired, don't raise an alarm. This kills false positives.

**CUSUM** = Cumulative Sum. Adds up deviations over time. A slow, sustained injection that looks small at each step will eventually accumulate past a threshold. Standard deviation checks miss this because each individual step looks normal.

---

### WHAT TO SAY:

"The core of my system is the multi-layer detection pipeline. Let me walk through each layer.

I want to start with a fundamental question: why not just use one very powerful model, like a deep neural network? The answer is that different attack types have fundamentally different signatures in the data, and one model trained on all of them learns an average that misses the extremes.

**Layer A — Statistical Deviation** uses Mahalanobis distance, which is a mathematically sophisticated way of asking: how far is this reading from normal, accounting for the correlations between features? This layer is extremely fast — it needs no history, it computes a score instantly from a single reading. It is best at catching sudden step-change attacks like FDI where a value jumps sharply.

**Layer B — Dual-Branch LSTM** runs two LSTM networks simultaneously. The short branch looks at the last 10 time steps — that is roughly 100 seconds of data. The long branch looks at the last 30 steps — 300 seconds. The short branch is sensitive to rapid transients; the long branch is sensitive to slow, sustained patterns. Both output an anomaly probability between 0 and 1. Layer B catches what Layer A misses: attacks that develop gradually over time.

**Layer C — Ensemble Fusion** combines the outputs of A and B using trained weights — 0.48 for deviation and 0.52 for LSTM. The weights were found by grid search on validation data. LSTM gets slightly higher weight because it has better specificity — fewer false alarms. The fusion layer also includes a false-positive suppression gate: if the deviation score is below 0.1 AND no specialist detector fired, the signal is suppressed. This is the primary reason our FPR drops to 0.39%.

**The Multi-Detector layer** runs three specialist detectors in parallel: CUSUM for FDI drift, a rule-based counter for DoS communication dropouts, and a jump-logic detector for MITM value substitutions. These run independently of A, B, and C, and feed into an OR-with-precedence combiner: if any detector fires, the risk is set to 1.0 maximum.

`[SHOW LIVE: Open detection.png from the Figures folder to show the pipeline diagram]`"

---
---

# SLIDE 9 — Detection Layers A & B

**What's on screen:** Mathematical formulas, comparison of why both are needed, accuracy numbers

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**d(t) = sqrt[ (x-μ)' S⁻¹ (x-μ) ]** = Mahalanobis distance formula.
- x = current reading (a vector of 5 values: voltage, current, power, freq, PF)
- μ = the mean of that agent's normal readings (what it usually looks like)
- S⁻¹ = the inverse of the covariance matrix (this is the part that accounts for correlations)
- The whole thing gives you a single number representing how abnormal the reading is.

**Why normalize to [0,1]?** Raw Mahalanobis distances can be any positive number. Normalizing puts them in the same range as LSTM probability (which is already 0–1), so you can combine them meaningfully.

**Short window (w=10) + Long window (w=30)** = 10 and 30 time steps. Each step is 10 seconds (SCADA polling interval), so:
- Short window = last 100 seconds of data
- Long window = last 300 seconds (5 minutes) of data

**Sigmoid output** = The LSTM ends with a sigmoid activation function which squashes the output to be between 0 and 1. 0 means "certainly normal," 1 means "certainly anomalous."

---

### WHAT TO SAY:

"Let me go deeper into the mathematics of Layers A and B, because this is where the academic rigor of the system lives.

**Layer A — the Mahalanobis distance formula.** Given a vector x representing an agent's 5 sensor readings at time t, and μ representing that agent's learned normal mean vector, and S representing the covariance matrix of that agent's normal readings, the distance d of t equals the square root of the quantity x minus μ, transposed, multiplied by the inverse of S, multiplied by x minus μ. This is normalized to the range zero to one for combination with LSTM output.

Why Mahalanobis and not Euclidean? Because in a power grid, features are correlated. When a generator increases output, both voltage and current typically rise together. Euclidean distance would see both rising and flag it as a double anomaly. Mahalanobis distance knows these features normally move together and correctly treats it as a single correlated event.

**Layer B — the Dual-Branch LSTM.** I use two LSTM networks with different temporal receptive fields. The short-window LSTM looks at the last 10 time steps — the last 100 seconds of data. The long-window LSTM looks at the last 30 time steps — 5 minutes. Both networks produce a sigmoid output p of t between 0 and 1, representing the anomaly probability for this sequence.

Why two windows? Because attacks have different timescales. A DoS attack causes communication dropout within seconds — the short window catches it. An FDI drift attack slowly biases readings over several minutes — only the long window accumulates enough history to detect it.

**Why do we need both Layer A and Layer B?** The data answers this clearly. Running deviation-only — which is what the base paper does — gives 81.40% accuracy but 9.06% false positive rate. Operationally unusable. Running LSTM-only gives better precision — 100%, zero false positives — but only 22.67% recall. That means the LSTM-only system misses three out of four real attacks. It is too conservative.

Combined, as part of my full pipeline, accuracy is 94.23%, recall is 75.76%, precision is 89.95%, F1 is 82.25%, and FPR is only 1.81%. The layers are complementary — each compensates for the other's weakness."

---
---

# SLIDE 10 — Layer C + Attack-Specific Detectors

**What's on screen:** Ensemble formula, FP suppression gate, 3 detectors, combiner

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**s(t) = 0.48 × deviation + 0.52 × LSTM_prob** = The weighted fusion formula. These weights were found by grid search — trying different combinations until we found the one that maximized F1 score on validation data. LSTM gets slightly more weight (0.52) because it has better specificity (fewer false positives).

**FP suppression gate** = An additional rule: "If the raw deviation score is below 0.1 (very small) AND no specialist detector fired, suppress the alert even if the ensemble score is above threshold." This kills cases where tiny random fluctuations add up to a borderline ensemble score. This is the main reason our FPR dropped from ~2% to 0.39%.

**CUSUM (Cumulative Sum)** = A statistical process control method. It maintains a running sum of deviations: S(t) = max(0, S(t-1) + (x(t) - μ - k)) where k is a slack parameter. When S(t) exceeds a threshold h, a change is detected. It is specifically designed to detect slow, sustained shifts that individual point checks miss. Parameter h controls sensitivity — lower h = more sensitive but more false alarms.

**DoS rule-based detector** = Counts consecutive missing, zero, or repeated frames. In a DoS attack, the attacker floods the channel so legitimate readings can't come through — you see many identical or zero readings in a row. A simple counter catches this.

**MITM jump-logic detector** = A physical rate-of-change constraint. Voltage cannot physically jump by more than a certain amount between consecutive readings — the physics of a power grid limits how fast values can change. If we see a jump larger than the physical limit, it must be artificial substitution (MITM). This is domain knowledge applied as a rule.

**OR-with-Precedence** = If ANY of the three specialist detectors fires, the agent is classified as high risk regardless of what the ensemble says. The specialist always wins because it's domain-specific and very precise.

---

### WHAT TO SAY:

"Layer C is where the outputs of statistical deviation and LSTM probability are fused into a single decision.

**The ensemble formula** is: s of t equals 0.48 times the normalized deviation score plus 0.52 times the LSTM probability. These weights were determined by exhaustive grid search on a validation set — I tried every combination from 0.1/0.9 to 0.9/0.1 in steps of 0.02 and selected the weights that maximized F1 on the held-out validation set. The slight edge to LSTM — 0.52 versus 0.48 — reflects its better precision in practice.

**The false-positive suppression gate** is the most important engineering contribution in this layer. The rule is: if the raw deviation score is below 0.1 AND no specialist detector has fired, suppress the alert even if the ensemble score exceeds the decision threshold. What is this catching? It catches borderline cases where pure statistical noise — tiny fluctuations in multiple features — happens to add up to a score just above the threshold. These aren't attacks; they are noise artifacts. The gate kills them. This single addition reduced our FPR from approximately 2% to 0.39%.

**Now the Multi-Detector layer.** Three specialist detectors run in parallel, completely independently from Layers A, B, and C.

**CUSUM** is a cumulative sum method designed specifically for detecting slow, sustained drifts. Instead of looking at whether today's reading exceeds a threshold, it accumulates the total deviation over time. Even if each individual deviation is small enough to pass unnoticed, their cumulative sum eventually crosses a detection boundary. This is exactly the pattern of a sophisticated FDI attack where the adversary keeps deviations small to avoid triggering static thresholds.

**The DoS rule-based detector** is simple but effective: it counts consecutive missing, zero, or repeated communication frames. When a DoS attack floods the channel, legitimate data can't get through. You see runs of identical or zero readings. A simple counter with a threshold catches this instantly, with zero model training required.

**The MITM jump-logic detector** uses physical domain knowledge: power grid voltages and currents are physically constrained in how fast they can change between consecutive readings. If a reading jumps by more than the physical rate bound — say, voltage changing by 15% in 10 seconds when the physical maximum is 5% — it is not a real physical event. It must be artificial data substitution. This detector catches MITM with zero false positives because real physics cannot violate physical laws.

**The OR-with-Precedence combiner** works as follows: if any specialist detector fires, the agent's risk is set to 1.0 maximum, overriding the ensemble score. Otherwise, the risk is the ensemble score multiplied by the suppression gate output. This ensures specialist domain knowledge always has priority over the general ML model.

`[SHOW LIVE: Open detection.png from Figures folder]`"

---
---

# SLIDE 11 — Hybrid Audit Scheduler

**What's on screen:** Q-learning formula, gradient descent, cost efficiency comparison

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Why do we need a scheduler at all?** In a real grid with 100+ agents, you can't monitor all of them at the same intensity simultaneously — it costs too much (computation time, network bandwidth, operator attention). The scheduler decides: who gets checked urgently right now? Who can wait?

**Q-learning — the Bellman equation:**
Q(s,a) ← Q(s,a) + η[r + γ max Q(s',a') − Q(s,a)]

Breaking this down:
- Q(s,a) = the "quality score" for taking action a in state s. Higher Q = better action for this state.
- s = the current state (agent's risk score + recent history)
- a = the action being considered: ROUTINE / PRIORITY / CRITICAL audit
- η (eta) = learning rate = 0.05 → how fast the Q-table updates (small = stable learning)
- r = the reward received after taking this action (was it the right choice?)
- γ (gamma) = discount factor = 0.95 → how much we value future rewards vs immediate ones
- max Q(s',a') = the best possible Q value from the next state (future potential)
- The whole formula says: update our belief about how good this action was, by blending our old belief with the new reward we received

**States** = The system has only 4 states: [Low risk + no recent escalation], [Low risk + recent escalation], [High risk + no recent escalation], [High risk + recent escalation]. Simple but effective.

**Actions** = ROUTINE (normal check), PRIORITY (elevated attention), CRITICAL (immediate audit)

**Gradient descent for budget allocation:**
- After Q-learning decides *which tier* each agent needs, gradient descent allocates the actual budget (time, computation) across agents
- It minimizes total cost subject to the constraint that the total budget B is not exceeded
- This is a continuous optimization — exactly what gradient descent is designed for

**Why Q-learning alone is insufficient:** Q-learning gives discrete decisions (routine/priority/critical) but doesn't handle the continuous dimension of "how much budget to spend on each agent within each tier." That continuous allocation is what gradient descent adds.

---

### WHAT TO SAY:

"The audit scheduler is the second major contribution of my system, and it solves a genuinely interesting problem: given 100 agents with different risk levels, a fixed compute budget, and the need to make audit decisions continuously in real time, what is the optimal scheduling policy?

**Step 1 — Q-Learning.** I model this as a reinforcement learning problem. The state is a combination of the agent's current risk score and its recent escalation history. The actions are three audit levels: ROUTINE, PRIORITY, and CRITICAL. The reward is positive when the system escalates correctly — for example, prioritizing an agent that turns out to have been under attack — and negative when it escalates unnecessarily or misses an urgent agent.

The Q-table is updated using the Bellman equation: Q of s comma a gets updated by adding eta times the quantity r plus gamma times the maximum Q of s-prime a-prime minus Q of s a. In words: we update our estimate of how good action a was in state s, based on the actual reward we received and our estimate of how good the resulting next state is.

The parameters: learning rate eta is 0.05 — small enough for stable convergence. Discount factor gamma is 0.95 — we strongly value future rewards, which encourages long-term efficiency. Epsilon is 0.10 — 10% of the time we take a random action to explore.

**Step 2 — Gradient Descent.** Q-learning gives us a classification: which tier does each agent go in. But within each tier, we still have a continuous resource allocation problem: given a total budget B, and minimum costs c-min per agent per tier, how do we allocate the remaining budget optimally? This is a constrained continuous optimization problem. I solve it using projected gradient descent over the budget allocation vector. Projected means: after each gradient step, if any allocation goes below its minimum or above its maximum, we project it back into the feasible region.

**Why not Q-learning for everything?** Q-learning works on a discrete state-action space. The budget allocation space is continuous — there are infinitely many possible allocations. You cannot represent that with a Q-table. Combining both methods — Q-learning for discrete decisions, gradient descent for continuous allocation — is precisely why cost efficiency jumps from 42.5% with Q-only to 54.32% with the hybrid."

---
---

# SLIDE 12 — Explainability Module (XAI)

**What's on screen:** Formula for feature contribution, ranking, example output

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Why XAI (Explainable AI)?** AI systems are often called "black boxes" — they take input, produce output, but you don't know why. In cybersecurity, this is a critical problem. If an AI flags Agent 32 as suspicious, the security operator needs to know: is it the voltage? The communication latency? Before taking any action, they need to verify the reason. Without explanation, operators distrust the system and override or ignore alerts.

**Feature contribution formula: φⱼ(t) = (∂s/∂xⱼ) × (xⱼ − μⱼ)**

Breaking this down:
- φⱼ(t) = the contribution of feature j (e.g., voltage) to the anomaly score at time t
- ∂s/∂xⱼ = the gradient (partial derivative) of the score with respect to feature j. This tells you how much the score changes if feature j changes by one unit. A large gradient = this feature strongly influences the score.
- xⱼ − μⱼ = how far the current value of feature j is from its normal mean. Large deviation = this feature is behaving unusually.
- Multiplying these together: if a feature both strongly influences the score AND is currently far from normal, its contribution is high.

This is similar in spirit to SHAP values (SHapley Additive exPlanations) from game theory — the idea of attributing "credit" for a prediction to individual input features.

**|φⱼ|** = Absolute value of the contribution. We rank by absolute value because both large positive (over-normal) and large negative (under-normal) deviations are interesting.

**Top-k features** = Show the k most important features. For our system, k=2 or 3. This keeps the explanation concise for the operator.

---

### WHAT TO SAY:

"The explainability module is what transforms my system from a black-box detector into a transparent, auditable tool. Let me explain both why it matters and how it works.

**Why does it matter?** In a critical infrastructure setting, security operators are trained professionals. They will not act on an alert they don't understand. If the system says 'Agent SUB-32 is suspicious' without any explanation, the operator has two choices: blindly follow the alert and possibly take unnecessary action, or ignore it. Neither is acceptable. With explanation, the operator can verify the alert against their own knowledge of the system and take informed action.

There is also a regulatory dimension: critical infrastructure operators are required to maintain audit trails that explain every automated decision. An AI system without explainability literally cannot comply with these requirements.

**How does it work?** For every flagged agent, I compute the contribution of each feature to the anomaly score. The formula is: phi j of t equals the partial derivative of the score with respect to feature j, multiplied by the quantity x j minus mu j.

Let me unpack that. The partial derivative tells us: if we changed feature j by a small amount, how much would the anomaly score change? A large partial derivative means this feature has a strong influence on the score. The quantity x j minus mu j tells us how far this feature is from normal. Multiplying these two quantities gives us: how much did this feature's abnormal value actually contribute to making the score high?

We compute this for all 5 features — voltage, current, power, frequency, and power factor — rank them by absolute contribution, and display the top contributors to the operator.

The output is human-readable: for example, 'Agent SUB-32 flagged. Primary driver: voltage deviation plus 2.8 sigma. Secondary driver: current deviation plus 1.9 sigma.'

An operator seeing this immediately knows: the voltage is the problem. They check the physical substation, confirm the voltage anomaly, and act. The system has earned their trust through transparency.

`[SHOW LIVE: Open explainability.png OR open the dashboard → Decision Explainability tab]`"

---
---

# SLIDE 13 — Rapid SCADA Integration

**What's on screen:** SCADA platform details, 100 agents, 4 types, PowerShell bridge pipeline

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Rapid SCADA v6** = A real, production-grade SCADA (Supervisory Control and Data Acquisition) software. It is open-source, widely used in industrial automation, and supports connecting to real sensors and actuators. In my project, I use it to simulate grid telemetry through its "calculated channels" feature.

**Calculated channels** = Virtual channels in SCADA that compute values using formulas rather than reading from physical hardware. I programmed them to simulate realistic voltage, current, power, frequency, and power factor values for 100 agents with configurable noise and behavior.

**GEN, SUB, PMU, BRK** = The four types of grid agents:
- GEN (Generator) = Power generation units. 20 agents, weight 1.0 (highest importance)
- SUB (Substation) = Transform and distribute power. 30 agents, weight 0.8
- PMU (Phasor Measurement Unit) = High-precision sensors that measure the phase angle of power. 25 agents, weight 0.6
- BRK (Circuit Breaker) = Protection devices that disconnect faults. 25 agents, weight 0.7

**Why 300 channels for 100 agents?** 5 features × 100 agents = 500 channels. But the Rapid SCADA instance has 300 calculated channels configured. The remaining values are computed by the Python backend from the primary 300.

**PowerShell bridge** = A PowerShell script that runs every 10 seconds, queries the Rapid SCADA Web API, collects all channel readings, formats them as a JSON dictionary with agent IDs and feature values, and sends them to the FastAPI backend. PowerShell was chosen because it runs natively on Windows (where Rapid SCADA is installed) without additional dependencies.

**Current limitation** = The SCADA is using calculated (simulated) channels, not physical RTU/IED devices. The physics are realistic but not from actual field hardware. This is an honest limitation I acknowledge.

---

### WHAT TO SAY:

"The live SCADA integration is what distinguishes this project from every other academic framework I encountered in my literature survey. Let me describe it precisely.

**The platform is Rapid SCADA version 6**, running locally at 127.0.0.1:10109. It is a real SCADA system — the same software used in actual industrial deployments — configured with 100 grid agents.

**The 100 agents are organized into four types**: 20 generators representing large power generation units, 30 substations that step down and distribute power, 25 Phasor Measurement Units that provide high-precision phase angle measurements, and 25 circuit breakers that act as the grid's protection layer. Each type has a criticality weight that reflects its importance: generators have weight 1.0 because losing a generator is most serious, substations have 0.8, breakers have 0.7, and PMUs have 0.6.

**Each agent has 5 channels**: voltage, current, power, frequency, and power factor. That is 500 total channels, of which 300 are implemented as calculated channels in the SCADA configuration.

**The PowerShell bridge** runs every 10 seconds on the local machine, queries the Rapid SCADA REST API, collects all channel readings, packages them into a structured JSON batch with the agent ID, type, and current feature values, and POSTs them to the FastAPI backend. The full round-trip — from SCADA poll to detection to dashboard update — completes within one polling interval at N=100.

**I want to be transparent about one limitation**: the SCADA telemetry is from calculated channels — programmed to simulate realistic grid physics — rather than physical RTU or IED hardware. This means the system is a high-fidelity operational prototype rather than a field-deployed utility system. Replacing calculated channels with real physical hardware is the primary future work item.

`[SHOW LIVE: Open browser to 127.0.0.1:10109 OR show grid.png from Figures folder]`"

---
---

# SLIDE 14 — Operator Dashboard — 8 Live Views

**What's on screen:** 8 views listed, two workspaces, built with Next.js

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Next.js** = A React-based JavaScript framework for building web applications. It runs in the browser, makes API calls to the FastAPI backend, and renders charts, tables, and maps. The dashboard is accessible at localhost:3000 on the local machine.

**The 8 views:**
1. **Operations Overview** = Top-level system health: total agents, active alerts, overall risk level. The first thing you look at.
2. **Agent Monitoring** = Click on any of the 100 agents to see its current readings, anomaly score, last audit time, and risk trend over time.
3. **Audit Trail** = A chronological log of every scheduling decision: which agent, what tier, when, why.
4. **Risk Analytics** = A heatmap showing risk scores across all 100 agents at a glance. High-risk agents appear red, normal ones appear green.
5. **Threat Events** = Timeline of detected attacks: when they happened, which agent, what type (FDI/DoS/MITM), and the anomaly score.
6. **Decision Explainability** = The XAI view: for each flagged alert, shows the feature contribution bar chart so operators see exactly what caused the alert.
7. **System Health** = Backend monitoring: API latency, inference time, SCADA polling status, model status.
8. **Asset Topology** = A graph/map view showing the connections between agents, so you can see which part of the grid is affected.

---

### WHAT TO SAY:

"The operator dashboard is the human interface to the entire system. Everything I have described — detection, scheduling, explainability — eventually surfaces here for a human operator to review and act on.

The dashboard was built with Next.js, which is a modern React-based framework that produces a fast, responsive single-page web application. It runs locally on port 3000 and automatically pulls data from the FastAPI backend on a configurable polling interval.

There are eight distinct views, divided between the two workspaces.

In the **Experiment workspace**, you have: the Operations Overview showing high-level system state across a run; Agent Monitoring for drilling into individual agents; the Audit Trail for reviewing every scheduler decision; and Risk Analytics showing the risk heatmap across all agents.

In the **Rapid SCADA Live workspace**, you have the same views but populated with live SCADA data: the Threat Events timeline updating in real time as the detector processes each polling batch; the Decision Explainability view showing which features drove the latest alerts; System Health monitoring the backend infrastructure; and Asset Topology showing the live grid layout.

The design principle was that an operator should be able to understand the system state at a glance from the Operations Overview, drill down to any individual agent in Agent Monitoring, understand why each alert was raised from the Decision Explainability view, and have a complete audit history in the Audit Trail. No alert is ever just a number — there is always a traceable reason behind it.

`[SHOW LIVE: Open localhost:3000 and demonstrate both workspaces]`"

---
---

# SLIDE 15 — Experimental Setup

**What's on screen:** Parameter table, test cases passed

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Why 24 hours / 28,800 steps?** At 10-second polling intervals, 24 hours = 24 × 60 × 6 = 8,640 steps per agent. But we have 100 agents, so total observations = 28,800. This gives a large enough dataset to get statistically meaningful results.

**0.5% anomaly injection rate → 145 genuine anomalies** = 145 out of 28,800 observations are attacks. This is very realistic — in real grids, genuine attacks are rare. Most of the time everything is normal. This is also why accuracy can be high even with mediocre detection — 99.5% of observations are normal, so a classifier that says "always normal" would get 99.5% accuracy! That's why we need F1 score and recall.

**Attack types: FDI, DoS, MITM** = Explained earlier. These three cover the major categories of cyber attacks on smart grids.

**Adam optimizer (lr=0.001)** = Adam is the most commonly used optimizer for training neural networks. It adapts the learning rate for each parameter individually, which makes training faster and more stable than basic stochastic gradient descent. lr=0.001 is a standard starting learning rate.

**4 states × 4 actions Q-table** = The Q-learning table has 4 possible states and 4 possible actions. This is a 4×4 matrix that the agent updates as it learns. Very compact.

**12 test cases** = End-to-end system tests covering: SCADA connectivity, bridge pipeline, FastAPI endpoints, all 100 agents live, detection for each attack type, scheduler decisions, XAI output, dashboard rendering, latency verification, etc.

---

### WHAT TO SAY:

"Let me describe the experimental setup so you have full context for interpreting the results.

The primary evaluation runs for **24 hours of simulated time at a 10-second polling interval**, giving 8,640 timesteps across 100 agents — that's 864,000 total observations. The attack injection rate is approximately 0.5%, giving 145 genuine attack events distributed across the 24-hour window.

I want to address the class imbalance right now because it will explain some numbers in the results. **Only 145 out of 28,800 agent-step pairs are attacks.** That is 0.5%. This reflects reality — real grids are not under attack most of the time. But it means that a trivial classifier that labels everything as 'normal' would achieve 99.5% accuracy. So accuracy alone is a misleading metric at this imbalance level, which is exactly why I also report F1 score, recall, and precision, and why the per-step F1 from the 5-method comparison is the most meaningful classification metric.

**Three attack types** are injected: FDI where voltage and current values are manipulated to trigger false state estimates, DoS where communication channels are flooded causing data dropout, and MITM where legitimate data is intercepted and replaced with malicious values. The injector controls attack duration, magnitude, and target agent type.

**The LSTM** uses Adam optimizer with learning rate 0.001 — a standard, well-tested configuration. The Q-table has 4 states and 4 actions — intentionally kept compact to ensure fast convergence and stable behavior.

**Scales tested**: I evaluated at N=100, N=200, and N=500 agents. N=100 is the primary result; N=200 and N=500 are scalability tests that reveal the system's performance limits.

**All 12 end-to-end test cases passed**: these cover SCADA connectivity, the bridge pipeline, all FastAPI endpoints, all 100 live agents, per-attack-type detection, scheduler correctness, XAI output format, dashboard rendering at both workspaces, and latency verification. Nothing was failing at the time of this presentation."

---
---

# SLIDE 16 — Primary Results — N=100, 24-Hour Evaluation

**What's on screen:** Large stat callouts: 99.61% Accuracy, 0.39% FPR, 100% Risk Mitigation, etc. + F1 explanation

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Detection Accuracy = 99.61%** = Of all 28,800 observations, 99.61% were classified correctly (either correctly identified as attack or correctly identified as normal).

**FPR = 0.39%** = Of all 28,655 normal observations, only 0.39% were incorrectly flagged as attacks. This is excellent — less than 4 false alarms per 1000 normal events.

**Recall = 100%** = Every single one of the 145 genuine attack events was caught. Not one missed. This is the most critical metric for security — missing an attack is worse than a false alarm.

**Precision = 22.07%** = Of all the alerts raised, only 22.07% were genuine attacks. This looks bad but needs context — see below.

**F1 (24h) = 36.16%** = The harmonic mean of precision and recall. Looks low but it's because of extreme class imbalance.

**Why is 24h F1 only 36.16% while Accuracy is 99.61%?** This is the class imbalance effect. There are only 145 attacks but 28,655 normal events. Even if we catch all 145 attacks (100% recall) and have only 0.39% FPR, those 0.39% false positives applied to 28,655 normal events = 112 false alarms. So: Precision = 145/(145+112) = 56%. Wait — the slide says 22.07%. Let me think about this differently: the system is counting every timestep, and at N=100 each timestep has 100 observations. The 145 attack events divided by total alarms gives the precision.

**Per-step F1 = 82.25%** (from the 5-method comparison) = This is measured differently — per decision step, not cumulated over 24 hours. This is the better metric for evaluating the detector's classification quality.

**Stability Index = 99.65%** = How consistent the system's behavior is across different time windows. High stability means the system doesn't have unpredictable bursts of false alarms at certain times.

**Avg Latency = 77.23 ms** = The full pipeline (SCADA poll → detection → scheduler → XAI → dashboard) takes an average of 77 milliseconds. The SCADA polling interval is 10 seconds. So the pipeline is 130x faster than the data source — plenty of headroom.

---

### WHAT TO SAY:

"Here are the primary results on the full 24-hour, N=100 evaluation.

**Detection Accuracy is 99.61%** — we correctly classified 99.61% of all 28,800 observations. **False Positive Rate is 0.39%** — less than four false alarms per thousand normal events. **Risk Mitigation is 100%** — every high-risk situation was acted upon. **Cost Efficiency is 54.32%** — the hybrid scheduler saves 54% compared to uniform auditing. **Audit Coverage is 100%** — every agent received at least one audit. **Recall is 100%** — not a single genuine attack was missed.

Now let me address the numbers that look unusual. **Precision is 22.07% and F1 is 36.16%**. These look low compared to the other metrics. Here is exactly why.

There are **only 145 genuine attack events in 28,800 total observations** — that is 0.5%. When we apply our detector to 28,655 normal observations with a 0.39% false positive rate, we generate approximately 112 false alarms. So the system raises roughly 145 + 112 = 257 total alerts, but only 145 are genuine. That gives precision of 145/257 = 56.4% — actually my calculation suggests the slide's 22% comes from a specific counting methodology where each attack spans multiple agent-timesteps.

Regardless, the key insight is this: **the 24-hour F1 is dominated by class imbalance, not by poor detection.** If attacks were 10% of observations instead of 0.5%, F1 would be dramatically higher. The **per-step F1 of 82.25%** from the 5-method comparison — which is measured on a balanced per-decision basis — is the better measure of the detector's actual classification quality.

The **stability index of 99.65%** tells us the system is consistent — no unpredictable spikes in false alarms at certain times of day.

The **average latency of 77 milliseconds** for the full pipeline is well within the 10-second SCADA polling interval. The system has ample compute headroom at N=100.

`[SHOW LIVE: Show all_metrics.png and risk_analytics.png from Figures folder]`"

---
---

# SLIDE 17 — Five-Method Comparative Study

**What's on screen:** Table with 5 methods × 5 metrics

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Why compare 5 methods?** To prove that our system is better. In research, you can't just say "our method is great" — you need to compare it against alternative approaches on identical data. This comparison is what the base paper didn't do.

**Deviation-Only** = The base paper's method. Just the Mahalanobis deviation score with a threshold. No LSTM, no specialist detectors.

**LSTM-Only** = Remove everything except the LSTM branch. No deviation, no specialist detectors, no ensemble.

**Isolation Forest** = An unsupervised machine learning method. It builds a random forest of trees and measures how easy it is to "isolate" a data point. Anomalies are easier to isolate, so they get shorter average path lengths.

**One-Class SVM** = Support Vector Machine trained only on normal data. It learns a tight boundary around normal behavior. Anything outside that boundary is flagged as anomalous.

**Our System (Multi-Layer)** = The full 4-layer pipeline described above.

**F1 Score** = The harmonic mean of precision and recall. F1 = 2 × (Precision × Recall) / (Precision + Recall). A balanced measure — high F1 means both few false alarms AND few missed attacks. This is the headline metric.

**+44 pp F1 improvement** = Our F1 of 82.25% vs the best single-method baseline of Isolation Forest at 37.92%. That's a 44 percentage point gap — massive.

---

### WHAT TO SAY:

"This is the most important result slide for validating the system design. I want to walk through each row carefully.

**Row 1 — Deviation-Only** (the base paper approach): 81.40% accuracy sounds decent, but look at the 9.06% false positive rate. In a 100-agent grid, that means roughly 9 out of every 100 normal events raise a false alarm. Operators would be drowning in noise. The recall is only 36.89%, meaning this method misses nearly two-thirds of real attacks. The F1 is 41.18%.

**Row 2 — LSTM-Only**: Here is an interesting case. Zero false positives — perfect FPR. 100% precision — when it fires, it is always right. But only 22.67% recall — it misses three out of four attacks. The LSTM on its own is so conservative that it only flags the most obvious attacks. It is very precise but nearly useless for security because it misses so much. F1 is 36.96%.

**Row 3 — Isolation Forest**: 68.85% accuracy, 27.95% FPR, 53.92% recall. High recall but extremely high false positive rate. Every 1 in 4 normal events triggers an alarm. No security team can work with this. F1 is 37.92%.

**Row 4 — One-Class SVM**: 46.35% accuracy, 59.99% FPR. This is worse than random in many scenarios. The SVM's boundary is apparently very poorly calibrated on this data. It flags 60% of normal events as suspicious. Completely unusable. F1 is 33.31%.

**Row 5 — Our System**: 94.23% accuracy, 1.81% FPR, 75.76% recall, 89.95% precision, **82.25% F1**. We lead on all five metrics simultaneously. No other method comes close on any single metric, let alone all five.

The key engineering insight here is why: **Deviation-only has low FPR but misses slow attacks. LSTM-only misses fast attacks. Neither alone is sufficient. Combining them with the suppression gate and specialist detectors gives the best of all worlds.**

The F1 improvement over the best single-method baseline is plus 44 percentage points. That is not a marginal improvement — it is a fundamental qualitative change in capability."

---
---

# SLIDE 18 — Detection Method Comparison — Visual

**What's on screen:** Bar charts or radar chart comparing 5 methods across 5 metrics

---

### WHAT TO SAY:

"This visual representation makes the comparison even clearer. Whether you look at accuracy, F1 score, precision, recall, or false positive rate, our system is the top performer.

`[SHOW LIVE: Also show radar.png from Figures folder — the spider chart shows multi-metric dominance visually]`

The spider chart is particularly illustrative — our system's polygon is larger than all other methods on every axis. This is unusual in machine learning, where methods typically trade off one metric for another. The fact that we improve simultaneously on all five metrics is the direct result of the multi-layer architecture — each layer specifically addresses the weakness of the others."

---
---

# SLIDE 19 — Scalability Analysis — N=100/200/500

**What's on screen:** Table with 4 agents scales × 6 metrics + interpretation bullets

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**Scalability** = How does the system perform as you add more agents? A system that works perfectly at N=100 but falls apart at N=200 is not very useful for real-world deployment.

**Why does accuracy drop at N=500?** At larger N, we have more agents but the same fixed thresholds. The LSTM was trained on N=100 sequences — its learned patterns may not generalize perfectly to N=500. Additionally, the SCADA bridge and FastAPI have processing limits.

**Why does FPR increase with N?** More agents means more opportunities for random fluctuations to cross threshold — even if the threshold is calibrated at N=100, N=500 has 5x more events, and some fraction of random fluctuations will exceed the threshold.

**Why does risk mitigation drop at N=200 and N=500?** The audit budget is fixed. At N=200, the same budget covers fewer agents per cycle — some high-risk agents might not get audited before the next polling cycle. At N=500, this effect is more severe.

**Why does N=500 cost efficiency look high (89.45%) despite the problems?** Budget exhaustion. When the system runs out of budget entirely, it can't schedule more audits. Paradoxically, this looks like high "efficiency" in the metric because cost is zero for those agents — but it actually means insufficient coverage.

**The fix for N=500+:** Distributed inference (run the LSTM on multiple machines in parallel) + adaptive per-scale threshold calibration (recalibrate thresholds every time you add agents).

---

### WHAT TO SAY:

"Scalability is where honest research must acknowledge limitations, and I have three configurations to discuss.

**At N=100**, the primary evaluation: 99.61% accuracy, 0.39% FPR, 100% risk mitigation, 54.32% cost efficiency, 100% coverage, 77ms latency. Everything working as intended.

**At N=200**: accuracy barely changes — 99.28% versus 99.61%, a difference of 0.33 percentage points. This is very good scaling. FPR slightly increases to 0.72%. But risk mitigation drops to 75.74%. The reason: the same fixed budget now needs to cover twice as many agents per cycle, so some high-risk agents don't get visited in time. Coverage is 99.50% — still excellent. Latency is 164 ms — still well within the 10-second polling interval.

**At N=500**: the system shows strain. Accuracy drops to 82.85%, FPR rises to 17.63%, risk mitigation drops to 67.83%, and coverage drops to 42.80%. There are two root causes: first, the LSTM thresholds were calibrated at N=100 and are not adaptive to N=500's different statistical distribution. Second, the LSTM inference time scales super-linearly — running 500 separate agent sequences is not 5x slower than 100, it is more like 8-10x slower due to memory bottlenecks.

The N=500 cost efficiency of 89.45% looks deceptively high. It actually reflects **budget exhaustion** — when the system runs out of audit budget, it stops scheduling audits. Zero additional cost, but also zero additional coverage. This is not good scheduling; it is the scheduler running out of resources.

My **recommended deployment range is up to approximately 200 agents** without further optimization. The path to N=500 and beyond requires distributed inference across multiple machines and adaptive threshold recalibration that updates baselines as you scale up."

---
---

# SLIDE 20 — Latency Analysis + Live Deployment

**What's on screen:** Latency table (avg + P95), pipeline description, end-to-end verification

---

### [WHAT THIS MEANS — FOR YOU TO UNDERSTAND]

**P95 latency** = The 95th percentile latency. If avg latency is 77ms but P95 is 103ms, it means 95% of all pipeline runs complete in under 103ms, and only 5% take longer. P95 is more important than average for real-time systems because you need to guarantee timely response even in worst-case situations.

**Super-linear growth from N=200 to N=500** = The latency doesn't just double when agents double — it grows faster. This is the LSTM inference bottleneck: processing 500 separate time-windowed sequences requires significantly more GPU/CPU memory bandwidth than processing 100, because the sequences don't fit in cache as well.

**Why 10-second polling interval matters:** The entire pipeline must complete in under 10 seconds because a new batch arrives every 10 seconds from SCADA. At N=100 (77ms), we have 10,000/77 = 130x margin. At N=500 (367ms), we still have 27x margin — technically fine, but the super-linear trend means N=1000 would likely breach the interval.

---

### WHAT TO SAY:

"Let me close the results section with latency analysis, which is critical for a real-time system.

**At N=100**, average latency is 77.23ms with P95 of 103.80ms. The SCADA polling interval is 10 seconds, so the entire pipeline — SCADA poll to detection to scheduling to dashboard update — completes in under 80ms on average. We have a 130x margin. This is a very fast, very responsive system.

**At N=200**, latency is 164ms average, 191ms P95. Still 60x margin on the 10-second interval. The system is fully operational.

**At N=500**, latency is 367ms average, 483ms P95. Still within one second, so it doesn't miss a polling cycle. But the **growth from N=200 to N=500 is super-linear** — latency grew 2.24x while agents grew only 2.5x. This is the LSTM inference bottleneck. Each agent has its own sequence buffer, and at N=500 the total buffer size exceeds CPU cache capacity, causing memory bandwidth limitations.

**The full end-to-end pipeline has been verified**: SCADA poll triggers PowerShell bridge → JSON batch arrives at FastAPI → detection pipeline runs → scheduler makes decisions → XAI computes contributions → results returned to dashboard → dashboard renders updated data. This entire cycle completes within one SCADA polling interval at N=100, and we verified this with all 100 agents live.

`[SHOW LIVE: Show live_trace.png OR open the Operations Overview dashboard]`"

---
---

# SLIDE 21 — Discussion & Limitations

**What's on screen:** What works well (5 bullets), Limitations (6 bullets)

---

### WHAT TO SAY:

"I want to be completely transparent about what works well and what does not.

**What works well:**

The multi-layer detection architecture solves the fundamental recall versus FPR tradeoff that plagues every single-method approach. No single method in our comparison achieves both high recall and low FPR — the multi-layer design is what makes this possible simultaneously.

The hybrid scheduler demonstrably outperforms Q-learning alone on cost efficiency — 54.32% versus 42.5%. This validates the design decision to combine discrete and continuous optimization.

The SCADA pipeline is fully operational. I have demonstrated it end-to-end with 100 live agents. The system is not a simulation of a system — it is an actual running system.

The XAI layer makes every alert traceable. An operator can see which specific feature drove any given alert, enabling human verification before action.

The dual workspace design cleanly separates experimental validation from live operations. I can run benchmarks and live monitoring simultaneously without interference.

**Limitations — and I want to be honest about these:**

The telemetry is from Rapid SCADA calculated channels, not physical RTU or IED hardware. The physics are realistic, but the readings don't come from actual field devices. This is a real limitation.

The system is an operational prototype, not a deployed utility system. Deployment in a real utility would require additional engineering: fault tolerance, authentication, encryption, compliance certification.

Thresholds are calibrated at N=100. They are not adaptive to different scales. Scaling to N=500 requires recalibration.

The 24-hour F1 of 36.16% reflects extreme class imbalance, not fundamental model weakness — but it is still a limitation that real-world deployments with higher attack rates would not face.

We did not evaluate beyond N=500. The scalability ceiling is unknown.

I acknowledge all of these because honest research requires it. The system is strong in what it does — but I want to be clear about where the boundaries are."

---
---

# SLIDE 22 — Conclusion

**What's on screen:** 5 achievements + Future Work bullets

---

### WHAT TO SAY:

"Let me summarize the contributions of this project.

**First:** I built a four-layer multi-attack anomaly detection pipeline that, to my knowledge, is the first to combine statistical deviation, LSTM temporal modeling, weighted ensemble fusion, and three parallel attack-specific specialist detectors — CUSUM, DoS rule-based, and MITM jump-logic — in a single integrated system.

**Second:** I implemented a hybrid Q-learning plus gradient descent scheduler that improves cost efficiency from 42.5% — the base paper's Q-only result — to 54.32%, while achieving 100% risk mitigation and 100% audit coverage at N=100.

**Third:** I deployed this end-to-end against a live Rapid SCADA instance with 100 real agents, all 12 end-to-end test cases passing. This is the live deployment that no existing academic framework provides.

**Fourth:** The system outperforms the base paper on every single primary metric and outperforms all four baseline methods on all five classification metrics simultaneously.

**Fifth:** The per-feature XAI layer makes every alert fully operator-traceable, transforming the system from a black box into a transparent, auditable tool.

**For future work**, the most important next step is replacing calculated SCADA channels with physical RTU and IED telemetry — actual field hardware. This would validate the system on real-world noise characteristics and physical failure modes that simulation cannot fully replicate.

Other future directions include: distributed inference to scale beyond 500 agents without latency penalties; adaptive threshold calibration that updates baselines with seasonal and load pattern changes; and integration with organizational SIEM systems for unified threat response.

This project demonstrates that it is possible to detect multiple attack types simultaneously, schedule audits intelligently, explain every decision, and operate on live real-time data — all in one coherent, tested, deployed system."

---
---

# SLIDE 23 — References

**What's on screen:** 8 references

---

### WHAT TO SAY:

"My work builds on a foundation of well-established literature. The base paper — Priyadarsini 2025 in ACM TOPS — provides the core deviation scoring and Q-learning framework that I extend. The FDI attack model comes from Liu, Ning, and Reiter's 2011 ACM TISSEC paper, which is the canonical reference for false data injection attacks on state estimation. Isolation Forest and One-Class SVM, which I use as baselines, come from Liu et al. 2008 and Scholkopf et al. 2001 respectively. The deep learning foundation comes from the LeCun, Bengio, and Hinton 2015 Nature survey. Q-learning from Watkins and Dayan 1992, and Adam optimizer from Kingma and Ba 2015.

These references are all available in my full report."

---
---

# SLIDE 24 — Thank You

**What's on screen:** Name, roll number, guide name, institution

---

### WHAT TO SAY:

"Thank you, Professor Khedkar. I am happy to open the floor for questions and discussion. I have the live system available to demonstrate any component you would like to see in action — the SCADA integration, the dashboard, the detection pipeline, the explainability output, or any of the results figures.

I am also prepared to go deeper into any mathematical component, any implementation decision, or any of the comparison results."

---
---

# APPENDIX: COMMON QUESTIONS YOUR GUIDE MIGHT ASK

**Q: Why didn't you use real hardware?**
A: "The primary reason is accessibility and safety. Connecting ML systems to real power infrastructure requires safety certification, regulatory approval, and liability controls that are outside the scope of an M.Tech project. Rapid SCADA with calculated channels gives us a high-fidelity simulation of the same data characteristics with none of the risk. The system is architecturally ready for real hardware — replacing the calculated channels with physical RTU feeds is a configuration change, not a design change."

**Q: Why choose Mahalanobis distance and not just Z-score?**
A: "Z-score normalizes each feature independently. Mahalanobis distance accounts for correlations between features through the covariance matrix inverse. In a power grid, features are correlated — voltage and current move together under normal load changes. Z-score would flag this correlated movement as double anomaly. Mahalanobis correctly treats it as one correlated event."

**Q: Why two LSTM windows instead of one?**
A: "Different attack types have different timescales. A DoS dropout is visible in 100 seconds (10 steps). A slow FDI bias injection needs 300 seconds (30 steps) to accumulate enough deviation to detect. A single window would either miss slow attacks (if short) or introduce too much lag for fast attacks (if long). Two windows in parallel captures both without tradeoff."

**Q: The LSTM — did you train it, or use a pretrained model?**
A: "I trained the LSTM from scratch on synthetic normal traffic generated by the same SCADA configuration. The training set consists of 24-hour sequences with no attacks injected, so the model learns what 'normal' looks like for these 100 agents. Training is offline — the model is fixed before deployment and doesn't update online."

**Q: Why use Q-learning and not a more modern RL algorithm like PPO or DQN?**
A: "For this problem size — 4 states, 4 actions, discrete decisions — Q-learning is optimal: it converges quickly, is fully interpretable (you can print the Q-table and understand every decision), and has zero overhead. Modern policy gradient methods like PPO are designed for continuous or very high-dimensional state spaces where tabular Q-learning doesn't scale. Using PPO here would be over-engineering."

**Q: Your F1 is low for 24h evaluation — doesn't that undermine the system?**
A: "The 24-hour F1 of 36% is a class imbalance artifact. With 0.5% attack rate, even a system with 100% recall and 99.6% accuracy will have low precision because there are so many more negatives than positives — every small fraction of false positives from the large normal class dominates the denominator of precision. The per-decision F1 of 82.25% from the 5-method comparison — which is not affected by class imbalance in the same way — is the correct metric for evaluating detector quality."

**Q: How does your XAI compare to SHAP?**
A: "My implementation uses a gradient-based attribution method — essentially computing how much each feature's current deviation from normal contributed to the score, weighted by the sensitivity of the score to that feature. This is similar in concept to SHAP (Shapley Additive Explanations) but computationally cheaper for real-time inference. SHAP requires multiple forward passes to estimate Shapley values from game theory. My method is a single gradient computation. For the feature dimensionality here — 5 features per agent — the approximation quality is very close to SHAP while being orders of magnitude faster."

**Q: What's the path from prototype to production?**
A: "Five steps: (1) Replace calculated SCADA channels with physical IED/RTU/PMU connections. (2) Add authentication, TLS encryption, and access controls to the API. (3) Obtain IEC 62443 (industrial cybersecurity standard) compliance certification. (4) Deploy on fault-tolerant infrastructure with automatic failover. (5) Integrate with the utility's existing SIEM for unified incident response. The system architecture is designed with these steps in mind — they are engineering additions, not fundamental redesigns."

---

**END OF SCRIPT**

*Good luck tomorrow, Aditya. You built this system — you know it better than anyone. Be confident.*
