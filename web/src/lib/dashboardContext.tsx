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

const STORAGE_MODE_KEY = 'sg_dashboard_view_mode'
const STORAGE_SCADA_KEY = 'sg_scada_connected'

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [viewMode, setViewModeState] = useState<ViewMode>('experiment')
  const [scadaConnected, setScadaConnectedState] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedMode = localStorage.getItem(STORAGE_MODE_KEY)
    const savedScada = localStorage.getItem(STORAGE_SCADA_KEY)
    if (savedMode === 'experiment' || savedMode === 'scada') {
      setViewModeState(savedMode)
    }
    if (savedScada === 'true') {
      setScadaConnectedState(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_SCADA_KEY, String(scadaConnected))
  }, [scadaConnected])

  const setViewMode = useCallback((mode: ViewMode) => {
    if (mode === 'scada' && !scadaConnected) {
      setNotifications(prev => [{
        id: crypto.randomUUID(),
        title: 'SCADA mode unavailable',
        message: 'Connect SCADA Live first, then switch to SCADA view.',
        ts: new Date().toISOString(),
        read: false,
        level: 'warning' as const,
      }, ...prev].slice(0, 40))
      return
    }
    setViewModeState(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_MODE_KEY, mode)
    }
  }, [scadaConnected])

  const setScadaConnected = useCallback((connected: boolean) => {
    setScadaConnectedState(connected)
    if (!connected && viewMode === 'scada') {
      setViewModeState('experiment')
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_MODE_KEY, 'experiment')
      }
      setNotifications(prev => [{
        id: crypto.randomUUID(),
        title: 'Switched to Experiment view',
        message: 'SCADA disconnected, so SCADA mode was disabled automatically.',
        ts: new Date().toISOString(),
        read: false,
        level: 'warning' as const,
      }, ...prev].slice(0, 40))
    }
  }, [viewMode])

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
