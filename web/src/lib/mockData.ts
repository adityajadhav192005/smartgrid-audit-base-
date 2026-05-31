// Realistic mock data for Smart Grid AI Control Center

export const kpiData = {
  totalAgents: 100,
  healthyAgents: 81,
  flaggedAgents: 12,
  underAudit: 7,
  currentAnomalies: 9,
  attacksDetected: 5,
  ongoingAudits: 4,
  completedAudits: 218,
  auditCoverage: 0.9438,
  currentRiskScore: 0.312,
  crossLayerStability: 0.871,
  detectionAccuracy: 0.9956,
  attackRate: 0.0900,
  operationalCost: 4820,
  currentRunId: 'RUN-2026-0315-04',
  dataset: 'UCI Grid Stability',
  systemUptime: '14h 22m',
  modelHealth: 'Optimal',
  xaiStatus: 'Active',
  livestreamStatus: 'Streaming',
  precision: 0.387,
  recall: 1.0,
  f1: 0.558,
  riskMitigation: 0.712,
  costEfficiency: 0.835,
}

// Time series — 24 hour window, 24 points
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`)

export const anomalyTrend = hours.map((h, i) => ({
  time: h,
  anomalyScore: +(0.2 + 0.4 * Math.sin(i / 3) + Math.random() * 0.15).toFixed(3),
  riskScore: +(0.15 + 0.3 * Math.cos(i / 4) + Math.random() * 0.1).toFixed(3),
  auditCount: Math.floor(5 + 12 * Math.abs(Math.sin(i / 4)) + Math.random() * 4),
  attackCount: Math.floor(Math.random() * 3 + (i > 10 && i < 18 ? 2 : 0)),
}))

export const attackTypeDistribution = [
  { name: 'False Data Injection', value: 38, color: '#ef4444' },
  { name: 'Denial of Service', value: 22, color: '#f59e0b' },
  { name: 'Comm. Jamming', value: 15, color: '#8b5cf6' },
  { name: 'Coordinated Attack', value: 14, color: '#ff6b35' },
  { name: 'Replay Attack', value: 7, color: '#3b82f6' },
  { name: 'MITM', value: 4, color: '#00f5d4' },
]

export const agentStatusDistribution = [
  { name: 'Healthy', value: 81, color: '#10b981' },
  { name: 'Anomalous', value: 9, color: '#f59e0b' },
  { name: 'Under Audit', value: 4, color: '#3b82f6' },
  { name: 'Attacked', value: 5, color: '#ef4444' },
  { name: 'Isolated', value: 1, color: '#6366f1' },
]

export const auditSeverityDistribution = [
  { name: 'Critical', value: 15, color: '#ef4444' },
  { name: 'High', value: 28, color: '#f97316' },
  { name: 'Medium', value: 47, color: '#f59e0b' },
  { name: 'Low', value: 10, color: '#10b981' },
]

export const topRiskyAgents = [
  { id: 'GEN-04', type: 'Generator', riskScore: 0.91, anomalyScore: 1.42, auditCount: 8, attack: 'FDI' },
  { id: 'SUB-07', type: 'Substation', riskScore: 0.85, anomalyScore: 1.28, auditCount: 6, attack: 'DoS' },
  { id: 'GEN-01', type: 'Generator', riskScore: 0.79, anomalyScore: 1.15, auditCount: 5, attack: 'FDI' },
  { id: 'BRK-12', type: 'Breaker', riskScore: 0.71, anomalyScore: 1.08, auditCount: 4, attack: 'Coordinated' },
  { id: 'PMU-22', type: 'PMU', riskScore: 0.62, anomalyScore: 0.98, auditCount: 3, attack: 'Jamming' },
  { id: 'SUB-03', type: 'Substation', riskScore: 0.58, anomalyScore: 0.94, auditCount: 3, attack: 'FDI' },
  { id: 'GEN-09', type: 'Generator', riskScore: 0.52, anomalyScore: 0.87, auditCount: 2, attack: 'DoS' },
  { id: 'BRK-05', type: 'Breaker', riskScore: 0.44, anomalyScore: 0.79, auditCount: 2, attack: '-' },
]

export const physicalVsCyber = [
  { subject: 'Voltage', physical: 0.94, cyber: null },
  { subject: 'Frequency', physical: 0.89, cyber: null },
  { subject: 'Current', physical: 0.82, cyber: null },
  { subject: 'Power', physical: 0.91, cyber: null },
  { subject: 'Latency', physical: null, cyber: 0.77 },
  { subject: 'Integrity', physical: null, cyber: 0.88 },
  { subject: 'Comm Freq', physical: null, cyber: 0.71 },
  { subject: 'Pkt Loss', physical: null, cyber: 0.65 },
]

export const radarData = [
  { metric: 'Voltage', score: 94 },
  { metric: 'Current', score: 82 },
  { metric: 'Frequency', score: 89 },
  { metric: 'Latency', score: 77 },
  { metric: 'Integrity', score: 88 },
  { metric: 'Pkt Loss', score: 65 },
]

export const recentEvents = [
  { id: 1, ts: '14:22:11', type: 'ANOMALY', msg: 'GEN-04: anomaly score 1.42 — FDI signature', severity: 'critical' },
  { id: 2, ts: '14:21:55', type: 'AUDIT', msg: 'Audit AUD-218 triggered for GEN-04 (high priority)', severity: 'high' },
  { id: 3, ts: '14:21:30', type: 'ATTACK', msg: 'FDI attack confirmed on GEN-04, GEN-01 cluster', severity: 'critical' },
  { id: 4, ts: '14:20:15', type: 'THRESHOLD', msg: 'SUB-07 voltage deviation exceeds Th=1.25 (obs=1.28)', severity: 'high' },
  { id: 5, ts: '14:19:48', type: 'RESPONSE', msg: 'BRK-12 isolated — coordinated attack mitigation', severity: 'high' },
  { id: 6, ts: '14:18:33', type: 'AUDIT', msg: 'Audit AUD-217 completed: threat confirmed on SUB-07', severity: 'medium' },
  { id: 7, ts: '14:17:12', type: 'MODEL', msg: 'RL policy update — Q-value delta 0.0082 (converged)', severity: 'info' },
  { id: 8, ts: '14:16:05', type: 'XAI', msg: 'SHAP explanation generated for agent GEN-04', severity: 'info' },
  { id: 9, ts: '14:15:20', type: 'SYNC', msg: 'External dashboard sync completed (Grafana)', severity: 'info' },
  { id: 10, ts: '14:14:44', type: 'ANOMALY', msg: 'PMU-22 comm jamming pattern detected', severity: 'medium' },
]

export const liveAgents = Array.from({ length: 20 }, (_, i) => {
  const types = ['Generator', 'Substation', 'PMU', 'Breaker']
  const states = ['Healthy', 'Healthy', 'Healthy', 'Healthy', 'Anomalous', 'Suspect', 'Under Audit', 'Attacked']
  const attacks = ['-', '-', '-', 'FDI', 'DoS', 'Jamming', 'Coordinated', 'Replay']
  const type = types[i % 4]
  const state = states[Math.floor(Math.random() * states.length)]
  return {
    id: `${type.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
    type,
    state,
    physicalHealth: +(0.6 + Math.random() * 0.4).toFixed(2),
    cyberHealth: +(0.55 + Math.random() * 0.45).toFixed(2),
    anomalyScore: state === 'Anomalous' || state === 'Attacked' ? +(1.0 + Math.random() * 0.6).toFixed(3) : +(Math.random() * 0.8).toFixed(3),
    riskScore: +(Math.random() * 0.9).toFixed(2),
    lastAttack: state === 'Attacked' ? attacks[Math.floor(Math.random() * attacks.length)] : '-',
    auditTriggered: state === 'Under Audit' || state === 'Anomalous',
    criticalityWeight: type === 'Generator' ? 1.0 : type === 'Substation' ? 0.7 : type === 'Breaker' ? 0.5 : 0.3,
  }
})

export const auditRecords = [
  {
    id: 'AUD-218', agentId: 'GEN-04', agentType: 'Generator', severity: 'Critical',
    status: 'Active', triggerReason: 'FDI anomaly + threshold breach',
    triggerCondition: 'Score(GEN-04) = 1.42 > Th=1.0, FDI signature confirmed',
    anomalyScore: 1.42, riskScore: 0.91, criticalityWeight: 1.0,
    suspectedAttack: 'False Data Injection', confidence: 0.94,
    startTime: '14:21:55', endTime: null,
    description: 'Agent GEN-04 exhibited a deviation of 42% above its normalized threshold across voltage and power metrics. The RL audit policy flagged this as high-priority due to the criticality weight (1.0) and the presence of an FDI signature pattern — a sudden upward bias consistent with sensor value tampering. Both physical and cyber layers are affected.',
    linkedEvidence: ['ANO-091', 'ATK-034'],
  },
  {
    id: 'AUD-217', agentId: 'SUB-07', agentType: 'Substation', severity: 'High',
    status: 'Completed', triggerReason: 'DoS + comm latency spike',
    triggerCondition: 'Latency(SUB-07) = 85ms > Th_latency=40ms, DoS signature',
    anomalyScore: 1.28, riskScore: 0.85, criticalityWeight: 0.7,
    suspectedAttack: 'Denial of Service', confidence: 0.89,
    startTime: '13:45:00', endTime: '14:18:33',
    description: 'SUB-07 recorded a 112% latency spike combined with elevated packet loss. The behavior analysis module identified this as a DoS pattern based on cumulative deviation trend D(SUB-07,t)=4.2 over the observation window. The audit confirmed active attack; breaker isolation was recommended.',
    linkedEvidence: ['ANO-088', 'ATK-031'],
  },
  {
    id: 'AUD-216', agentId: 'BRK-12', agentType: 'Breaker', severity: 'High',
    status: 'Completed', triggerReason: 'Coordinated cascade chain detected',
    triggerCondition: 'K-means cluster [BRK-12, SUB-03, GEN-01]: anomalous cluster detected',
    anomalyScore: 1.08, riskScore: 0.71, criticalityWeight: 0.5,
    suspectedAttack: 'Coordinated Chain Attack', confidence: 0.81,
    startTime: '12:10:00', endTime: '12:55:00',
    description: 'Behavior clustering detected a correlated anomaly pattern across the BRK-12, SUB-03, GEN-01 chain. Cluster label=1 with 3+ anomalous members triggered cascading audit capacity boost (+15%). Pattern consistent with coordinated breaker-substation attack described in threat model.',
    linkedEvidence: ['ANO-082', 'ATK-029'],
  },
]

export const attackEvents = [
  {
    id: 'ATK-034', type: 'False Data Injection', startTime: '14:20:00', duration: '14m+',
    targetAgents: ['GEN-04', 'GEN-01'], affectedLayer: 'Physical + Cyber',
    severity: 'Critical', detectionTime: '14:21:30', status: 'Confirmed',
    anomalies: ['ANO-091', 'ANO-087'], audits: ['AUD-218'],
    impact: 'Voltage sensor readings biased +18%; power output misreported +22%',
    confidence: 0.94,
  },
  {
    id: 'ATK-031', type: 'Denial of Service', startTime: '13:40:00', duration: '40m',
    targetAgents: ['SUB-07', 'SUB-03'], affectedLayer: 'Cyber',
    severity: 'High', detectionTime: '13:45:00', status: 'Mitigated',
    anomalies: ['ANO-088', 'ANO-085'], audits: ['AUD-217'],
    impact: 'Communication latency increased 3x; 2 substations degraded',
    confidence: 0.89,
  },
  {
    id: 'ATK-029', type: 'Coordinated Chain', startTime: '12:05:00', duration: '50m',
    targetAgents: ['BRK-12', 'SUB-03', 'GEN-01'], affectedLayer: 'Physical',
    severity: 'High', detectionTime: '12:10:00', status: 'Mitigated',
    anomalies: ['ANO-082', 'ANO-080', 'ANO-079'], audits: ['AUD-216'],
    impact: 'Breaker relay tampering; potential grid section destabilization',
    confidence: 0.81,
  },
]

export const xaiExplanations = [
  {
    agentId: 'GEN-04',
    anomalyScore: 1.42,
    topFeatures: [
      { feature: 'voltage_deviation', importance: 0.48, direction: 'positive', value: 1.18, nominal: 1.0 },
      { feature: 'power_deviation', importance: 0.31, direction: 'positive', value: 1.22, nominal: 1.0 },
      { feature: 'response_time', importance: 0.12, direction: 'positive', value: 1.08, nominal: 1.0 },
      { feature: 'comm_freq', importance: 0.06, direction: 'negative', value: 0.78, nominal: 1.0 },
      { feature: 'current_deviation', importance: 0.03, direction: 'negative', value: 0.92, nominal: 1.0 },
    ],
    narrative: 'GEN-04 was flagged due to abnormally high voltage and power deviations consistent with False Data Injection. Voltage rose 18% above the adaptive threshold while power output was reported 22% higher than the baseline. The RL audit scheduler prioritized this agent due to its generator-class criticality weight (1.0) and historical FDI vulnerability.',
    confidence: 0.94,
    modelVersion: 'LSTM-v2.1',
  },
]

export const runHistory = [
  { id: 'RUN-2026-0315-04', date: '2026-03-15', duration: '14m 22s+', agents: 100, dataset: 'UCI Grid Stability', attacks: 'FDI+DoS+Chain', auditCount: 218, anomalyCount: 91, riskAvg: 0.312, attackRate: 0.09, cost: 4820, stability: 0.871, xai: true, status: 'Running', costEfficiency: 0.835, riskMitigation: 0.712 },
  { id: 'RUN-2026-0315-03', date: '2026-03-15', duration: '8m 14s', agents: 100, dataset: 'UCI Grid Stability', attacks: 'FDI+DoS', auditCount: 184, anomalyCount: 78, riskAvg: 0.298, attackRate: 0.08, cost: 4210, stability: 0.884, xai: true, status: 'Completed', costEfficiency: 0.842, riskMitigation: 0.676 },
  { id: 'RUN-2026-0315-02', date: '2026-03-15', duration: '7m 52s', agents: 200, dataset: 'UCI Grid Stability', attacks: 'DoS+Chain', auditCount: 392, anomalyCount: 155, riskAvg: 0.321, attackRate: 0.10, cost: 8840, stability: 0.859, xai: true, status: 'Completed', costEfficiency: 0.847, riskMitigation: 0.713 },
  { id: 'RUN-2026-0315-01', date: '2026-03-15', duration: '9m 01s', agents: 500, dataset: 'Synthetic', attacks: 'All types', auditCount: 1024, anomalyCount: 411, riskAvg: 0.344, attackRate: 0.11, cost: 10560, stability: 0.841, xai: false, status: 'Completed', costEfficiency: 0.926, riskMitigation: 0.721 },
]
