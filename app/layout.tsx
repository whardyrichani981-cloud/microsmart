import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Microsmart – Comparador de Precios',
  description: 'Compará precios de múltiples proveedores en un solo lugar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
