import { NextRequest, NextResponse } from 'next/server'
import { getOrdenes, updateOrden } from '@/lib/sistema-db'
import cloudinary from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

// POST — subir una o más imágenes a Cloudinary y guardar en la orden
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const ordenes = await getOrdenes()
    const orden = ordenes.find(o => o.id === id)
    if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const usuario = formData.get('usuario') as string | null

    const newUrls: string[] = []
    for (const file of files) {
      const bytes  = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: `microsmart/ordenes/${id}`, resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
          (error, res) => { if (error || !res) reject(error ?? new Error('Upload failed')); else resolve(res) }
        ).end(buffer)
      })
      newUrls.push(result.secure_url)
    }

    const existing = orden.imagenes ?? []
    const imagenes = [...existing, ...newUrls]

    console.log('[imagenes] orden.id:', id, '| existing:', existing.length, '| new:', newUrls.length, '| total:', imagenes.length)
    console.log('[imagenes] newUrls:', JSON.stringify(newUrls))

    // Agregar historial en la misma escritura
    const histEntry = {
      id: Date.now().toString(),
      tipo: 'foto' as const,
      descripcion: `Se subieron ${newUrls.length} foto(s)`,
      fecha: new Date().toISOString(),
      usuario: usuario ?? 'Sistema',
    }
    const historial = [...(orden.historial ?? []), histEntry]

    const updated = await updateOrden(id, { imagenes, historial })
    console.log('[imagenes] updated.imagenes:', JSON.stringify(updated?.imagenes))
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[imagenes/POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE — eliminar una imagen
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const filename: string = body.filename ?? body.url ?? ''

    const ordenes = await getOrdenes()
    const orden = ordenes.find(o => o.id === id)
    if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Si es URL de Cloudinary, borrar del servicio
    if (filename.startsWith('http') && filename.includes('cloudinary')) {
      try {
        const match = filename.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/)
        if (match) await cloudinary.uploader.destroy(match[1])
      } catch { /* ignorar error de Cloudinary */ }
    }

    const updated = await updateOrden(id, {
      imagenes: (orden.imagenes ?? []).filter(f => f !== filename),
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
