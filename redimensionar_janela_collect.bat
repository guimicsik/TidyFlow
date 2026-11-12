@echo off
chcp 65001 >nul
echo ========================================================
echo   TidyFlow - Fixar Janela Collect Files (510x650)
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\resize_window.ps1" -Width 510 -Height 650
echo.
echo Concluido! Pode voltar ao Premiere Pro / After Effects.
ping 127.0.0.1 -n 3 >nul
