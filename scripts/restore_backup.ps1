<#
    TidyFlow - Restauracao de backup
    ------------------------------------------------------------------------
    Restaura os arquivos salvos em _backup/<pasta> de volta para o projeto.

    Uso:
        powershell -ExecutionPolicy Bypass -File scripts/restore_backup.ps1 -BackupDir "_backup/pre-fase7-20261104-120857"

    Sem -BackupDir, usa o backup mais recente em _backup/.
    Use -WhatIf para apenas listar o que seria copiado.
#>
param(
    [string]$BackupDir = "",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $BackupDir) {
    $latest = Get-ChildItem -Path "_backup" -Directory -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Error "Nenhum backup encontrado em _backup/."
        exit 1
    }
    $BackupDir = $latest.FullName
}

if (-not (Test-Path -LiteralPath $BackupDir)) {
    Write-Error "Pasta de backup inexistente: $BackupDir"
    exit 1
}

Write-Host "Restaurando de: $BackupDir" -ForegroundColor Cyan

$targets = @("client", "host")
$restored = 0

foreach ($folder in $targets) {
    $source = Join-Path $BackupDir $folder
    if (-not (Test-Path -LiteralPath $source)) { continue }
    Get-ChildItem -Path $source -File | ForEach-Object {
        $dest = Join-Path (Join-Path $repoRoot $folder) $_.Name
        if ($WhatIf) {
            Write-Host ("[whatif] " + $_.FullName + " -> " + $dest) -ForegroundColor Yellow
        } else {
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
            Write-Host ("restaurado: " + $folder + "/" + $_.Name) -ForegroundColor Green
        }
        $restored++
    }
}

foreach ($single in @("MANIFESTO_MESTRE.md", "package.json")) {
    $path = Join-Path $BackupDir $single
    if (-not (Test-Path -LiteralPath $path)) { continue }
    if ($WhatIf) {
        Write-Host ("[whatif] " + $path) -ForegroundColor Yellow
    } else {
        Copy-Item -LiteralPath $path -Destination (Join-Path $repoRoot $single) -Force
        Write-Host ("restaurado: " + $single) -ForegroundColor Green
    }
    $restored++
}

Write-Host ("Arquivos processados: " + $restored) -ForegroundColor Cyan
if (-not $WhatIf) {
    Write-Host "Rode 'npm test' para confirmar o estado restaurado." -ForegroundColor Cyan
}
