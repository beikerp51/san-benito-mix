@echo off
title SAN BENITO MIX 2026 — Administrador Central
color 0B
echo =====================================================================
echo           SAN BENITO MIX 2026 - ADMINISTRACION EJECUTIVA
echo =====================================================================
echo.
echo  [1] ACCESO LOCAL (Esta Computadora):
echo      -^> http://localhost:5173
echo.
echo  [2] ACCESO MOVIL NATIVO / INSTALACION APK:
echo      -^> https://queue-kid-stanford-outlet.trycloudflare.com
echo.
echo  [3] ACCESO RED LOCAL WIFI (Misma red sin internet):
echo      -^> http://192.168.1.103:5173
echo.
echo =====================================================================
echo Iniciando servidor seguro y sincronizacion central...
echo.

where cloudflared >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start /B cloudflared tunnel --url http://localhost:5173 > "%TEMP%\cloudflared_sanbenito.log" 2>&1
)

timeout /t 2 /nobreak >nul
start http://localhost:5173
call npm.cmd run dev
pause
