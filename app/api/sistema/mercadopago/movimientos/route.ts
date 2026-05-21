import { NextRequest, NextResponse } from 'next/server'
import { getMPCuentas } from '@/lib/sistema-db'
import type { MPMovimiento } from '@/lib/sistema-types'

export const dynamic = 'force-dynamic'

type MPPaymentType = 'account_money' | 'credit_card' | 'debit_card' | 'ticket' | string

function resolveType(paymentTypeId: MPPaymentType, paymentMethodId: string): MPMovimiento['tipo'] {
  if (paymentTypeId === 'account_money') return 'transferencia'
  if (paymentTypeId === 'credit_card')   return 'tarjeta_credito'
  if (paymentTypeId === 'debit_card')    return 'tarjeta_debito'
  if (paymentMethodId === 'consumer_credits') return 'otro'
  return 'otro'
}

// GET /api/sistema/mercadopago/movimientos?cuentaId=xxx&desde=ISO&hasta=ISO&tipo=transferencia|tarjeta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cuentaId = searchParams.get('cuentaId')
  const desde    = searchParams.get('desde')   // ISO date string
  const hasta    = searchParams.get('hasta')   // ISO date string
  const tipoFiltro = searchParams.get('tipo')  // 'transferencia' | 'tarjeta' | null = all

  if (!cuentaId) return NextResponse.json({ error: 'cuentaId requerido' }, { status: 400 })

  const cuentas = await getMPCuentas()
  const cuenta  = cuentas.find(c => c.id === cuentaId)
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  try {
    // Build MP search URL
    const params = new URLSearchParams({
      status: 'approved',
      sort:   'date_created',
      criteria: 'desc',
      limit: '100',
    })

    // Date range — default: last 30 days
    // Argentina = UTC-3. End of "hasta" day in Argentina = next day 02:59:59 UTC
    const endDate = hasta ? (() => {
      const d = new Date(hasta)            // 2026-05-21T00:00:00Z
      d.setUTCDate(d.getUTCDate() + 1)     // 2026-05-22T00:00:00Z
      d.setUTCHours(2, 59, 59, 999)        // 2026-05-22T02:59:59Z = 2026-05-21T23:59:59 ART
      return d
    })() : new Date()
    // Start of "desde" day in Argentina = that day at 03:00 UTC
    const startDate = desde ? (() => {
      const d = new Date(desde)            // 2026-04-21T00:00:00Z
      d.setUTCHours(3, 0, 0, 0)           // 2026-04-21T03:00:00Z = 2026-04-21T00:00:00 ART
      return d
    })() : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })()
    params.set('range',      'date_created')
    params.set('begin_date', startDate.toISOString())
    params.set('end_date',   endDate.toISOString())

    const url = `https://api.mercadopago.com/v1/payments/search?${params}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cuenta.accessToken}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? `MP respondió ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = data.results ?? []

    const movimientos: MPMovimiento[] = results
      .filter(p => {
        const tipo = resolveType(p.payment_type_id, p.payment_method_id)
        if (tipoFiltro === 'transferencia') return tipo === 'transferencia'
        if (tipoFiltro === 'tarjeta')       return tipo === 'tarjeta_credito' || tipo === 'tarjeta_debito'
        return true // all
      })
      .map(p => ({
        id:            String(p.id),
        fecha:         p.date_approved ?? p.date_created,
        tipo:          resolveType(p.payment_type_id, p.payment_method_id),
        monto:         p.transaction_amount ?? 0,
        montoNeto:     p.net_amount ?? p.transaction_amount ?? 0,
        pagadorNombre: [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(' ') || p.payer?.email || '—',
        pagadorEmail:  p.payer?.email ?? '',
        descripcion:   p.description ?? '',
        estado:        p.status ?? '',
        metodoPago:    p.payment_method_id ?? '',
        cuotas:        p.installments ?? 1,
        cuentaId,
      }))

    return NextResponse.json({ movimientos, total: movimientos.length })
  } catch (e) {
    console.error('[mp/movimientos]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
