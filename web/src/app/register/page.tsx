'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, UserPlus, User } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabaseClient'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function normalizeAuthError(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('unsupported provider') || lower.includes('provider is not enabled')) {
      return 'Google login is not enabled in Supabase yet. Enable Google provider in Supabase Auth > Providers and add this redirect URL: ' + `${window.location.origin}/live`
    }
    return message
  }

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    let supabase
    try {
      supabase = getSupabaseClient()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Supabase client not configured')
      return
    }
    setLoading(true)
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (signupError) {
      setError(normalizeAuthError(signupError.message))
      return
    }
    setSuccess('Registration successful. Check your email for confirmation if required.')
    router.push('/login')
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
          <UserPlus className="w-5 h-5 text-cyber-teal" />
          <h1 className="text-xl font-semibold text-slate-100">Create account</h1>
        </div>

        <p className="text-xs text-slate-400 mb-6">Register to manage audit runs and security events.</p>

        <form className="space-y-4" onSubmit={onRegister}>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
            <div className="flex items-center gap-2 bg-grid-900 border border-slate-700/50 rounded px-3 py-2">
              <User className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grid Operator"
                className="bg-transparent outline-none text-sm text-slate-200 w-full"
              />
            </div>
          </div>

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
                placeholder="Create secure password"
                className="bg-transparent outline-none text-sm text-slate-200 w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-cyber-teal/20 border border-cyber-teal/40 text-cyber-teal py-2 text-sm font-semibold hover:bg-cyber-teal/30 transition-colors"
          >
            {loading ? 'Registering…' : 'Register'}
          </button>
        </form>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {success && <p className="mt-3 text-xs text-emerald-400">{success}</p>}

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
          Already have an account?{' '}
          <Link href="/login" className="text-cyber-blue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
