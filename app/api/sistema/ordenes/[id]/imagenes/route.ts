import { NextRequest, NextResponse } from 'next/server'
import { getOrdenes, updateOrden } from '@/lib/sistema-db'
import cloudinary from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

// POST — subir una o más imágenes a Cloudinary
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ordenes = await getOrdenes()
  const orden = ordenes.find(o => o.id === id)
  if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  const newUrls: string[] = []
  for (const file of files) {
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `microsmart/ordenes/${id}`, resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
        (error, res) => { if (error || !res) reject(error); else resolve(res) }
      ).end(buffer)
    })
    newUrls.push(result.secure_url)
  }

  const existing = orden.imagenes ?? []
  const updated = await updateOrden(id, { imagenes: [...existing, ...newUrls] })
  return NextResponse.json(updated)
}

// DELETE — eliminar una imagen (por URL o publicId)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const filename: string = body.filename ?? body.url ?? ''

  const ordenes = await getOrdenes()
  const orden = ordenes.find(o => o.id === id)
  if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Si es una URL de Cloudinary, eliminar del servicio
  if (filename.startsWith('http') && filename.includes('cloudinary')) {
    try {
      // Extraer publicId desde la URL
      const match = filename.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/)
      if (match) await cloudinary.uploader.destroy(match[1])
    } catch { /* si falla, igual eliminamos la referencia */ }
  }

  const updated = await updateOrden(id, {
    imagenes: (orden.imagenes ?? []).filter(f => f !== filename),
  })
  return NextResponse.json(updated)
}
