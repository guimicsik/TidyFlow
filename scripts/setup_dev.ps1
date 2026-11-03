<#
.SYNOPSIS
    Script de setup e deploy em desenvolvimento para a extensao Adobe CEP "AE Organizer".

.DESCRIPTION
    Executa de forma segura e idempotente:
    1. Habilita PlayerDebugMode = "1" (REG_SZ) em HKCU\Software\Adobe\CSXS.9 ate CSXS.16.
    2. Garante a existencia de %APPDATA%\Adobe\CEP\extensions e recria a Junction
       apontando para a raiz do projeto (AE_File_Organizer).
    3. Verifica o arquivo .debug (porta 8089) e exibe instrucoes de abertura e inspecao.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$c_ao        = "$([char]0x00E3)o"   # ao com til
$c_cao       = "$([char]0x00E7)$([char]0x00E3)o" # cao com cedilha e til
$c_oes       = "$([char]0x00F5)es"  # oes com til
$c_ja        = "j$([char]0x00E1)"   # ja com acento
$c_concluido = "conclu$([char]0x00ED)do"
$c_Proximos  = "Pr$([char]0x00F3)ximos"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AE Organizer - Setup de Ambiente de Desenvolvimento (CEP) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Resolve a raiz do projeto a partir da pasta scripts/
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$ManifestPath = Join-Path $ProjectRoot 'CSXS\manifest.xml'

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifesto CEP nao encontrado em: $ManifestPath. Verifique a estrutura do projeto."
}

# ---------------------------------------------------------------------------
# 1. Habilitar PlayerDebugMode (CSXS.9 ate CSXS.16)
# ---------------------------------------------------------------------------
Write-Host "[1/3] Habilitando PlayerDebugMode no Registro do Usuario (HKCU)..." -ForegroundColor Yellow

$CsxsVersions = 9..16
foreach ($Version in $CsxsVersions) {
    $RegKey = "HKCU\Software\Adobe\CSXS.$Version"
    $null = & reg.exe add $RegKey /v PlayerDebugMode /t REG_SZ /d "1" /f
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao gravar PlayerDebugMode na chave $RegKey (codigo $LASTEXITCODE)."
    }
    Write-Host "  [OK] $RegKey -> PlayerDebugMode = `"1`" (REG_SZ)" -ForegroundColor Green
}

Write-Host ""

# ---------------------------------------------------------------------------
# 2. Criar Link Simbolico / Junction em %APPDATA%\Adobe\CEP\extensions
# ---------------------------------------------------------------------------
Write-Host "[2/3] Configurando link da extens$c_ao em %APPDATA%\Adobe\CEP\extensions..." -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
    throw "Variavel de ambiente APPDATA nao definida."
}

$CepExtensionsDir = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
if (-not (Test-Path -LiteralPath $CepExtensionsDir)) {
    $null = New-Item -ItemType Directory -Path $CepExtensionsDir -Force
    Write-Host "  [OK] Diretorio criado: $CepExtensionsDir" -ForegroundColor Green
} else {
    Write-Host "  [OK] Diretorio verificado: $CepExtensionsDir" -ForegroundColor DarkGray
}

$ExtensionFolderName = 'AE_File_Organizer'
$TargetLinkPath = Join-Path $CepExtensionsDir $ExtensionFolderName

# Get-Item -Force detecta inclusive links/junctions quebrados (dangling reparse points)
$ExistingItem = Get-Item -LiteralPath $TargetLinkPath -Force -ErrorAction SilentlyContinue
if ($null -ne $ExistingItem) {
    $IsReparsePoint = ($ExistingItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0

    if ($IsReparsePoint) {
        Write-Host "  [..] Removendo link/junction anterior: $TargetLinkPath" -ForegroundColor DarkYellow
        if ($ExistingItem.PSIsContainer) {
            # rmdir (sem /s) remove apenas o reparse point, preservando intactos os arquivos de origem
            & cmd.exe /d /c rmdir "$TargetLinkPath"
        } else {
            & cmd.exe /d /c del /f /q "$TargetLinkPath"
        }

        if ($LASTEXITCODE -ne 0 -or ($null -ne (Get-Item -LiteralPath $TargetLinkPath -Force -ErrorAction SilentlyContinue))) {
            throw "Nao foi possivel remover o link anterior em: $TargetLinkPath"
        }
    } else {
        $ResolvedExisting = (Resolve-Path -LiteralPath $TargetLinkPath).Path
        if ($ResolvedExisting -ieq $ProjectRoot) {
            throw "Abortado por seguranca: o destino coincide com a propria raiz do projeto ($ProjectRoot)."
        }
        Write-Host "  [..] Removendo diretorio/arquivo anterior em: $TargetLinkPath" -ForegroundColor DarkYellow
        Remove-Item -LiteralPath $TargetLinkPath -Recurse -Force
    }
}

# Cria Directory Junction (nativo no NTFS e nao requer privilegios de Administrador)
$null = New-Item -ItemType Junction -Path $TargetLinkPath -Value $ProjectRoot
Write-Host "  [OK] Junction criada com sucesso:" -ForegroundColor Green
Write-Host "       $TargetLinkPath -> $ProjectRoot" -ForegroundColor Gray

Write-Host ""

# ---------------------------------------------------------------------------
# 3. Verificacao da Porta de Depuracao (.debug) e Orientacoes
# ---------------------------------------------------------------------------
Write-Host "[3/3] Verificando arquivo de depura$c_cao (.debug)..." -ForegroundColor Yellow

$DebugFilePath = Join-Path $ProjectRoot '.debug'
$DebugPort = '8089'

if (Test-Path -LiteralPath $DebugFilePath) {
    try {
        [xml]$DebugXml = Get-Content -LiteralPath $DebugFilePath -Raw -Encoding UTF8
        $AeftHostNode = $DebugXml.SelectSingleNode("//Host[@Name='AEFT']")
        if ($null -ne $AeftHostNode -and -not [string]::IsNullOrWhiteSpace($AeftHostNode.Port)) {
            $DebugPort = $AeftHostNode.Port.Trim()
        }
        Write-Host "  [OK] Arquivo .debug encontrado (Host: AEFT | Porta: $DebugPort)" -ForegroundColor Green
    } catch {
        Write-Host "  [!] Aviso: Falha ao ler XML do arquivo .debug. Utilizando porta padrao $DebugPort." -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  [!] Aviso: Arquivo .debug nao encontrado em $DebugFilePath (porta esperada: $DebugPort)." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Setup $c_concluido com sucesso!                           " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "$c_Proximos passos:" -ForegroundColor White
Write-Host "  1. Reinicie o Adobe After Effects (caso $c_ja esteja aberto)."
Write-Host "  2. No After Effects, abra o painel em:"
Write-Host "       - PT-BR: Janela > Extens$c_oes > AE Organizer" -ForegroundColor Cyan
Write-Host "       - EN-US: Window > Extensions > AE Organizer" -ForegroundColor Cyan
Write-Host "  3. Para inspecionar o console do painel (DevTools):"
Write-Host "       - Abra o Google Chrome e acesse: http://localhost:$DebugPort" -ForegroundColor Cyan
Write-Host ""
