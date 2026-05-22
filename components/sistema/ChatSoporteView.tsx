'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { C, inputSt } from './shared'
import type { TelegramConfig, AutoResponderRule } from '@/lib/chat-db'

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
      {tab === 'ia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>

          {/* Explicación */}
          <div style={{ background: `${COLOR}10`, border: `1px solid ${COLOR}33`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLOR, marginBottom: 6 }}>🧠 ¿Cómo funciona?</div>
            <ul style={{ fontSize: 13, color: C.muted, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>La IA responde automáticamente usando la información que escribís abajo sobre tu negocio</li>
              <li>Podés responder vos mismo desde Telegram o este panel — tu respuesta tiene prioridad</li>
              <li>Las <b style={{ color: 'var(--text-primary)' }}>Auto-respuestas por palabras clave</b> tienen mayor prioridad que la IA</li>
            </ul>
          </div>

          {/* Selector de proveedor */}
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 8, fontWeight: 700, letterSpacing: '0.05em' }}>
              ELEGÍ EL MOTOR DE IA
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { id: 'gemini', label: '✨ Google Gemini', desc: 'GRATIS · 1M tokens/día', color: '#4285f4' },
                { id: 'claude', label: '🧠 Claude (Anthropic)', desc: 'De pago', color: '#818cf8' },
              ] as const).map(p => (
                <button
                  key={p.id}
                  onClick={() => setConfig(c => ({ ...c, aiProvider: p.id }))}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: (config.aiProvider ?? 'gemini') === p.id ? `${p.color}22` : 'var(--surface2)',
                    outline: (config.aiProvider ?? 'gemini') === p.id ? `2px solid ${p.color}` : '2px solid var(--border)',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: (config.aiProvider ?? 'gemini') === p.id ? p.color : 'var(--text-primary)' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: (config.aiProvider ?? 'gemini') === p.id ? p.color : C.muted, marginTop: 2, fontWeight: 600 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Gemini API key */}
          {(config.aiProvider ?? 'gemini') === 'gemini' && (
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid #4285f433', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4285f4' }}>✨ Configurar Google Gemini (Gratis)</div>
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { n: '1', text: <>Entrá a <b style={{ color: 'var(--text-primary)' }}>aistudio.google.com</b> con tu cuenta de Google</> },
                  { n: '2', text: <>Hacé clic en <b style={{ color: 'var(--text-primary)' }}>Get API key</b> → <b style={{ color: 'var(--text-primary)' }}>Create API key</b></> },
                  { n: '3', text: <>Copiá la clave y pegala acá abajo</> },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                    <span style={{ background: '#4285f422', color: '#4285f4', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.geminiApiKey ?? ''}
                  onChange={e => setConfig(c => ({ ...c, geminiApiKey: e.target.value }))}
                  placeholder="AIzaSy..."
                  style={{ ...inputSt, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                />
                <button onClick={() => setShowApiKey(v => !v)} style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
                  {showApiKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {/* Claude API key */}
          {config.aiProvider === 'claude' && (
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid #818cf433', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>🧠 Configurar Claude (Anthropic)</div>
              <p style={{ fontSize: 12, color: C.muted }}>
                Conseguila en <b style={{ color: 'var(--text-primary)' }}>console.anthropic.com</b> → API Keys → Create Key. Requiere tarjeta de crédito.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.anthropicApiKey ?? ''}
                  onChange={e => setConfig(c => ({ ...c, anthropicApiKey: e.target.value }))}
                  placeholder="sk-ant-api03-..."
                  style={{ ...inputSt, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                />
                <button onClick={() => setShowApiKey(v => !v)} style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: C.muted, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
                  {showApiKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {/* Activar + testear */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setConfig(c => ({ ...c, aiEnabled: !c.aiEnabled }))}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: config.aiEnabled ? `${COLOR}22` : 'var(--surface2)',
                color: config.aiEnabled ? COLOR : C.muted,
                outline: config.aiEnabled ? `1.5px solid ${COLOR}` : '1.5px solid var(--border)',
              }}
            >{config.aiEnabled ? '✅ IA activada' : '⭕ IA desactivada'}</button>

            <button
              onClick={testAI}
              disabled={testingAI || !((config.aiProvider ?? 'gemini') === 'gemini' ? config.geminiApiKey : config.anthropicApiKey)?.trim()}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: '#818cf822', color: '#818cf8',
                opacity: testingAI ? 0.7 : 1,
              }}
            >{testingAI ? '⏳ Verificando…' : '🔌 Verificar API key'}</button>
          </div>

          {aiTestResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: aiTestResult.ok ? `${COLOR}15` : '#ef444415',
              border: `1px solid ${aiTestResult.ok ? COLOR : '#ef4444'}55`,
              color: aiTestResult.ok ? COLOR : '#ef4444', fontWeight: 600,
            }}>{aiTestResult.msg}</div>
          )}

          {/* Base de conocimiento */}
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, fontWeight: 700, letterSpacing: '0.05em' }}>
              INFORMACIÓN DEL NEGOCIO — "enseñale a la IA"
            </label>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>
              Escribí todo lo que querés que la IA sepa: precios, servicios, garantías, horarios, forma de hablar, qué decir ante cada consulta.
            </p>
            <textarea
              value={config.aiKnowledge ?? ''}
              onChange={e => setConfig(c => ({ ...c, aiKnowledge: e.target.value }))}
              rows={16}
              placeholder={`Ejemplos:\n\n• Somos Microsmart, servicio técnico Apple en [tu ciudad]. Lunes a sábado 9 a 18 hs.\n\n• Trato: siempre usar "vos", ser directo y amable. No dar vueltas.\n\n• Pantalla iPhone 15 Pro: $XX.000 con garantía 90 días.\n• Batería iPhone 13: $XX.000 instalada.\n\n• Si no saben el modelo: pedirles que vayan a Ajustes → General → Información.\n\n• Para presupuesto preguntar siempre: modelo del equipo, qué problema tiene y si tiene garantía de compra.\n\n• Tiempo de reparación: pantallas 1 hora, baterías 30 min, reparaciones de placa 2-5 días hábiles.\n\n• Si preguntan si usamos repuestos originales: sí, trabajamos con repuestos de calidad original con garantía.`}
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6, fontSize: 13, minHeight: 300 }}
            />
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              💡 Cuanto más detalle escribas (precios, tiempos, formas de hablar), más útil y precisa va a ser la IA
            </p>
          </div>

          <button onClick={save} disabled={saving} style={{ width: 'fit-content', padding: '10px 24px', borderRadius: 8, border: 'none', background: COLOR, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : '💾 Guardar configuración de IA'}
          </button>
        </div>
      )}

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
