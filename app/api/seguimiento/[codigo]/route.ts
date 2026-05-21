import { NextRequest, NextResponse } from 'next/server'
import { getOrdenByCodigo, getEstadosOrden } from '@/lib/sistema-db'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const orden = await getOrdenByCodigo(codigo)
  if (!orden) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Sanitize — only return what the customer needs
  const nameParts = (orden.nombreCliente ?? '').split(' ')
  const nombrePublico = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : nameParts[0] ?? '—'

  const estadosConfig = await getEstadosOrden()
  // Include 'Entregado' at the end
  const allEstados = estadosConfig.includes('Entregado') ? estadosConfig : [...estadosConfig, 'Entregado']

  const notasPublicas = (orden.notasLista ?? [])
    .filter(n => n.visibilidad === 'publica')
    .map(n => ({ texto: n.texto, fecha: n.fecha, area: n.area }))

  return NextResponse.json({
    nOrden: orden.nOrden,
    codigoSeguimiento: orden.codigoSeguimiento,
    fecha: orden.fecha,
    estado: orden.estado,
    prioridad: orden.prioridad,
    modeloEquipo: orden.modeloEquipo,
    categoriaDispositivo: orden.categoriaDispositivo ?? 'iPhone',
    nombrePublico,
    fechaEntrega: orden.fechaEntrega,
    tipo: orden.tipo,
    estadosWorkflow: allEstados,
    notasPublicas,
  })
}
