# ============================================================
# La Cabaña Eventos — Script de arranque del sistema
# Ejecutar con: .\iniciar-sistema.ps1
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$logFile = "$env:USERPROFILE\Desktop\la-cabana\sistema.log"
$cloudflaredExe = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
$cfConfig = "$env:USERPROFILE\.cloudflared\config.yml"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $msg" | Tee-Object -FilePath $logFile -Append
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  La Cabana Eventos — Iniciando sistema..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Verificar que n8n no este ya corriendo ----
$n8nRunning = $false
try {
    $h = Invoke-RestMethod -Uri "http://localhost:5678/healthz" -TimeoutSec 2
    if ($h.status -eq "ok") { $n8nRunning = $true }
} catch {}

if ($n8nRunning) {
    Write-Host "[n8n] Ya esta corriendo en localhost:5678" -ForegroundColor Green
    Log "n8n ya estaba corriendo"
} else {
    Write-Host "[n8n] Iniciando..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx n8n" -WindowStyle Minimized
    Log "n8n iniciado"

    # Esperar a que levante
    $intentos = 0
    do {
        Start-Sleep -Seconds 3
        $intentos++
        try {
            $h = Invoke-RestMethod -Uri "http://localhost:5678/healthz" -TimeoutSec 2
            if ($h.status -eq "ok") { $n8nRunning = $true }
        } catch {}
    } while (-not $n8nRunning -and $intentos -lt 10)

    if ($n8nRunning) {
        Write-Host "[n8n] Listo en localhost:5678" -ForegroundColor Green
        Log "n8n listo"
    } else {
        Write-Host "[n8n] ERROR: no pudo arrancar en 30 segundos" -ForegroundColor Red
        Log "ERROR: n8n no arranco"
    }
}

# ---- 2. Verificar tunnel de Cloudflare ----
$cfRunning = $false
try {
    $info = & $cloudflaredExe tunnel info la-cabana 2>&1 | Out-String
    if ($info -match "CONNECTOR ID") { $cfRunning = $true }
} catch {}

if ($cfRunning) {
    Write-Host "[Cloudflare] Tunnel activo" -ForegroundColor Green
    Log "Cloudflare tunnel ya estaba activo"
} else {
    Write-Host "[Cloudflare] Iniciando tunnel..." -ForegroundColor Yellow
    Start-Process -FilePath $cloudflaredExe -ArgumentList "--config `"$cfConfig`" tunnel run la-cabana" -WindowStyle Minimized
    Log "Cloudflare tunnel iniciado"
    Start-Sleep -Seconds 4
    Write-Host "[Cloudflare] Tunnel iniciado" -ForegroundColor Green
}

# ---- 3. Resumen ----
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SISTEMA LISTO" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  n8n (admin):    http://localhost:5678" -ForegroundColor White
Write-Host ""
Write-Host "  WEBHOOK URL PERMANENTE:" -ForegroundColor Yellow
Write-Host "  https://n8n.lacabanaeventos.com/webhook/lacabana-lead" -ForegroundColor Green
Write-Host ""
Write-Host "  Flujos activos:" -ForegroundColor White
Write-Host "  - Flujo 1: Lead sitio web  -> Telegram + Slack + Email + Sheets" -ForegroundColor Gray
Write-Host "  - Flujo 2: Follow-up auto  -> Emails dia 2, 5 y 10" -ForegroundColor Gray
Write-Host "  - Flujo 3: Lead Facebook   -> Telegram + Slack + Email + Sheets" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

Log "Sistema listo. Webhook: https://n8n.lacabanaeventos.com/webhook/lacabana-lead"

# Pausa para que el usuario pueda leer
Read-Host "Presiona Enter para cerrar esta ventana"
