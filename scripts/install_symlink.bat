@echo off
setlocal EnableExtensions

:: Launcher em lote para Prompt de Comando (cmd.exe) e Windows Explorer.
:: Delega a execucao de forma segura e idempotente para scripts\setup_dev.ps1.

set "PS_SCRIPT=%~dp0setup_dev.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERRO] Script PowerShell nao encontrado em: "%PS_SCRIPT%"
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERRO] O setup falhou com codigo de saida %EXIT_CODE%.
    exit /b %EXIT_CODE%
)

exit /b 0
