'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { getSupabaseClient } from '@/lib/supabaseClient'

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const authRoute = useMemo(() => {
    return pathname === '/login' || pathname === '/register'
  }, [pathname])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null

    const run = async () => {
      if (authRoute) {
        setChecked(true)
        return
      }

      let supabase
      try {
        supabase = getSupabaseClient()
      } catch {
        if (active) {
          setChecked(true)
          setAuthenticated(false)
          router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`)
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      const hasSession = Boolean(data.session)

      if (!active) {
        return
      }

      setAuthenticated(hasSession)
      setChecked(true)

      if (!hasSession) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`)
      }

      const authListener = supabase.auth.onAuthStateChange((_event, session) => {
        const ok = Boolean(session)
        setAuthenticated(ok)
        if (!ok && !authRoute) {
          router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`)
        }
      })

      unsubscribe = () => {
        authListener.data.subscription.unsubscribe()
      }
    }

    run()

    return () => {
      active = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [authRoute, pathname, router])

  if (authRoute) {
    return <main className="min-h-screen bg-grid-900 bg-grid-pattern">{children}</main>
  }

  if (!checked || !authenticated) {
    return (
      <main className="min-h-screen bg-grid-900 bg-grid-pattern flex items-center justify-center text-slate-400 text-sm">
        Checking authentication...
      </main>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-grid-900 bg-grid-pattern">
          <div className="max-w-[1800px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
