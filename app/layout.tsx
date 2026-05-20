import type { Metadata } from 'next'
import './globals.css'
import ChatWidget from '@/components/ChatWidget'

export const metadata: Metadata = {
  title: 'Microsmart – Comparador de Precios',
  description: 'Compará precios de múltiples proveedores en un solo lugar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  )
}
