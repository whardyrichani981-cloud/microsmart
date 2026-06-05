import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cron job diario para generar backup automático.
 * Se llama desde Vercel Cron o cualquier scheduler externo.
 * Protegido con CRON_SECRET si está configurado.
 */
export async function GET(req: NextRequest) {
  // Verificar cron secret
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const started = new Date().toISOString()
  console.log(`[cron] backup started at ${started}`)

  try {
    // Llamar al endpoint POST de backup internamente
    // NEXT_PUBLIC_BASE_URL tiene prioridad; en Vercel se usa VERCEL_URL automáticamente
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || vercelUrl || `http://localhost:${process.env.PORT || 3000}`
    const res = await fetch(`${baseUrl}/api/sistema/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[cron] backup failed: ${text}`)
      return NextResponse.json({ ok: false, error: text, timestamp: started })
    }

    const data = await res.json()
    console.log(`[cron] backup saved: ${data.file} (${(data.size / 1024).toFixed(1)} KB)`)

    return NextResponse.json({
      ok: true,
      timestamp: started,
      ...data,
    })
  } catch (e) {
    console.error(`[cron] backup error: ${e}`)
    return NextResponse.json({ ok: false, error: String(e), timestamp: started })
  }
}
