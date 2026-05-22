import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const API_URL = process.env.TEAM_SAUL_API_URL || 'https://team-saul.com/api/v2'
const API_KEY = process.env.TEAM_SAUL_API_KEY || ''

export async function GET(_req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'API key de team-saul.com no configurada. Agregá TEAM_SAUL_API_KEY en .env.local' },
      { status: 503 }
    )
  }

  try {
    const url = `${API_URL}?action=services&key=${API_KEY}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Microsmart/1.0' },
      next: { revalidate: 300 }, // cachear 5 minutos
    })

    const text = await res.text()

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: `Respuesta inválida de team-saul.com: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, services: data })
  } catch (e) {
    return NextResponse.json({ error: `Error de conexión: ${String(e)}` }, { status: 500 })
  }
}
