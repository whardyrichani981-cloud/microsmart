import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

const REDIS_KEY = 'panicfull-session-cookies'

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

// GET — obtener cookies guardadas
export async function GET() {
  if (!redis) return NextResponse.json({ cookies: process.env.PANICFULL_COOKIES || '' })
  const cookies = await redis.get<string>(REDIS_KEY) ?? process.env.PANICFULL_COOKIES ?? ''
  return NextResponse.json({ cookies })
}

// PUT — guardar nuevas cookies
export async function PUT(req: NextRequest) {
  const { cookies } = await req.json() as { cookies: string }
  if (!cookies?.trim()) {
    return NextResponse.json({ error: 'Cookies vacías' }, { status: 400 })
  }
  if (redis) {
    await redis.set(REDIS_KEY, cookies.trim())
  }
  return NextResponse.json({ ok: true })
}
