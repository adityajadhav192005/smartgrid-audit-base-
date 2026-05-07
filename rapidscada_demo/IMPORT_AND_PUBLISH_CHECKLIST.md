# Rapid SCADA Manual Import And Publish Checklist

Use this with:

- [ProjectBaseXML](d:/Mtech%20Main%20project/smartgrid-audit-base-/rapidscada_demo/ProjectBaseXML)
- [CHANNEL_POPULATION_PLAN.md](d:/Mtech%20Main%20project/smartgrid-audit-base-/rapidscada_demo/Config/CHANNEL_POPULATION_PLAN.md)
- [trace_rapidscada_live_agents.ps1](d:/Mtech%20Main%20project/smartgrid-audit-base-/scripts/trace_rapidscada_live_agents.ps1)

## 1. Generate The BaseXML Pack

Run:

```powershell
python .\scripts\generate_rapidscada_project_basexml.py
```

Expected output files:

- `rapidscada_demo/ProjectBaseXML/Cnl.xml`
- `rapidscada_demo/ProjectBaseXML/Obj.xml`
- `rapidscada_demo/ProjectBaseXML/Device.xml`
- `rapidscada_demo/ProjectBaseXML/CommLine.xml`

## 2. Open The MAS Project

1. Start Rapid SCADA Administrator.
2. Open project:
   - `C:\Users\adity\OneDrive\Documents\ScadaProjects\MAS\MAS.rsproj`

## 3. Import The Base Tables

In Administrator, go to the Configuration tables and import these XML files:

1. `Communication Lines`
   - import `ProjectBaseXML/CommLine.xml`
2. `Devices`
   - import `ProjectBaseXML/Device.xml`
3. `Objects`
   - import `ProjectBaseXML/Obj.xml`
4. `Channels`
   - import `ProjectBaseXML/Cnl.xml`

If you already have existing rows and want to keep them, use merge/update mode.
If this is a clean SmartGrid-only project, replacing those tables is simpler.

## 4. Save The Project

1. Save the project in Administrator.
2. Confirm there are no validation/import errors.

Expected rough counts:

- `CommLine`: 4
- `Device`: 100
- `Obj`: 101 including the root object
- `Cnl`: 300

## 5. Populate Live Data

Rapid SCADA import only creates config rows. It does not create live values by itself.

To move from `2` live to `100` live:

1. open the simulator / driver / formula configuration you use in MAS
2. apply the per-agent plan from:
   - [CHANNEL_POPULATION_PLAN.md](d:/Mtech%20Main%20project/smartgrid-audit-base-/rapidscada_demo/Config/CHANNEL_POPULATION_PLAN.md)
3. make sure every required live channel returns `stat > 0`

Required live channels:

- `GEN-01..20`: voltage + current
- `SUB-21..50`: load + latency
- `PMU-51..75`: voltage + frequency
- `BRK-76..100`: status

## 6. Publish The Project

In Administrator:

1. go to the project deployment/publish action
2. select the `Default Profile`
3. publish/upload to the local instance
4. allow restart of:
   - Server
   - Comm
   - Web

Your project already has an agent deployment profile configured in:

- `C:\Users\adity\OneDrive\Documents\ScadaProjects\MAS\Deployment.xml`

## 7. Verify Live Count

Run:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

Current observed state before full population:

- `Live agents: 2`
- `GEN-01`
- `GEN-03`

Target milestones:

- after generators: `20`
- after substations: `50`
- after PMUs: `75`
- after breakers: `100`

## 8. Start Full Demo Stack

Run:

```powershell
.\scripts\start_local_demo.ps1 -OpenDashboard
```

## 9. Final Demo Pass

Take screenshots/videos from:

- Experiment workspace overview
- Rapid SCADA Grid
- Rapid SCADA Asset / Topology View
- Algorithm Config / Methodology View
- Incident Timeline
- System Health / Pipeline Health

## Troubleshooting

- If `trace_rapidscada_live_agents.ps1` still shows only `2` live:
  - publish did not apply
  - simulator/formulas are not populating the new channels
  - channels are present but still returning `stat=0`

- If Webstation crashes in local repo mode:
  - use the updated launcher:
    - [start_local_demo.ps1](d:/Mtech%20Main%20project/smartgrid-audit-base-/scripts/start_local_demo.ps1)
  - it disables the Windows Event Log provider that was failing in this environment
