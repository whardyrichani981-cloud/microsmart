import { NextRequest, NextResponse } from 'next/server'
import { getTelegramConfig, searchPriceList } from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

// GET /api/debug/chat-search?q=pantalla+iphone+14
// Verifica qué devuelve la búsqueda de precios para el chatbot
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? 'pantalla iphone 14'
  const config = await getTelegramConfig()

  const [gremioResults, clientesResults] = await Promise.all([
    config.gremioListaId   ? searchPriceList(config.gremioListaId,   q) : Promise.resolve([]),
    config.clientesListaId ? searchPriceList(config.clientesListaId, q) : Promise.resolve([]),
  ])

  return NextResponse.json({
    query: q,
    config: {
      gremioListaId:   config.gremioListaId   || '(no configurado)',
      clientesListaId: config.clientesListaId || '(no configurado)',
      aiEnabled:       config.aiEnabled,
      aiProvider:      config.aiProvider,
    },
    gremio: {
      count: gremioResults.length,
      items: gremioResults,
    },
    clientes: {
      count: clientesResults.length,
      items: clientesResults,
    },
    combined: [...gremioResults, ...clientesResults].slice(0, 15),
  })
}
