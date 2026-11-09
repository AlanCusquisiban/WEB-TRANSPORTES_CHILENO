@echo off
chcp 65001 > nul
title Transportes Chileno E.I.R.L. — Sistema de Monitoreo de Flota

echo ===============================================================================
echo   TRANSPORTES CHILENO E.I.R.L. — GESTIÓN DE FLOTA Y MONITOREO GPS
echo ===============================================================================
echo.

echo [1/3] Verificando servicio de Base de Datos MySQL...
where mysqld >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [MySQL] Servicio detectado en PATH.
) else (
    if exist "C:\xampp\mysql\bin\mysqld.exe" (
        echo [MySQL] Iniciando MySQL desde XAMPP...
        start "" /B "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone >nul 2>&1
        timeout /t 2 >nul
    ) else (
        echo [MySQL] Nota: Asegúrese de que su servidor MySQL (XAMPP o MySQL Server 8.0) esté encendido.
    )
)

echo [2/3] Verificando entorno de ejecución del servidor...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Servidor] Iniciando con Node.js (server.js)...
    echo.
    echo El sistema se abrirá automáticamente en: http://localhost:3000
    start "" http://localhost:3000
    node server.js
) else (
    if exist "C:\xampp\php\php.exe" (
        echo [Servidor] Node.js no encontrado. Iniciando con PHP de XAMPP (puerto 3000)...
        echo.
        echo El sistema se abrirá automáticamente en: http://localhost:3000
        start "" http://localhost:3000
        "C:\xampp\php\php.exe" -S localhost:3000
    ) else (
        echo [Servidor] Abriendo la aplicación en modo cliente (interfaz directa)...
        start "" index.html
    )
)

pause
