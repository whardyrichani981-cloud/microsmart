import { NextRequest, NextResponse } from 'next/server'
import {
  getComprasClientes, addCompraCliente, updateCompraCliente, deleteCompraCliente,
  addEquipo, getUltimoDolar,
} from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getComprasClientes())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      // campos del equipo que van a EquipoUsado
      modelo, color, capacidad, imei, bateria, funciones,
      detallesFisicos, fotos,
      // flag de estado
      enviarAReparacion,
      // campos de compra
      ...compraFields
    } = body

    const tieneReparaciones = (compraFields.reparaciones ?? []).length > 0

    // 1. Crear el equipo en stock o reparación
    const equipo = addEquipo({
      fecha: compraFields.fecha,
      modelo,
      color,
      capacidad,
      imei,
      bateria,
      funciones,
      detallesFisicos,
      fotos,
      estado: (enviarAReparacion && tieneReparaciones) ? 'En reparación' : 'En stock',
      precioCompra: compraFields.precioCompra,
      monedaCompra: compraFields.monedaCompra,
      precioVenta: compraFields.precioVentaEstimado,
      monedaVenta: compraFields.monedaVenta,
      proveedorId: '',    // no es proveedor registrado
    })

    // 2. Crear el registro de compra referenciando el equipo
    const compra = addCompraCliente({
      ...compraFields,
      modelo, color, capacidad, imei, bateria, funciones, detallesFisicos, fotos,
      equipoId: equipo.id,
    })

    return NextResponse.json({ compra, equipo })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const item = updateCompraCliente(id, data)
    if (!item) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    deleteCompraCliente(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
