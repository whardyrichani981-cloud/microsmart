'use client'
import { useApi, fmtARS, C, KPICard, Badge } from './shared'
import type { DashboardData } from '@/lib/sistema-types'

export default function DashboardView() {
  const { data, loading, refresh } = useApi<DashboardData>('/api/sistema/dashboard')

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
