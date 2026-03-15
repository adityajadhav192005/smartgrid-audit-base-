# Supabase Auth + Blockchain Mirror Setup

## 1) Frontend Auth (Next.js)

Create `web/.env.local` from `web/.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

Then restart the web dev server.

Auth routes already wired:
- `/login` -> email/password + Google OAuth
- `/register` -> email/password signup + Google OAuth

## 2) Enable Google provider in Supabase

In Supabase Dashboard:
1. Authentication -> Providers -> Google -> Enable
2. Add Google client ID/secret
3. Add redirect URL(s), e.g.:
   - `http://localhost:3000`
   - `http://localhost:3001`

## 3) Backend blockchain event mirror to Supabase Postgres

Create table in Supabase SQL editor:

```sql
create table if not exists public.blockchain_events (
  id bigserial primary key,
  local_id bigint,
  created_at timestamptz not null,
  event_type text not null,
  agent_id text not null,
  severity text not null,
  payload_json text not null,
  chain_hash text not null,
  prev_hash text not null,
  tx_id text not null,
  anchored boolean not null default true,
  source text not null default 'smartgrid_mas'
);

create index if not exists idx_blockchain_events_created_at on public.blockchain_events(created_at desc);
create index if not exists idx_blockchain_events_agent_id on public.blockchain_events(agent_id);
create unique index if not exists uq_blockchain_events_chain_hash on public.blockchain_events(chain_hash);
```

Set backend environment variables before running API server:

```env
SMARTGRID_SUPABASE_MIRROR_ENABLED=1
SMARTGRID_SUPABASE_URL=https://<project-ref>.supabase.co
SMARTGRID_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SMARTGRID_SUPABASE_TABLE=blockchain_events
```

## 4) Security requirements

- Never expose `SMARTGRID_SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Keep service role key only in backend environment.
- Rotate any leaked tokens immediately.

## 5) Verify integration

- Call `/v1/db/health` (API key required)
- Check fields:
  - `supabase_mirror_enabled`
  - `supabase_mirror_ready`
  - `last_mirror_error`

If `supabase_mirror_ready=true` and `last_mirror_error=null`, mirror is active.
