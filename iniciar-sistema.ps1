param(
    [switch]$NoPause
)

$ErrorActionPreference = "SilentlyContinue"
$logFile = "$env:USERPROFILE\Desktop\la-cabana\sistema.log"
$cloudflaredExe = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
if (-not (Test-Path $cloudflaredExe)) {
    $cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cloudflaredCmd) { $cloudflaredExe = $cloudflaredCmd.Source }
}
$cfConfig = "$env:USERPROFILE\.cloudflared\config.yml"
$activarScript = "$env:USERPROFILE\Desktop\la-cabana\activar-flujos.js"
$n8nLogFile = "$env:USERPROFILE\Desktop\la-cabana\n8n.log"
$n8nUserFolder = "$env:USERPROFILE"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $msg" | Tee-Object -FilePath $logFile -Append
}

Clear-Host
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  La Cabana Eventos - Iniciando sistema...' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

# ---------- 1. n8n ----------
$n8nRunning = $false
try {
    $h = Invoke-RestMethod -Uri 'http://localhost:5678/healthz' -TimeoutSec 2
    if ($h.status -eq 'ok') { $n8nRunning = $true }
} catch {}

if ($n8nRunning) {
    Write-Host '[OK] n8n ya estaba corriendo' -ForegroundColor Green
    Log 'n8n ya estaba corriendo'
} else {
    Write-Host '[..] Iniciando n8n...' -ForegroundColor Yellow
    $env:N8N_USER_FOLDER = $n8nUserFolder
    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c set `"N8N_USER_FOLDER=$n8nUserFolder`" && npx n8n start >> `"$n8nLogFile`" 2>&1" -WorkingDirectory "$env:USERPROFILE\Desktop\la-cabana" -WindowStyle Minimized
    Log 'n8n iniciado'
    $intentos = 0
    do {
        Start-Sleep -Seconds 4
        $intentos++
        try {
            $h = Invoke-RestMethod -Uri 'http://localhost:5678/healthz' -TimeoutSec 2
            if ($h.status -eq 'ok') { $n8nRunning = $true }
        } catch {}
    } while (-not $n8nRunning -and $intentos -lt 15)

    if ($n8nRunning) {
        Write-Host '[OK] n8n listo en localhost:5678' -ForegroundColor Green
        Log 'n8n listo'
    } else {
        Write-Host '[ERROR] n8n no pudo arrancar' -ForegroundColor Red
        Log 'ERROR: n8n no arranco'
        if (-not $NoPause) { Read-Host 'Presiona Enter para cerrar' }
        exit
    }
}

# ---------- 2. Activar Flujos 5 y 6 ----------
Write-Host '[..] Activando flujos de menu...' -ForegroundColor Yellow
Start-Sleep -Seconds 3

node $activarScript 2>$null

Write-Host '[OK] Flujos 5 y 6 marcados activos' -ForegroundColor Green
Log 'Flujos 5 y 6 marcados activos'

# ---------- 3. Cloudflare Tunnel ----------
$cfRunning = Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue
if ($cfRunning) {
    Write-Host '[OK] Tunnel Cloudflare ya estaba activo' -ForegroundColor Green
    Log 'Cloudflare ya activo'
} elseif (-not (Test-Path $cloudflaredExe)) {
    Write-Host '[ERROR] No encontre cloudflared.exe' -ForegroundColor Red
    Log 'ERROR: No encontre cloudflared.exe'
} else {
    Write-Host '[..] Iniciando tunnel Cloudflare...' -ForegroundColor Yellow
    Start-Process -FilePath $cloudflaredExe -ArgumentList "--config `"$cfConfig`" tunnel run" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Write-Host '[OK] Tunnel Cloudflare iniciado' -ForegroundColor Green
    Log 'Cloudflare tunnel iniciado'
}

# ---------- Resumen ----------
Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '  SISTEMA LISTO' -ForegroundColor Green
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Panel n8n:  http://localhost:5678' -ForegroundColor White
Write-Host ''
Write-Host '  Link de prueba:' -ForegroundColor Yellow
Write-Host '  https://n8n.lacabanaeventos.com/webhook/seleccion?token=TEST-ANGEL-001' -ForegroundColor Green
Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

Log 'Sistema listo'
if (-not $NoPause) { Read-Host 'Presiona Enter para cerrar esta ventana' }
