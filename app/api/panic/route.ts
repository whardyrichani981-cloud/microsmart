import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PANIC_HOME = 'https://panicfull.com/'
const PANIC_POST = 'https://panicfull.com/processa_panic.php'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const DAILY_LIMIT = 3

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD en UTC
}

async function getRateInfo(ip: string): Promise<{ used: number; remaining: number; limit: number }> {
  if (!redis) return { used: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT }
  const key = `panic-rate:${ip}:${todayKey()}`
  const used = (await redis.get<number>(key)) ?? 0
  return { used, remaining: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT }
}

async function incrementRate(ip: string): Promise<void> {
  if (!redis) return
  const key = `panic-rate:${ip}:${todayKey()}`
  const newVal = await redis.incr(key)
  if (newVal === 1) await redis.expire(key, 86400) // expira a las 24h
}

// GET /api/panic — consultar usos restantes del día
export async function GET(req: NextRequest) {
  const ip = getClientIP(req)
  const info = await getRateInfo(ip)
  return NextResponse.json(info)
}

// POST /api/panic — analizar archivo(s)
export async function POST(req: NextRequest) {
  const ip = getClientIP(req)

  // ── Rate limit check ──────────────────────────────────────────────────────
  const { used, remaining } = await getRateInfo(ip)
  if (used >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `Límite diario alcanzado. Podés realizar hasta ${DAILY_LIMIT} análisis por día. Volvé mañana.`,
        limitReached: true,
        remaining: 0,
        limit: DAILY_LIMIT,
      },
      { status: 429 }
    )
  }

  try {
    const form = await req.formData()

    async function resolveLog(key: string): Promise<string> {
      const file = form.get(key) as File | null
      const text = form.get(key + '_text') as string | null
      if (file && file.size > 0) return await file.text()
      if (text?.trim()) return text.trim()
      return ''
    }

    const log1 = await resolveLog('file1') || await resolveLog('file')
    const log2 = await resolveLog('file2')
    const log3 = await resolveLog('file3')

    if (!log1) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo o texto.' }, { status: 400 })
    }

    // ── GET panicfull.com → token tk + cookies ────────────────────────────
    const getRes = await fetch(PANIC_HOME, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    })

    if (!getRes.ok) {
      return NextResponse.json(
        { error: `Error al conectar con panicfull.com (HTTP ${getRes.status})` },
        { status: 502 }
      )
    }

    const pageHtml = await getRes.text()

    const tkMatch =
      pageHtml.match(/name=["']tk["']\s+value=["']([^"']+)["']/) ??
      pageHtml.match(/value=["']([^"']+)["']\s+name=["']tk["']/)
    if (!tkMatch?.[1]) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de sesión de panicfull.com' },
        { status: 502 }
      )
    }
    const tk = tkMatch[1]

    const rawCookies: string[] = []
    getRes.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie') rawCookies.push(val.split(';')[0])
    })
    const cookieHeader = rawCookies.join('; ')

    // ── POST a processa_panic.php ─────────────────────────────────────────
    const body = new URLSearchParams()
    body.append('tk', tk)
    if (log2 || log3) {
      body.append('t1_send', log1)
      body.append('t2_send', log2)
      body.append('t3_send', log3)
    } else {
      body.append('t4_send', log1)
    }

    const postRes = await fetch(PANIC_POST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Referer': PANIC_HOME,
        'Origin': 'https://panicfull.com',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: body.toString(),
    })

    const resultHtml = await postRes.text()

    if (!resultHtml || resultHtml.length < 50) {
      return NextResponse.json(
        { error: 'panicfull.com no devolvió un resultado válido. Intentá de nuevo.' },
        { status: 502 }
      )
    }

    // ── Éxito: descontar uso ──────────────────────────────────────────────
    await incrementRate(ip)
    const newRemaining = Math.max(0, remaining - 1)

    return NextResponse.json({ ok: true, html: resultHtml, remaining: newRemaining, limit: DAILY_LIMIT })

  } catch (e) {
    console.error('[panic proxy]', e)
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
