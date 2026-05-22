'use client'
import { useState, useEffect, useRef } from 'react'
import { C, inputSt, useApi, fmtARS, Modal, Field, FormGrid, Badge, SearchableSelect } from './shared'
import type { Empleado, ReglaComision, TipoReglaComision, ReglaComisionGremio } from '@/lib/sistema-types'
import BackupView from './BackupView'

const COLOR = '#0066CC'

// Módulos protegidos — siempre visibles, no editables
const PROTECTED = new Set(['inicio', 'comparador', 'proveedores', 'administracion'])

// Estados de orden que no se pueden eliminar ni renombrar
const ESTADOS_PROTEGIDOS = ['Entrada', 'Salida']

interface ModuloMeta {
  id: string
  icon: string
  label: string
  desc: string
  group: 'herramientas' | 'gestion' | 'contable'
}

const MODULOS: ModuloMeta[] = [
  { id: 'notasdash',     icon: '📋', label: 'Tareas y Pedidos',        desc: 'Panel de notas, pedidos y tareas del equipo',                   group: 'herramientas' },
  { id: 'imei',          icon: '🔍', label: 'Verificar IMEI',          desc: 'Consulta de estado de equipos por IMEI',                        group: 'herramientas' },
  { id: 'herramientas',  icon: '🛠️', label: 'Herramientas Técnicas',   desc: 'Panicfull, Servicios IMEI (team-saul.com) y herramientas Apple', group: 'herramientas' },
  { id: 'ordenes',    icon: '🗂',  label: 'Órdenes de trabajo',  desc: 'Gestión de reparaciones y seguimiento de equipos',  group: 'gestion' },
  { id: 'servicios',  icon: '🛠',  label: 'Servicios',           desc: 'Catálogo de servicios y mano de obra',              group: 'gestion' },
  { id: 'clientes',   icon: '👥', label: 'Clientes',             desc: 'Base de datos de clientes B2C y B2B',               group: 'gestion' },
  { id: 'agenda',     icon: '📅', label: 'Turnos / Agenda',      desc: 'Gestión de turnos y citas',                         group: 'gestion' },
  { id: 'stock',      icon: '📦', label: 'Stock',                desc: 'Inventario de repuestos y accesorios',              group: 'gestion' },
  { id: 'ventas',     icon: '💵', label: 'Ventas',               desc: 'Sub-pestaña dentro de Administración contable',     group: 'contable' },
  { id: 'gastos',     icon: '🧾', label: 'Gastos',               desc: 'Sub-pestaña dentro de Administración contable',     group: 'contable' },
  { id: 'comisiones', icon: '👤', label: 'Comisiones',           desc: 'Sub-pestaña dentro de Administración contable',     group: 'contable' },
  { id: 'reportes',   icon: '📊', label: 'Reportes',             desc: 'Sub-pestaña dentro de Administración contable',     group: 'contable' },
]

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: enabled ? '#4ade80' : 'var(--border)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: enabled ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

// ─── Helpers para reglas de comisión ─────────────────────────────────────────
const EMPLEADOS_LIST: Empleado[] = ['Ronald', 'Sharon', 'Saddi']

const TIPO_REGLA_LABELS: Record<TipoReglaComision, string> = {
  reparacion: 'Reparación (CF)',
  accesorio:  'Accesorio (CF)',
}

type ReglaForm = Omit<ReglaComision, 'id' | 'createdAt'>
function buildEmptyRegla(): ReglaForm {
  return { tipo: 'reparacion', empleado: 'Ronald', porcentaje: 10, comisionFija: 0, activa: true }
}

type ReglaGremioForm = Omit<ReglaComisionGremio, 'id' | 'createdAt'>
function buildEmptyReglaGremio(): ReglaGremioForm {
  return { modelo: '', tipoReparacion: '', comisionFija: 0, activa: true }
}

// ─── Panel: Configuración de Comisiones ──────────────────────────────────────
export function ComisionesConfigPanel({ onBack, backLabel = '← Volver a Configuración' }: { onBack: () => void; backLabel?: string }) {
  // ── Reglas CF ────────────────────────────────────────────────────────────
  const { data: reglasList, refresh: refreshReglas } = useApi<ReglaComision[]>('/api/sistema/reglas-comision')
  const reglas = reglasList ?? []
  const [reglaModal, setReglaModal] = useState<false | 'new' | 'edit'>(false)
  const [reglaForm, setReglaForm] = useState<ReglaForm>(buildEmptyRegla())
  const [reglaEditId, setReglaEditId] = useState<string | null>(null)
  const [reglaSaving, setReglaSaving] = useState(false)

  const openNewRegla = () => { setReglaForm(buildEmptyRegla()); setReglaEditId(null); setReglaModal('new') }
  const openEditRegla = (r: ReglaComision) => {
    const { id, createdAt, ...rest } = r
    setReglaForm(rest); setReglaEditId(id); setReglaModal('edit')
  }
  const saveRegla = async () => {
    setReglaSaving(true)
    try {
      if (reglaModal === 'new') {
        await fetch('/api/sistema/reglas-comision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reglaForm) })
      } else {
        await fetch('/api/sistema/reglas-comision', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reglaEditId, ...reglaForm }) })
      }
      await refreshReglas(); setReglaModal(false)
    } finally { setReglaSaving(false) }
  }
  const deleteRegla = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return
    await fetch('/api/sistema/reglas-comision', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await refreshReglas()
  }
  const toggleReglaActiva = async (r: ReglaComision) => {
    await fetch('/api/sistema/reglas-comision', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, activa: !r.activa }) })
    await refreshReglas()
  }

  // ── Reglas Gremio ────────────────────────────────────────────────────────
  const { data: reglasGremioList, refresh: refreshReglasGremio } = useApi<ReglaComisionGremio[]>('/api/sistema/reglas-comision-gremio')
  const reglasGremio = reglasGremioList ?? []
  const [gremioModal, setGremioModal] = useState<false | 'new' | 'edit'>(false)
  const [gremioForm, setGremioForm] = useState<ReglaGremioForm>(buildEmptyReglaGremio())
  const [gremioEditId, setGremioEditId] = useState<string | null>(null)
  const [gremioSaving, setGremioSaving] = useState(false)
  const [gremioSearch, setGremioSearch] = useState('')

  const openNewGremio = () => { setGremioForm(buildEmptyReglaGremio()); setGremioEditId(null); setGremioModal('new') }
  const openEditGremio = (r: ReglaComisionGremio) => {
    const { id, createdAt, ...rest } = r
    setGremioForm(rest); setGremioEditId(id); setGremioModal('edit')
  }
  const saveGremio = async () => {
    if (!gremioForm.tipoReparacion.trim()) return
    setGremioSaving(true)
    try {
      if (gremioModal === 'new') {
        await fetch('/api/sistema/reglas-comision-gremio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gremioForm) })
      } else {
        await fetch('/api/sistema/reglas-comision-gremio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: gremioEditId, ...gremioForm }) })
      }
      await refreshReglasGremio(); setGremioModal(false)
    } finally { setGremioSaving(false) }
  }
  const deleteGremio = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return
    await fetch('/api/sistema/reglas-comision-gremio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await refreshReglasGremio()
  }
  const toggleGremioActiva = async (r: ReglaComisionGremio) => {
    await fetch('/api/sistema/reglas-comision-gremio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, activa: !r.activa }) })
    await refreshReglasGremio()
  }

  const modelosSugeridos = Array.from(new Set(reglasGremio.map(r => r.modelo).filter(Boolean))).sort()
  const tiposSugeridos   = Array.from(new Set(reglasGremio.map(r => r.tipoReparacion).filter(Boolean))).sort()
  const gremioFiltradas  = reglasGremio.filter(r => {
    if (!gremioSearch.trim()) return true
    const q = gremioSearch.toLowerCase()
    return r.modelo.toLowerCase().includes(q) || r.tipoReparacion.toLowerCase().includes(q)
  })

  return (
    <div style={{ padding: '0 0 48px' }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24,
          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'none', color: '#6E6E73', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#1D1D1F'; e.currentTarget.style.borderColor = '#6E6E73' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6E6E73'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >{backLabel}</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 22 }}>👤</span>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>Reglas de comisión automática</h2>
      </div>

      {/* ══ SECCIÓN CF ══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>Cliente final (B2C)</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Al entregar una orden de <strong style={{ color: '#1D1D1F' }}>Cliente final</strong>, se generan comisiones automáticamente según estas reglas.<br />
            <span style={{ color: '#a78bfa' }}>Reparación</span> aplica sobre el total de servicios · <span style={{ color: '#4ade80' }}>Accesorio</span> aplica sobre el total de productos/accesorios.
          </div>
        </div>
        <button
          onClick={openNewRegla}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >+ Nueva regla</button>
      </div>

      {reglas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: C.muted, fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚙</div>
          Sin reglas configuradas. Hacé clic en <strong>+ Nueva regla</strong> para empezar.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Tipo', 'Empleado', '%', 'Comisión fija', 'Activa', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reglas.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < reglas.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: r.tipo === 'reparacion' ? 'rgba(167,139,250,0.15)' : 'rgba(74,222,128,0.12)',
                      color: r.tipo === 'reparacion' ? '#a78bfa' : '#4ade80',
                      border: `1px solid ${r.tipo === 'reparacion' ? 'rgba(167,139,250,0.3)' : 'rgba(74,222,128,0.25)'}`,
                    }}>
                      {TIPO_REGLA_LABELS[r.tipo]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}><Badge label={r.empleado} color={COLOR} /></td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{r.porcentaje}%</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: r.comisionFija > 0 ? COLOR : C.muted }}>
                    {r.comisionFija > 0 ? fmtARS(r.comisionFija) : '— (usa %)'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div onClick={() => toggleReglaActiva(r)} style={{ width: 36, height: 20, borderRadius: 10, background: r.activa ? '#4ade80' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', display: 'inline-block' }}>
                      <div style={{ position: 'absolute', top: 2, left: r.activa ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditRegla(r)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = COLOR} onMouseLeave={e => e.currentTarget.style.color = C.muted}>✏️</button>
                      <button onClick={() => deleteRegla(r.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = C.red} onMouseLeave={e => e.currentTarget.style.color = C.muted}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        <strong style={{ color: '#a78bfa' }}>¿Cómo funciona?</strong><br />
        Cuando marcás una orden de <strong style={{ color: '#1D1D1F' }}>Cliente final</strong> como entregada, el sistema aplica cada regla activa:<br />
        • <strong style={{ color: '#a78bfa' }}>Reparación</strong>: suma los ítems de tipo <em>servicio</em> de la orden y aplica el % (o monto fijo)<br />
        • <strong style={{ color: '#4ade80' }}>Accesorio</strong>: suma los ítems de tipo <em>producto/accesorio</em> de la orden y aplica el % (o monto fijo)<br />
        Si el monto calculado es 0 (no hay ítems del tipo correspondiente), no se genera la comisión.
      </div>

      {/* ══ SECCIÓN GREMIO ══ */}
      <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>🏢 Gremio (B2B) — Monto fijo por modelo y reparación</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Al entregar una orden de <strong style={{ color: '#1D1D1F' }}>Gremio</strong>, el sistema busca una regla que coincida con el modelo y tipo de reparación y genera la comisión fija para el técnico asignado.
            </div>
          </div>
          <button
            onClick={openNewGremio}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#fb923c', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >+ Nueva regla</button>
        </div>

        <input
          value={gremioSearch}
          onChange={e => setGremioSearch(e.target.value)}
          placeholder="🔍  Filtrar por modelo o tipo de reparación…"
          style={{ ...inputSt, width: '100%', marginBottom: 14, fontSize: 13 }}
        />

        {reglasGremio.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: C.muted, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏢</div>
            Sin reglas de Gremio. Hacé clic en <strong>+ Nueva regla</strong> para agregar.
          </div>
        ) : gremioFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: C.muted, fontSize: 13 }}>Sin resultados para "{gremioSearch}"</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Modelo', 'Tipo de reparación', 'Comisión fija', 'Activa', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gremioFiltradas.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < gremioFiltradas.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', opacity: r.activa ? 1 : 0.45 }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: '#60a5fa' }}>
                      {r.modelo || <span style={{ color: C.muted, fontStyle: 'italic' }}>Cualquier modelo</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: C.text }}>
                      {r.tipoReparacion || <span style={{ color: C.muted, fontStyle: 'italic' }}>Cualquier reparación</span>}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 800, color: COLOR, fontSize: 13 }}>
                      {fmtARS(r.comisionFija)}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <div onClick={() => toggleGremioActiva(r)} style={{ width: 36, height: 20, borderRadius: 10, background: r.activa ? '#4ade80' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', display: 'inline-block' }}>
                        <div style={{ position: 'absolute', top: 2, left: r.activa ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEditGremio(r)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = COLOR} onMouseLeave={e => e.currentTarget.style.color = C.muted}>✏️</button>
                        <button onClick={() => deleteGremio(r.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '3px 6px', fontSize: 13, borderRadius: 5 }} onMouseEnter={e => e.currentTarget.style.color = C.red} onMouseLeave={e => e.currentTarget.style.color = C.muted}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: '#fb923c' }}>Prioridad de coincidencia</strong><br />
          El sistema busca en este orden: <strong style={{ color: '#1D1D1F' }}>1)</strong> Modelo exacto + Reparación exacta &nbsp;→&nbsp;
          <strong style={{ color: '#1D1D1F' }}>2)</strong> Cualquier modelo + Reparación exacta &nbsp;→&nbsp;
          <strong style={{ color: '#1D1D1F' }}>3)</strong> Modelo exacto + Cualquier reparación.<br />
          Dejá el campo vacío para que actúe como comodín.
        </div>
      </div>

      {/* Modal Gremio */}
      {gremioModal && (
        <Modal title={gremioModal === 'new' ? 'Nueva regla Gremio' : 'Editar regla Gremio'} onClose={() => setGremioModal(false)} onSubmit={saveGremio} submitting={gremioSaving} submitColor="#fb923c" width={500}>
          <FormGrid cols={2}>
            <Field label="Modelo del equipo">
              <input
                list="modelos-gremio-list"
                value={gremioForm.modelo}
                onChange={e => setGremioForm(prev => ({ ...prev, modelo: e.target.value }))}
                placeholder="Ej: iPhone 6S  (vacío = cualquiera)"
                style={inputSt}
              />
              <datalist id="modelos-gremio-list">
                {modelosSugeridos.map(m => <option key={m} value={m} />)}
              </datalist>
            </Field>
            <Field label="Tipo de reparación" required>
              <input
                list="tipos-gremio-list"
                value={gremioForm.tipoReparacion}
                onChange={e => setGremioForm(prev => ({ ...prev, tipoReparacion: e.target.value }))}
                placeholder="Ej: Reparación de placa"
                style={inputSt}
              />
              <datalist id="tipos-gremio-list">
                {tiposSugeridos.map(t => <option key={t} value={t} />)}
              </datalist>
            </Field>
            <Field label="Comisión fija ($)" required col={2}>
              <input
                type="number" min={0} step={100}
                value={gremioForm.comisionFija}
                onChange={e => setGremioForm(prev => ({ ...prev, comisionFija: parseFloat(e.target.value) || 0 }))}
                placeholder="Ej: 3500"
                style={{ ...inputSt, fontSize: 16, fontWeight: 700 }}
              />
            </Field>
          </FormGrid>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => setGremioForm(prev => ({ ...prev, activa: !prev.activa }))} style={{ width: 36, height: 20, borderRadius: 10, background: gremioForm.activa ? '#4ade80' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: gremioForm.activa ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
            <span style={{ fontSize: 13, color: gremioForm.activa ? '#4ade80' : C.muted }}>{gremioForm.activa ? 'Regla activa' : 'Regla inactiva'}</span>
          </div>
          {gremioForm.comisionFija > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 12, color: C.muted }}>
              <strong style={{ color: '#fb923c' }}>Vista previa:</strong> Orden Gremio con
              {gremioForm.modelo ? <strong style={{ color: '#1D1D1F' }}> {gremioForm.modelo}</strong> : ' cualquier modelo'}
              {' '}+{' '}
              {gremioForm.tipoReparacion ? <strong style={{ color: '#1D1D1F' }}>{gremioForm.tipoReparacion}</strong> : 'cualquier reparación'}
              {' '}→ comisión fija de <strong style={{ color: COLOR }}>{fmtARS(gremioForm.comisionFija)}</strong> para el técnico asignado.
            </div>
          )}
        </Modal>
      )}

      {/* Modal CF */}
      {reglaModal && (
        <Modal title={reglaModal === 'new' ? 'Nueva regla de comisión' : 'Editar regla'} onClose={() => setReglaModal(false)} onSubmit={saveRegla} submitting={reglaSaving} submitColor="#a78bfa" width={500}>
          <FormGrid cols={2}>
            <Field label="Tipo de comisión" required>
              <select
                value={reglaForm.tipo}
                onChange={e => setReglaForm(prev => ({ ...prev, tipo: e.target.value as TipoReglaComision }))}
                style={{ ...inputSt, cursor: 'pointer' }}
              >
                <option value="reparacion">Reparación (CF)</option>
                <option value="accesorio">Accesorio (CF)</option>
              </select>
            </Field>
            <Field label="Empleado" required>
              <SearchableSelect
                value={reglaForm.empleado}
                onChange={v => setReglaForm(prev => ({ ...prev, empleado: v as Empleado }))}
                options={[...EMPLEADOS_LIST]}
                placeholder="Seleccionar empleado..."
              />
            </Field>
            <Field label="Porcentaje (%)">
              <input
                type="number" min={0} max={100} step={0.5}
                value={reglaForm.porcentaje}
                onChange={e => setReglaForm(prev => ({ ...prev, porcentaje: parseFloat(e.target.value) || 0 }))}
                style={inputSt}
              />
            </Field>
            <Field label="Comisión fija (0 = usar %)">
              <input
                type="number" min={0}
                value={reglaForm.comisionFija}
                onChange={e => setReglaForm(prev => ({ ...prev, comisionFija: parseFloat(e.target.value) || 0 }))}
                placeholder="0 = calcular por %"
                style={inputSt}
              />
            </Field>
          </FormGrid>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={() => setReglaForm(prev => ({ ...prev, activa: !prev.activa }))}
              style={{ width: 36, height: 20, borderRadius: 10, background: reglaForm.activa ? '#4ade80' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 2, left: reglaForm.activa ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
            <span style={{ fontSize: 13, color: reglaForm.activa ? '#4ade80' : C.muted }}>{reglaForm.activa ? 'Regla activa' : 'Regla inactiva'}</span>
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 12, color: C.muted }}>
            <strong style={{ color: '#a78bfa' }}>Vista previa:</strong> Por cada orden CF con ítems de <strong>{TIPO_REGLA_LABELS[reglaForm.tipo]}</strong>, se generará una comisión de{' '}
            {reglaForm.comisionFija > 0
              ? <strong style={{ color: COLOR }}>{fmtARS(reglaForm.comisionFija)} fijos</strong>
              : <strong style={{ color: COLOR }}>{reglaForm.porcentaje}% del subtotal</strong>
            } para <strong style={{ color: COLOR }}>{reglaForm.empleado}</strong>.
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Panel: Pestañas de Órdenes de Trabajo ────────────────────────────────────
export function OrdenesEstadosPanel({ onBack, backLabel = '← Volver a Configuración' }: { onBack: () => void; backLabel?: string }) {
  const [activeTab, setActiveTab] = useState<'estados' | 'terminos' | 'garantia' | 'whatsapp' | 'backup'>('estados')

  const [estados, setEstados] = useState<string[]>([])
  const [nuevo, setNuevo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Renaming
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Nombre del negocio
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [nombreSaving, setNombreSaving] = useState(false)
  const [nombreSaved, setNombreSaved] = useState(false)

  // Logo
  const [logoBase64, setLogoBase64] = useState('')
  const [logoLoading, setLogoLoading] = useState(true)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoSaved, setLogoSaved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Términos
  const [terminos, setTerminos] = useState('')
  const [terminosLoading, setTerminosLoading] = useState(true)
  const [terminosSaving, setTerminosSaving] = useState(false)
  const [terminosSaved, setTerminosSaved] = useState(false)

  // Garantía comprobante de retiro
  const [garantia, setGarantia] = useState('')
  const [garantiaLoading, setGarantiaLoading] = useState(true)
  const [garantiaSaving, setGarantiaSaving] = useState(false)
  const [garantiaSaved, setGarantiaSaved] = useState(false)

  // Días de garantía por defecto
  const [diasGarantiaDefault, setDiasGarantiaDefault] = useState(90)
  const [diasGarantiaSaving, setDiasGarantiaSaving] = useState(false)
  const [diasGarantiaSaved, setDiasGarantiaSaved] = useState(false)

  // Mensajes WhatsApp
  const [waMensajes, setWaMensajes] = useState<Record<string, string>>({})
  const [waLoading, setWaLoading] = useState(true)
  const [waSaving, setWaSaving] = useState(false)
  const [waSaved, setWaSaved] = useState(false)

  useEffect(() => {
    fetch('/api/sistema/estados-orden')
      .then(r => r.json())
      .then((d: string[]) => { setEstados(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/sistema/negocio')
      .then(r => r.json())
      .then((d: { nombre: string }) => setNombreNegocio(d.nombre ?? ''))
      .catch(() => {})
    fetch('/api/sistema/logo')
      .then(r => r.json())
      .then((d: { logo: string }) => { setLogoBase64(d.logo ?? ''); setLogoLoading(false) })
      .catch(() => setLogoLoading(false))
    fetch('/api/sistema/terminos')
      .then(r => r.json())
      .then((d: { terminos: string }) => { setTerminos(d.terminos ?? ''); setTerminosLoading(false) })
      .catch(() => setTerminosLoading(false))
    fetch('/api/sistema/garantia-retiro')
      .then(r => r.json())
      .then((d: { garantia: string }) => { setGarantia(d.garantia ?? ''); setGarantiaLoading(false) })
      .catch(() => setGarantiaLoading(false))
    fetch('/api/sistema/dias-garantia')
      .then(r => r.json())
      .then((d: { dias: number }) => { setDiasGarantiaDefault(d.dias ?? 90) })
      .catch(() => {})
    fetch('/api/sistema/wa-mensajes')
      .then(r => r.json())
      .then((d: Record<string, string>) => { setWaMensajes(d); setWaLoading(false) })
      .catch(() => setWaLoading(false))
  }, [])

  // ── Nombre del negocio ────────────────────────────────────────────────────
  const handleSaveNombre = async () => {
    setNombreSaving(true)
    try {
      await fetch('/api/sistema/negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNegocio }),
      })
      setNombreSaved(true)
      setTimeout(() => setNombreSaved(false), 2500)
    } finally {
      setNombreSaving(false)
    }
  }

  // ── Logo ──────────────────────────────────────────────────────────────────
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      alert('El archivo es muy grande. El logo debe ser menor a 500 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setLogoBase64(ev.target?.result as string)
      setLogoSaved(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveLogo = async () => {
    setLogoSaving(true)
    try {
      await fetch('/api/sistema/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: logoBase64 }),
      })
      setLogoSaved(true)
      setTimeout(() => setLogoSaved(false), 2500)
    } finally {
      setLogoSaving(false)
    }
  }

  const handleRemoveLogo = async () => {
    setLogoBase64('')
    setLogoSaving(true)
    try {
      await fetch('/api/sistema/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: '' }),
      })
      setLogoSaved(true)
      setTimeout(() => setLogoSaved(false), 1500)
    } finally {
      setLogoSaving(false)
    }
  }

  // ── Estados ───────────────────────────────────────────────────────────────
  const agregarEstado = () => {
    const nombre = nuevo.trim()
    if (!nombre || estados.includes(nombre)) return
    const idx = estados.indexOf('Salida')
    const next = [...estados]
    next.splice(idx === -1 ? next.length : idx, 0, nombre)
    setEstados(next)
    setNuevo('')
    setSaved(false)
  }

  const eliminarEstado = (nombre: string) => {
    if (ESTADOS_PROTEGIDOS.includes(nombre)) return
    setEstados(prev => prev.filter(e => e !== nombre))
    setSaved(false)
  }

  const startRename = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(estados[idx])
  }

  const confirmRename = () => {
    if (editingIdx === null) return
    const trimmed = editValue.trim()
    if (!trimmed) { setEditingIdx(null); return }
    if (trimmed !== estados[editingIdx] && estados.includes(trimmed)) {
      alert('Ya existe una etapa con ese nombre.')
      return
    }
    const next = [...estados]
    next[editingIdx] = trimmed
    setEstados(next)
    setEditingIdx(null)
    setSaved(false)
  }

  const cancelRename = () => setEditingIdx(null)

  const moverArriba = (idx: number) => {
    if (idx <= 1) return
    const next = [...estados]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setEstados(next)
    setSaved(false)
  }

  const moverAbajo = (idx: number) => {
    if (idx >= estados.length - 2) return
    const next = [...estados]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setEstados(next)
    setSaved(false)
  }

  const guardar = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sistema/estados-orden', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estados),
      })
      const updated: string[] = await res.json()
      setEstados(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const guardarTerminos = async () => {
    setTerminosSaving(true)
    try {
      await fetch('/api/sistema/terminos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminos }),
      })
      setTerminosSaved(true)
      setTimeout(() => setTerminosSaved(false), 2500)
    } finally {
      setTerminosSaving(false)
    }
  }

  const guardarGarantia = async () => {
    setGarantiaSaving(true)
    try {
      await fetch('/api/sistema/garantia-retiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garantia }),
      })
      setGarantiaSaved(true)
      setTimeout(() => setGarantiaSaved(false), 2500)
    } finally {
      setGarantiaSaving(false)
    }
  }

  const guardarDiasGarantia = async () => {
    setDiasGarantiaSaving(true)
    try {
      await fetch('/api/sistema/dias-garantia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: diasGarantiaDefault }),
      })
      setDiasGarantiaSaved(true)
      setTimeout(() => setDiasGarantiaSaved(false), 2500)
    } finally {
      setDiasGarantiaSaving(false)
    }
  }

  const guardarWaMensajes = async () => {
    setWaSaving(true)
    try {
      const res = await fetch('/api/sistema/wa-mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waMensajes),
      })
      const updated: Record<string, string> = await res.json()
      setWaMensajes(updated)
      setWaSaved(true)
      setTimeout(() => setWaSaved(false), 2500)
    } finally {
      setWaSaving(false)
    }
  }

  return (
    <div style={{ padding: '0 0 48px' }}>

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24,
          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'none', color: '#6E6E73', fontSize: 13, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#1D1D1F'; e.currentTarget.style.borderColor = '#6E6E73' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6E6E73'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >{backLabel}</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🗂</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>Órdenes de trabajo</h2>
        </div>
        {activeTab === 'estados' && (
          <button
            onClick={guardar}
            disabled={saving || loading}
            style={{
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: saved ? '#4ade80' : COLOR,
              color: '#FFFFFF', fontWeight: 700, fontSize: 13,
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'all 0.15s', minWidth: 140,
            }}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
        {activeTab === 'terminos' && (
          <button
            onClick={guardarTerminos}
            disabled={terminosSaving || terminosLoading}
            style={{
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: terminosSaved ? '#4ade80' : COLOR,
              color: '#FFFFFF', fontWeight: 700, fontSize: 13,
              cursor: (terminosSaving || terminosLoading) ? 'not-allowed' : 'pointer',
              opacity: terminosSaving ? 0.7 : 1, transition: 'all 0.15s', minWidth: 140,
            }}
          >
            {terminosSaved ? '✓ Guardado' : terminosSaving ? 'Guardando…' : 'Guardar términos'}
          </button>
        )}
        {activeTab === 'garantia' && (
          <button
            onClick={guardarGarantia}
            disabled={garantiaSaving || garantiaLoading}
            style={{
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: garantiaSaved ? '#4ade80' : COLOR,
              color: '#FFFFFF', fontWeight: 700, fontSize: 13,
              cursor: (garantiaSaving || garantiaLoading) ? 'not-allowed' : 'pointer',
              opacity: garantiaSaving ? 0.7 : 1, transition: 'all 0.15s', minWidth: 160,
            }}
          >
            {garantiaSaved ? '✓ Guardado' : garantiaSaving ? 'Guardando…' : 'Guardar garantía'}
          </button>
        )}
        {activeTab === 'whatsapp' && (
          <button
            onClick={guardarWaMensajes}
            disabled={waSaving || waLoading}
            style={{
              padding: '9px 22px', borderRadius: 9, border: 'none',
              background: waSaved ? '#4ade80' : '#25d366',
              color: '#FFFFFF', fontWeight: 700, fontSize: 13,
              cursor: (waSaving || waLoading) ? 'not-allowed' : 'pointer',
              opacity: waSaving ? 0.7 : 1, transition: 'all 0.15s', minWidth: 160,
            }}
          >
            {waSaved ? '✓ Guardado' : waSaving ? 'Guardando…' : '💾 Guardar mensajes'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { id: 'estados',   label: '⚙ Etapas del flujo' },
          { id: 'terminos',  label: '📋 Garantía de recepción' },
          { id: 'garantia',  label: '🧾 Garantía de comprobante' },
          { id: 'whatsapp',  label: '💬 Mensajes WhatsApp' },
          { id: 'backup',    label: '💾 Backup' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', border: '1px solid var(--border)',
              borderBottom: activeTab === tab.id ? '1px solid var(--bg, #111)' : '1px solid var(--border)',
              background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
              color: activeTab === tab.id ? '#1D1D1F' : '#6E6E73',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════ TAB: TÉRMINOS ════════════════ */}
      {activeTab === 'terminos' && (
        <div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 20 }}>
            Este texto se imprime al pie de cada orden de servicio al momento de la recepción. Podés editarlo libremente.
          </div>
          {terminosLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6E6E73', fontSize: 13 }}>Cargando…</div>
          ) : (
            <>
              <textarea
                value={terminos}
                onChange={e => { setTerminos(e.target.value); setTerminosSaved(false) }}
                rows={16}
                style={{
                  width: '100%', padding: '14px 16px',
                  border: '1px solid var(--border)', borderRadius: 10,
                  background: 'var(--surface)', color: '#1D1D1F',
                  fontSize: 12, lineHeight: 1.7, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                placeholder="Ingresá los términos y condiciones de garantía…"
              />
              <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 8 }}>
                {terminos.length} caracteres · Se mostrará con letra pequeña al pie de la impresión
              </div>

              {/* Preview */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Vista previa (tamaño real en impresión)
                </div>
                <div style={{
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>
                    Términos y condiciones
                  </div>
                  <div style={{ fontSize: 8, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {terminos || '(sin términos cargados)'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════ TAB: GARANTÍA DE COMPROBANTE ════════════════ */}
      {activeTab === 'garantia' && (
        <div>
          {/* Días de garantía por defecto */}
          <div style={{
            marginBottom: 24, padding: '16px 18px', borderRadius: 12,
            background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E5E3', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
              🛡️ Días de garantía por defecto
            </div>
            <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 14, lineHeight: 1.5 }}>
              Cantidad de días que se asigna automáticamente al entregar un equipo con garantía.<br />
              Podés modificarlo por orden desde el panel de entrega.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                min={1} max={3650}
                value={diasGarantiaDefault}
                onChange={e => { setDiasGarantiaDefault(Math.max(1, Math.min(3650, parseInt(e.target.value) || 1))); setDiasGarantiaSaved(false) }}
                style={{
                  width: 100, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: '#E5E5E3', fontSize: 15, fontWeight: 700,
                  outline: 'none', textAlign: 'center',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <span style={{ fontSize: 13, color: '#6E6E73' }}>días</span>
              <button
                onClick={guardarDiasGarantia}
                disabled={diasGarantiaSaving}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: diasGarantiaSaved ? '#4ade80' : COLOR,
                  color: diasGarantiaSaved ? '#000' : '#fff',
                  fontWeight: 700, fontSize: 13,
                  cursor: diasGarantiaSaving ? 'not-allowed' : 'pointer',
                  opacity: diasGarantiaSaving ? 0.7 : 1, transition: 'all 0.15s',
                }}
              >
                {diasGarantiaSaved ? '✓ Guardado' : diasGarantiaSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 20, lineHeight: 1.6 }}>
            Este texto se imprime al pie del <strong style={{ color: '#1D1D1F' }}>Comprobante de Retiro de Equipo</strong>.<br />
            Podés editarlo libremente para reflejar las condiciones de garantía del servicio.
          </div>
          {garantiaLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6E6E73', fontSize: 13 }}>Cargando…</div>
          ) : (
            <>
              <textarea
                value={garantia}
                onChange={e => { setGarantia(e.target.value); setGarantiaSaved(false) }}
                rows={14}
                style={{
                  width: '100%', padding: '14px 16px',
                  border: '1px solid var(--border)', borderRadius: 10,
                  background: 'var(--surface)', color: '#1D1D1F',
                  fontSize: 12, lineHeight: 1.7, resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = COLOR)}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                placeholder="Ingresá las condiciones de garantía del comprobante de retiro…"
              />
              <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 8 }}>
                {garantia.length} caracteres · Se mostrará al pie del comprobante de retiro
              </div>
              {/* Preview */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Vista previa (tamaño real en impresión)
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, borderBottom: '1.5px solid #222', paddingBottom: 3 }}>
                    Condiciones de garantía
                  </div>
                  <div style={{ fontSize: 8, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {garantia || '(sin texto de garantía cargado)'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════ TAB: WHATSAPP ════════════════ */}
      {activeTab === 'whatsapp' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Editá el mensaje que se pre-carga al notificar a un cliente por WhatsApp según el estado de su orden.<br />
            Podés usar las variables <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{'{nombre}'}</code>{' '}
            <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{'{modelo}'}</code>{' '}
            <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{'{nOrden}'}</code>{' '}
            que se reemplazan automáticamente.
          </div>
          {waLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Cargando…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {estados.map(estado => (
                <div key={estado} style={{
                  padding: '16px 18px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)',
                      fontSize: 12, fontWeight: 700, color: '#25d366',
                    }}>💬 {estado}</span>
                    <button
                      onClick={() => {
                        // Reset to default
                        const defaults: Record<string, string> = {
                          'Entrada':               'Hola {nombre} 👋 Tu {modelo} (orden #{nOrden}) ingresó al taller Microsmart. Te avisamos cuando esté listo.',
                          'Técnico Saddi':         'Hola {nombre} 🔧 Tu {modelo} (orden #{nOrden}) está siendo revisado por nuestro técnico. Pronto te tenemos novedades.',
                          'Laboratorio':           'Hola {nombre} 🔬 Tu {modelo} (orden #{nOrden}) está en laboratorio para diagnóstico avanzado.',
                          'Salida de laboratorio': 'Hola {nombre} ✅ Tu {modelo} (orden #{nOrden}) salió del laboratorio y está siendo preparado para la entrega.',
                          'Salida':                'Hola {nombre} 🎉 ¡Buenas noticias! Tu {modelo} (orden #{nOrden}) está LISTO para retirar. Te esperamos en el local. ¡Gracias por elegirnos!',
                          'Entregado':             'Hola {nombre} 😊 Tu {modelo} fue entregado. ¡Gracias por confiar en Microsmart! Ante cualquier consulta, estamos a tu disposición.',
                        }
                        if (defaults[estado]) {
                          setWaMensajes(prev => ({ ...prev, [estado]: defaults[estado] }))
                          setWaSaved(false)
                        }
                      }}
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface2)',
                        color: 'var(--text-secondary)', marginLeft: 'auto',
                      }}
                    >↺ Restaurar predeterminado</button>
                  </div>
                  <textarea
                    value={waMensajes[estado] ?? ''}
                    onChange={e => { setWaMensajes(prev => ({ ...prev, [estado]: e.target.value })); setWaSaved(false) }}
                    rows={3}
                    placeholder={`Mensaje para estado "${estado}"…`}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5,
                      resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#25d366')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                  {waMensajes[estado] && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#25d366', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vista previa · </span>
                      {waMensajes[estado]
                        .replace(/{nombre}/g, 'Juan')
                        .replace(/{modelo}/g, 'iPhone 14')
                        .replace(/{nOrden}/g, '0042')
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB: ESTADOS ════════════════ */}
      {activeTab === 'estados' && <>

      {/* ── LOGO SECTION ── */}
      <div style={{
        marginBottom: 28, padding: '18px 20px', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          🏢 Nombre del negocio
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
          Se usa como texto de respaldo cuando no hay logo cargado (en órdenes, etiquetas y presupuestos).
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 420 }}>
          <input
            value={nombreNegocio}
            onChange={e => { setNombreNegocio(e.target.value); setNombreSaved(false) }}
            placeholder="Ej: Reparaciones El Centro"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
            onKeyDown={e => e.key === 'Enter' && handleSaveNombre()}
          />
          <button
            onClick={handleSaveNombre}
            disabled={nombreSaving}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: nombreSaved ? '#4ade80' : COLOR,
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: nombreSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {nombreSaved ? '✓ Guardado' : nombreSaving ? 'Guardando…' : nombreNegocio ? 'Modificar' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Logo ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>
          🖼 Logo para impresión
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
          Este logo se mostrará en la cabecera al imprimir una orden de servicio.<br />
          <strong style={{ color: '#6E6E73' }}>Recomendado:</strong> PNG o SVG con fondo transparente · Máx. 400×120 px · Menos de 500 KB
        </div>

        {logoLoading ? (
          <div style={{ fontSize: 12, color: '#6E6E73', padding: '12px 0' }}>Cargando…</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Preview */}
            <div style={{
              width: 200, height: 70, borderRadius: 8,
              border: '1.5px dashed var(--border)',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {logoBase64 ? (
                <img src={logoBase64} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: 8 }}>Sin logo<br />Se mostrará texto</span>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{
                    padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: '#1D1D1F',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📂 Elegir imagen
                </button>
                <button
                  onClick={handleSaveLogo}
                  disabled={logoSaving || !logoBase64}
                  style={{
                    padding: '7px 16px', borderRadius: 7, border: 'none',
                    background: logoSaved ? '#4ade80' : logoBase64 ? COLOR : 'var(--surface2)',
                    color: (logoSaved || logoBase64) ? '#FFFFFF' : '#6E6E73',
                    fontSize: 12, fontWeight: 700, cursor: (logoSaving || !logoBase64) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {logoSaved ? '✓ Guardado' : logoSaving ? 'Guardando…' : 'Guardar logo'}
                </button>
                {logoBase64 && (
                  <button
                    onClick={handleRemoveLogo}
                    style={{
                      padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ✕ Quitar
                  </button>
                )}
              </div>
              {!logoBase64 && (
                <div style={{ fontSize: 11, color: '#6E6E73' }}>
                  Sin logo: la impresión mostrará el nombre del negocio como texto.
                </div>
              )}
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              style={{ display: 'none' }}
              onChange={handleLogoFile}
            />
          </div>
        )}
      </div>

      {/* Aviso estados protegidos */}
      <div style={{
        marginBottom: 24, padding: '10px 14px', borderRadius: 8,
        background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#60a5fa',
      }}>
        <span>🔒</span>
        <span><strong>Entrada</strong> y <strong>Salida</strong> son fijos: no se pueden eliminar ni renombrar. Las etapas intermedias se pueden agregar, eliminar, reordenar y renombrar.</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6E6E73', fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          {/* Lista de estados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {estados.map((estado, idx) => {
              const isProtected = ESTADOS_PROTEGIDOS.includes(estado)
              const isLast = idx === estados.length - 1
              const isSecondToLast = idx === estados.length - 2
              const isEditing = editingIdx === idx

              return (
                <div
                  key={`${estado}-${idx}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 10,
                    background: isProtected ? 'rgba(96,165,250,0.06)' : isEditing ? 'rgba(245,158,11,0.06)' : 'var(--surface)',
                    border: `1px solid ${isProtected ? 'rgba(96,165,250,0.25)' : isEditing ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
                  }}
                >
                  {/* Index */}
                  <span style={{ fontSize: 11, color: '#6E6E73', fontWeight: 700, minWidth: 20, textAlign: 'center', fontFamily: 'monospace' }}>
                    {idx + 1}
                  </span>

                  {/* Nombre / Editor */}
                  {isEditing ? (
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') cancelRename() }}
                      autoFocus
                      style={{ ...inputSt, flex: 1, fontSize: 13, fontWeight: 600, height: 32, padding: '4px 10px' }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isProtected ? '#60a5fa' : '#1D1D1F' }}>
                      {estado}
                    </span>
                  )}

                  {/* Badge protegido */}
                  {isProtected && !isEditing && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 700 }}>
                      FIJO
                    </span>
                  )}

                  {/* Confirm/cancel when editing */}
                  {isEditing && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={confirmRename}
                        title="Confirmar"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(74,222,128,0.4)',
                          background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                          cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >✓</button>
                      <button
                        onClick={cancelRename}
                        title="Cancelar"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--surface2)', color: '#6E6E73',
                          cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >✕</button>
                    </div>
                  )}

                  {/* Controles normales (no en modo edición) */}
                  {!isProtected && !isEditing && (
                    <>
                      {/* Botón renombrar */}
                      <button
                        onClick={() => startRename(idx)}
                        title="Renombrar"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--surface2)', color: '#6E6E73',
                          cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = COLOR; e.currentTarget.style.borderColor = COLOR }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6E6E73'; e.currentTarget.style.borderColor = 'var(--border)' }}
                      >✏</button>

                      {/* Controles de orden */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => moverArriba(idx)}
                          disabled={idx <= 1}
                          title="Mover arriba"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                            background: 'var(--surface2)', color: idx <= 1 ? '#444' : '#6E6E73',
                            cursor: idx <= 1 ? 'default' : 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >▲</button>
                        <button
                          onClick={() => moverAbajo(idx)}
                          disabled={isSecondToLast || isLast}
                          title="Mover abajo"
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                            background: 'var(--surface2)', color: (isSecondToLast || isLast) ? '#444' : '#6E6E73',
                            cursor: (isSecondToLast || isLast) ? 'default' : 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >▼</button>
                      </div>

                      {/* Botón eliminar */}
                      <button
                        onClick={() => eliminarEstado(estado)}
                        title="Eliminar etapa"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                          background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                          cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}
                      >✕</button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Agregar nueva etapa */}
          <div style={{
            padding: '16px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6E6E73', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              + Agregar etapa
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={nuevo}
                onChange={e => setNuevo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregarEstado()}
                placeholder="Nombre de la etapa (ej: Técnico Rony, Control de calidad…)"
                style={{ ...inputSt, flex: 1 }}
              />
              <button
                onClick={agregarEstado}
                disabled={!nuevo.trim() || estados.includes(nuevo.trim())}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: !nuevo.trim() || estados.includes(nuevo.trim()) ? 'var(--surface2)' : COLOR,
                  color: !nuevo.trim() || estados.includes(nuevo.trim()) ? '#6E6E73' : '#FFFFFF',
                  fontWeight: 700, fontSize: 13, cursor: !nuevo.trim() || estados.includes(nuevo.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}
              >
                Agregar
              </button>
            </div>
            {nuevo.trim() && estados.includes(nuevo.trim()) && (
              <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>Ya existe una etapa con ese nombre.</div>
            )}
          </div>

          {/* Preview del flujo */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Vista previa del flujo
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {estados.map((e, i) => (
                <div key={`${e}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: ESTADOS_PROTEGIDOS.includes(e) ? 'rgba(96,165,250,0.15)' : 'rgba(245,158,11,0.12)',
                    color: ESTADOS_PROTEGIDOS.includes(e) ? '#60a5fa' : COLOR,
                    border: `1px solid ${ESTADOS_PROTEGIDOS.includes(e) ? 'rgba(96,165,250,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}>{e}</span>
                  {i < estados.length - 1 && <span style={{ color: '#6E6E73', fontSize: 12 }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      </> /* end activeTab === 'estados' */}

      {/* ════════════════ TAB: BACKUP ════════════════ */}
      {activeTab === 'backup' && (
        <BackupView />
      )}
    </div>
  )
}

// ─── Main ConfiguracionView ───────────────────────────────────────────────────
export default function ConfiguracionView({
  onBack,
  onModulosChange,
  onModulosSaved,
}: {
  onBack?: () => void
  onModulosChange?: (config: Record<string, boolean>) => void
  onModulosSaved?: (config: Record<string, boolean>) => void
}) {
  const [config, setConfig] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [subPanel, setSubPanel] = useState<null>(null)

  // ── Nombre del negocio ──────────────────────────────────────────────────────
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [nombreSaving, setNombreSaving] = useState(false)
  const [nombreSaved, setNombreSaved] = useState(false)

  useEffect(() => {
    fetch('/api/sistema/negocio')
      .then(r => r.json())
      .then((d: { nombre: string }) => setNombreNegocio(d.nombre ?? ''))
      .catch(() => {})
  }, [])

  const handleSaveNombre = async () => {
    setNombreSaving(true)
    try {
      await fetch('/api/sistema/negocio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNegocio }),
      })
      setNombreSaved(true)
      setTimeout(() => setNombreSaved(false), 2500)
    } finally { setNombreSaving(false) }
  }

  useEffect(() => {
    fetch('/api/sistema/modulos', { cache: 'no-store' }).then(r => r.json()).then(setConfig).catch(() => {})
  }, [])

  const toggle = (id: string) => {
    if (!config) return
    const next = { ...config, [id]: !config[id] }
    setConfig(next)
    onModulosChange?.(next)   // ← fuera del updater para evitar doble ejecución en Strict Mode
    setSaved(false)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch('/api/sistema/modulos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onModulosSaved?.(config)
    } finally { setSaving(false) }
  }

  const herramientas = MODULOS.filter(m => m.group === 'herramientas')
  const gestion = MODULOS.filter(m => m.group === 'gestion')
  const contable = MODULOS.filter(m => m.group === 'contable')

  const enabledCount = config ? Object.values(config).filter(Boolean).length : 0
  const totalCount = MODULOS.length

  return (
    <div style={{ padding: '0 0 48px' }}>

      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24,
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'none', color: '#6E6E73', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#1D1D1F'; e.currentTarget.style.borderColor = '#6E6E73' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6E6E73'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >← Volver</button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🧩</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1D1D1F', margin: 0 }}>Configuración del Sistema</h2>
          </div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginLeft: 34 }}>
            {config ? `${enabledCount} de ${totalCount} módulos activos` : 'Cargando…'}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={save}
          disabled={!config || saving}
          style={{
            padding: '9px 22px', borderRadius: 9, border: 'none',
            background: saved ? '#4ade80' : COLOR,
            color: '#FFFFFF', fontWeight: 700, fontSize: 13,
            cursor: !config || saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
            minWidth: 140,
          }}
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {/* Protected notice */}
      <div style={{
        marginBottom: 24, padding: '10px 14px', borderRadius: 8,
        background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#60a5fa',
      }}>
        <span>🔒</span>
        <span>Los módulos <strong>Inicio</strong>, <strong>Listas de precio</strong> y <strong>Proveedores</strong> siempre están activos. <strong>Gremio</strong> y <strong>Consumidor Final</strong> son sub-pestañas dentro de Listas de precio y se controlan desde Usuarios.</span>
      </div>

      {config && (
        <>
          {/* Section: Herramientas */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              📊 Herramientas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {herramientas.map(m => (
                <ModuloCard key={m.id} modulo={m} enabled={config[m.id] ?? true} onToggle={() => toggle(m.id)} />
              ))}
            </div>
          </div>

          {/* Section: Gestión */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              ⚙️ Gestión del negocio
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {gestion.map(m => (
                <ModuloCard
                  key={m.id}
                  modulo={m}
                  enabled={config[m.id] ?? true}
                  onToggle={() => toggle(m.id)}
                  onSettings={undefined}
                />
              ))}
            </div>
          </div>

          {/* Section: Administración contable */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              📒 Administración contable
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {contable.map(m => (
                <ModuloCard
                  key={m.id}
                  modulo={m}
                  enabled={config[m.id] ?? true}
                  onToggle={() => toggle(m.id)}
                  onSettings={undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {!config && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6E6E73', fontSize: 13 }}>Cargando configuración…</div>
      )}

      {/* ── Nombre del negocio ───────────────────────────────────────────── */}
      <div style={{
        marginTop: 32, marginBottom: 24, padding: '18px 20px', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          🏢 Nombre del negocio
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
          Aparece en órdenes, etiquetas y presupuestos cuando no hay logo cargado.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 440 }}>
          <input
            value={nombreNegocio}
            onChange={e => { setNombreNegocio(e.target.value); setNombreSaved(false) }}
            placeholder="Ej: Reparaciones El Centro"
            onKeyDown={e => e.key === 'Enter' && handleSaveNombre()}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={handleSaveNombre}
            disabled={nombreSaving}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: nombreSaved ? '#4ade80' : COLOR,
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: nombreSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {nombreSaved ? '✓ Guardado' : nombreSaving ? 'Guardando…' : nombreNegocio ? 'Modificar' : 'Guardar'}
          </button>
        </div>
      </div>

    </div>
  )
}

function BackupSection() {
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  const descargarBackup = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/sistema/backup')
      if (!res.ok) throw new Error('Error al generar el backup')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-')
      a.href = url
      a.download = `microsmart-backup-${fecha}-${hora}.json`
      a.click()
      URL.revokeObjectURL(url)
      setLastBackup(new Date().toLocaleString('es-AR'))
    } catch (e) {
      alert(`Error: ${String(e)}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        💾 Backup de datos
      </div>
      <div style={{
        padding: '20px 22px', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          💾
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>Respaldo manual de todos los datos</div>
          <div style={{ fontSize: 12, color: '#6E6E73', lineHeight: 1.5 }}>
            Descarga un archivo <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>.json</code> con todas las órdenes, clientes, stock, ventas, presupuestos y configuración. Guardalo en Google Drive o un disco externo.
          </div>
          {lastBackup && (
            <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4, fontWeight: 600 }}>
              ✓ Último backup: {lastBackup}
            </div>
          )}
        </div>
        <button
          onClick={descargarBackup}
          disabled={downloading}
          style={{
            padding: '10px 22px', borderRadius: 9, border: 'none', cursor: downloading ? 'not-allowed' : 'pointer',
            background: downloading ? 'var(--surface2)' : 'linear-gradient(135deg, #818cf8, #6366f1)',
            color: downloading ? '#6E6E73' : '#fff', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            boxShadow: downloading ? 'none' : '0 2px 8px rgba(99,102,241,0.35)',
            transition: 'all 0.15s',
          }}
        >
          {downloading
            ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#888', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generando…</>
            : <><span>⬇️</span> Descargar backup</>
          }
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#6E6E73', paddingLeft: 4 }}>
        💡 <strong>Recomendación:</strong> realizá un backup semanal y guardalo en la nube. El archivo incluye todos los datos del sistema.
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ModuloCard({ modulo, enabled, onToggle, onSettings }: {
  modulo: ModuloMeta
  enabled: boolean
  onToggle: () => void
  onSettings?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 10,
      background: enabled ? 'var(--surface)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${enabled ? 'var(--border)' : 'rgba(0,0,0,0.04)'}`,
      transition: 'all 0.15s', opacity: enabled ? 1 : 0.55,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{modulo.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: enabled ? '#1D1D1F' : '#6E6E73', marginBottom: 2 }}>
          {modulo.label}
        </div>
        <div style={{ fontSize: 11, color: '#6E6E73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {modulo.desc}
        </div>
      </div>
      {onSettings && (
        <button
          onClick={e => { e.stopPropagation(); onSettings() }}
          title="Configurar pestañas"
          style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: '#6E6E73', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = COLOR; e.currentTarget.style.borderColor = COLOR }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6E6E73'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >⚙</button>
      )}
      <Toggle enabled={enabled} onClick={onToggle} />
    </div>
  )
}
