import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardProvider } from '@/lib/dashboardContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Smart Grid AI Control Center',
  description: 'Real-time cyber-physical monitoring, adaptive audit scheduling, anomaly detection, and explainable AI for multi-agent smart grid systems.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-grid-900 text-slate-200 min-h-screen overflow-hidden`}>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  )
}
