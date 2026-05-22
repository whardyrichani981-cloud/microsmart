'use client'
import { useState, useEffect } from 'react'
import { useApi, fmtARS, C } from './shared'
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

  if (loading) return <div style={{ padding: 40, color: 'var(--ms-text-3, var(--text-secondary))', textAlign: 'center' }}>Cargando dashboard…</div>
  if (!data) return null

  const d = data
  const margen = d.totalIngresosBrutos > 0 ? ((d.gananciaReal / d.totalIngresosBrutos) * 100).toFixed(1) : '0.0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="ms-eyebrow" style={{ marginBottom: 4 }}>Reportes</div>
          <div className="ms-h3" style={{ color: 'var(--ms-text, var(--text-primary))' }}>Dashboard Financiero</div>
          <div style={{ fontSize: 12, color: 'var(--ms-text-3, var(--text-secondary))', marginTop: 2 }}>
            Resumen del período · Calculado automáticamente
          </div>
        </div>
        <button
          onClick={refresh}
          className="ms-btn is-ghost is-sm"
          style={{ fontSize: 12 }}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MSKPICard label="Facturación" value={fmtARS(d.totalIngresosBrutos)} variant="success" sub={`B2C: ${fmtARS(d.ventasB2C)} · B2B: ${fmtARS(d.ventasB2B)} · Caja: ${fmtARS(d.ventasCaja ?? 0)}`} />
        <MSKPICard label="Ganancia Real" value={fmtARS(d.gananciaReal)} variant={d.gananciaReal >= 0 ? 'success' : 'danger'} sub={`Margen: ${margen}%`} />
        <MSKPICard label="Total Gastos" value={fmtARS(d.totalGastos)} variant="danger" sub={`Local: ${fmtARS(d.gastosLocal)} · Fijos: ${fmtARS(d.gastosFijos)}`} />
        <MSKPICard label="Comisiones" value={fmtARS(d.totalComisionesEmpleados)} variant="accent" sub={`${d.pendientesPago} pendientes de pago`} />
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <MSKPICard label="Turnos Pendientes" value={String(d.cantidadTurnos)} variant="accent" />
        <MSKPICard label="Ventas B2C" value={String(d.cantidadVentasB2C)} variant="success" sub={fmtARS(d.ventasB2C)} />
        <MSKPICard label="Ventas B2B" value={String(d.cantidadVentasB2B)} variant="success" sub={fmtARS(d.ventasB2B)} />
        <MSKPICard label="Comisión MP" value={fmtARS(d.comisionesMP)} variant="warn" sub={`IIBB: ${fmtARS(d.iibbTotal)}`} />
        <MSKPICard label="Ventas Caja" value={String(d.cantidadVentasCaja ?? 0)} variant="accent" sub={fmtARS(d.ventasCaja ?? 0)} />
      </div>

      {/* ── Panel de Alertas de Stock ── */}
      {!stockLoading && stockGroups.length > 0 && (() => {
        const agotados = stockGroups.filter(g => g.totalStock === 0)
        const bajos    = stockGroups.filter(g => g.totalStock > 0)
        return (
          <div className="ms-card" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px',
              background: 'var(--ms-danger-soft, rgba(239,68,68,0.06))',
              borderBottom: '0.5px solid var(--ms-border)',
            }}>
              <div style={{ flex: 1 }}>
                <div className="ms-eyebrow" style={{ marginBottom: 2 }}>Inventario</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ms-text, var(--text-primary))' }}>Alertas de Stock</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {agotados.length > 0 && (
                  <span className="ms-pill is-danger">
                    <span className="dot" />
                    {agotados.length} sin stock
                  </span>
                )}
                {bajos.length > 0 && (
                  <span className="ms-pill is-warn">
                    <span className="dot" />
                    {bajos.length} stock bajo
                  </span>
                )}
              </div>
            </div>

            {/* Tabla */}
            <div style={{ padding: '0 20px 16px' }}>
              {agotados.length > 0 && (
                <>
                  <div className="ms-eyebrow" style={{ color: 'var(--ms-danger)', padding: '12px 0 6px' }}>
                    Sin stock — urgente
                  </div>
                  {agotados.map(g => (
                    <StockAlertRow key={g.key} g={g} />
                  ))}
                </>
              )}
              {bajos.length > 0 && (
                <>
                  <div className="ms-eyebrow" style={{ color: 'var(--ms-warn)', padding: '12px 0 6px' }}>
                    Stock bajo — reponer pronto
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
        <div className="ms-card" style={{ padding: '16px 20px' }}>
          <div className="ms-eyebrow" style={{ marginBottom: 14 }}>Desglose de Resultado</div>
          <WaterfallRow label="Ingresos Brutos" value={d.totalIngresosBrutos} color={C.green} sign="+" />
          <WaterfallRow label="Costo Repuestos B2C" value={d.costoRepuestosB2C} color={C.red} sign="-" />
          <WaterfallRow label="Costo Repuestos B2B" value={d.costoRepuestosB2B} color={C.red} sign="-" />
          <WaterfallRow label="Comisiones Mercado Pago" value={d.comisionesMP} color={C.red} sign="-" />
          <WaterfallRow label="IIBB (4%)" value={d.iibbTotal} color={C.red} sign="-" />
          <WaterfallRow label="Comisiones Empleados" value={d.totalComisionesEmpleados} color={C.yellow} sign="-" />
          <WaterfallRow label="Gastos Operativos" value={d.totalGastos} color={C.red} sign="-" />
          <hr className="ms-hr" style={{ margin: '10px 0' }} />
          <WaterfallRow label="Ganancia Real" value={d.gananciaReal} color={d.gananciaReal >= 0 ? C.green : C.red} sign="=" bold />
        </div>

        {/* Gastos breakdown + Comisiones por empleado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ms-card" style={{ padding: '16px 20px' }}>
            <div className="ms-eyebrow" style={{ marginBottom: 14 }}>Gastos por Categoría</div>
            <WaterfallRow label="Gastos del Local" value={d.gastosLocal} color={C.red} />
            <WaterfallRow label="Gastos de Oficina" value={d.gastosOficina} color={C.red} />
            <WaterfallRow label="Gastos Fijos" value={d.gastosFijos} color={C.red} />
          </div>
          <div className="ms-card" style={{ padding: '16px 20px' }}>
            <div className="ms-eyebrow" style={{ marginBottom: 14 }}>Comisiones por Empleado</div>
            {['Ronald', 'Sharon', 'Saddi'].map(emp => (
              <WaterfallRow key={emp} label={emp} value={d.comisionesPorEmpleado[emp] ?? 0} color={C.yellow} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MSKPICard: KPI card con nuevo sistema de diseño ──────────────────────────
type KPIVariant = 'success' | 'danger' | 'warn' | 'accent' | 'default'

function MSKPICard({ label, value, sub, variant = 'default' }: {
  label: string
  value: string
  sub?: string
  variant?: KPIVariant
}) {
  const pillClass = variant === 'default' ? 'ms-pill' : `ms-pill is-${variant}`
  return (
    <div className="ms-card" style={{ padding: '16px 18px' }}>
      <div className="ms-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="ms-h3 ms-mono" style={{
        color: variant === 'danger' ? 'var(--ms-danger)'
          : variant === 'success' ? 'var(--ms-success)'
          : variant === 'warn' ? 'var(--ms-warn)'
          : variant === 'accent' ? 'var(--ms-accent)'
          : 'var(--ms-text)',
        fontSize: 18,
        marginBottom: sub ? 8 : 0,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--ms-text-3)', marginTop: 4, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
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
      padding: '8px 0', borderBottom: '0.5px solid var(--ms-border, var(--row-border))',
    }}>
      {/* Nombre */}
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ms-text, var(--text-primary))' }}>{g.repuesto}</span>
        {g.modelo && <span style={{ fontSize: 11, color: 'var(--ms-text-2, var(--text-secondary))', marginLeft: 6 }}>{g.modelo}</span>}
        {/* Barra de progreso */}
        <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: 'var(--ms-border, var(--border))', width: 140, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: barColor, width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
      {/* Stock actual */}
      <div style={{ textAlign: 'center' }}>
        <div className="ms-eyebrow" style={{ marginBottom: 2, fontSize: 9 }}>Actual</div>
        <span className="ms-mono ms-pill" style={{
          background: agotado ? 'var(--ms-danger-soft)' : 'var(--ms-warn-soft)',
          color: agotado ? 'var(--ms-danger)' : 'var(--ms-warn)',
          fontWeight: 800, fontSize: 12,
        }}>
          {g.totalStock}
        </span>
      </div>
      {/* Mínimo */}
      <div style={{ textAlign: 'center' }}>
        <div className="ms-eyebrow" style={{ marginBottom: 2, fontSize: 9 }}>Mínimo</div>
        <span className="ms-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ms-text-2)' }}>
          {g.stockMinimo}
        </span>
      </div>
    </div>
  )
}

function WaterfallRow({ label, value, color, sign, bold }: { label: string; value: number; color: string; sign?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--ms-border, var(--row-border))' }}>
      <span style={{ fontSize: 12, color: bold ? 'var(--ms-text, var(--text-primary))' : 'var(--ms-text-2, var(--text-secondary))', fontWeight: bold ? 700 : 400 }}>
        {sign && <span style={{ color, marginRight: 6, fontFamily: 'monospace' }}>{sign}</span>}
        {label}
      </span>
      <span className="ms-mono" style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color }}>{fmtARS(value)}</span>
    </div>
  )
}
