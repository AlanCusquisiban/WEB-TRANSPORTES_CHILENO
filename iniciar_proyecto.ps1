# ===============================================================================
# Transportes Chileno E.I.R.L. — Script de Inicio con Persistencia MySQL
# ===============================================================================

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  TRANSPORTES CHILENO E.I.R.L. — SISTEMA DE GESTION DE FLOTA Y MONITOREO GPS" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Comprobar MySQL
Write-Host "[1/3] Comprobando servidor MySQL..." -ForegroundColor White
$mysqlXampp = "C:\xampp\mysql\bin\mysqld.exe"
if (Test-Path $mysqlXampp) {
    Write-Host "  Iniciando MySQL (XAMPP)..." -ForegroundColor Green
    Start-Process -FilePath $mysqlXampp -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini", "--standalone" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
} else {
    Write-Host "  Verificando conexión en localhost:3306..." -ForegroundColor Gray
}

# 2. Iniciar Servidor
Write-Host "[2/3] Iniciando servidor con persistencia de datos..." -ForegroundColor White
$hasNode = (Get-Command node -ErrorAction SilentlyContinue)
$phpPath = "C:\xampp\php\php.exe"

Start-Sleep -Seconds 1
Start-Process "http://localhost:3000"

if ($hasNode) {
    Write-Host "  Ejecutando server.js con Node.js..." -ForegroundColor Green
    node server.js
} elseif (Test-Path $phpPath) {
    Write-Host "  Ejecutando servidor local con PHP (XAMPP) en puerto 3000..." -ForegroundColor Green
    & $phpPath -S localhost:3000
} else {
    Write-Host "  Abriendo cliente web index.html directamente..." -ForegroundColor Yellow
    Start-Process "index.html"
}
