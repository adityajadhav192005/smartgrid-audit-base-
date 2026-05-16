import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardProvider } from '@/lib/dashboardContext'

export const metadata: Metadata = {
  title: 'Smart Grid AI Control Center',
  description: 'Real-time cyber-physical monitoring, adaptive audit scheduling, anomaly detection, and explainable AI for multi-agent smart grid systems.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-hidden" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  )
}
