import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export async function GET() {
  try {
    // Step 1: GET login page to see form fields + get Cloudflare cookies
    const r1 = await fetch('https://panicfull.com/user_login', {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      redirect: 'follow',
    })

    const html = await r1.text()
    const cookies: string[] = []
    r1.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') cookies.push(v) })

    // Extract all input names from HTML
    const inputMatches = html.match(/<input[^>]+>/gi) || []
    const formMatches = html.match(/<form[^>]+>/gi) || []

    return NextResponse.json({
      status: r1.status,
      finalUrl: r1.url,
      cookies,
      forms: formMatches,
      inputs: inputMatches,
      htmlSnippet: html.substring(0, 1000),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
