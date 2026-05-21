import { NextRequest, NextResponse } from 'next/server'
import { getVentasCaja, addVentaCaja, updateVentaCaja, deleteVentaCaja, getNextVentaCajaNum, getSesionCajaByFecha, updateSesionCaja } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export async function GET() {
  return NextResponse.json({ items: await getVentasCaja(), nextVenta: await getNextVentaCajaNum() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { adminOverride, adminOperador, ...ventaData } = body

  const fecha = ventaData.fecha ?? todayISO()
  const sesion = await getSesionCajaByFecha(fecha)

  // Si el día está cerrado y no viene con override de admin → rechazar
  if (sesion?.estado === 'cerrada' && !adminOverride) {
    return NextResponse.json({ error: 'caja_cerrada', mensaje: 'La caja está cerrada para este día.' }, { status: 403 })
  }

  const nVenta = await getNextVentaCajaNum()
  const venta = await addVentaCaja({ ...ventaData, nVenta })

  // Registrar intervención admin si corresponde
  if (sesion?.estado === 'cerrada' && adminOverride && adminOperador) {
    const intervenciones = sesion.intervencionesAdmin ?? []
    await updateSesionCaja(sesion.id, {
      intervencionesAdmin: [
        ...intervenciones,
        {
          fechaHora: new Date().toISOString(),
          operador: adminOperador,
          tipo: 'add_venta',
          detalle: `Venta #${nVenta} agregada en día cerrado — ${ventaData.total ? `$${ventaData.total}` : ''}`,
        },
      ],
    })
  }

  return NextResponse.json(venta, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json()
  const item = await updateVentaCaja(id, data)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const { id, adminOverride, adminOperador } = await req.json()

  const ventas = await getVentasCaja()
  const venta = ventas.find(v => v.id === id)
  if (!venta) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sesion = await getSesionCajaByFecha(venta.fecha)

  // Si el día está cerrado y no viene con override de admin → rechazar
  if (sesion?.estado === 'cerrada' && !adminOverride) {
    return NextResponse.json({ error: 'caja_cerrada', mensaje: 'La caja está cerrada. Solo un administrador puede eliminar ventas de un día cerrado.' }, { status: 403 })
  }

  await deleteVentaCaja(id)

  // Registrar intervención admin si corresponde
  if (sesion?.estado === 'cerrada' && adminOverride && adminOperador) {
    const intervenciones = sesion.intervencionesAdmin ?? []
    await updateSesionCaja(sesion.id, {
      intervencionesAdmin: [
        ...intervenciones,
        {
          fechaHora: new Date().toISOString(),
          operador: adminOperador,
          tipo: 'del_venta',
          detalle: `Venta #${venta.nVenta} eliminada de día cerrado — ${venta.total ? `$${venta.total}` : ''}`,
        },
      ],
    })
  }

  return NextResponse.json({ ok: true })
}
