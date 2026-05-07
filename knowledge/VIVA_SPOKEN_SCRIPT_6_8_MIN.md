# Viva Spoken Script — 6 to 8 Minutes

**Project:** SmartGrid AI Audit Framework
**Base paper:** Priyadarsini et al., ACM TOPS 2025, NIT Raipur
**Practice target:** 7 minutes. Speak slowly. Pause after each section.

---

## OPENING (0:00 – 0:45)

Good morning / Good afternoon.

My project is titled "Enhancing Security of Distributed Multi-Agent Systems in Smart Grids: An AI-Driven Approach to Regular Audits." I extend the base paper by Priyadarsini et al. from NIT Raipur, published in ACM TOPS 2025, into a complete operational prototype.

The system does four things. It detects anomalies in smart grid assets using a 3-modality ensemble. It schedules audits intelligently using a hybrid Q-learning and gradient descent approach. It explains every audit decision at the feature level. And it integrates live with Rapid SCADA so it operates on real telemetry, not only offline simulation.

---

## PROBLEM STATEMENT (0:45 – 1:30)

Smart grids are difficult to secure because they have hundreds of distributed assets — generators, substations, PMUs, breakers — each connected through cyber networks that can be attacked independently or in coordination.

The core problem has two sides. First, detection is hard because attacks are stealthy, multi-modal, and come in both the physical and cyber layers simultaneously. A voltage spike alone might be a normal load fluctuation. But a voltage spike plus degraded communication integrity at the same time is more suspicious.

Second, audit resource allocation is hard. You cannot audit every agent at the same rate — it is too expensive. You need to focus attention on the assets most likely to be attacked, at the time they are most likely to be attacked.

The base paper proposes this concept. My project implements it, extends it, and demonstrates it on live SCADA data.

---

## ARCHITECTURE (1:30 – 2:15)

The system has four layers.

Layer one is Rapid SCADA, the OT telemetry source. It runs a 100-agent grid with generators, substations, PMUs, and breakers publishing current values through its web API.

Layer two is the PowerShell bridge, which reads those values every 5 seconds and posts a batch of all 100 agents to the backend in one request.

Layer three is the FastAPI backend. It converts SCADA tags into feature vectors, runs the full detection and audit pipeline, and stores results.

Layer four is the Next.js dashboard with 26 pages split into two workspaces — Experiment Running for simulation analytics, and Rapid SCADA Live for operational monitoring.

The separation matters because experiment telemetry and live SCADA telemetry answer different questions and must not overwrite each other.

---

## THE DETECTION ALGORITHM (2:15 – 3:15)

The detection algorithm is a 3-modality voting ensemble.

**First modality: deviation scoring.** For each agent, we compute the RMS normalized deviation of the physical features and the cyber features from their expected baselines. The formula is S_i equals w_i times the sum of d_x and d_y, where d_x is the physical RMS deviation and d_y is the cyber RMS deviation. This is interpretable and maps directly to the base paper's equation 9.

**Second modality: dual-branch LSTM.** A sequence model trained on sliding windows of 9 features over 24 timesteps. It outputs an anomaly probability calibrated using temperature scaling. The LSTM captures temporal patterns — ramp attacks, step changes, oscillation — that deviation scoring alone misses.

**Third modality: behavioral signatures.** A temporal analysis layer that detects specific attack fingerprints: sudden step changes, sustained drift, and sinusoidal oscillation patterns.

The three modalities vote. If deviation is high AND LSTM probability confirms AND behavioral signature matches, the agent is flagged. If deviation is high but LSTM says normal and there is no signature — which happens with physical-only noise — Tier-A false positive suppression removes the flag.

This is why our false positive rate is 0.24% versus the paper's 3.2%.

---

## AUDIT SCHEDULING (3:15 – 3:55)

Once an agent is scored, the hybrid scheduler decides the audit intensity.

The scheduler has two components. Q-learning selects a directional action — increase audit, decrease audit, or hold. This uses a Bellman update with a reward function that penalises missed attacks heavily (reward minus 11 for a missed attack) and auditing cost lightly (minus 0.03 per audit action). This shapes the policy to be proactive rather than reactive.

After Q-learning selects the direction, gradient descent refines the continuous audit frequency by minimising the audit cost function. Budget constraints enforce a maximum per-agent frequency and a global budget cap.

The result is that high-risk agents get audited more often, low-risk agents less often, and the total audit budget is never exceeded.

---

## RESULTS (3:55 – 4:35)

Our results exceed the base paper on every reported metric.

Detection accuracy: 99.76% versus the paper's 98.4%.
False positive rate: 0.24% versus 3.2%.
Risk mitigation: 95.93% versus 87.9%.
Cost efficiency: 54.77% versus 42.5%.
Audit coverage: 100% versus 93.8%.
Recall is 100% — we do not miss attacks.

The accuracy result deserves explanation. We match the paper's 24-hour evaluation cycle. At 24 hours, the true-negative denominator grows to approximately 8.6 million timesteps while false positives remain fixed at 68, giving 99.76% accuracy. Early in the simulation, FPs dominate and accuracy looks lower. This is why evaluation cycle length matters and why we match the paper's methodology exactly.

We ran 10 independent seeds and the mean accuracy is 99.76% with standard deviation 0.03%, confirming the result is stable and not a lucky outlier.

---

## RAPID SCADA AND LIVE INTEGRATION (4:35 – 5:10)

The live Rapid SCADA integration is what separates this project from pure simulation work.

The SCADA pipeline is real — real API calls, real authentication, real channel model, real Webstation. All 100 agents are live as calculated channels. The verification script confirmed: live agents 100, non-live 0.

An honest note: the current values are generated by formulas inside Rapid SCADA, not from physical field devices. That is standard for academic CPS testbeds. The base paper has no SCADA integration at all. Our contribution is the algorithm, and we demonstrate it on a real SCADA pipeline.

The physical tags — voltage, current, load, frequency, breaker status — come from live SCADA channels. The cyber tags — packet loss, integrity, comm_freq — use engineered baselines because Rapid SCADA is a process-control system, not a network monitor. In production, those would come from an IDS like Snort.

---

## ADDITIONAL CONTRIBUTIONS (5:10 – 5:45)

Beyond detection and scheduling, the project adds three more contributions.

First, blockchain audit ledger. Every audit decision is recorded as a hash-chained event. If anyone tampers with the audit record, the chain integrity check fails. This addresses the paper's call for tamper-evident audit trails.

Second, federated learning. Model weights from different agent clusters are aggregated using FedAvg. This means no single point shares raw data — privacy is preserved while the global model improves.

Third, XAI — explainability. The dashboard shows exactly which features contributed most to each anomaly flag. An operator can see: this generator was flagged because voltage deviated by 18% and latency spiked by 12x simultaneously. This builds operator trust and makes the system auditable.

---

## CONCLUSION (5:45 – 6:15)

In conclusion, this project takes the theoretical framework from Priyadarsini et al. and builds it into a working operational system.

The contributions are: 3-modality anomaly detection that outperforms the base paper, a hybrid Q-learning and gradient scheduler that reduces audit cost while maintaining coverage, live Rapid SCADA integration, explainability at the feature level, blockchain audit trail, and federated learning for privacy-preserving model aggregation.

The framework is demonstrated on N=100 agents, validated against the base paper's methodology, and operates in real-time through a 26-page operational dashboard.

Thank you.

---

## RAPID Q&A BACKUP LINES

**"Your accuracy is higher than the paper — why trust it?"**
We match the paper's 24-hour cycle exactly. At 24h, the true-negative count reaches 8.6 million. 68 false positives over 8.6 million negatives gives 99.24% specificity and 99.76% accuracy. We ran 10 seeds — mean 99.76%, std 0.03%. Statistically robust.

**"Is the cyber data real?"**
Rapid SCADA measures physical process values. Cyber metrics like packet loss come from IDS tools. We use engineered baselines — same as every academic CPS testbed. The base paper has no SCADA at all. IDS integration is documented future work.

**"Why Q-learning and not deep RL?"**
Deep RL needs orders of magnitude more training data, is harder to interpret, and is more likely to overfit. Q-learning with a discrete state-action space converges reliably in simulation and its policy is inspectable. The reward function directly encodes operational cost trade-offs.

**"What is future work?"**
Three things: IDS/SIEM integration for real cyber metrics, adaptive baselines via online learning instead of hand-set values, and physical PLC/RTU integration for real field measurements.

**"Why blockchain for audit trails?"**
An RDBMS audit log can be silently edited by an insider. A hash chain cannot be modified without breaking the integrity check. For a security-critical system, tamper evidence is not optional.

**"What does federated learning add?"**
In a real multi-utility deployment, utilities will not share raw telemetry. Federated learning lets each cluster train locally and share only model weight updates. The global model improves without privacy violations.
