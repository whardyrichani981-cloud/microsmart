'use client'
import { useEffect } from 'react'

// Tipos de input que NO deben capitalizarse automáticamente
const SKIP_TYPES = new Set(['number', 'tel', 'email', 'password', 'date', 'time', 'search', 'url', 'color', 'range', 'file', 'checkbox', 'radio', 'hidden', 'submit', 'button', 'reset'])

function shouldCap(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el.dataset.nocap !== undefined) return false
  if (el.tagName === 'TEXTAREA') return true
  const input = el as HTMLInputElement
  const t = (input.type || 'text').toLowerCase()
  if (SKIP_TYPES.has(t)) return false
  // No capitalizar campos de búsqueda/filtro rápidos (tienen placeholder como "Buscar...")
  const placeholder = (el.placeholder || '').toLowerCase()
  if (placeholder.startsWith('buscar') || placeholder.startsWith('search')) return false
  return true
}

export default function CapProvider() {
  useEffect(() => {
    function handler(e: Event) {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement
      if (!el || !shouldCap(el)) return
      const val = el.value
      if (!val || val[0] === val[0].toUpperCase()) return
      const caret = (el as HTMLInputElement).selectionStart ?? val.length
      el.value = val.charAt(0).toUpperCase() + val.slice(1)
      try { (el as HTMLInputElement).setSelectionRange(caret, caret) } catch {}
    }

    document.addEventListener('input', handler, true)
    return () => document.removeEventListener('input', handler, true)
  }, [])

  return null
}
