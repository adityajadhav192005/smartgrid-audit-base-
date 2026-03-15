'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabaseClient'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function normalizeAuthError(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('unsupported provider') || lower.includes('provider is not enabled')) {
      return 'Google login is not enabled in Supabase yet. Enable Google provider in Supabase Auth > Providers and add this redirect URL: ' + `${window.location.origin}/live`
    }
    return message
  }

  useEffect(() => {
    let active = true
    let supabase
    try {
      supabase = getSupabaseClient()
    } catch {
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return
      }
      if (data.session) {
        const nextPath = searchParams.get('next') || '/live'
        router.replace(nextPath)
      }
    })

    return () => {
      active = false
    }
  }, [router, searchParams])

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    let supabase
    try {
      supabase = getSupabaseClient()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Supabase client not configured')
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError(normalizeAuthError(authError.message))
      return
    }
    const nextPath = searchParams.get('next') || '/live'
    router.push(nextPath)
  }

  async function onGoogleSignIn() {
    setError(null)
    let supabase
    try {
      supabase = getSupabaseClient()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Supabase client not configured')
      return
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/live` },
    })
    if (oauthError) {
      setError(normalizeAuthError(oauthError.message))
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md glass-card p-6 cyber-border">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-cyber-blue" />
          <h1 className="text-xl font-semibold text-slate-100">Sign in to SmartGrid AI</h1>
        </div>

        <p className="text-xs text-slate-400 mb-6">Access the control center with your credentials.</p>

        <form className="space-y-4" onSubmit={onSignIn}>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <div className="flex items-center gap-2 bg-grid-900 border border-slate-700/50 rounded px-3 py-2">
              <Mail className="w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@utility.com"
                className="bg-transparent outline-none text-sm text-slate-200 w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <div className="flex items-center gap-2 bg-grid-900 border border-slate-700/50 rounded px-3 py-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent outline-none text-sm text-slate-200 w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-cyber-blue/20 border border-cyber-blue/40 text-cyber-blue py-2 text-sm font-semibold hover:bg-cyber-blue/30 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="my-4 flex items-center gap-2">
          <div className="h-px bg-slate-700/60 flex-1" />
          <span className="text-[11px] text-slate-500">or</span>
          <div className="h-px bg-slate-700/60 flex-1" />
        </div>

        <button
          type="button"
          onClick={onGoogleSignIn}
          className="w-full rounded bg-white/5 border border-slate-600/50 text-slate-200 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Continue with Google
        </button>

        <p className="mt-5 text-xs text-slate-400">
          New here?{' '}
          <Link href="/register" className="text-cyber-blue hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

function LoginPageFallback() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md glass-card p-6 cyber-border">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-cyber-blue" />
          <h1 className="text-xl font-semibold text-slate-100">Sign in to SmartGrid AI</h1>
        </div>

        <p className="text-xs text-slate-400">Loading sign-in form...</p>
      </div>
    </div>
  )
}
