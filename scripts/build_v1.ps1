$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistDir = Join-Path $ProjectRoot 'dist\v1'
$BundleDir = Join-Path $DistDir 'com.tidyflow'
$InstallerRoot = Join-Path $DistDir 'TidyFlow_v1.0.0_Installer'
$InstallerExtDir = Join-Path $InstallerRoot 'com.tidyflow'
$ZipOut = Join-Path $DistDir 'TidyFlow_v1.0.0_Installer.zip'
$ZxpOut = Join-Path $DistDir 'TidyFlow_v1.0.0.zxp'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TidyFlow V1 - Build de Distribuicao (Bundle + Instalador) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (Test-Path -LiteralPath $DistDir) {
    Remove-Item -LiteralPath $DistDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BundleDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BundleDir 'CSXS') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BundleDir 'client\presets') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BundleDir 'host') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BundleDir 'scripts') | Out-Null

# 1. Copiar arquivos limpos da extensao (sem arquivos de teste, debug ou lixo)
Copy-Item -Path (Join-Path $ProjectRoot 'CSXS\manifest.xml') -Destination (Join-Path $BundleDir 'CSXS\manifest.xml') -Force
Copy-Item -Path (Join-Path $ProjectRoot 'client\*.html') -Destination (Join-Path $BundleDir 'client') -Force
Copy-Item -Path (Join-Path $ProjectRoot 'client\*.css') -Destination (Join-Path $BundleDir 'client') -Force
Copy-Item -Path (Join-Path $ProjectRoot 'client\theme') -Destination (Join-Path $BundleDir 'client') -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot 'client\*.js') -Destination (Join-Path $BundleDir 'client') -Force
Copy-Item -Path (Join-Path $ProjectRoot 'client\presets\default_preset.json') -Destination (Join-Path $BundleDir 'client\presets\default_preset.json') -Force
Copy-Item -Path (Join-Path $ProjectRoot 'host\*.jsx') -Destination (Join-Path $BundleDir 'host') -Force

foreach ($helperFile in @('resize_window.ps1', 'TidyFlowWinApi.dll')) {
    $srcHelper = Join-Path $ProjectRoot ("scripts\" + $helperFile)
    if (Test-Path -LiteralPath $srcHelper) {
        Copy-Item -LiteralPath $srcHelper -Destination (Join-Path $BundleDir ("scripts\" + $helperFile)) -Force
    }
}

Write-Host "[1/3] Bundle limpo preparado em: $BundleDir" -ForegroundColor Green

# 2. Montar pacote One-Click Installer (Windows)
New-Item -ItemType Directory -Force -Path $InstallerRoot | Out-Null
Copy-Item -Path $BundleDir -Destination $InstallerExtDir -Recurse -Force

$InstallPs1Content = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Instalador TidyFlow v1.0.0 (After Effects & Premiere Pro) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Habilitar PlayerDebugMode para CSXS.8 ate CSXS.16
foreach ($v in 8..16) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path -LiteralPath $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -LiteralPath $regPath -Name 'PlayerDebugMode' -Value '1' -Type String -Force
}
Write-Host "[OK] Registro Adobe CEP (PlayerDebugMode) configurado." -ForegroundColor Green

# 2. Copiar extensao para %APPDATA%\Adobe\CEP\extensions\com.tidyflow
$TargetDir = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.tidyflow'
$SourceDir = Join-Path $PSScriptRoot 'com.tidyflow'

if (Test-Path -LiteralPath $TargetDir) {
    Remove-Item -LiteralPath $TargetDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetDir) | Out-Null
Copy-Item -LiteralPath $SourceDir -Destination $TargetDir -Recurse -Force

Write-Host "[OK] TidyFlow instalado em: $TargetDir" -ForegroundColor Green
Write-Host ""
Write-Host "Instalacao concluida! Reinicie o After Effects ou Premiere Pro e acesse:" -ForegroundColor Yellow
Write-Host "  Janela > Extensoes > TidyFlow" -ForegroundColor White
'@

Set-Content -Path (Join-Path $InstallerRoot 'install.ps1') -Value $InstallPs1Content -Encoding UTF8

$InstallBatContent = "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0install.ps1`"`r`npause`r`n"
Set-Content -Path (Join-Path $InstallerRoot 'Instalar_TidyFlow.bat') -Value $InstallBatContent -Encoding ASCII

Compress-Archive -Path "$InstallerRoot\*" -DestinationPath $ZipOut -Force
Write-Host "[2/3] Instalador One-Click ZIP gerado em: $ZipOut" -ForegroundColor Green

# 3. Gerar pacote .ZXP se ZXPSignCmd estiver disponivel
$ZxpTool = Get-Command 'ZXPSignCmd.exe' -ErrorAction SilentlyContinue
if (-not $ZxpTool) {
    $LocalZxpTool = Join-Path $ProjectRoot 'scripts\tools\ZXPSignCmd.exe'
    if (Test-Path -LiteralPath $LocalZxpTool) {
        $ZxpTool = $LocalZxpTool
    }
}

if ($ZxpTool) {
    $CertFile = Join-Path $DistDir 'tidyflow_cert.p12'
    $CertPass = 'tidyflow_v1'
    & $ZxpTool -selfSignedCert BR SP "TidyFlow" "TidyFlow" $CertPass $CertFile | Out-Null
    & $ZxpTool -sign $BundleDir $ZxpOut $CertFile $CertPass | Out-Null
    Remove-Item -LiteralPath $CertFile -Force -ErrorAction SilentlyContinue
    Write-Host "[3/3] Arquivo ZXP assinado gerado em: $ZxpOut" -ForegroundColor Green
} else {
    # Gerar tambem um pacote .zxp (ZIP padrao compativel com ZXP Installers que aceitam pacote unsigned/zip)
    $UnsignedZip = Join-Path $DistDir 'TidyFlow_v1.0.0_unsigned.zip'
    Compress-Archive -Path "$BundleDir\*" -DestinationPath $UnsignedZip -Force
    Copy-Item -LiteralPath $UnsignedZip -Destination $ZxpOut -Force
    Remove-Item -LiteralPath $UnsignedZip -Force
    Write-Host "[3/3] Pacote ZXP gerado em: $ZxpOut (para assinatura criptografica opcional, coloque ZXPSignCmd.exe em scripts\tools\)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build V1 finalizado com sucesso!" -ForegroundColor Cyan
