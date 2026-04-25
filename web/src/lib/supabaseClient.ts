import { createClient, processLock } from '@supabase/supabase-js'

let cachedClient: ReturnType<typeof createClient> | null = null

const FALLBACK_SUPABASE_URL = 'https://mkiddsqbgmnypydrhowd.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_dyy8H7lHyYpbtX_DEfiO9Q_IREI0Lwo'

declare global {
  // Persist the client across HMR module reloads in dev so we don't
  // create competing GoTrue instances that fight over navigator.locks.
  // eslint-disable-next-line no-var
  var __smartgridSupabase: ReturnType<typeof createClient> | undefined
}

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient
  }
  if (typeof globalThis !== 'undefined' && globalThis.__smartgridSupabase) {
    cachedClient = globalThis.__smartgridSupabase
    return cachedClient
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Swap the default Web Locks-based lock for an in-process mutex.
      // navigator.locks throws AbortError ("Lock broken ... 'steal' option")
      // whenever Next.js fast-refresh remounts or a second tab opens, since
      // GoTrue forces a `steal` to recover. processLock is single-tab safe
      // and avoids the unhandled rejection in the dashboard.
      lock: processLock,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  if (typeof globalThis !== 'undefined') {
    globalThis.__smartgridSupabase = cachedClient
  }
  return cachedClient
}
