'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage { id: string; role: 'user' | 'owner' | 'bot'; text: string; createdAt: string }

function genSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hora

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('ms_chat_session')
  if (!id) { id = genSessionId(); localStorage.setItem('ms_chat_session', id) }
  return id
}

function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false
  const last = localStorage.getItem('ms_chat_last_activity')
  if (!last) return false
  return Date.now() - parseInt(last, 10) > SESSION_TTL_MS
}

function touchActivity() {
  if (typeof window !== 'undefined')
    localStorage.setItem('ms_chat_last_activity', String(Date.now()))
}

function clearSession() {
  if (typeof window === 'undefined') return
  const newId = genSessionId()
  localStorage.setItem('ms_chat_session', newId)
  localStorage.removeItem('ms_chat_last_activity')
  localStorage.removeItem('ms_chat_name')
  localStorage.removeItem('ms_chat_phone')
  return newId
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

export default function ChatWidget() {
  const [open, setOpen]               = useState(false)
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [unread, setUnread]           = useState(0)
  const [visitorName, setVisitorName] = useState('')
  const [visitorPhone, setVisitorPhone] = useState('')
  const [nameSet, setNameSet]         = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [phoneInput, setPhoneInput]   = useState('')
  const [sessionId, setSessionId]     = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Si pasó más de 1 hora desde el último mensaje, limpiar sesión
    if (isSessionExpired()) {
      clearSession()
      setMessages([])
      setVisitorName('')
      setVisitorPhone('')
      setNameSet(false)
      setSessionId(getSessionId())
      return
    }
    const id = getSessionId()
    setSessionId(id)
    const savedName  = localStorage.getItem('ms_chat_name')
    const savedPhone = localStorage.getItem('ms_chat_phone') ?? ''
    if (savedName) { setVisitorName(savedName); setVisitorPhone(savedPhone); setNameSet(true) }
  }, [])

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const fetchMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/messages?session_id=${sid}`)
      if (!res.ok) return
      const data: ChatMessage[] = await res.json()
      setMessages(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev
        const newOwner = data.filter(m =>
          (m.role === 'owner' || m.role === 'bot') &&
          !prev.some(p => p.id === m.id)
        ).length
        if (newOwner > 0 && !open) setUnread(u => u + newOwner)
        // Actualizar timestamp de actividad si hay mensajes
        if (data.length > 0) touchActivity()
        return data
      })
    } catch { /* ignore */ }
  }, [open])

  // Start polling when we have a session
  useEffect(() => {
    if (!sessionId || !nameSet) return
    fetchMessages(sessionId)
    pollRef.current = setInterval(() => fetchMessages(sessionId), 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [sessionId, nameSet, fetchMessages])

  useEffect(() => {
    if (open) { setUnread(0); scrollBottom() }
  }, [open, scrollBottom])

  useEffect(() => { scrollBottom() }, [messages, scrollBottom])

  const handleSetName = () => {
    const name  = nameInput.trim() || 'Visitante'
    const phone = phoneInput.trim()
    setVisitorName(name)
    setVisitorPhone(phone)
    localStorage.setItem('ms_chat_name', name)
    if (phone) localStorage.setItem('ms_chat_phone', phone)
    setNameSet(true)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || !sessionId) return
    setInput('')
    setSending(true)
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user', text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    scrollBottom()
    try {
      touchActivity()
      // Incluir teléfono en el nombre para que llegue a Telegram
      const displayName = visitorPhone
        ? `${visitorName} (${visitorPhone})`
        : visitorName
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, visitorName: displayName, text }),
      })
      await fetchMessages(sessionId)
    } finally { setSending(false) }
  }

  const accent = '#4ade80'
  const dark   = '#0f1117'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent}, #22c55e)`,
          border: 'none', cursor: 'pointer',
          boxShadow: `0 4px 20px ${accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
        title="Chat con nosotros"
      >
        {open ? '✕' : '💬'}
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff',
            fontSize: 11, fontWeight: 700,
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${dark}`,
          }}>{unread}</span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9000,
          width: 360, maxHeight: 560,
          background: '#1a1d2e',
          border: '1px solid #2e3150',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${accent}22, #22c55e11)`,
            borderBottom: '1px solid #2e3150',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `${accent}22`, border: `2px solid ${accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🔧</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Microsmart</div>
              <div style={{ fontSize: 11, color: accent }}>● En línea</div>
            </div>
            {nameSet && (
              <div style={{ fontSize: 11, color: '#7c85a2', textAlign: 'right' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{visitorName}</div>
                {visitorPhone && <div>{visitorPhone}</div>}
              </div>
            )}
          </div>

          {/* Ask for name + phone */}
          {!nameSet ? (
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
              <div style={{ fontSize: 14, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.5 }}>
                👋 ¡Hola! Para chatear, completá tus datos:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetName()}
                  placeholder="Tu nombre *"
                  style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 14,
                    background: '#252840', border: '1px solid #2e3150',
                    color: '#e2e8f0', outline: 'none',
                  }}
                />
                <input
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetName()}
                  placeholder="Tu teléfono (opcional)"
                  type="tel"
                  style={{
                    padding: '10px 14px', borderRadius: 10, fontSize: 14,
                    background: '#252840', border: '1px solid #2e3150',
                    color: '#e2e8f0', outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handleSetName}
                style={{
                  padding: '10px', borderRadius: 10, border: 'none',
                  background: accent, color: '#000', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >Iniciar chat →</button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                minHeight: 0,
              }}>
                {/* Saludo local — no se envía a Telegram */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '80%',
                    background: '#1e2235',
                    color: '#e2e8f0',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '9px 13px',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginBottom: 3 }}>
                      Microsmart
                    </div>
                    ¡Hola {visitorName.split(' ')[0]}! ¿En qué te podemos ayudar? 😊
                  </div>
                </div>

                {messages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      background: msg.role === 'user'
                        ? `linear-gradient(135deg, ${accent}, #22c55e)`
                        : msg.role === 'owner' ? '#252840' : '#1e2235',
                      color: msg.role === 'user' ? '#000' : '#e2e8f0',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '9px 13px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      border: msg.role === 'owner' ? '1px solid #2e3150' : 'none',
                    }}>
                      {msg.role === 'owner' && (
                        <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginBottom: 3 }}>
                          Microsmart
                        </div>
                      )}
                      {msg.text}
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{
                borderTop: '1px solid #2e3150', padding: '10px 12px',
                display: 'flex', gap: 8, alignItems: 'flex-end',
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder="Escribí tu mensaje…"
                  rows={1}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 13,
                    background: '#252840', border: '1px solid #2e3150',
                    color: '#e2e8f0', outline: 'none', resize: 'none',
                    lineHeight: 1.4, maxHeight: 80, overflow: 'auto',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: input.trim() ? accent : '#2e3150',
                    color: input.trim() ? '#000' : '#7c85a2',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 16, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {sending ? '…' : '➤'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
