'use client'
import { useState, useEffect } from 'react'
import { useApi, fmtARS, C, KPICard, Badge } from './shared'
import type { DashboardData, StockItem } from '@/lib/sistema-types'

interface StockGroup {
  key: string
  repuesto: string
  modelo: string
  tipo: string
  totalStock: number
  stockMinimo: number
}

function buildStockGroups(items: StockItem[]): StockGroup[] {
  const map = new Map<string, StockGroup>()
  for (const item of items) {
    const k = `${item.tipo}|||${item.repuesto?.toLowerCase()}|||${item.modelo?.toLowerCase()}`
    if (!map.has(k)) map.set(k, { key: k, repuesto: item.repuesto, modelo: item.modelo, tipo: item.tipo, totalStock: 0, stockMinimo: item.stockMinimo ?? 2 })
    const g = map.get(k)!
    g.totalStock += item.stock ?? 0
    g.stockMinimo = Math.max(g.stockMinimo, item.stockMinimo ?? 2)
  }
  return [...map.values()].filter(g => g.totalStock <= g.stockMinimo)
    .sort((a, b) => a.totalStock - b.totalStock)
}

export default function DashboardView() {
  const { data, loading, refresh } = useApi<DashboardData>('/api/sistema/dashboard')
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([])
  const [stockLoading, setStockLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/sistema/stock?tipo=repuestos').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/sistema/stock?tipo=accesorios').then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([rep, acc]) => {
      const all: StockItem[] = [...(rep?.items ?? []), ...(acc?.items ?? [])]
      setStockGroups(buildStockGroups(all))
      setStockLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>Cargando dashboard…</div>
  if (!data) return null

  const d = data
  const margen = d.totalIngresosBrutos > 0 ? ((d.gananciaReal / d.totalIngresosBrutos) * 100).toFixed(1) : '0.0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fb923c18', border: '1px solid #fb923c33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Dashboard Financiero</div>
            <div style={{ fontSize: 12, color: C.muted }}>Resumen del período · Calculado automáticamente</div>
          </div>
        </div>
        <button onClick={refresh} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="Facturación" value={fmtARS(d.totalIngresosBrutos)} color="#4ade80" icon="💰" sub={`B2C: ${fmtARS(d.ventasB2C)} · B2B: ${fmtARS(d.ventasB2B)} · Caja: ${fmtARS(d.ventasCaja ?? 0)}`} />
        <KPICard label="Ganancia Real" value={fmtARS(d.gananciaReal)} color={d.gananciaReal >= 0 ? '#4ade80' : '#f87171'} icon="📈" sub={`Margen: ${margen}%`} />
        <KPICard label="Total Gastos" value={fmtARS(d.totalGastos)} color="#f87171" icon="🧾" sub={`Local: ${fmtARS(d.gastosLocal)} · Fijos: ${fmtARS(d.gastosFijos)}`} />
        <KPICard label="Comisiones" value={fmtARS(d.totalComisionesEmpleados)} color="#0066CC" icon="👥" sub={`${d.pendientesPago} pendientes de pago`} />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="Turnos Pendientes" value={String(d.cantidadTurnos)} color="#60a5fa" icon="📅" />
        <KPICard label="Ventas B2C" value={String(d.cantidadVentasB2C)} color="#4ade80" icon="📋" sub={fmtARS(d.ventasB2C)} />
        <KPICard label="Ventas B2B" value={String(d.cantidadVentasB2B)} color="#34d399" icon="🏢" sub={fmtARS(d.ventasB2B)} />
        <KPICard label="Comisión MP" value={fmtARS(d.comisionesMP)} color="#a78bfa" icon="💳" sub={`IIBB: ${fmtARS(d.iibbTotal)}`} />
        <KPICard label="Ventas Caja" value={String(d.cantidadVentasCaja ?? 0)} color="#fb923c" icon="🖥️" sub={fmtARS(d.ventasCaja ?? 0)} />
      </div>

      {/* ── Panel de Alertas de Stock ── */}
      {!stockLoading && stockGroups.length > 0 && (() => {
        const agotados = stockGroups.filter(g => g.totalStock === 0)
        const bajos    = stockGroups.filter(g => g.totalStock > 0)
        return (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Alertas de Stock</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Productos que requieren reposición</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {agotados.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#ef4444', color: '#fff', padding: '3px 10px', borderRadius: 20 }}>
                    🔴 {agotados.length} sin stock
                  </span>
                )}
                {bajos.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#f97316', color: '#fff', padding: '3px 10px', borderRadius: 20 }}>
                    🟠 {bajos.length} stock bajo
                  </span>
                )}
              </div>
            </div>

            {/* Tabla */}
            <div style={{ padding: '0 20px 16px' }}>
              {/* Sub-sección: Sin stock */}
              {agotados.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 0 6px' }}>
                    🔴 Sin stock — urgente
                  </div>
                  {agotados.map(g => (
                    <StockAlertRow key={g.key} g={g} />
                  ))}
                </>
              )}
              {/* Sub-sección: Stock bajo */}
              {bajos.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 0 6px' }}>
                    🟠 Stock bajo — reponer pronto
                  </div>
                  {bajos.map(g => (
                    <StockAlertRow key={g.key} g={g} />
                  ))}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Waterfall breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Ingresos vs Costos */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Desglose de Resultado</div>
          <WaterfallRow label="Ingresos Brutos" value={d.totalIngresosBrutos} color={C.green} sign="+" />
          <WaterfallRow label="Costo Repuestos B2C" value={d.costoRepuestosB2C} color={C.red} sign="-" />
          <WaterfallRow label="Costo Repuestos B2B" value={d.costoRepuestosB2B} color={C.red} sign="-" />
          <WaterfallRow label="Comisiones Mercado Pago" value={d.comisionesMP} color={C.red} sign="-" />
          <WaterfallRow label="IIBB (4%)" value={d.iibbTotal} color={C.red} sign="-" />
          <WaterfallRow label="Comisiones Empleados" value={d.totalComisionesEmpleados} color={C.yellow} sign="-" />
          <WaterfallRow label="Gastos Operativos" value={d.totalGastos} color={C.red} sign="-" />
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
          <WaterfallRow label="Ganancia Real" value={d.gananciaReal} color={d.gananciaReal >= 0 ? C.green : C.red} sign="=" bold />
        </div>

        {/* Gastos breakdown + Comisiones por empleado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gastos por Categoría</div>
            <WaterfallRow label="Gastos del Local" value={d.gastosLocal} color={C.red} />
            <WaterfallRow label="Gastos de Oficina" value={d.gastosOficina} color={C.red} />
            <WaterfallRow label="Gastos Fijos" value={d.gastosFijos} color={C.red} />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comisiones por Empleado</div>
            {['Ronald', 'Sharon', 'Saddi'].map(emp => (
              <WaterfallRow key={emp} label={emp} value={d.comisionesPorEmpleado[emp] ?? 0} color={C.yellow} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StockAlertRow({ g }: { g: StockGroup }) {
  const agotado = g.totalStock === 0
  const pct = Math.min(100, Math.round((g.totalStock / Math.max(g.stockMinimo, 1)) * 100))
  const barColor = agotado ? '#ef4444' : g.totalStock <= Math.ceil(g.stockMinimo / 2) ? '#f97316' : '#fb923c'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto',
      alignItems: 'center', gap: 12,
      padding: '8px 0', borderBottom: '1px solid var(--row-border)',
    }}>
      {/* Nombre */}
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{g.repuesto}</span>
        {g.modelo && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{g.modelo}</span>}
        {/* Barra de progreso */}
        <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: 'var(--border)', width: 140, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: barColor, width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
      {/* Stock actual */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>Actual</div>
        <span style={{
          fontSize: 13, fontWeight: 800, fontFamily: 'monospace',
          color: agotado ? '#ef4444' : '#f97316',
          background: agotado ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
          padding: '2px 8px', borderRadius: 6,
        }}>
          {g.totalStock}
        </span>
      </div>
      {/* Mínimo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>Mínimo</div>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {g.stockMinimo}
        </span>
      </div>
    </div>
  )
}

function WaterfallRow({ label, value, color, sign, bold }: { label: string; value: number; color: string; sign?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--row-border)' }}>
      <span style={{ fontSize: 12, color: bold ? C.text : C.muted, fontWeight: bold ? 700 : 400 }}>
        {sign && <span style={{ color, marginRight: 6, fontFamily: 'monospace' }}>{sign}</span>}
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color, fontFamily: 'monospace' }}>{fmtARS(value)}</span>
    </div>
  )
}
