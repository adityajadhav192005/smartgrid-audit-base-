# Final Release Checklist (SmartGrid Audit Platform)

Date: 2026-03-15

## 1) Deployed Services
- Frontend (Vercel, production): `https://masaudit.ai`
- Frontend deployment URL (latest): `https://web-2sof4pwf2-adityajadhav192005s-projects.vercel.app`
- Backend (Railway): `https://smartgrid-public-api-production.up.railway.app`
- Backend custom domain: `https://api.masaudit.ai`

## 2) Runtime Settings Persistence (Production)
- Settings save/load path is production-safe:
  - Dashboard -> `web/src/app/api/settings/runtime/route.ts`
  - Proxies to Railway endpoint `/v1/settings/runtime`
- Railway persistence store:
  - SQLite table `runtime_settings` in backend DB (`/app/data/audit_chain.db`)
- Verified flow:
  - POST `/api/settings/runtime` returns `status: ok`
  - GET `/api/settings/runtime` returns persisted `values`, `runtime_overrides`, `runtime_env`

## 3) Core Code Changes Included
- Railway backend settings endpoints:
  - `backend_railway/app.py`
- Vercel settings API proxy:
  - `web/src/app/api/settings/runtime/route.ts`
- Settings UI persistence wiring:
  - `web/src/app/settings/page.tsx`
- Python runtime override loading:
  - `smartgrid_mas/config/loader.py` (JSON merge)
  - `smartgrid_mas/run_all.py` (runtime env file bootstrap)

## 4) Validation Results
- Frontend production build: pass (`next build`)
- Python tests (targeted for changed modules): pass
- Railway runtime logs show healthy startup and settings GET/POST traffic

## 5) Required Production Environment Variables
### Vercel (Project: web, Production)
- `SMARTGRID_API_URL=https://smartgrid-public-api-production.up.railway.app`

### Railway (Service: smartgrid-public-api)
- `SMARTGRID_API_KEY=<expected API key used by Vercel route>`
- Optional persistent disk path via `SMARTGRID_DATA_DIR` if using mounted volume

## 6) DNS / Access Notes
- `masaudit.ai` alias is configured on Vercel.
- `api.masaudit.ai` is configured on Railway.
- If any endpoint appears unreachable from a specific network, verify local DNS resolution and SSL propagation.

## 7) Post-Release Smoke Test Commands
1. Vercel settings GET:
   - `vercel curl /api/settings/runtime --deployment https://<latest-vercel-deployment>.vercel.app`
2. Vercel settings POST:
   - `vercel curl /api/settings/runtime --deployment https://<latest-vercel-deployment>.vercel.app -- --request POST --header "Content-Type: application/json" --data-binary "@payload.json"`
3. Railway health:
   - `curl https://smartgrid-public-api-production.up.railway.app/health`
4. Railway settings GET (with API key):
   - `curl -H "x-api-key: <key>" https://smartgrid-public-api-production.up.railway.app/v1/settings/runtime`

## 8) Repository Hygiene Done
- Removed temporary file: `web/settings_payload.json`
- Added ignore rules for runtime-generated files:
  - `smartgrid_mas/config/runtime_overrides.json`
  - `smartgrid_mas/config/runtime_env.env`

## 9) Recommended Final Team Actions
- Pin and document final API key rotation plan.
- Add automated integration test for `/api/settings/runtime` proxy + Railway persistence.
- Add backup/retention policy for Railway persisted DB volume.
