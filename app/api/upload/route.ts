import { NextRequest, NextResponse } from 'next/server'
import cloudinary from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file   = formData.get('file')   as File   | null
    const folder = (formData.get('folder') as string) || 'microsmart'

    if (!file) return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
        (error, res) => { if (error || !res) reject(error); else resolve(res) }
      ).end(buffer)
    })

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id })
  } catch (e) {
    console.error('[upload]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { publicId } = await req.json()
    if (!publicId) return NextResponse.json({ error: 'publicId requerido' }, { status: 400 })
    await cloudinary.uploader.destroy(publicId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
