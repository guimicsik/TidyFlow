@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo ============================================================
echo   Restaurar Ponto de Retorno (v1.0 - Somente After Effects)
echo ============================================================
echo.
echo Isso ira reverter os arquivos para a tag Git: ponto-de-retorno-ae-v1.0
set /p CONFIRM="Tem certeza que deseja restaurar o ponto de retorno? (S/N): "

if /I not "%CONFIRM%"=="S" (
    echo Operacao cancelada.
    exit /b 0
)

pushd "%~dp0.."
git reset --hard ponto-de-retorno-ae-v1.0
git clean -fd -e node_modules
popd

echo.
echo [OK] Ponto de retorno restaurado com sucesso!
pause
