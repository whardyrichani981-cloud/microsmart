import { NextRequest, NextResponse } from 'next/server'
import { getOrdenes, updateOrden } from '@/lib/sistema-db'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function uploadDir(id: string) {
  return path.join(process.cwd(), 'public', 'uploads', 'ordenes', id)
}

// POST — subir una o más imágenes
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ordenes = getOrdenes()
  const orden = ordenes.find(o => o.id === id)
  if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  const dir = uploadDir(id)
  fs.mkdirSync(dir, { recursive: true })

  const newFilenames: string[] = []
  for (const file of files) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const safe = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safe}`
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(dir, filename), buffer)
    newFilenames.push(filename)
  }

  const existing = orden.imagenes ?? []
  const updated = updateOrden(id, { imagenes: [...existing, ...newFilenames] })
  return NextResponse.json(updated)
}

// DELETE — eliminar una imagen
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { filename } = await req.json()

  const ordenes = getOrdenes()
  const orden = ordenes.find(o => o.id === id)
  if (!orden) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Eliminar archivo del disco
  const filePath = path.join(uploadDir(id), filename)
  try { fs.unlinkSync(filePath) } catch { /* ya no existe, ignorar */ }

  const updated = updateOrden(id, {
    imagenes: (orden.imagenes ?? []).filter(f => f !== filename),
  })
  return NextResponse.json(updated)
}
