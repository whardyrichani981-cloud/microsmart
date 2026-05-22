import { NextResponse } from 'next/server'
import { getTelegramConfig, saveTelegramConfig } from '@/lib/chat-db'

export const dynamic = 'force-dynamic'

const tecnico = `PANTALLAS / MÓDULOS / LCD (son lo mismo, distintas calidades):

En nuestra lista los módulos aparecen con estos nombres:
- "Modulo Incell IC" = INCELL: calidad económica, buena imagen, tecnología LCD
- "Modulo Soft Oled IC" = OLED: mejor calidad de imagen, colores vivos, negros profundos
- "Modulo Soft Oled Diagnostico" = ORIGINAL/PREMIUM: la mejor calidad disponible

REGLA MÁS IMPORTANTE: Solo mostrá las calidades que tengas en la sección "PRECIOS DE LA LISTA".
- Si la lista tiene Incell y Original (Diagnostico) → mostrá esas DOS calidades con sus precios
- Si la lista tiene las 3 calidades → mostrá las 3
- Si solo hay una calidad → mostrá esa sola
- NUNCA menciones una calidad si no tenés su precio en la lista
- NUNCA digas "consultanos" para una calidad que SÍ tiene precio

Ejemplo cuando hay Incell y Original:
"Para el iPhone 14 tenemos:
- Incell: U$D 33 (en pesos al cambio del día)
- Original: U$D 81 (en pesos al cambio del día)"

Ejemplo cuando hay las 3 calidades:
"Para el iPhone 13 tenemos:
- Incell: U$D 33
- OLED: U$D 67
- Original: U$D 81
(todos en pesos al tipo de cambio del día)"`

// GET — actualiza aiSections.tecnico en Redis con las instrucciones correctas
export async function GET() {
  try {
    const config = await getTelegramConfig()
    if (!config.aiSections) config.aiSections = { negocio: '', precios: '', tecnico: '', faq: '', estilo: '' }
    config.aiSections.tecnico = tecnico
    await saveTelegramConfig(config)
    return NextResponse.json({ ok: true, tecnico })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
