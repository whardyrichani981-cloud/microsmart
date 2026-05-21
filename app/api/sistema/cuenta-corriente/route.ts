import { NextRequest, NextResponse } from 'next/server'
import {
  getCuentaCorriente, addCCItem, updateCCItem, deleteCCItem,
  getCCBalancePorCliente, addVentaCaja, getNextVentaCajaNum, calcVentaCSF, calcVentaGremio, getUltimoDolar,
  addVentaCSF, addVentaGremio, getNextOrdenCSF, getNextOrdenGremio, addComision, getReglasComision, getReglasComisionGremio,
} from '@/lib/sistema-db'
import type { CuentaCorrienteItem } from '@/lib/sistema-types'
export const dynamic = 'force-dynamic'

function today() {
  return new Date().toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('clienteId')
  const clienteNombre = req.nextUrl.searchParams.get('clienteNombre')
  const tipo = req.nextUrl.searchParams.get('tipo')   // 'cargo' | 'pago'
  const balances = req.nextUrl.searchParams.get('balances') === '1'

  if (balances) {
    return NextResponse.json({ balances: await getCCBalancePorCliente() })
  }

  let items = (await getCuentaCorriente())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (clienteId) items = items.filter(i => i.clienteId === clienteId)
  if (clienteNombre) items = items.filter(i =>
    i.clienteNombre.toLowerCase().includes(clienteNombre.toLowerCase())
  )
  if (tipo) items = items.filter(i => i.tipo === tipo)

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const item = await addCCItem(body)
  return NextResponse.json(item, { status: 201 })
}

// PUT: registrar un pago parcial o total sobre un cargo
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, montoPago, metodoPago, ...rest } = body

  if (montoPago !== undefined && id) {
    // ── Registrar pago sobre un cargo ──────────────────────────────────────
    const items = await getCuentaCorriente()
    const cargo = items.find(i => i.id === id && i.tipo === 'cargo')
    if (!cargo) return NextResponse.json({ error: 'Cargo no encontrado' }, { status: 404 })

    const pagoReal = Math.min(montoPago, cargo.saldoPendiente)
    const nuevoMontoPagado = cargo.montoPagado + pagoReal
    const nuevoSaldo = cargo.monto - nuevoMontoPagado
    const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'parcial'

    // 1. Crear item de pago (historial)
    const pagoItem = await addCCItem({
      fecha: today(),
      clienteId: cargo.clienteId,
      clienteTipo: cargo.clienteTipo,
      clienteNombre: cargo.clienteNombre,
      clienteTelefono: cargo.clienteTelefono,
      tipo: 'pago',
      monto: pagoReal,
      montoPagado: 0,
      saldoPendiente: 0,
      estado: 'pagado',
      cargoRefId: id,
      concepto: `Pago CC — ${cargo.concepto}`,
      referenciaId: cargo.referenciaId,
      referenciaTipo: cargo.referenciaTipo,
      referenciaNum: cargo.referenciaNum,
    })

    // 2. Actualizar el cargo
    const cargoActualizado = await updateCCItem(id, {
      montoPagado: nuevoMontoPagado,
      saldoPendiente: Math.max(0, nuevoSaldo),
      estado: nuevoEstado,
    })

    // 3. Crear VentaCaja para que aparezca en caja del día
    const snap = cargo.snapshotOrden
    let ventaCajaCreada = null
    try {
      const dolar = await getUltimoDolar()
      const conceptoVenta = snap
        ? `Cobro CC — Orden #${snap.nOrden} · ${snap.nombreCliente} · ${snap.modeloEquipo}`
        : `Cobro CC — ${cargo.concepto}`

      // Calcular comisiones y costos para VentaCaja
      const costoUnitario = snap ? (snap.costoRepuestoPesos > 0 ? snap.costoRepuestoPesos : snap.costoRepuestos) : 0
      const comisionMPMonto = metodoPago === 'Mercado Pago' ? Math.round(pagoReal * 0.045) : 0
      const iibbMonto = Math.round(pagoReal * 0.04)
      const gananciaCC = pagoReal - costoUnitario - comisionMPMonto - iibbMonto
        - (snap?.comisionVendedora ?? 0) - (snap?.comisionTecnico ?? 0)

      const nVenta = await getNextVentaCajaNum()
      ventaCajaCreada = await addVentaCaja({
        nVenta,
        fecha: today(),
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        items: [{
          id: `cc-${Date.now()}`,
          nombre: conceptoVenta,
          cantidad: 1,
          precioUnitario: pagoReal,
          subtotal: pagoReal,
          costoUnitario,
          tipo: 'orden',
          refId: cargo.referenciaId,
        }],
        subtotal: pagoReal,
        descuento: 0,
        total: pagoReal,
        costoTotal: costoUnitario,
        comisionMP: comisionMPMonto,
        iibb: iibbMonto,
        gananciaReal: gananciaCC,
        metodoPago,
        clienteNombre: cargo.clienteNombre,
        clienteTelefono: cargo.clienteTelefono,
        nOrdenRef: snap?.nOrden,
        observaciones: `Cobro de Cuenta Corriente · ${cargo.concepto}`,
      })

      // Actualizar cargo con ventaCajaId
      await updateCCItem(id, { ventaCajaId: ventaCajaCreada.id })

      // 4. Auto-generar comisiones si hay snapshot y es pago completo
      if (snap && nuevoEstado === 'pagado') {
        try {
          if (snap.tipo === 'Cliente final') {
            const reglas = await getReglasComision()
            const empleado = snap.tecnico?.trim() || 'Ronald'
            for (const regla of reglas.filter(r => r.activa)) {
              const base = pagoReal
              if (base <= 0) continue
              const comisionCalculada = Math.round(base * regla.porcentaje / 100)
              const totalComision = regla.comisionFija > 0 ? regla.comisionFija : comisionCalculada
              if (totalComision <= 0) continue
              await addComision({
                fecha: today(),
                empleado: empleado as any,
                nOrden: String(snap.nOrden),
                tipo: 'B2C',
                descripcion: `CC cobrado — ${snap.nombreCliente} · ${snap.modeloEquipo}`,
                montoVenta: base,
                porcentaje: regla.porcentaje,
                comisionCalculada,
                comisionFija: regla.comisionFija,
                totalComision,
                pagada: 'Pendiente',
              })
            }
          } else {
            const reglasG = await getReglasComisionGremio()
            const modelo = (snap.modeloEquipo ?? '').trim().toLowerCase()
            const tipoR  = (snap.tipoServicio  ?? '').trim().toLowerCase()
            const activas = reglasG.filter(r => r.activa && r.comisionFija > 0)
            const match =
              activas.find(r => r.modelo.toLowerCase() === modelo && r.tipoReparacion.toLowerCase() === tipoR) ||
              activas.find(r => !r.modelo && r.tipoReparacion.toLowerCase() === tipoR) ||
              activas.find(r => r.modelo.toLowerCase() === modelo && !r.tipoReparacion)
            if (match) {
              await addComision({
                fecha: today(),
                empleado: (snap.tecnico?.trim() || 'Ronald') as any,
                nOrden: String(snap.nOrden),
                tipo: 'B2B',
                descripcion: `CC cobrado Gremio — ${snap.nombreCliente} · ${snap.modeloEquipo}`,
                montoVenta: pagoReal,
                porcentaje: 0,
                comisionCalculada: match.comisionFija,
                comisionFija: match.comisionFija,
                totalComision: match.comisionFija,
                pagada: 'Pendiente',
              })
            }
          }
        } catch { /* silencioso */ }
      }
    } catch { /* silencioso */ }

    return NextResponse.json({ cargo: cargoActualizado, pago: pagoItem, ventaCaja: ventaCajaCreada })
  }

  // ── Update genérico ────────────────────────────────────────────────────────
  const updated = await updateCCItem(id, rest)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await deleteCCItem(id)
  return NextResponse.json({ ok: true })
}
