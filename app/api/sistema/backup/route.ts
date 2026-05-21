import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const DATA_DIR  = path.join(process.cwd(), 'data')
const BCK_DIR   = path.join(DATA_DIR, 'backups')
const META_FILE = path.join(DATA_DIR, 'backup-meta.json')

// Archivos del sistema a incluir en el backup
const BACKUP_FILES = [
  'sistema-ordenes.json',
  'sistema-clientes.json',
  'sistema-clientes-personas.json',
  'sistema-stock.json',
  'sistema-servicios.json',
  'sistema-presupuestos.json',
  'sistema-proveedores.json',
  'sistema-proveedores-equipos.json',
  'sistema-ventas-caja.json',
  'sistema-ventas-csf.json',
  'sistema-ventas-gremio.json',
  'sistema-gastos.json',
  'sistema-turnos.json',
  'sistema-equipos.json',
  'sistema-tipo-cambio.json',
  'sistema-comisiones.json',
  'sistema-usuarios.json',
  'sistema-caja-diaria.json',
  'sistema-compras-clientes.json',
  'sistema-terminos.json',
  'sistema-modulos.json',
  'sistema-listas-meta.json',
  'sistema-garantia-retiro.json',
  'notas.json',
]

// Máximo de backups a conservar
const MAX_BACKUPS = 30

interface BackupMeta {
  lastBackup: string | null
  lastBackupFile: string | null
  lastBackupSize: number
  totalBackups: number
}

function readMeta(): BackupMeta {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) }
  catch { return { lastBackup: null, lastBackupFile: null, lastBackupSize: 0, totalBackups: 0 } }
}

function writeMeta(meta: BackupMeta) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
}

function ensureBackupDir() {
  if (!fs.existsSync(BCK_DIR)) fs.mkdirSync(BCK_DIR, { recursive: true })
}

function buildBackupPayload(): { json: string; fecha: string; hora: string } {
  const now  = new Date()
  const fecha = now.toISOString().slice(0, 10)
  const hora  = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-')

  const backup: Record<string, unknown> = {
    _meta: {
      version: '2.0',
      fecha,
      hora,
      generadoEn: now.toISOString(),
      archivos: BACKUP_FILES.length,
    },
  }

  for (const filename of BACKUP_FILES) {
    const filePath = path.join(DATA_DIR, filename)
    const key = filename.replace('.json', '').replace('sistema-', '')
    try {
      let raw = fs.readFileSync(filePath, 'utf-8')
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
      backup[key] = JSON.parse(raw)
    } catch {
      backup[key] = null
    }
  }

  return { json: JSON.stringify(backup, null, 2), fecha, hora }
}

function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BCK_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BCK_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)

    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BCK_DIR, file.name))
    }
  } catch { /* ignore */ }
}

// ── GET — descarga backup o lista backups guardados ──────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ?list=1 → devuelve lista de backups guardados + meta
  if (searchParams.get('list') === '1') {
    ensureBackupDir()
    const meta = readMeta()
    let files: { name: string; size: number; createdAt: string }[] = []
    try {
      files = fs.readdirSync(BCK_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(f => {
          const stat = fs.statSync(path.join(BCK_DIR, f))
          return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() }
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch { /* empty */ }
    return NextResponse.json({ meta, files })
  }

  // ?file=backup-YYYY-MM-DD.json → descarga un backup guardado específico
  const fileName = searchParams.get('file')
  if (fileName) {
    const safe = path.basename(fileName) // prevent path traversal
    const filePath = path.join(BCK_DIR, safe)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup no encontrado' }, { status: 404 })
    }
    const buffer = fs.readFileSync(filePath)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safe}"`,
        'Content-Length': String(buffer.length),
      },
    })
  }

  // Sin parámetros → genera backup al vuelo y lo descarga (compatibilidad anterior)
  const { json, fecha, hora } = buildBackupPayload()
  const buffer = Buffer.from(json, 'utf-8')
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="microsmart-backup-${fecha}-${hora}.json"`,
      'Content-Length': String(buffer.length),
    },
  })
}

// ── POST — genera y guarda backup en disco ────────────────────────────────────
export async function POST() {
  ensureBackupDir()
  const { json, fecha, hora } = buildBackupPayload()

  const fileName = `backup-${fecha}-${hora}.json`
  const filePath = path.join(BCK_DIR, fileName)

  const buffer = Buffer.from(json, 'utf-8')
  fs.writeFileSync(filePath, buffer)

  pruneOldBackups()

  // Actualizar metadata
  const files = fs.readdirSync(BCK_DIR).filter(f => f.startsWith('backup-') && f.endsWith('.json'))
  writeMeta({
    lastBackup: new Date().toISOString(),
    lastBackupFile: fileName,
    lastBackupSize: buffer.length,
    totalBackups: files.length,
  })

  return NextResponse.json({
    ok: true,
    file: fileName,
    size: buffer.length,
    savedAt: new Date().toISOString(),
  })
}
