import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Microsmart – Comparador de Precios',
  description: 'Compará precios de múltiples proveedores en un solo lugar',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <style>{`
          :root {
            --bg: #080808;
            --surface: #0f0f0f;
            --surface2: #171717;
            --border: #212121;
            --accent: #F5C400;
            --accent-dim: rgba(245,196,0,0.08);
            --accent-glow: rgba(245,196,0,0.25);
          }
          *, *::before, *::after { box-sizing: border-box; }
          body {
            background: var(--bg);
            color: #E5E5E3;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            margin: 0;
          }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #2E2E2E; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #3A3A3A; }
          .table-scroll { overflow: auto; max-height: calc(100vh - 280px); }
          .table-scroll thead th { position: sticky; top: 0; z-index: 10; }
          @keyframes flash-green {
            0% { background-color: rgba(34, 197, 94, 0.3); }
            100% { background-color: transparent; }
          }
          .price-best { animation: flash-green 1s ease-out; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
