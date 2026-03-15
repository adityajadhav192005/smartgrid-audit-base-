'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Verifying your email...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let supabase
    try {
      supabase = getSupabaseClient()
    } catch {
      setIsError(true)
      setMessage('Supabase is not configured. Contact support.')
      return
    }

    // The Supabase client automatically processes the #access_token hash on
    // page load. We listen for the resulting auth state event and redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setMessage('Email confirmed! Taking you to the dashboard...')
        setTimeout(() => router.replace('/live'), 1200)
      }
    })

    // Also handle the case where the session is already established
    // (e.g. user clicked the link a second time)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setMessage('Already confirmed! Taking you to the dashboard...')
        setTimeout(() => router.replace('/live'), 800)
      }
    })

    // Detect Supabase error hash fragments (#error=...)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const errorDesc = params.get('error_description') || 'Confirmation failed.'
        setIsError(true)
        setMessage(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
      }
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
      <div className="text-center max-w-sm px-6">
        <div className={`text-5xl mb-5 ${isError ? 'animate-pulse' : 'animate-bounce'}`}>
          {isError ? '⚠️' : '⚡'}
        </div>
        <h1 className={`text-xl font-semibold mb-2 ${isError ? 'text-red-400' : 'text-cyan-400'}`}>
          {isError ? 'Confirmation Error' : 'Confirming Account'}
        </h1>
        <p className="text-slate-400 text-sm">{message}</p>
        {isError && (
          <button
            onClick={() => router.replace('/register')}
            className="mt-6 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded"
          >
            Back to Register
          </button>
        )}
      </div>
    </div>
  )
}
