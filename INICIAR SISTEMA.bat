@echo off
title SAN BENITO MIX 2026 - Servidor Central y Sincronizacion
cd /d "%~dp0"

echo ===================================================
echo   INICIANDO SERVIDOR CENTRAL DE SAN BENITO MIX
echo ===================================================
echo.

:: Iniciar servidor local
start /b cmd /c "npm run dev"

:: Iniciar tunel de sincronizacion
start /b cmd /c "cloudflared tunnel --url http://localhost:5173"

echo [OK] Servidor y Sincronizacion iniciados correctamente.
echo Puedes minimizar esta ventana.
echo.
timeout /t 5 >nul
