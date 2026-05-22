import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Permitir archivos de hasta 2MB
export const maxDuration = 30

const PANIC_HOME = 'https://panicfull.com/'
const PANIC_POST  = 'https://panicfull.com/processa_panic.php'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// POST /api/panic
// Body: FormData con campo "file" (File) o "text" (string)
// Soporta hasta 3 archivos: file1, file2, file3 (o file como único)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    // Resolver contenidos de hasta 3 logs
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

    // ── 1. GET panicfull.com → obtener token tk + cookies ────────────────────
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

    // Extraer token tk del HTML
    const tkMatch = pageHtml.match(/name=["']tk["']\s+value=["']([^"']+)["']/)
                 ?? pageHtml.match(/value=["']([^"']+)["']\s+name=["']tk["']/)
    if (!tkMatch?.[1]) {
      return NextResponse.json({ error: 'No se pudo obtener el token de sesión de panicfull.com' }, { status: 502 })
    }
    const tk = tkMatch[1]

    // Capturar cookies de la respuesta GET
    const rawCookies: string[] = []
    getRes.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie') rawCookies.push(val.split(';')[0])
    })
    const cookieHeader = rawCookies.join('; ')

    // ── 2. POST a processa_panic.php ─────────────────────────────────────────
    const isMulti = log2 || log3

    const body = new URLSearchParams()
    body.append('tk', tk)
    if (isMulti) {
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
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
      body: body.toString(),
    })

    const resultHtml = await postRes.text()

    // Verificar que la respuesta tiene contenido útil
    if (!resultHtml || resultHtml.length < 50) {
      return NextResponse.json({ error: 'panicfull.com no devolvió un resultado válido. Intentá de nuevo.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, html: resultHtml })

  } catch (e) {
    console.error('[panic proxy]', e)
    return NextResponse.json({ error: `Error interno: ${String(e)}` }, { status: 500 })
  }
}
