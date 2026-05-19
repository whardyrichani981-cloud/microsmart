# Microsmart — Refresh diario de listas de proveedores
# Ejecutar con Windows Task Scheduler todos los dias a las 11:00 AM
#
# Para registrar la tarea automatica, ejecutar como Administrador:
#   schtasks /create /tn "Microsmart RefreshSuppliers" /tr "powershell -File C:\ruta\scripts\refresh-suppliers.ps1" /sc daily /st 11:00 /f

$APP_URL   = "http://localhost:3000"   # Cambiar por la URL de produccion si corresponde
$CRON_SECRET = $env:CRON_SECRET        # Configurar en variables de entorno del sistema
$LOG_FILE  = "$PSScriptRoot\refresh-suppliers.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$headers   = @{ "Authorization" = "Bearer $CRON_SECRET" }

try {
    $response = Invoke-RestMethod -Uri "$APP_URL/api/cron/refresh-suppliers" `
        -Method GET -Headers $headers -TimeoutSec 60

    $msg = "[$timestamp] OK | Cambios: $($response.anyChanged) | Errores: $($response.anyError)"
    foreach ($s in $response.suppliers) {
        $msg += "`n  - $($s.id): $($s.count) items | changed=$($s.changed)"
        if ($s.error) { $msg += " | ERROR: $($s.error)" }
    }
} catch {
    $msg = "[$timestamp] FALLO — $($_.Exception.Message)"
}

Write-Host $msg
Add-Content -Path $LOG_FILE -Value $msg
