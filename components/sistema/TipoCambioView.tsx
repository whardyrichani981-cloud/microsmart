'use client'
import { useState } from 'react'
import type { TipoCambio } from '@/lib/sistema-types'
import { useApi, fmtARS, today, C, Modal, Field, FormGrid, PageHeader, DataTable, KPICard, inputSt, selectSt } from './shared'

const COLOR = '#34d399'

interface ApiResponse { items: TipoCambio[]; actual: number }

const EMPTY: Omit<TipoCambio, 'id'> = {
  fecha: today(),
  valor: 0,
  fuente: 'Blue informal',
  notas: '',
}

export default function TipoCambioView() {
  const { data, loading, refresh } = useApi<ApiResponse>('/api/sistema/tipo-cambio')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<TipoCambio, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  const items = data?.items ?? []
  const actual = data?.actual ?? 0

  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.valor || form.valor <= 0) return alert('Ingresá el valor del dólar')
    setSaving(true)
    await fetch('/api/sistema/tipo-cambio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setOpen(false)
    setForm(EMPTY)
    refresh()
  }

  async function del(row: TipoCambio) {
    await fetch('/api/sistema/tipo-cambio', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    })
    refresh()
  }

  const sorted = [...items].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        icon="💱"
        title="Tipo de Cambio USD/ARS"
        desc="Registro histórico · Usado en todos los cálculos del sistema"
        color={COLOR}
        count={items.length}
        onNew={() => { setForm(EMPTY); setOpen(true) }}
        newLabel="Registrar cotización"
      />

      {/* Current rate highlight */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KPICard
          label="Cotización Actual"
          value={`$ ${actual.toLocaleString('es-AR')}`}
          color={COLOR}
          icon="💱"
          sub="Última registrada"
        />
        <KPICard
          label="Registros Totales"
          value={String(items.length)}
          color={C.blue}
          icon="📋"
        />
        {items.length >= 2 && (() => {
          const s = [...items].sort((a, b) => b.fecha.localeCompare(a.fecha))
          const diff = s[0].valor - s[1].valor
          const pct = ((diff / s[1].valor) * 100).toFixed(1)
          return (
            <KPICard
              label="Variación vs Anterior"
              value={`${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR')}`}
              color={diff >= 0 ? C.red : C.green}
              icon={diff >= 0 ? '📈' : '📉'}
              sub={`${diff >= 0 ? '+' : ''}${pct}%`}
            />
          )
        })()}
      </div>

      <DataTable<TipoCambio>
        accentColor={COLOR}
        data={sorted}
        onDelete={del}
        keyField="id"
        emptyMsg="Sin cotizaciones registradas — agregá la primera"
        cols={[
          { key: 'fecha', label: 'Fecha', width: 120 },
          {
            key: 'valor', label: 'Cotización USD', align: 'right',
            render: r => (
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: COLOR, fontSize: 14 }}>
                {fmtARS(r.valor)}
              </span>
            ),
          },
          { key: 'fuente', label: 'Fuente' },
          { key: 'notas', label: 'Notas', render: r => <span style={{ color: C.muted }}>{r.notas || '—'}</span> },
        ]}
      />

      {open && (
        <Modal title="Registrar Cotización USD" onClose={() => setOpen(false)} onSubmit={save} submitting={saving} submitColor={COLOR} width={440}>
          <FormGrid cols={2}>
            <Field label="Fecha" required>
              <input type="date" style={inputSt} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </Field>
            <Field label="Valor ARS por USD" required>
              <input type="number" style={inputSt} value={form.valor || ''} onChange={e => set('valor', +e.target.value)} placeholder="ej: 1250" />
            </Field>
          </FormGrid>
          <Field label="Fuente">
            <select style={selectSt} value={form.fuente} onChange={e => set('fuente', e.target.value)}>
              {['Blue informal', 'Oficial BNA', 'MEP / Bolsa', 'CCL', 'Cripto', 'Otro'].map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Notas">
            <input style={inputSt} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones opcionales" />
          </Field>
        </Modal>
      )}
    </div>
  )
}
