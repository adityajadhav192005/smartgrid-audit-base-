param(
  [string]$ProjectId,
  [string]$Region = "us-central1",
  [string]$Service = "smartgrid-public-api",
  [string]$ApiKey = "smartgrid-dev-key"
)

if (-not $ProjectId) {
  Write-Error "ProjectId is required. Example: .\\scripts\\deploy_cloudrun.ps1 -ProjectId your-gcp-project"
  exit 1
}

$ErrorActionPreference = "Stop"

Write-Host "Setting gcloud project..."
gcloud config set project $ProjectId | Out-Null

Write-Host "Deploying to Cloud Run (source build)..."
gcloud run deploy $Service `
  --source . `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --min-instances 1 `
  --no-cpu-throttling `
  --set-env-vars "SMARTGRID_API_KEY=$ApiKey"

Write-Host "Done. Fetching service URL..."
$url = gcloud run services describe $Service --region $Region --format="value(status.url)"
Write-Host "Cloud Run URL: $url"
