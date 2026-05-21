import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const FILE = path.join(process.cwd(), 'data', 'sistema-wa-mensajes.json')

const DEFAULTS: Record<string, string> = {
  'Entrada':               'Hola {nombre} 👋 Tu {modelo} (orden #{nOrden}) ingresó al taller Microsmart. Te avisamos cuando esté listo.',
  'Técnico Saddi':         'Hola {nombre} 🔧 Tu {modelo} (orden #{nOrden}) está siendo revisado por nuestro técnico. Pronto te tenemos novedades.',
  'Laboratorio':           'Hola {nombre} 🔬 Tu {modelo} (orden #{nOrden}) está en laboratorio para diagnóstico avanzado.',
  'Salida de laboratorio': 'Hola {nombre} ✅ Tu {modelo} (orden #{nOrden}) salió del laboratorio y está siendo preparado para la entrega.',
  'Salida':                'Hola {nombre} 🎉 ¡Buenas noticias! Tu {modelo} (orden #{nOrden}) está LISTO para retirar. Te esperamos en el local. ¡Gracias por elegirnos!',
  'Entregado':             'Hola {nombre} 😊 Tu {modelo} fue entregado. ¡Gracias por confiar en Microsmart! Ante cualquier consulta, estamos a tu disposición.',
}

function read(): Record<string, string> {
  try {
    let raw = fs.readFileSync(FILE, 'utf-8')
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    return JSON.parse(raw)
  } catch { return {} }
}

export async function GET() {
  const saved = read()
  // Merge: defaults first, then saved overrides
  return NextResponse.json({ ...DEFAULTS, ...saved })
}

export async function POST(req: NextRequest) {
  const body: Record<string, string> = await req.json()
  fs.writeFileSync(FILE, JSON.stringify(body, null, 2), 'utf-8')
  return NextResponse.json({ ...DEFAULTS, ...body })
}
