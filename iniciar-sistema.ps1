# ============================================================
# La Cabaña Eventos — Script de arranque del sistema
# Ejecutar con: .\iniciar-sistema.ps1
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$dataDir = "$env:USERPROFILE\.n8n"
$logFile = "$env:USERPROFILE\Desktop\la-cabana\sistema.log"

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

# ---- 2. Verificar que ngrok no este ya corriendo ----
$ngrokRunning = $false
try {
    $t = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 2
    if ($t.tunnels.Count -gt 0) { $ngrokRunning = $true }
} catch {}

if ($ngrokRunning) {
    Write-Host "[ngrok] Ya esta corriendo" -ForegroundColor Green
    Log "ngrok ya estaba corriendo"
} else {
    Write-Host "[ngrok] Iniciando tunnel..." -ForegroundColor Yellow
    Start-Process -FilePath "ngrok" -ArgumentList "http 5678" -WindowStyle Minimized
    Log "ngrok iniciado"

    # Esperar a que levante
    $intentos = 0
    do {
        Start-Sleep -Seconds 2
        $intentos++
        try {
            $t = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 2
            if ($t.tunnels.Count -gt 0) { $ngrokRunning = $true }
        } catch {}
    } while (-not $ngrokRunning -and $intentos -lt 10)

    if ($ngrokRunning) {
        Write-Host "[ngrok] Tunnel activo" -ForegroundColor Green
        Log "ngrok listo"
    } else {
        Write-Host "[ngrok] ERROR: no pudo arrancar" -ForegroundColor Red
        Log "ERROR: ngrok no arranco"
    }
}

# ---- 3. Obtener y mostrar la URL publica ----
$webhookUrl = ""
$ngrokUrl = ""
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3
    $httpsTunnel = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
    if ($httpsTunnel) {
        $ngrokUrl = $httpsTunnel.public_url
        $webhookUrl = "$ngrokUrl/webhook/lacabana-lead"
    }
} catch {}

# Guardar la URL en un archivo para referencia
if ($webhookUrl) {
    $webhookUrl | Set-Content "$env:USERPROFILE\Desktop\la-cabana\webhook-url-actual.txt"
    Log "Webhook URL: $webhookUrl"
}

# ---- 4. Resumen ----
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SISTEMA LISTO" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  n8n (admin):    http://localhost:5678" -ForegroundColor White
if ($ngrokUrl) {
    Write-Host "  ngrok (admin):  http://localhost:4040" -ForegroundColor White
    Write-Host ""
    Write-Host "  WEBHOOK URL PUBLICA:" -ForegroundColor Yellow
    Write-Host "  $webhookUrl" -ForegroundColor Green
    Write-Host ""
    Write-Host "  >> Copia esta URL y pegala en el sitio web <<" -ForegroundColor Yellow
    Write-Host "     (En WordPress: Apariencia > Editor de temas > script.js)" -ForegroundColor Gray
    Write-Host "     Reemplaza: https://hook.us2.make.com/..." -ForegroundColor Gray
    Write-Host "     Con:       $webhookUrl" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Flujos activos:" -ForegroundColor White
Write-Host "  - Flujo 1: Lead sitio web  -> Telegram + Email + Sheets" -ForegroundColor Gray
Write-Host "  - Flujo 2: Follow-up auto  -> Emails dia 2, 5 y 10" -ForegroundColor Gray
Write-Host "  - Flujo 3: Lead Facebook   -> Telegram + Email + Sheets" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

# Pausa para que el usuario pueda leer
Read-Host "Presiona Enter para cerrar esta ventana"
