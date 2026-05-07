**SCADA Quickstart**

For production operations (Railway backend + Vercel dashboard), see [BACKEND_OPS.md](BACKEND_OPS.md).

This project exposes a SCADA-facing batch ingest endpoint in [smartgrid_mas/api/app.py](smartgrid_mas/api/app.py):

- `POST /v1/scada/ingest/tags/batch`

It accepts a full grid snapshot as records, normalizes tags through [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py), and returns:

- normalized score request
- deviation/risk score
- anomaly flag
- XAI explanation for the decision

**1. Start the API**

Run:

```powershell
$env:SMARTGRID_API_KEY="smartgrid-dev-key"
& "D:/Mtech Main project/smartgrid-audit-base-/.venv/Scripts/python.exe" -m smartgrid_mas.api_server
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

**2. Push SCADA tags using bridge launcher**

Use the bridge launcher:

```powershell
$env:SMARTGRID_API_KEY="smartgrid-dev-key"
.\scripts\start_rapidscada_bridge.ps1
```

This posts to:

```text
http://127.0.0.1:8000/v1/scada/ingest/tags/batch
```

**3. Rapid SCADA direct polling bridge (port 10109)**

Rapid SCADA local demo host runs on **TCP port 10109**. It exposes a REST API:

```
GET http://localhost:10109/Api/Main/GetCurData?cnlNums=...
```

Use the dedicated polling bridge that reads Rapid SCADA channels and forwards them to the SmartGrid API automatically:

```powershell
$env:SMARTGRID_API_KEY = "smartgrid-dev-key"

# Single poll (test)
.\scripts\pull_rapidscada_to_api.ps1 -RunOnce

# Continuous polling every 10 seconds
.\scripts\pull_rapidscada_to_api.ps1 -PollIntervalSeconds 10
```

Or use the one-command launcher:

```powershell
$env:SMARTGRID_API_KEY = "smartgrid-dev-key"
.\scripts\start_rapidscada_bridge.ps1
```

Optional Rapid SCADA auth env vars (if API returns 401):

```powershell
$env:RAPID_SCADA_BEARER_TOKEN = "<token>"
# or
$env:RAPID_SCADA_USERNAME = "<user>"
$env:RAPID_SCADA_PASSWORD = "<password>"
```

Default bridge credentials (if env vars are not set):

```powershell
Username = admin
Password = scada
```

For username/password API login, ensure Rapid SCADA has auth API enabled in `ScadaWebConfig.xml`:

```xml
<Option name="AllowAuthApi" value="true" />
```

The bridge first tries `POST /Api/Auth/Login` (token auth) and then falls back to Basic auth automatically.

One-shot test mode:

```powershell
.\scripts\start_rapidscada_bridge.ps1 -RunOnce
```

If your API key is different from the default, set it first:

```powershell
$env:SMARTGRID_API_KEY = "<your-api-key>"
```

If Rapid SCADA is not reachable, the bridge skips publishing to avoid fallback/default contamination.

If IIS-hosted Rapid SCADA returns HTTP 500 due file permissions under `C:\Program Files\SCADA\ScadaWeb`, run a writable local copy:

```powershell
# Example local host URL used by bridge
$env:RAPID_SCADA_URL = "http://127.0.0.1:10109"
```

**Channel number → tag name mapping** (edit in `scripts/pull_rapidscada_to_api.ps1`):

| Rapid SCADA Cnl # | SmartGrid tag    | What it measures           |
|-------------------|------------------|----------------------------|
| 101               | `voltage`        | Phase voltage (V)           |
| 102               | `frequency`      | Grid frequency (Hz)         |
| 103               | `current`        | Line current (A)            |
| 104               | `power`          | Active power (W)            |
| 105               | `response_time`  | Agent response time (ms)    |
| 201               | `latency`        | Communication latency (ms)  |
| 202               | `packet_loss`    | Packet loss ratio (0–1)     |
| 203               | `integrity`      | Comm integrity (0–1)        |
| 204               | `comm_freq`      | Communication frequency (Hz)|

**How to create matching channels in Rapid SCADA:**

1. Open **Rapid SCADA Administrator** → `Configuration → Channels (Cnl)`  
2. Add channels with the numbers above (101–105 for physical, 201–204 for cyber)  
3. Assign each channel to the appropriate device/data source  
4. Set the **Data type** to `Double` and configure the engineering unit  
5. Restart ScadaComm service  

Once channels are flowing, the bridge normalises each raw value by its nominal and sends the result to the audit API.

**4. Required tag mapping**

If you prefer not to use the polling bridge, map your SCADA channel names to these expected tags:

- `voltage`
- `frequency`
- `current`
- `power`
- `response_time`
- `latency`
- `packet_loss`
- `integrity`
- `comm_freq`

If required tags are missing, ingest is rejected for strict live mode.

**5. What comes back**

The API response includes:

- `deviation_score`
- `anomaly_flag`
- `risk_score`
- `decision`
- `severity`
- `ledger` (blockchain anchor metadata: `event_id`, `tx_id`, `chain_hash`)
- `xai.physical`
- `xai.cyber`
- `xai.decision`

That is enough for:

- operator explanation
- SCADA alarm enrichment
- HMI display
- downstream storage/logging

**6. Minimal integration pattern**

For a simple deployment, use this flow:

1. Rapid SCADA exports current tag values.
2. A small script/service converts them to the JSON structure above.
3. The bridge posts one batched payload to `/v1/scada/ingest/tags/batch`.
4. The response is logged back into SCADA or shown in the operator HMI.

**8. Files involved**

| File | Purpose |
|------|---------|
| [smartgrid_mas/api/app.py](smartgrid_mas/api/app.py) | FastAPI with `/v1/scada/ingest/tags/batch` endpoint |
| [smartgrid_mas/integration/scada_adapter.py](smartgrid_mas/integration/scada_adapter.py) | Tag normalisation and score request builder |
| [scripts/pull_rapidscada_to_api.ps1](scripts/pull_rapidscada_to_api.ps1) | **Rapid SCADA polling bridge** (port 10109 → port 8000 batch ingest) |
| [scripts/push_scada_tags_to_api.ps1](scripts/push_scada_tags_to_api.ps1) | Manual tag push (sample or JSON file) |