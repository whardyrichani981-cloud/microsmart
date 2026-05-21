import { NextRequest, NextResponse } from 'next/server'
import { getMPCuentas, addMPCuenta, deleteMPCuenta, updateMPCuenta } from '@/lib/sistema-db'

export const dynamic = 'force-dynamic'

// GET — list all accounts (tokens masked)
export async function GET() {
  const cuentas = getMPCuentas().map(c => ({
    ...c,
    accessToken: maskToken(c.accessToken),
  }))
  return NextResponse.json(cuentas)
}

// POST — add new account
export async function POST(req: NextRequest) {
  const { nombre, accessToken } = await req.json()
  if (!nombre?.trim())      return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  if (!accessToken?.trim()) return NextResponse.json({ error: 'accessToken requerido' }, { status: 400 })

  // Validate token against MP API
  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments/search?limit=1', {
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    })
    if (res.status === 401) {
      return NextResponse.json({ error: 'Access Token inválido o sin permisos.' }, { status: 422 })
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar el token (sin conexión a MP).' }, { status: 422 })
  }

  const cuenta = addMPCuenta({ nombre: nombre.trim(), accessToken: accessToken.trim() })
  return NextResponse.json({ ...cuenta, accessToken: maskToken(cuenta.accessToken) }, { status: 201 })
}

// PUT — update account name
export async function PUT(req: NextRequest) {
  const { id, nombre } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const updated = updateMPCuenta(id, { nombre: nombre?.trim() })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...updated, accessToken: maskToken(updated.accessToken) })
}

// DELETE — remove account
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  deleteMPCuenta(id)
  return NextResponse.json({ ok: true })
}

function maskToken(token: string): string {
  if (token.length <= 12) return '***'
  return token.slice(0, 6) + '••••••••••••' + token.slice(-4)
}
