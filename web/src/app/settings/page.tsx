'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/runs#settings-configuration')
  }, [router])

  return (
    <div className="space-y-3">
      <h1 className="section-header">Settings moved</h1>
      <p className="text-sm text-slate-400">Settings are now merged into Run Configuration.</p>
      <p className="text-xs text-slate-500">Redirecting to unified configuration page...</p>
    </div>
  )
}
