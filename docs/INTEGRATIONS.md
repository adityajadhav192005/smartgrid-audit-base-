# External Tool Integration Plan

This framework targets multi-agent smart grid audit simulation and can integrate with domain tools as follows:

- MATLAB/Simulink: Power system dynamics and fault simulation; export time-series metrics for ingestion by Python pipeline. Interface via CSV/Mat files and a simple Python loader.
- JADE (Java): Decentralized multi-agent audit execution; use REST or message queues to exchange agent states and audit commands.
- NS-3: Network traffic simulation for cyber-attack scenarios (DoS/MITM); export packet traces and integrity metrics for the cyber layer.
- PowerWorld: Stability analysis; import/export bus/line parameters and stability indicators; map to physical layer risk metrics.
- GridLAB-D: Distribution modeling; export load distribution and energy loss metrics for distribution agents.

## Data Exchange Interfaces
- File-based: CSV/JSON/Mat file exports imported via `smartgrid_mas/data/loaders.py` (to be added as needed)
- REST/HTTP: Lightweight API endpoints for live telemetry and audit actions
- Message Queue: RabbitMQ/Kafka for high-throughput agent updates (optional)

## Next Steps
1. Define minimal schema for cross-tool metric exchange (timestamps, agent_id, layer, metric_name, value)
2. Implement loaders/adapters for MATLAB and NS-3 traces
3. Prototype JADE integration via REST endpoints for audit triggers
4. Document mapping between external metrics and internal baselines/thresholds
