import { NextRequest, NextResponse } from 'next/server'
import {
  getSesionesCaja, getSesionCajaByFecha,
  addSesionCaja, updateSesionCaja, getLastEfectivoEnCaja,
} from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')

  if (fecha) {
    const sesion = getSesionCajaByFecha(fecha)
    // efectivoInicial: si hay sesión para hoy, usar su efectivoInicial; si no, usar el del último cierre
    const efectivoInicial = sesion?.efectivoInicial ?? getLastEfectivoEnCaja()
    return NextResponse.json({ sesion: sesion ?? null, efectivoInicial })
  }

  return NextResponse.json({ sesiones: getSesionesCaja() })
}

// POST — abrir caja (primera vez en el día)
export async function POST(req: NextRequest) {
  const data = await req.json()
  const existing = getSesionCajaByFecha(data.fecha)
  if (existing) {
    return NextResponse.json({ error: 'Ya existe una sesión para esta fecha', sesion: existing }, { status: 409 })
  }
  const item = addSesionCaja({
    ...data,
    estado: 'abierta',
    intervencionesAdmin: [],
  })
  return NextResponse.json(item, { status: 201 })
}

// PUT — cerrar caja, reabrir (admin) o registrar intervención
export async function PUT(req: NextRequest) {
  const { id, adminReabrir, adminOperador, ...data } = await req.json()
  const sesion = getSesionesCaja().find(s => s.id === id)
  if (!sesion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reapertura admin: vuelve a estado 'abierta' y registra la intervención
  if (adminReabrir) {
    const intervenciones = sesion.intervencionesAdmin ?? []
    const item = updateSesionCaja(id, {
      estado: 'abierta',
      // Limpiar datos del cierre para que quede limpia
      operadorCierre: undefined,
      horaCierre: undefined,
      efectivoContado: undefined,
      diferencia: undefined,
      efectivoRetirado: undefined,
      intervencionesAdmin: [
        ...intervenciones,
        {
          fechaHora: new Date().toISOString(),
          operador: adminOperador ?? 'Admin',
          tipo: 'reabrir' as const,
          detalle: 'Caja reabierta por administrador',
        },
      ],
    })
    return NextResponse.json(item)
  }

  const item = updateSesionCaja(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
