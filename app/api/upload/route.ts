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
    const mime   = file.type || 'image/jpeg'
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
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
