'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export type ViewMode = 'experiment' | 'scada'

export type DashboardNotification = {
  id: string
  title: string
  message: string
  ts: string
  read: boolean
  level?: 'info' | 'success' | 'warning' | 'error'
}

type DashboardContextValue = {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  scadaConnected: boolean
  setScadaConnected: (connected: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  refreshTick: number
  triggerRefresh: () => void
  notifications: DashboardNotification[]
  unreadCount: number
  addNotification: (n: Omit<DashboardNotification, 'id' | 'ts' | 'read'>) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

const STORAGE_SCADA_KEY = 'sg_scada_connected'

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [viewMode, setViewModeState] = useState<ViewMode>('experiment')
  const [scadaConnected, setScadaConnectedState] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setViewModeState('experiment')
    const savedScada = localStorage.getItem(STORAGE_SCADA_KEY)
    if (savedScada === 'true' || savedScada === 'false') {
      setScadaConnectedState(savedScada === 'true')
      return
    }
    setScadaConnectedState(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_SCADA_KEY, String(scadaConnected))
  }, [scadaConnected])

  useEffect(() => {
    let active = true

    const refreshScadaConnection = async () => {
      try {
        const response = await fetch('/api/proxy/grid/status', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        const connected = Boolean(payload?.rapid_scada?.connection?.connected)
        if (active) {
          setScadaConnectedState(connected)
        }
      } catch {
        if (active) {
          setScadaConnectedState(false)
        }
      }
    }

    void refreshScadaConnection()
    const intervalId = setInterval(() => {
      void refreshScadaConnection()
    }, 5000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [])

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
  }, [])

  const setScadaConnected = useCallback((connected: boolean) => {
    setScadaConnectedState(connected)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTick(v => v + 1)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sg:refresh'))
    }
    router.refresh()
  }, [router])

  const addNotification = useCallback((n: Omit<DashboardNotification, 'id' | 'ts' | 'read'>) => {
    setNotifications(prev => [{
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      read: false,
      ...n,
    }, ...prev].slice(0, 60))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const value = useMemo<DashboardContextValue>(() => ({
    viewMode,
    setViewMode,
    scadaConnected,
    setScadaConnected,
    searchQuery,
    setSearchQuery,
    refreshTick,
    triggerRefresh,
    notifications,
    unreadCount,
    addNotification,
    markAllNotificationsRead,
    clearNotifications,
  }), [
    viewMode,
    setViewMode,
    scadaConnected,
    setScadaConnected,
    searchQuery,
    refreshTick,
    triggerRefresh,
    notifications,
    unreadCount,
    addNotification,
    markAllNotificationsRead,
    clearNotifications,
  ])

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
