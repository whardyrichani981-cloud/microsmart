'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { C, inputSt } from './shared'
import type { TelegramConfig, AutoResponderRule, AIKnowledgeSections } from '@/lib/chat-db'

const COLOR = '#4ade80'

interface Session { id: string; visitorName: string; createdAt: string; lastMessageAt: string; open: boolean; unread: number; messageCount: number }
interface ChatMsg { id: string; role: 'user' | 'owner' | 'bot'; text: string; createdAt: string; source?: 'ai' | 'autoresponder' }

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Hace un momento'
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  } catch { return '' }
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Step({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: done ? 14 : 12, fontWeight: 700,
        background: done ? COLOR : active ? `${COLOR}22` : 'var(--surface2)',
        border: `2px solid ${done ? COLOR : active ? COLOR : 'var(--border)'}`,
        color: done ? '#000' : active ? COLOR : 'var(--text-secondary)',
      }}>{done ? '✓' : n}</div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? 'var(--text-primary)' : done ? COLOR : 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

// ─── IA Knowledge Panel ───────────────────────────────────────────────────────
const KNOWLEDGE_SECTIONS: { key: keyof AIKnowledgeSections; icon: string; label: string; desc: string; placeholder: string }[] = [
  {
    key: 'negocio', icon: '🏢', label: 'Tu negocio', desc: 'Nombre, dirección, horarios, contacto, qué hacen',
    placeholder: `Somos Microsmart, servicio técnico especializado en Apple en [ciudad].
Horario: lunes a sábado de 9 a 18 hs.
WhatsApp: +54 9 11 XXXX-XXXX
Dirección: [dirección]
Trabajamos solo con productos Apple: iPhone, iPad, Mac, Apple Watch, AirPods.`,
  },
  {
    key: 'precios', icon: '💰', label: 'Precios y servicios', desc: 'Lista de precios por modelo, combos, garantías',
    placeholder: `PANTALLAS (con garantía 90 días):
- iPhone 15 / 15 Plus: $XXX.000
- iPhone 14 / 14 Plus: $XXX.000
- iPhone 13 / 13 mini: $XXX.000
- iPhone 12: $XXX.000
- iPhone 11: $XXX.000

BATERÍAS (instalada, garantía 90 días):
- iPhone 15 / 14: $XX.000
- iPhone 13 / 12: $XX.000
- iPhone 11 / XR: $XX.000

OTROS:
- Conector carga: desde $XX.000
- Cámara trasera: consultar por modelo
- Face ID: no reparamos (requiere reemplazo de pantalla original)`,
  },
  {
    key: 'tecnico', icon: '🔧', label: 'Conocimiento técnico', desc: 'Diagnósticos, síntomas comunes, soluciones, qué es reparable',
    placeholder: `PANTALLA ROTA:
- Si tiene rayas/no responde al tacto → cambio de pantalla
- Si se ve imagen pero no toca → digitalizador dañado (mismo cambio)
- Si no enciende DESPUÉS de caída → puede ser placa o batería, revisar primero

BATERÍA:
- Si dura poco, se apaga sola o se calienta → cambio de batería
- Verificar en Ajustes → Batería → Estado de la batería (si está por debajo de 80% conviene cambiarla)
- iPhone 14 en adelante: la batería se puede cambiar sin perder el porcentaje mostrado si se hace con equipo profesional

FACE ID / TOUCH ID:
- Face ID roto por caída → casi siempre irrecuperable (está vinculado a pantalla original)
- Touch ID (botón home) → si falla después de cambio de pantalla, puede recalibrarse

NO ENCIENDE:
- Primero probar carga 30 min con cable original
- Si no responde → puede ser batería agotada, conector roto o placa
- Si vibra pero no muestra imagen → problema de pantalla

AGUA:
- El iPhone resistente al agua NO es impermeable indefinidamente
- Si entró agua → apagarlo inmediatamente, no cargarlo, traer al local
- No meter en arroz (mito, no funciona)

ICLOUD BLOQUEADO:
- No desbloqueamos iCloud activation lock
- Solo el dueño original puede quitarlo desde appleid.apple.com`,
  },
  {
    key: 'faq', icon: '❓', label: 'Preguntas frecuentes', desc: 'Las preguntas más comunes y cómo responderlas',
    placeholder: `P: ¿Cuánto tarda la reparación?
R: Pantallas y baterías: 30-60 minutos en el momento. Reparaciones de placa: 2-5 días hábiles. Te avisamos cuando está listo.

P: ¿Tienen garantía?
R: Sí, 90 días en mano de obra y repuestos para todas las reparaciones.

P: ¿Usan repuestos originales?
R: Trabajamos con repuestos de calidad premium (equivalente original). Los originales de Apple solo se consiguen a través de Apple Store a mayor costo.

P: ¿Pueden perder mis datos?
R: En cambio de pantalla/batería los datos no se tocan. En reparaciones de placa o software puede ser necesario un backup previo, te avisamos antes.

P: ¿Cómo sé el modelo de mi iPhone?
R: Ajustes → General → Información → Modelo. O fijate en la parte trasera del equipo.

P: ¿Hacen presupuesto gratis?
R: Sí, el diagnóstico es sin cargo. Si decidís no reparar, no pagás nada.

P: ¿Trabajan con garantía de compra?
R: Sí, si el equipo está en garantía de Apple lo derivamos al Apple Service Provider. Si ya venció, lo reparamos nosotros.`,
  },
  {
    key: 'estilo', icon: '💬', label: 'Cómo hablar', desc: 'Tono, forma de responder, qué decir y qué no',
    placeholder: `TONO:
- Siempre usar "vos" (nunca "usted")
- Directo, amable y sin tecnicismos innecesarios
- Si el cliente está enojado o apurado, priorizar calma y soluciones
- Respuestas cortas (2-4 líneas), sin rodeos

PREGUNTAR SIEMPRE:
- Para dar precio: modelo exacto del equipo (ej: iPhone 13 o iPhone 13 Pro Max → tienen precios distintos)
- Si es urgente o puede esperar

QUÉ NUNCA DECIR:
- No dar precios sin saber el modelo
- No prometer tiempos sin ver el equipo
- No decir "eso no tiene arreglo" sin verlo primero

CUANDO NO SABÉS:
- "Dejame consultarlo y te confirmo en unos minutos"
- "Pasate por el local y lo vemos en el momento"`,
  },
]

function IAKnowledgePanel({
  config, setConfig, showApiKey, setShowApiKey,
  testingAI, aiTestResult, testAI, saving, saved, onSave,
}: {
  config: TelegramConfig
  setConfig: React.Dispatch<React.SetStateAction<TelegramConfig>>
  showApiKey: boolean
  setShowApiKey: (v: boolean | ((v: boolean) => boolean)) => void
  testingAI: boolean
  aiTestResult: { ok: boolean; msg: string } | null
  testAI: () => void
  saving: boolean
  saved: boolean
  onSave: () => void
}) {
  const [activeSection, setActiveSection] = useState<keyof AIKnowledgeSections>('negocio')
  const [testMsg, setTestMsg]   = useState('')
  const [testReply, setTestReply] = useState('')
  const [testing, setTesting]   = useState(false)
  const [showTest, setShowTest] = useState(false)

  const sections = config.aiSections ?? { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' }
  const setSection = (key: keyof AIKnowledgeSections, val: string) =>
    setConfig(c => ({ ...c, aiSections: { ...(c.aiSections ?? { negocio:'',precios:'',tecnico:'',faq:'',estilo:'' }), [key]: val } }))

  const runTest = async () => {
    if (!testMsg.trim() || testing) return
    setTesting(true); setTestReply('')
    try {
      // Compilar todo el conocimiento actual (sin guardar)
      const s = sections
      const knowledge = [
        s.negocio && `## NEGOCIO\n${s.negocio}`,
        s.precios && `## PRECIOS\n${s.precios}`,
        s.tecnico && `## TÉCNICO\n${s.tecnico}`,
        s.faq && `## FAQ\n${s.faq}`,
        s.estilo && `## ESTILO\n${s.estilo}`,
      ].filter(Boolean).join('\n\n')

      const res = await fetch('/api/chat/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMsg, knowledge }),
      })
      const data = await res.json() as { reply?: string; error?: string }
      setTestReply(data.reply ?? data.error ?? 'Sin respuesta')
    } finally { setTesting(false) }
  }

  const currentSec = KNOWLEDGE_SECTIONS.find(s => s.key === activeSection)!
  const hasApiKey = (config.aiProvider ?? 'gemini') === 'gemini' ? !!config.geminiApiKey?.trim() : !!config.anthropicApiKey?.trim()
  const filledSections = KNOWLEDGE_SECTIONS.filter(s => sections[s.key]?.trim()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Configuración IA — compacta en la parte superior */}
      <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>⚙️ Configuración del motor de IA</div>

        {/* Selector proveedor */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([
            { id: 'gemini' as const, label: '✨ Gemini', desc: 'Gratis', color: '#4285f4' },
            { id: 'claude' as const, label: '🧠 Claude', desc: 'De pago', color: '#818cf8' },
          ]).map(p => (
            <button key={p.id} onClick={() => setConfig(c => ({ ...c, aiProvider: p.id }))}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: (config.aiProvider ?? 'gemini') === p.id ? `${p.color}22` : 'var(--surface)',
                color: (config.aiProvider ?? 'gemini') === p.id ? p.color : C.muted,
                outline: (config.aiProvider ?? 'gemini') === p.id ? `2px solid ${p.color}` : '2px solid transparent',
              }}>
              {p.label} <span style={{ fontWeight: 400, fontSize: 11 }}>({p.desc})</span>
            </button>
          ))}
        </div>

        {/* API key */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={(config.aiProvider ?? 'gemini') === 'gemini' ? (config.geminiApiKey ?? '') : (config.anthropicApiKey ?? '')}
            onChange={e => {
              const val = e.target.value
              setConfig(c => (config.aiProvider ?? 'gemini') === 'gemini'
                ? { ...c, geminiApiKey: val }
                : { ...c, anthropicApiKey: val })
            }}
            placeholder={(config.aiProvider ?? 'gemini') === 'gemini' ? 'AIzaSy… (aistudio.google.com → Get API key)' : 'sk-ant-api03-…'}
            style={{ ...inputSt, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={() => setShowApiKey(v => !v)} style={{ padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
            {showApiKey ? '🙈' : '👁'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setConfig(c => ({ ...c, aiEnabled: !c.aiEnabled }))}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: config.aiEnabled ? `${COLOR}22` : 'var(--surface)',
              color: config.aiEnabled ? COLOR : C.muted,
              outline: config.aiEnabled ? `1.5px solid ${COLOR}` : '1.5px solid var(--border)',
            }}>
            {config.aiEnabled ? '✅ IA activada' : '⭕ IA desactivada'}
          </button>
          <button onClick={testAI} disabled={testingAI || !hasApiKey}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: hasApiKey ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, background: '#818cf822', color: '#818cf8', opacity: testingAI ? 0.7 : 1 }}>
            {testingAI ? '⏳…' : '🔌 Verificar key'}
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: COLOR, color: '#000' }}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar todo'}
          </button>
        </div>
        {aiTestResult && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: aiTestResult.ok ? `${COLOR}15` : '#ef444415', color: aiTestResult.ok ? COLOR : '#ef4444', border: `1px solid ${aiTestResult.ok ? COLOR : '#ef4444'}44` }}>
            {aiTestResult.msg}
          </div>
        )}
      </div>

      {/* Base de conocimiento */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>📚 Base de conocimiento</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {filledSections} de {KNOWLEDGE_SECTIONS.length} secciones completadas · Cuanto más info, mejor responde
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Navegación de secciones */}
          <div style={{ width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {KNOWLEDGE_SECTIONS.map(s => {
              const filled = !!sections[s.key]?.trim()
              const active = activeSection === s.key
              return (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: active ? `${COLOR}18` : 'var(--surface2)',
                    borderLeft: active ? `3px solid ${COLOR}` : '3px solid transparent',
                    transition: 'all 0.12s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? COLOR : 'var(--text-primary)' }}>{s.label}</div>
                      {filled && <div style={{ fontSize: 10, color: COLOR, fontWeight: 600 }}>✓ Con info</div>}
                      {!filled && <div style={{ fontSize: 10, color: C.muted }}>Vacío</div>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Editor de la sección activa */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentSec.icon} {currentSec.label}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{currentSec.desc}</div>
            </div>
            <textarea
              value={sections[activeSection] ?? ''}
              onChange={e => setSection(activeSection, e.target.value)}
              rows={18}
              placeholder={currentSec.placeholder}
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.7, fontSize: 13, minHeight: 340 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted }}>
                {sections[activeSection]?.length ?? 0} caracteres
              </span>
              <button onClick={onSave} disabled={saving}
                style={{ padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: COLOR, color: '#000' }}>
                {saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat de prueba */}
      <div style={{ background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowTest(v => !v)}
          style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🧪 Probar la IA</span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>Testea cómo responde antes de activarla con clientes</span>
          </div>
          <span style={{ fontSize: 18, color: C.muted }}>{showTest ? '▲' : '▼'}</span>
        </button>

        {showTest && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!hasApiKey && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#f9731615', color: '#f97316', fontSize: 12, fontWeight: 600 }}>
                ⚠️ Guardá primero una API key válida para poder probar
              </div>
            )}
            {testReply && (
              <div style={{ background: `${COLOR}12`, border: `1px solid ${COLOR}33`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLOR, marginBottom: 6 }}>RESPUESTA DE LA IA:</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{testReply}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
                placeholder='Ej: "cuánto sale cambiar la pantalla de un iPhone 14?" o "mi iPhone no enciende"'
                style={{ ...inputSt, flex: 1 }}
                disabled={!hasApiKey}
              />
              <button onClick={runTest} disabled={testing || !testMsg.trim() || !hasApiKey}
                style={{
                  padding: '0 20px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
                  background: testMsg.trim() && hasApiKey ? COLOR : 'var(--border)',
                  color: testMsg.trim() && hasApiKey ? '#000' : C.muted,
                  cursor: testMsg.trim() && hasApiKey ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}>
                {testing ? '⏳…' : '▶ Probar'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
              💡 El chat de prueba usa la info que escribiste arriba aunque no hayas guardado todavía
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel() {
  const [config, setConfig] = useState<TelegramConfig>({
    botToken: '', chatId: '',
    welcomeMessage: '¡Hola! 👋 ¿En qué podemos ayudarte?',
    offlineMessage: 'Gracias por tu mensaje. Te respondemos a la brevedad.',
    autoResponder: [],
    aiProvider: 'gemini',
    geminiApiKey: '',
    anthropicApiKey: '',
    aiEnabled: false,
    aiKnowledge: '',
    aiSections: { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' },
    gremioListaId: '',
    clientesListaId: '',
    tipoCambio: 0,
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingAI, setTestingAI] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tab, setTab] = useState<'telegram' | 'mensajes' | 'autoresponder' | 'ia'>('telegram')
  const [newRule, setNewRule] = useState<Omit<AutoResponderRule, 'id'>>({ keywords: '', response: '', active: true })
  const [wizardStep, setWizardStep] = useState(1)

  useEffect(() => {
    fetch('/api/chat/config').then(r => r.json()).then((d: TelegramConfig) => {
      setConfig(d)
      if (d.botToken && d.chatId) setWizardStep(4)
      else if (d.botToken) setWizardStep(3)
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/chat/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/chat/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: config.botToken, chatId: config.chatId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) {
        setTestResult({ ok: true, msg: '✅ ¡Funcionó! Revisá tu Telegram, te llegó un mensaje de prueba.' })
        setWizardStep(4)
        save()
      } else {
        setTestResult({ ok: false, msg: `❌ ${data.error ?? 'No se pudo conectar. Verificá el token y el Chat ID.'}` })
      }
    } finally { setTesting(false) }
  }

  const addRule = () => {
    if (!newRule.keywords.trim() || !newRule.response.trim()) return
    const rule: AutoResponderRule = { ...newRule, id: `${Date.now()}` }
    setConfig(c => ({ ...c, autoResponder: [...(c.autoResponder ?? []), rule] }))
    setNewRule({ keywords: '', response: '', active: true })
  }
  const removeRule = (id: string) => setConfig(c => ({ ...c, autoResponder: c.autoResponder.filter(r => r.id !== id) }))

  const testAI = async () => {
    setTestingAI(true); setAiTestResult(null)
    const provider = config.aiProvider ?? 'gemini'
    const apiKey = provider === 'gemini' ? config.geminiApiKey : config.anthropicApiKey
    if (!apiKey?.trim()) { setTestingAI(false); return }
    try {
      const res = await fetch('/api/chat/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testAI: true, aiProvider: provider, geminiApiKey: config.geminiApiKey, anthropicApiKey: config.anthropicApiKey }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      const name = provider === 'gemini' ? 'Gemini' : 'Claude'
      if (data.ok) {
        setAiTestResult({ ok: true, msg: `✅ API key válida. ${name} está listo para responder.` })
        save()
      } else {
        setAiTestResult({ ok: false, msg: `❌ ${data.error ?? 'API key inválida.'}` })
      }
    } finally { setTestingAI(false) }
  }

  const TABS = [
    { id: 'telegram' as const, label: '📱 Telegram' },
    { id: 'ia' as const, label: '🧠 IA & Conocimiento' },
    { id: 'mensajes' as const, label: '💬 Mensajes' },
    { id: 'autoresponder' as const, label: '⚡ Auto-respuestas' },
  ]

  const stepDone = (n: number) => {
    if (n === 1) return true
    if (n === 2) return !!config.botToken
    if (n === 3) return !!config.botToken && !!config.chatId
    if (n === 4) return testResult?.ok === true
    return false
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>⚙️ Configuración del Chat</h2>
        <p style={{ fontSize: 13, color: C.muted }}>Conectá el chat con tu cuenta de Telegram para recibir y responder mensajes.</p>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
            color: tab === t.id ? COLOR : C.muted, fontWeight: tab === t.id ? 700 : 400,
            borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TELEGRAM WIZARD ── */}
      {tab === 'telegram' && (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Left: steps progress */}
          <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { n: 1, label: 'Crear el bot' },
              { n: 2, label: 'Pegar el token' },
              { n: 3, label: 'Obtener Chat ID' },
              { n: 4, label: 'Probar conexión' },
            ].map((s, i, arr) => (
              <div key={s.n}>
                <button
                  onClick={() => setWizardStep(s.n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left' }}
                >
                  <Step n={s.n} label={s.label} done={stepDone(s.n)} active={wizardStep === s.n} />
                </button>
                {i < arr.length - 1 && (
                  <div style={{ width: 2, height: 16, background: stepDone(s.n) ? COLOR : 'var(--border)', marginLeft: 13, marginTop: 2, marginBottom: 2, borderRadius: 2 }} />
                )}
              </div>
            ))}
          </div>

          {/* Right: step content */}
          <div style={{ flex: 1, minWidth: 300, maxWidth: 520 }}>

            {/* STEP 1 */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Paso 1 — Crear tu bot en Telegram
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  El bot es el intermediario: los mensajes del chat te llegan a través de él a tu Telegram personal.
                </p>

                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: '1️⃣', text: <>Abrí Telegram en tu celular o computadora</> },
                    { icon: '2️⃣', text: <>En el buscador escribí <b style={{ color: 'var(--text-primary)' }}>@BotFather</b> y entrá a esa cuenta (tiene una tilde azul ✔)</> },
                    { icon: '3️⃣', text: <>Escribile <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/newbot</code> y mandalo</> },
                    { icon: '4️⃣', text: <>Te va a pedir el <b style={{ color: 'var(--text-primary)' }}>nombre del bot</b> (ej: <i>Microsmart Soporte</i>) y luego el <b style={{ color: 'var(--text-primary)' }}>nombre de usuario</b> (debe terminar en <i>bot</i>, ej: <i>microsmart_bot</i>)</> },
                    { icon: '5️⃣', text: <>Cuando termine, te manda un mensaje con el <b style={{ color: COLOR }}>Token</b> — es un texto largo como <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>1234567890:ABCxyz…</code></> },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setWizardStep(2)}
                  style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, width: 'fit-content' }}
                >Ya tengo el token → Siguiente</button>
              </div>
            )}

            {/* STEP 2 */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Paso 2 — Pegar el Token del bot
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  El token lo manda <b>@BotFather</b> después de crear el bot. Se ve así:
                </p>
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: COLOR, border: `1px solid ${COLOR}33` }}>
                  1234567890:ABCDEFghijklmnopqrstuvwxyz-abc
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6, fontWeight: 700, letterSpacing: '0.05em' }}>
                    PEGÁ EL TOKEN ACÁ
                  </label>
                  <input
                    autoFocus
                    value={config.botToken}
                    onChange={e => setConfig(c => ({ ...c, botToken: e.target.value }))}
                    placeholder="1234567890:ABCDEFghijklmnopqrstuvwxyz"
                    style={{ ...inputSt, fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setWizardStep(1)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>← Atrás</button>
                  <button
                    onClick={() => { save(); setWizardStep(3) }}
                    disabled={!config.botToken.trim()}
                    style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: config.botToken.trim() ? COLOR : 'var(--border)', color: config.botToken.trim() ? '#000' : C.muted, cursor: config.botToken.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}
                  >Guardar y siguiente →</button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Paso 3 — Obtener tu Chat ID
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  El Chat ID es tu número de identificación en Telegram. Los mensajes del chat te llegarán a ese chat.
                </p>

                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: '1️⃣', text: <>En Telegram buscá el bot que creaste (ej: <b style={{ color: 'var(--text-primary)' }}>@microsmart_bot</b>) y mandale <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/start</code></> },
                    {
                      icon: '2️⃣', text: <>
                        Abrí esta URL en tu navegador — reemplazá <b style={{ color: COLOR }}>TOKEN</b> con el token que pegaste:
                        <div style={{ marginTop: 6, background: 'var(--surface)', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: COLOR, wordBreak: 'break-all', lineHeight: 1.5 }}>
                          https://api.telegram.org/bot<b>{config.botToken || 'TU_TOKEN'}</b>/getUpdates
                        </div>
                      </>
                    },
                    {
                      icon: '3️⃣', text: <>
                        En el texto que aparece buscá la parte que dice <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>&quot;chat&quot;</code> y dentro de ella <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>&quot;id&quot;</code> — ese número es tu Chat ID:
                        <div style={{ marginTop: 6, background: 'var(--surface)', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                          {`"chat": {`}<br />
                          &nbsp;&nbsp;<span style={{ color: COLOR }}>{`"id": `}<b style={{ color: '#f97316' }}>123456789</b></span><br />
                          {`}`}
                        </div>
                      </>
                    },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, lineHeight: 1.6, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6, fontWeight: 700, letterSpacing: '0.05em' }}>
                    PEGÁ TU CHAT ID ACÁ (solo el número)
                  </label>
                  <input
                    autoFocus
                    value={config.chatId}
                    onChange={e => setConfig(c => ({ ...c, chatId: e.target.value }))}
                    placeholder="123456789"
                    style={{ ...inputSt, fontFamily: 'monospace', fontSize: 14, maxWidth: 200 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setWizardStep(2)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>← Atrás</button>
                  <button
                    onClick={() => setWizardStep(4)}
                    disabled={!config.chatId.trim()}
                    style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: config.chatId.trim() ? COLOR : 'var(--border)', color: config.chatId.trim() ? '#000' : C.muted, cursor: config.chatId.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}
                  >Siguiente →</button>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Paso 4 — Probar la conexión
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  Hacé clic en el botón para verificar que todo esté bien. Si funciona, te va a llegar un mensaje de prueba a tu Telegram.
                </p>

                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>RESUMEN DE CONFIGURACIÓN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.muted, width: 80, flexShrink: 0 }}>Token:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: COLOR, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {config.botToken ? `${config.botToken.slice(0, 20)}…` : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: C.muted, width: 80, flexShrink: 0 }}>Chat ID:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: COLOR }}>{config.chatId || '—'}</span>
                    </div>
                  </div>
                </div>

                {testResult && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 10, fontSize: 14, lineHeight: 1.5,
                    background: testResult.ok ? `${COLOR}15` : '#ef444415',
                    border: `1px solid ${testResult.ok ? COLOR : '#ef4444'}55`,
                    color: testResult.ok ? COLOR : '#ef4444',
                    fontWeight: 600,
                  }}>{testResult.msg}</div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setWizardStep(3)} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>← Atrás</button>
                  <button
                    onClick={testConnection}
                    disabled={testing || !config.botToken || !config.chatId}
                    style={{
                      padding: '10px 24px', borderRadius: 9, border: 'none',
                      background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                      opacity: testing ? 0.7 : 1,
                    }}
                  >{testing ? '⏳ Probando…' : '🔌 Probar conexión'}</button>
                  {testResult?.ok && (
                    <button
                      onClick={save}
                      disabled={saving}
                      style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#22c55e', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                    >{saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar configuración'}</button>
                  )}
                </div>

                {testResult?.ok && (
                  <div style={{ background: `${COLOR}10`, border: `1px solid ${COLOR}33`, borderRadius: 10, padding: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>🎉 ¡Todo listo! ¿Cómo funciona?</div>
                    <ul style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, paddingLeft: 18 }}>
                      <li>Cuando alguien escribe en el chat del sitio, te llega un mensaje a tu Telegram</li>
                      <li>Para responder: <b style={{ color: 'var(--text-primary)' }}>mantené presionado el mensaje en Telegram → Responder</b> y escribí tu respuesta</li>
                      <li>También podés responder desde el panel <b style={{ color: 'var(--text-primary)' }}>Conversaciones</b> de este sistema</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IA & CONOCIMIENTO ── */}
      {tab === 'ia' && <IAKnowledgePanel config={config} setConfig={setConfig} showApiKey={showApiKey} setShowApiKey={setShowApiKey} testingAI={testingAI} aiTestResult={aiTestResult} testAI={testAI} saving={saving} saved={saved} onSave={save} />}

      {/* ── MENSAJES ── */}
      {tab === 'mensajes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>MENSAJE DE BIENVENIDA</label>
            <textarea value={config.welcomeMessage} onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))} rows={3} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }} />
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Se muestra al iniciar el chat</p>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>MENSAJE CUANDO NO HAY RESPUESTA AUTOMÁTICA</label>
            <textarea value={config.offlineMessage} onChange={e => setConfig(c => ({ ...c, offlineMessage: e.target.value }))} rows={3} style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }} />
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Se envía si no hay reglas auto-respuesta que coincidan</p>
          </div>
          <button onClick={save} disabled={saving} style={{ width: 'fit-content', padding: '9px 22px', borderRadius: 8, border: 'none', background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar mensajes'}
          </button>
        </div>
      )}

      {/* ── AUTO-RESPONDER ── */}
      {tab === 'autoresponder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          <p style={{ fontSize: 13, color: C.muted }}>Cuando el cliente escribe algo que contiene las palabras clave, el bot responde automáticamente. Útil para preguntas frecuentes.</p>
          {(config.autoResponder ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>No hay reglas configuradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {config.autoResponder.map(rule => (
                <div key={rule.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: `1px solid ${rule.active ? COLOR + '33' : 'var(--border)'}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: COLOR, fontWeight: 700, marginBottom: 3 }}>🔑 {rule.keywords}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{rule.response}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfig(c => ({ ...c, autoResponder: c.autoResponder.map(r => r.id === rule.id ? { ...r, active: !r.active } : r) }))} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: rule.active ? `${COLOR}22` : 'var(--border)', color: rule.active ? COLOR : C.muted, fontWeight: 600 }}>{rule.active ? 'Activa' : 'Inactiva'}</button>
                    <button onClick={() => removeRule(rule.id)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer', background: '#ef444422', color: '#ef4444' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>➕ NUEVA REGLA</div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>PALABRAS CLAVE (separadas por coma)</label>
              <input value={newRule.keywords} onChange={e => setNewRule(r => ({ ...r, keywords: e.target.value }))} placeholder="precio, costo, cuánto, cuanto" style={{ ...inputSt, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>RESPUESTA AUTOMÁTICA</label>
              <textarea value={newRule.response} onChange={e => setNewRule(r => ({ ...r, response: e.target.value }))} placeholder="Nuestros precios dependen del modelo. Escribinos el equipo y el problema y te cotizamos al toque." rows={3} style={{ ...inputSt, resize: 'vertical', fontSize: 12, lineHeight: 1.5 }} />
            </div>
            <button onClick={addRule} disabled={!newRule.keywords.trim() || !newRule.response.trim()} style={{ width: 'fit-content', padding: '8px 18px', borderRadius: 8, border: 'none', background: newRule.keywords.trim() && newRule.response.trim() ? COLOR : 'var(--border)', color: newRule.keywords.trim() && newRule.response.trim() ? '#000' : C.muted, cursor: newRule.keywords.trim() && newRule.response.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>Agregar regla</button>
          </div>
          <button onClick={save} disabled={saving} style={{ width: 'fit-content', padding: '9px 22px', borderRadius: 8, border: 'none', background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar reglas'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Chat Admin View ─────────────────────────────────────────────────────
export default function ChatSoporteView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'chats' | 'config'>('chats')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions')
      if (res.ok) { const data = await res.json(); setSessions(data); setLoading(false) }
    } catch { setLoading(false) }
  }, [])

  const fetchMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/messages?session_id=${sid}`)
      if (res.ok) {
        const data: ChatMsg[] = await res.json()
        setMessages(data)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch { }
  }, [])

  useEffect(() => {
    fetchSessions()
    pollRef.current = setInterval(() => {
      fetchSessions()
      if (activeSession) fetchMessages(activeSession)
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchSessions, fetchMessages, activeSession])

  useEffect(() => {
    if (activeSession) fetchMessages(activeSession)
  }, [activeSession, fetchMessages])

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || !activeSession || sending) return
    setReply(''); setSending(true)
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession, text, role: 'owner' }),
      })
      await fetchMessages(activeSession)
      await fetchSessions()
    } finally { setSending(false) }
  }

  const totalUnread = sessions.reduce((sum, s) => sum + (s.unread ?? 0), 0)

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            💬 Chat & Soporte
            {totalUnread > 0 && (
              <span style={{ fontSize: 12, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {totalUnread} sin leer
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Conversaciones de clientes · Integración Telegram</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[
          { id: 'chats' as const, label: `💬 Conversaciones${totalUnread > 0 ? ` (${totalUnread})` : ''}` },
          { id: 'config' as const, label: '⚙️ Configuración' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
            color: tab === t.id ? COLOR : C.muted, fontWeight: tab === t.id ? 700 : 400,
            borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.12s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'config' && <ConfigPanel />}

      {tab === 'chats' && (
        <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 280px)', minHeight: 400, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Sessions list */}
          <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>Cargando…</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div>No hay conversaciones todavía</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>Los chats de clientes aparecerán aquí</div>
              </div>
            ) : sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                style={{
                  width: '100%', padding: '12px 14px', textAlign: 'left',
                  background: activeSession === s.id ? `${COLOR}15` : 'none',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  borderLeft: activeSession === s.id ? `3px solid ${COLOR}` : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, fontWeight: s.unread > 0 ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {s.visitorName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginLeft: 6 }}>
                    {s.unread > 0 && (
                      <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                        {s.unread}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: C.muted }}>{fmtDate(s.lastMessageAt)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {s.messageCount} mensaje{s.messageCount !== 1 ? 's' : ''}
                  {!s.open && ' · Cerrada'}
                </div>
              </button>
            ))}
          </div>

          {/* Chat panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
            {!activeSession ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: C.muted }}>
                <div style={{ fontSize: 40 }}>💬</div>
                <div style={{ fontSize: 14 }}>Seleccioná una conversación</div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                {(() => {
                  const s = sessions.find(x => x.id === activeSession)
                  return s ? (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${COLOR}22`, border: `1px solid ${COLOR}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        👤
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.visitorName}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>Sesión: {s.id.slice(0, 12)}…</div>
                      </div>
                      <button
                        onClick={async () => {
                          await fetch('/api/chat/sessions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, open: !s.open }) })
                          fetchSessions()
                        }}
                        style={{
                          marginLeft: 'auto', padding: '5px 12px', borderRadius: 7, border: 'none',
                          background: s.open ? '#ef444422' : `${COLOR}22`,
                          color: s.open ? '#ef4444' : COLOR,
                          cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >{s.open ? 'Cerrar chat' : 'Reabrir chat'}</button>
                    </div>
                  ) : null
                })()}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.filter(m => m.text !== '👋').map(msg => (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                      <div style={{
                        maxWidth: '72%',
                        background: msg.role === 'user' ? 'var(--surface2)'
                          : msg.role === 'owner' ? `${COLOR}22`
                          : 'var(--surface)',
                        border: `1px solid ${msg.role === 'user' ? 'var(--border)' : msg.role === 'owner' ? COLOR + '44' : 'var(--border)'}`,
                        borderRadius: msg.role === 'user' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                        padding: '9px 13px',
                      }}>
                        {msg.role === 'owner' && (
                          <div style={{ fontSize: 10, color: COLOR, fontWeight: 700, marginBottom: 3 }}>Microsmart</div>
                        )}
                        {msg.role === 'bot' && msg.source === 'ai' && (
                          <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, marginBottom: 3 }}>🧠 IA</div>
                        )}
                        {msg.role === 'bot' && msg.source !== 'ai' && (
                          <div style={{ fontSize: 10, color: '#f97316', fontWeight: 700, marginBottom: 3 }}>⚡ Auto-respuesta</div>
                        )}
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.text}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'right' }}>{fmtTime(msg.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Reply box */}
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--surface)' }}>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                    placeholder="Escribí tu respuesta… (Enter para enviar)"
                    rows={2}
                    style={{ ...inputSt, flex: 1, resize: 'none', lineHeight: 1.5 }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    style={{
                      padding: '0 18px', borderRadius: 10, border: 'none',
                      background: reply.trim() ? COLOR : 'var(--border)',
                      color: reply.trim() ? '#000' : C.muted,
                      cursor: reply.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >{sending ? '…' : '➤ Enviar'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
