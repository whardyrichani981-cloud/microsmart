import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import ChatWidget from '@/components/ChatWidget'
import CapProvider from '@/components/CapProvider'
import PWAInstaller from '@/components/PWAInstaller'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Microsmart – Sistema de gestión',
  description: 'Sistema de gestión para Microsmart Especialistas Apple',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Microsmart',
  },
  icons: {
    apple: '/icons/icon-192.png',
    icon: '/icons/icon-512.png',
  },
  other: {
    'msapplication-TileColor': '#0066CC',
  },
}

export const viewport: Viewport = {
  themeColor: '#0066CC',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>
        {children}
        <ChatWidget />
        <CapProvider />
        <PWAInstaller />
      </body>
    </html>
  )
}
