import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const API_URL = process.env.TEAM_SAUL_API_URL || 'https://team-saul.com/api/v2'
const API_KEY = process.env.TEAM_SAUL_API_KEY || ''

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key no configurada.' }, { status: 503 })
  }

  const orderId = req.nextUrl.searchParams.get('order')
  if (!orderId) {
    return NextResponse.json({ error: 'Parámetro order requerido.' }, { status: 400 })
  }

  try {
    const url = `${API_URL}?action=status&key=${API_KEY}&order=${orderId}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Microsmart/1.0' },
    })

    const text = await res.text()

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: `Respuesta inválida: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, result: data })
  } catch (e) {
    return NextResponse.json({ error: `Error de conexión: ${String(e)}` }, { status: 500 })
  }
}
