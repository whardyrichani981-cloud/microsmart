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
      // Usar base64 data URI — más confiable en serverless que upload_stream
      const mime    = file.type || 'image/jpeg'
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`
      try {
        const result = await cloudinary.uploader.upload(dataUri, {
          folder: `microsmart/ordenes/${id}`,
          resource_type: 'image',
        })
        newUrls.push(result.secure_url)
      } catch (uploadErr) {
        console.error('[imagenes] upload error:', String(uploadErr))
        return NextResponse.json({ error: `Cloudinary error: ${String(uploadErr)}` }, { status: 500 })
      }
    }

    const existing = orden.imagenes ?? []
    const imagenes = [...existing, ...newUrls]

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
