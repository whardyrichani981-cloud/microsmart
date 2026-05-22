import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const tecnico = `PANTALLAS / MÓDULOS / LCD (son lo mismo, distintas calidades):

En nuestra lista los módulos aparecen con estos nombres:
- "Modulo Incell IC" = INCELL: calidad económica, buena imagen, tecnología LCD
- "Modulo Soft Oled IC" = OLED: mejor calidad de imagen, colores vivos, negros profundos
- "Modulo Soft Oled Diagnostico" = OLED PREMIUM/ORIGINAL: la mejor calidad disponible

REGLA CLAVE: cuando alguien pregunte por pantalla, lcd, módulo o display de un modelo específico, SIEMPRE mostrá TODAS las calidades que aparezcan en la lista con sus precios. No elijas solo una calidad, mostrá todas.

Ejemplo de respuesta correcta:
"Para el iPhone 13 tenemos 3 calidades de pantalla:
- Incell: U$D 33 efectivo / U$D 35 transferencia
- OLED: U$D 67 efectivo / U$D 70 transferencia
- OLED Premium: U$D 81 efectivo / U$D 85 transferencia"
`

async function main() {
  const configRaw = await redis.get('chat-config')
  const config = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw
  if (!config.aiSections) config.aiSections = {}

  config.aiSections.tecnico = tecnico

  await redis.set('chat-config', JSON.stringify(config))
  console.log('✅ aiSections.tecnico actualizado')
  console.log(tecnico)
}

main().catch(console.error)
