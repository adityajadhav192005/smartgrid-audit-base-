import { createClient } from '@supabase/supabase-js'

let cachedClient: ReturnType<typeof createClient> | null = null

const FALLBACK_SUPABASE_URL = 'https://mkiddsqbgmnypydrhowd.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_dyy8H7lHyYpbtX_DEfiO9Q_IREI0Lwo'

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  cachedClient = createClient(supabaseUrl, supabaseAnonKey)
  return cachedClient
}
