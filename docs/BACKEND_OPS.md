**Backend Ops (1-Minute Guide)**

Use this for day-to-day operation of the public SmartGrid backend and dashboard wiring.

**Production Endpoints**

- Dashboard: https://web-three-kappa-37.vercel.app
- Backend (Railway): https://smartgrid-public-api-production.up.railway.app
- Railway project: https://railway.com/project/b80600a5-73d3-4572-b718-776079b283f2

**Services and Paths**

- Railway service name: `smartgrid-public-api`
- Backend source folder: `backend_railway/`
- Vercel frontend folder: `web/`

**Required Environment Variables**

Backend (Railway):
- `SMARTGRID_API_KEY=smartgrid-dev-key`

Frontend (Vercel):
- `NEXT_PUBLIC_SUPABASE_URL=https://mkiddsqbgmnypydrhowd.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-key>`
- `SMARTGRID_API_URL=https://smartgrid-public-api-production.up.railway.app`
- `SMARTGRID_API_KEY=smartgrid-dev-key`

**Quick Health Checks**

Backend direct:

```powershell
$headers = @{ 'x-api-key' = 'smartgrid-dev-key' }
Invoke-WebRequest "https://smartgrid-public-api-production.up.railway.app/health" -UseBasicParsing
Invoke-WebRequest "https://smartgrid-public-api-production.up.railway.app/v1/blockchain/status" -Headers $headers -UseBasicParsing
```

Dashboard proxy (what users actually hit):

```powershell
Invoke-WebRequest "https://web-three-kappa-37.vercel.app/api/proxy/health" -UseBasicParsing
Invoke-WebRequest "https://web-three-kappa-37.vercel.app/api/proxy/blockchain/status" -UseBasicParsing
```

Expected: HTTP `200` and JSON responses.

**Backend Redeploy (Railway)**

```powershell
cd "D:/Mtech Main project/smartgrid-audit-base-/backend_railway"
cmd /c npx @railway/cli login
cmd /c npx @railway/cli link
cmd /c npx @railway/cli service smartgrid-public-api
cmd /c npx @railway/cli up
```

Check status and logs:

```powershell
cmd /c npx @railway/cli status --json
cmd /c npx @railway/cli logs -s smartgrid-public-api -n 100
```

**Frontend Redeploy (Vercel)**

```powershell
cd "D:/Mtech Main project/smartgrid-audit-base-/web"
cmd /c npx vercel deploy --prod --yes \
  --build-env NEXT_PUBLIC_SUPABASE_URL=https://mkiddsqbgmnypydrhowd.supabase.co \
  --build-env NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-key> \
  --build-env SMARTGRID_API_URL=https://smartgrid-public-api-production.up.railway.app \
  --build-env SMARTGRID_API_KEY=smartgrid-dev-key \
  --env NEXT_PUBLIC_SUPABASE_URL=https://mkiddsqbgmnypydrhowd.supabase.co \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-key> \
  --env SMARTGRID_API_URL=https://smartgrid-public-api-production.up.railway.app \
  --env SMARTGRID_API_KEY=smartgrid-dev-key
```

**Common Recovery Steps**

1. If `/api/proxy/health` returns `503`: check Railway logs first.
2. If Railway is healthy but proxy fails: redeploy Vercel with correct `SMARTGRID_API_URL`.
3. If blockchain route fails with `401`: ensure backend key and frontend `SMARTGRID_API_KEY` match.
4. Avoid temporary tunnels for production use.
