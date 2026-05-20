'use client'
import { useState, useEffect } from 'react'
import type { Comision, Empleado, EstadoPago } from '@/lib/sistema-types'
import {
  useApi, fmtARS, today,
  C, Modal, Field, FormGrid, SectionDivider, PageHeader, Badge, KPICard,
  inputSt, calcSt, AutoCapInput, SearchableSelect,
} from './shared'
import { ComisionesConfigPanel } from './ConfiguracionView'

const COLOR = '#0066CC'
const EMPLEADOS: Empleado[] = ['Ronald', 'Sharon', 'Saddi']
const TIPOS_DEFAULT = ['B2C', 'B2B'] as const
const TIPOS_SHARON = ['B2C', 'B2B', 'B2C Accesorio'] as const


type FormState = Omit<Comision, 'id' | 'createdAt'>

function buildEmpty(empleado: Empleado): FormState {
  return {
    fecha: today(),
    empleado,
    nOrden: '',
    tipo: 'B2C',
    descripcion: '',
    montoVenta: 0,
    porcentaje: 0,
    comisionCalculada: 0,
    comisionFija: 0,
    totalComision: 0,
    pagada: 'Pendiente',
  }
}

function recalc(f: FormState): FormState {
  const porcentaje = f.tipo === 'B2C Accesorio' ? 10 : f.porcentaje
  const comisionCalculada = Math.round(f.montoVenta * porcentaje / 100)
  const totalComision = f.comisionFija > 0 ? f.comisionFija : comisionCalculada
  return { ...f, porcentaje, comisionCalculada, totalComision }
}

interface MeResponse { username: string; empleado: string; isAdmin: boolean }

export default function ComisionesView() {
  const { data: me } = useApi<MeResponse>('/api/auth/me')
  const { data: comisiones, loading, refresh } = useApi<Comision[]>('/api/sistema/comisiones')

  const isAdmin = me?.isAdmin ?? false
  const currentEmpleado = (me?.empleado ?? 'Ronald') as Empleado

  type Tab = Empleado | 'Resumen' | 'Pagadas'
  const defaultTab: Tab = isAdmin ? 'Ronald' : currentEmpleado
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [configOpen, setConfigOpen] = useState(false)

  const [form, setForm] = useState<FormState>(buildEmpty('Ronald'))
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (me && !me.isAdmin) setActiveTab(me.empleado as Empleado)
  }, [me?.empleado, me?.isAdmin])

  const set = (k: string, v: unknown) => {
    setForm(prev => {
      let next = { ...prev, [k]: v }
      if (k === 'empleado' && v !== 'Sharon' && next.tipo === 'B2C Accesorio') {
        next = { ...next, tipo: 'B2C' }
      }
      return recalc(next)
    })
  }

  const openNew = () => {
    const emp = (activeTab === 'Resumen' || activeTab === 'Pagadas') ? currentEmpleado : activeTab
    setForm(recalc(buildEmpty(emp as Empleado)))
    setEditId(null)
    setModal('new')
  }

  const openEdit = (c: Comision) => {
    const { id, createdAt, ...rest } = c
    setForm(rest)
    setEditId(id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.nOrden.trim()) return
    setSaving(true)
    try {
      if (modal === 'new') {
        await fetch('/api/sistema/comisiones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      } else {
        await fetch('/api/sistema/comisiones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) })
      }
      await refresh()
      setModal(false)
    } finally { setSaving(false) }
  }

  const del = async (c: Comision) => {
    await fetch('/api/sistema/comisiones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id }) })
    await refresh()
  }

  const allList = comisiones ?? []
  // Non-admins only see their own commissions
  const list = isAdmin ? allList : allList.filter(c => c.empleado === currentEmpleado)

  const pendienteList = list.filter(c => c.pagada === 'Pendiente')
  const pagadasList   = list.filter(c => c.pagada === 'Pagada')

  const byEmp = (emp: Empleado) => pendienteList.filter(c => c.empleado === emp)

  // Tabs de empleado/Resumen muestran solo Pendientes; Pagadas tiene su propia vista
  const filtered = activeTab === 'Resumen'
    ? pendienteList
    : activeTab === 'Pagadas'
    ? pagadasList
    : pendienteList.filter(c => c.empleado === activeTab)

  // Agrupar pagadas por mes (YYYY-MM), más reciente primero
  const pagadasByMonth = pagadasList.reduce<Record<string, Comision[]>>((acc, c) => {
    const m = c.fecha.slice(0, 7)
    ;(acc[m] ??= []).push(c)
    return acc
  }, {})
  const monthKeys = Object.keys(pagadasByMonth).sort().reverse()

  function fmtMonth(ym: string) {
    const [y, m] = ym.split('-')
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    return `${names[parseInt(m) - 1]} ${y}`
  }

  const empSummary = EMPLEADOS.map(emp => {
    const rows = list.filter(c => c.empleado === emp)
    const total = rows.reduce((s, c) => s + c.totalComision, 0)
    const pagadas = rows.filter(c => c.pagada === 'Pagada').reduce((s, c) => s + c.totalComision, 0)
    const pendientes = rows.filter(c => c.pagada === 'Pendiente').reduce((s, c) => s + c.totalComision, 0)
    return { emp, total, pagadas, pendientes, count: rows.length }
  })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState(false)

  // Clear selection when tab changes
  useEffect(() => { setSelected(new Set()) }, [activeTab])

  const pendienteRows = filtered.filter(c => c.pagada === 'Pendiente')
  const allPendienteSelected = pendienteRows.length > 0 && pendienteRows.every(c => selected.has(c.id))

  const toggleAll = () => {
    if (allPendienteSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendienteRows.map(c => c.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const pagarUna = async (c: Comision) => {
    await fetch('/api/sistema/comisiones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, pagada: 'Pagada' }),
    })
    await refresh()
  }

  const pagarSeleccionadas = async () => {
    setPaying(true)
    try {
      await Promise.all(
        filtered
          .filter(c => selected.has(c.id) && c.pagada === 'Pendiente')
          .map(c => fetch('/api/sistema/comisiones', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...c, pagada: 'Pagada' }),
          }))
      )
      await refresh()
      setSelected(new Set())
    } finally { setPaying(false) }
  }

  const pendientesTotal = pendienteList.reduce((s, c) => s + c.totalComision, 0)
  const pagadasTotal    = pagadasList.reduce((s, c) => s + c.totalComision, 0)
  const selectedTotal   = filtered.filter(c => selected.has(c.id)).reduce((s, c) => s + c.totalComision, 0)

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <PageHeader
            icon="💛"
            title="Comisiones"
            desc="Gestión de comisiones por empleado"
            color={COLOR}
            count={filtered.length}
            onNew={openNew}
            newLabel="Nueva comisión"
          />
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          title="Configuración de reglas de comisión"
          style={{
            marginTop: 4,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: C.muted,
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚙ Configurar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {(isAdmin ? ([...EMPLEADOS, 'Resumen'] as Tab[]) : [currentEmpleado as Tab]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '9px 18px', border: 'none', borderRadius: 0, background: 'none',
            color: activeTab === tab ? COLOR : C.muted,
            fontWeight: activeTab === tab ? 700 : 400, cursor: 'pointer', fontSize: 13,
            borderBottom: activeTab === tab ? `2px solid ${COLOR}` : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.12s',
          }}>
            {tab}
            {tab !== 'Resumen' && (
              <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 8, background: `${COLOR}22`, color: COLOR }}>
                {byEmp(tab as Empleado).length}
              </span>
            )}
          </button>
        ))}
        {/* Pagadas tab */}
        <button onClick={() => setActiveTab('Pagadas')} style={{
          padding: '9px 18px', border: 'none', borderRadius: 0, background: 'none',
          color: activeTab === 'Pagadas' ? C.green : C.muted,
          fontWeight: activeTab === 'Pagadas' ? 700 : 400, cursor: 'pointer', fontSize: 13,
          borderBottom: activeTab === 'Pagadas' ? `2px solid ${C.green}` : '2px solid transparent',
          marginBottom: -1, transition: 'color 0.12s',
        }}>
          ✓ Pagadas
          <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 8, background: `${C.green}22`, color: C.green }}>
            {pagadasList.length}
          </span>
        </button>

      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPICard label="Pendientes de cobro" value={fmtARS(pendientesTotal)} color={COLOR} icon="⏳" />
        <KPICard label="Total pagado" value={fmtARS(pagadasTotal)} color={C.green} icon="✅" />
      </div>

      {/* Bulk pay bar — solo en tabs de pendientes */}
      {activeTab !== 'Pagadas' && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 16px', borderRadius: 8, background: `${COLOR}10`, border: `1px solid ${COLOR}30` }}>
          <span style={{ fontSize: 13, color: COLOR, fontWeight: 600 }}>
            {selected.size} seleccionada{selected.size > 1 ? 's' : ''} — {fmtARS(selectedTotal)}
          </span>
          <button
            onClick={pagarSeleccionadas}
            disabled={paying}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: C.green, color: '#FFFFFF', cursor: paying ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: paying ? 0.7 : 1 }}
          >
            {paying ? 'Pagando…' : `Pagar ${selected.size} comisión${selected.size > 1 ? 'es' : ''}`}
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid var(--border)`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
            Cancelar
          </button>
        </div>
      )}

      {/* ── TAB PAGADAS ── agrupado por mes */}
      {activeTab === 'Pagadas' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
        ) : pagadasList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: C.dim, fontSize: 13, border: '1px solid var(--border)', borderRadius: 10 }}>No hay comisiones pagadas todavía</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {monthKeys.map(ym => {
              const rows = pagadasByMonth[ym]
              const totalMes = rows.reduce((s, c) => s + c.totalComision, 0)
              return (
                <div key={ym}>
                  {/* Month header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '8px 14px', borderRadius: 8, background: `${C.green}0c`, border: `1px solid ${C.green}22` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmtMonth(ym)}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.green }}>{fmtARS(totalMes)}</span>
                  </div>
                  {/* Month table */}
                  <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)' }}>
                          {['Fecha', 'N°Orden', ...(isAdmin ? ['Empleado'] : []), 'Tipo', 'Descripción', 'Monto Venta', '%', 'Comisión', ...(isAdmin ? [''] : [])].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: ['Monto Venta', 'Comisión', '%'].includes(h) ? 'right' : 'left', color: C.muted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((c, i) => (
                          <tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.025)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{c.fecha}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: C.muted }}>{c.nOrden || '—'}</td>
                            {isAdmin && <td style={{ padding: '8px 12px' }}><Badge label={c.empleado} color={COLOR} /></td>}
                            <td style={{ padding: '8px 12px', fontSize: 10, color: C.muted }}>{c.tipo}</td>
                            <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{c.descripcion}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.text }}>{fmtARS(c.montoVenta)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.muted }}>{c.porcentaje}%</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.green }}>{fmtARS(c.totalComision)}</td>
                            {isAdmin && (
                              <td style={{ padding: '6px 10px' }}>
                                <button
                                  onClick={() => { if (confirm('¿Eliminar esta comisión pagada?')) del(c) }}
                                  style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }}
                                  onMouseEnter={e => e.currentTarget.style.color = C.red}
                                  onMouseLeave={e => e.currentTarget.style.color = C.muted}
                                >🗑️</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Resumen tab: summary table */}
      {activeTab === 'Resumen' && (
        <div style={{ marginBottom: 16, overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Empleado', 'Registros', 'Total Comisiones', 'Pagadas', 'Pendientes'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Empleado' ? 'left' : 'right', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empSummary.map(row => (
                <tr key={row.emp} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '8px 12px' }}><Badge label={row.emp} color={COLOR} /></td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: C.muted }}>{row.count}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: COLOR }}>{fmtARS(row.total)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.green }}>{fmtARS(row.pagadas)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.red }}>{fmtARS(row.pendientes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de pendientes — se oculta en el tab Pagadas */}
      {activeTab !== 'Pagadas' && (loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: C.dim, fontSize: 13, border: '1px solid var(--border)', borderRadius: 10 }}>No hay comisiones pendientes</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ width: 36, padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={allPendienteSelected}
                    onChange={toggleAll}
                    title="Seleccionar todas las pendientes"
                    style={{ cursor: 'pointer', accentColor: COLOR }}
                  />
                </th>
                {['Fecha', 'N°Orden', ...(activeTab === 'Resumen' ? ['Empleado'] : []), 'Tipo', 'Descripción', 'Monto Venta', '%', 'Comisión', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: ['Monto Venta', 'Comisión', '%'].includes(h) ? 'right' : 'left', color: C.muted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isPendiente = c.pagada === 'Pendiente'
                const isSelected = selected.has(c.id)
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', background: isSelected ? `${COLOR}08` : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.025)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? `${COLOR}08` : '' }}
                  >
                    <td style={{ padding: '8px 10px' }}>
                      {isPendiente && (
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(c.id)} style={{ cursor: 'pointer', accentColor: COLOR }} />
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{c.fecha}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: C.muted }}>{c.nOrden || '—'}</td>
                    {activeTab === 'Resumen' && <td style={{ padding: '8px 12px' }}><Badge label={c.empleado} color={COLOR} /></td>}
                    <td style={{ padding: '8px 12px', fontSize: 10, color: C.muted }}>{c.tipo}</td>
                    <td style={{ padding: '8px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{c.descripcion}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.text }}>{fmtARS(c.montoVenta)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: C.muted }}>{c.porcentaje}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: COLOR }}>{fmtARS(c.totalComision)}</td>
                    <td style={{ padding: '8px 12px' }}><Badge label={c.pagada} color={c.pagada === 'Pagada' ? C.green : C.yellow} /></td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {isPendiente && (
                          <button
                            onClick={() => pagarUna(c)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.green}55`, background: `${C.green}10`, color: C.green, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                            onMouseEnter={e => e.currentTarget.style.background = `${C.green}22`}
                            onMouseLeave={e => e.currentTarget.style.background = `${C.green}10`}
                          >
                            Pagar
                          </button>
                        )}
                        <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = COLOR} onMouseLeave={e => e.currentTarget.style.color = C.muted}>✏️</button>
                        <button onClick={() => { if (confirm('¿Eliminar esta comisión?')) del(c) }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = C.red} onMouseLeave={e => e.currentTarget.style.color = C.muted}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}


      {modal && (
        <Modal title={modal === 'new' ? 'Nueva Comisión' : 'Editar Comisión'} onClose={() => setModal(false)} onSubmit={save} submitting={saving} submitColor={COLOR} width={600}>
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
            </Field>
            <Field label="Empleado" required>
              <SearchableSelect value={form.empleado} onChange={v => set('empleado', v as Empleado)} options={[...EMPLEADOS]} placeholder="Seleccionar empleado..." />
            </Field>
            <Field label="N°Orden" required>
              <input value={form.nOrden} onChange={e => set('nOrden', e.target.value)} placeholder="Número de orden" style={inputSt} />
            </Field>
            <Field label="Tipo">
              <SearchableSelect value={form.tipo} onChange={v => set('tipo', v as 'B2C' | 'B2B' | 'B2C Accesorio')} options={form.empleado === 'Sharon' ? [...TIPOS_SHARON] : [...TIPOS_DEFAULT]} placeholder="Seleccionar tipo..." />
            </Field>
            <Field label="Descripción" required col={2}>
              <AutoCapInput value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción de la venta/servicio" style={inputSt} />
            </Field>
          </FormGrid>

          <SectionDivider label="Cálculo" color={COLOR} />

          <FormGrid cols={3}>
            <Field label="Monto Venta">
              <input type="number" min={0} value={form.montoVenta} onChange={e => set('montoVenta', parseFloat(e.target.value) || 0)} style={inputSt} />
            </Field>
            <Field label="Porcentaje (%)" calc={form.tipo === 'B2C Accesorio'}>
              <input
                type="number" min={0} max={100}
                value={form.porcentaje}
                readOnly={form.tipo === 'B2C Accesorio'}
                onChange={e => set('porcentaje', parseFloat(e.target.value) || 0)}
                style={form.tipo === 'B2C Accesorio' ? calcSt : inputSt}
              />
            </Field>
            <Field label="Comisión Calculada" calc>
              <input readOnly value={fmtARS(form.comisionCalculada)} style={calcSt} />
            </Field>
            {form.tipo !== 'B2C Accesorio' && (
              <Field label="Comisión Fija (override)">
                <input type="number" min={0} value={form.comisionFija} onChange={e => set('comisionFija', parseFloat(e.target.value) || 0)} placeholder="0 = usar % calculado" style={inputSt} />
              </Field>
            )}
            <Field label="Total Comisión" calc>
              <input readOnly value={fmtARS(form.totalComision)} style={{ ...calcSt, color: COLOR, fontSize: 15 }} />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* ─── Configuración inline ──────────────────────────────────────────── */}
      {configOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg)',
            overflowY: 'auto',
            padding: '24px 0',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
            <ComisionesConfigPanel
              onBack={() => setConfigOpen(false)}
              backLabel="✕ Cerrar configuración"
            />
          </div>
        </div>
      )}
    </div>
  )
}
