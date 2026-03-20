param(
  [string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$Service = "smartgrid-public-api",
  [string]$ApiKey = "smartgrid-dev-key",
  [string]$RapidScadaUrl = "",
  [int]$ScadaPollSec = 5,
  [int]$ScadaTimeoutSec = 4,
  [string]$ScadaAgentId = "rapidscada-agent"
)

if (-not $ProjectId) {
  Write-Error "ProjectId is required. Example: .\\scripts\\deploy_cloudrun.ps1 -ProjectId your-gcp-project"
  exit 1
}

$ErrorActionPreference = "Stop"

Write-Host "Setting gcloud project..."
gcloud config set project $ProjectId | Out-Null

Write-Host "Deploying to Cloud Run (source build)..."
$scadaEnabled = if ([string]::IsNullOrWhiteSpace($RapidScadaUrl)) { "0" } else { "1" }
$envVars = @(
  "SMARTGRID_API_KEY=$ApiKey",
  "SMARTGRID_SCADA_LIVE_ENABLED=$scadaEnabled",
  "SMARTGRID_SCADA_SOURCE_URL=$RapidScadaUrl",
  "SMARTGRID_SCADA_POLL_SEC=$ScadaPollSec",
  "SMARTGRID_SCADA_HTTP_TIMEOUT_SEC=$ScadaTimeoutSec",
  "SMARTGRID_SCADA_AGENT_ID=$ScadaAgentId"
) -join ","

gcloud run deploy $Service `
  --source . `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --min-instances 1 `
  --no-cpu-throttling `
  --set-env-vars $envVars

Write-Host "Done. Fetching service URL..."
$url = gcloud run services describe $Service --region $Region --format="value(status.url)"
Write-Host "Cloud Run URL: $url"
