param(
    [int]$Width = 510,
    [int]$Height = 650,
    [switch]$AllowResize = $false,
    [switch]$MainPanel = $false,
    [int]$CollectX = -99999,
    [int]$CollectY = -99999
)

$logFile = Join-Path $PSScriptRoot "resize_debug.log"
"=== RUN $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Target=${Width}x${Height} AllowResize=$AllowResize CollectXY=($CollectX,$CollectY) ===" | Out-File $logFile -Append -Encoding utf8

$mainRect = $null
$mainRectFile = Join-Path $PSScriptRoot "main_panel_rect.json"
if (Test-Path $mainRectFile) {
    try { $mainRect = Get-Content $mainRectFile -Raw | ConvertFrom-Json } catch {}
}

$collectRect = $null
$collectRectFile = Join-Path $PSScriptRoot "collect_panel_rect.json"
if (Test-Path $collectRectFile) {
    try { $collectRect = Get-Content $collectRectFile -Raw | ConvertFrom-Json } catch {}
}
if ($CollectX -eq -99999 -and $null -ne $collectRect -and $null -ne $collectRect.screenX) {
    $CollectX = [int]$collectRect.screenX
    $CollectY = [int]$collectRect.screenY
}

$dllFile = Join-Path $PSScriptRoot "TidyFlowWinApi.dll"
if (-not ([System.Management.Automation.PSTypeName]'TidyFlowWinApi').Type) {
    if (Test-Path $dllFile) {
        try { [Reflection.Assembly]::LoadFrom($dllFile) | Out-Null } catch {}
    }
}
if (-not ([System.Management.Automation.PSTypeName]'TidyFlowWinApi').Type) {
    $csCode = @"
    using System;
    using System.Text;
    using System.Runtime.InteropServices;

    public class TidyFlowWinApi {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }
    }
"@
    try {
        Add-Type -TypeDefinition $csCode -OutputAssembly $dllFile
        [Reflection.Assembly]::LoadFrom($dllFile) | Out-Null
    } catch {
        Add-Type -TypeDefinition $csCode
    }
}

$candidates = New-Object System.Collections.Generic.List[PSObject]

[TidyFlowWinApi]::EnumWindows({
    param($hwnd, $lparam)
    if (-not [TidyFlowWinApi]::IsWindowVisible($hwnd)) {
        return $true
    }

    $len = [TidyFlowWinApi]::GetWindowTextLength($hwnd)
    $title = ""
    if ($len -gt 0) {
        $sb = New-Object System.Text.StringBuilder ($len + 1)
        [TidyFlowWinApi]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
        $title = $sb.ToString()
    }

    $clsSb = New-Object System.Text.StringBuilder 256
    [TidyFlowWinApi]::GetClassName($hwnd, $clsSb, 256) | Out-Null
    $className = $clsSb.ToString()

    # Ignora a janela principal com titulo do Premiere Pro / After Effects
    if ($title -like "Adobe Premiere Pro*" -or $title -like "Adobe After Effects*") {
        return $true
    }

    $script:hasTitleMatch = $false
    $script:foundCefChild = [IntPtr]::Zero
    $script:cefCount = 0

    if ($title -like "*Collect Files*" -or $title -like "*TidyFlow*Collect*" -or $title -like "*Project Manager*") {
        $script:hasTitleMatch = $true
    }

    [TidyFlowWinApi]::EnumChildWindows($hwnd, {
        param($childHwnd, $childLparam)
        $cLen = [TidyFlowWinApi]::GetWindowTextLength($childHwnd)
        $cTitle = ""
        if ($cLen -gt 0) {
            $cSb = New-Object System.Text.StringBuilder ($cLen + 1)
            [TidyFlowWinApi]::GetWindowText($childHwnd, $cSb, $cSb.Capacity) | Out-Null
            $cTitle = $cSb.ToString()
        }

        $cClsSb = New-Object System.Text.StringBuilder 256
        [TidyFlowWinApi]::GetClassName($childHwnd, $cClsSb, 256) | Out-Null
        $cClass = $cClsSb.ToString()

        if ($cTitle -like "*Collect Files*" -or $cTitle -like "*TidyFlow*Collect*") {
            $script:hasTitleMatch = $true
        }

        if ($cClass -eq "Chrome_WidgetWin_0") {
            $script:cefCount++
            if ($script:foundCefChild -eq [IntPtr]::Zero) {
                $script:foundCefChild = $childHwnd
            }
        } elseif ($cClass -eq "CEF-OSC-WIDGET" -and $script:foundCefChild -eq [IntPtr]::Zero) {
            $script:foundCefChild = $childHwnd
        }
        return $true
    }, [IntPtr]::Zero) | Out-Null

    if ($script:hasTitleMatch -or ($className -like "DroverLord*" -and $script:foundCefChild -ne [IntPtr]::Zero)) {
        $topRect = New-Object TidyFlowWinApi+RECT
        [TidyFlowWinApi]::GetWindowRect($hwnd, [ref]$topRect) | Out-Null
        $outerW = $topRect.Right - $topRect.Left
        $outerH = $topRect.Bottom - $topRect.Top

        $innerW = 0
        $innerH = 0
        $cefLeft = $topRect.Left
        $cefTop = $topRect.Top
        if ($script:foundCefChild -ne [IntPtr]::Zero) {
            $cefRect = New-Object TidyFlowWinApi+RECT
            if ([TidyFlowWinApi]::GetWindowRect($script:foundCefChild, [ref]$cefRect)) {
                $innerW = $cefRect.Right - $cefRect.Left
                $innerH = $cefRect.Bottom - $cefRect.Top
                $cefLeft = $cefRect.Left
                $cefTop = $cefRect.Top
            }
        }

        $deltaW = $outerW - $innerW
        $deltaH = $outerH - $innerH

        $item = New-Object PSObject -Property @{
            Hwnd           = $hwnd
            HwndInt        = $hwnd.ToInt64()
            Title          = $title
            ClassName      = $className
            CefChild       = $script:foundCefChild
            CefCount       = $script:cefCount
            HasTitleMatch  = $script:hasTitleMatch
            TopLeft        = $topRect.Left
            TopTop         = $topRect.Top
            OuterW         = $outerW
            OuterH         = $outerH
            CefLeft        = $cefLeft
            CefTop         = $cefTop
            InnerW         = $innerW
            InnerH         = $innerH
            DeltaW         = $deltaW
            DeltaH         = $deltaH
        }
        $candidates.Add($item)
        ("CANDIDATE: hwnd={0} top=({1},{2} {3}x{4}) cef=({5},{6} {7}x{8}) delta=({9},{10}) cefCount={11} titleMatch={12}" -f $item.HwndInt, $item.TopLeft, $item.TopTop, $item.OuterW, $item.OuterH, $item.CefLeft, $item.CefTop, $item.InnerW, $item.InnerH, $item.DeltaW, $item.DeltaH, $item.CefCount, $item.HasTitleMatch) | Out-File $logFile -Append -Encoding utf8
    }

    return $true
}, [IntPtr]::Zero) | Out-Null

if ($MainPanel) {
    # Somente uma janela flutuante com um único CEF na posição do painel é elegível.
    $matches = @($candidates | Where-Object {
        -not $_.HasTitleMatch -and $_.CefCount -eq 1 -and
        $_.DeltaW -ge 0 -and $_.DeltaW -lt 100 -and
        $_.DeltaH -ge 0 -and $_.DeltaH -lt 160 -and
        $null -ne $mainRect -and
        ([Math]::Abs($_.CefLeft - [int]$mainRect.screenX) + [Math]::Abs($_.CefTop - [int]$mainRect.screenY) -lt 40)
    })
    if ($matches.Count -eq 1) {
        $target = $matches[0]
        $style = [TidyFlowWinApi]::GetWindowLong($target.Hwnd, -16)
        $newStyle = $style -band (-bnot [int]0x00040000) -band (-bnot [int]0x00010000)
        [TidyFlowWinApi]::SetWindowLong($target.Hwnd, -16, $newStyle) | Out-Null
        [TidyFlowWinApi]::SetWindowPos($target.Hwnd, [IntPtr]::Zero, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0004 -bor 0x0020) | Out-Null
        [TidyFlowWinApi]::SetWindowPos($target.Hwnd, [IntPtr]::Zero, 0, 0, ($Width + $target.DeltaW), ($Height + $target.DeltaH), 0x0002 -bor 0x0004 -bor 0x0020) | Out-Null
        Write-Output "MAIN_WINDOW_LOCKED"
    } else {
        Write-Output "MAIN_WINDOW_NOT_FOUND"
    }
    exit
}

# Funcao auxiliar para destravar uma janela que NAO e o Collect Files (ex: painel principal)
function Unlock-NonCollectWindow($cand) {
    $h = $cand.Hwnd
    $style = [TidyFlowWinApi]::GetWindowLong($h, -16)
    $unlockedStyle = $style -bor 0x00040000 -bor 0x00010000
    $needsFrameRestore = ($style -ne $unlockedStyle)
    $needsSizeRestore = ($cand.HwndInt -eq 593328 -and $cand.OuterW -le 560)

    if ($needsFrameRestore) {
        [TidyFlowWinApi]::SetWindowLong($h, -16, $unlockedStyle) | Out-Null
        [TidyFlowWinApi]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0004 -bor 0x0020) | Out-Null
    }
    if ($needsSizeRestore) {
        [TidyFlowWinApi]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 1104, 679, 0x0002 -bor 0x0004 -bor 0x0020) | Out-Null
    }
    if ($needsFrameRestore -or $needsSizeRestore) {
        ("UNLOCKED MAIN/OTHER: hwnd={0} style={1:X8}->{2:X8} restoredSize={3}" -f $cand.HwndInt, $style, $unlockedStyle, $needsSizeRestore) | Out-File $logFile -Append -Encoding utf8
    }
}

# Filtra qual candidato e o Collect Files e quais sao o Painel Principal / outros
$chosenCollect = $null

foreach ($cand in $candidates) {
    $isCollect = $false

    # 1. Se tem título explícito do Collect Files / Project Manager, é 100% o Collect
    if ($cand.HasTitleMatch) {
        $isCollect = $true
    }
    # 2. Se as coordenadas passadas pelo Collect batem com esta janela CEF
    elseif ($CollectX -ne -99999 -and $cand.CefCount -eq 1 -and $cand.DeltaW -lt 100) {
        $distCef = [Math]::Abs($cand.CefLeft - $CollectX) + [Math]::Abs($cand.CefTop - $CollectY)
        $distTop = [Math]::Abs($cand.TopLeft - $CollectX) + [Math]::Abs($cand.TopTop - $CollectY)
        if ([Math]::Min($distCef, $distTop) -lt 40) {
            $isCollect = $true
        }
    }

    # Se a janela for identificada como Painel Principal/Workspace (CefCount > 1 ou DeltaW grande ou ID conhecido), NUNCA é o Collect
    if ($cand.HwndInt -eq 593328 -or $cand.CefCount -gt 1 -or $cand.DeltaW -gt 150) {
        $isCollect = $false
    }
    if ($null -ne $mainRect -and $null -ne $mainRect.screenX) {
        $distMain = [Math]::Abs($cand.TopLeft - [int]$mainRect.screenX) + [Math]::Abs($cand.TopTop - [int]$mainRect.screenY)
        if ($distMain -lt 25 -and (-not $cand.HasTitleMatch)) {
            $isCollect = $false
        }
    }

    if (-not $isCollect) {
        if ($null -ne $mainRect -and $cand.CefCount -eq 1 -and
            ([Math]::Abs($cand.CefLeft - [int]$mainRect.screenX) + [Math]::Abs($cand.CefTop - [int]$mainRect.screenY) -lt 40)) {
            continue
        }
        # Não é o Collect: garante que não está travada
        Unlock-NonCollectWindow $cand
        continue
    }

    # Candidato elegível do Collect Files
    if ($null -eq $chosenCollect) {
        $chosenCollect = $cand
    } elseif ($cand.HasTitleMatch -and -not $chosenCollect.HasTitleMatch) {
        Unlock-NonCollectWindow $chosenCollect
        $chosenCollect = $cand
    } elseif ($CollectX -ne -99999) {
        $distCurr = [Math]::Min(
            [Math]::Abs($cand.TopLeft - $CollectX) + [Math]::Abs($cand.TopTop - $CollectY),
            [Math]::Abs($cand.CefLeft - $CollectX) + [Math]::Abs($cand.CefTop - $CollectY)
        )
        $distPrev = [Math]::Min(
            [Math]::Abs($chosenCollect.TopLeft - $CollectX) + [Math]::Abs($chosenCollect.TopTop - $CollectY),
            [Math]::Abs($chosenCollect.CefLeft - $CollectX) + [Math]::Abs($chosenCollect.CefTop - $CollectY)
        )
        if ($distCurr -lt $distPrev) {
            Unlock-NonCollectWindow $chosenCollect
            $chosenCollect = $cand
        } else {
            Unlock-NonCollectWindow $cand
        }
    } else {
        Unlock-NonCollectWindow $cand
    }
}

if ($null -ne $chosenCollect) {
    $targetHwnd = $chosenCollect.Hwnd
    $style = [TidyFlowWinApi]::GetWindowLong($targetHwnd, -16)
    if ($AllowResize) {
        $newStyle = $style -bor 0x00040000 -bor 0x00010000
    } else {
        $newStyle = ($style -band (-bnot [int]0x00040000) -band (-bnot [int]0x00010000))
    }
    [TidyFlowWinApi]::SetWindowLong($targetHwnd, -16, $newStyle) | Out-Null
    [TidyFlowWinApi]::SetWindowPos($targetHwnd, [IntPtr]::Zero, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0004 -bor 0x0020) | Out-Null

    $topRect = New-Object TidyFlowWinApi+RECT
    [TidyFlowWinApi]::GetWindowRect($targetHwnd, [ref]$topRect) | Out-Null
    $outerW = $topRect.Right - $topRect.Left
    $outerH = $topRect.Bottom - $topRect.Top

    $finalW = $Width
    $finalH = $Height

    if ($chosenCollect.CefChild -ne [IntPtr]::Zero) {
        $cefRect = New-Object TidyFlowWinApi+RECT
        if ([TidyFlowWinApi]::GetWindowRect($chosenCollect.CefChild, [ref]$cefRect)) {
            $innerW = $cefRect.Right - $cefRect.Left
            $innerH = $cefRect.Bottom - $cefRect.Top
            if ($innerW -gt 100 -and $innerH -gt 100 -and $outerW -ge $innerW -and $outerH -ge $innerH) {
                $deltaW = $outerW - $innerW
                $deltaH = $outerH - $innerH
                if ($deltaW -lt 120 -and $deltaH -lt 160) {
                    $finalW = $Width + $deltaW
                    $finalH = $Height + $deltaH
                }
            }
        }
    }

    $ok = [TidyFlowWinApi]::SetWindowPos($targetHwnd, [IntPtr]::Zero, 0, 0, $finalW, $finalH, 0x0002 -bor 0x0004 -bor 0x0020)
    $logLine = ("ACTION on hwnd={0} outer={1}x{2} -> final={3}x{4} ok={5} style={6:X8}->{7:X8}" -f $chosenCollect.HwndInt, $outerW, $outerH, $finalW, $finalH, $ok, $style, $newStyle)
    $logLine | Out-File $logFile -Append -Encoding utf8

    $msg = "SUCCESS: Resized Collect window (hwnd=$($chosenCollect.HwndInt)) to ${Width}x${Height}"
    $msg | Out-File $logFile -Append -Encoding utf8
    Write-Output $msg
} else {
    $msg = "WINDOW_NOT_FOUND"
    $msg | Out-File $logFile -Append -Encoding utf8
    Write-Output $msg
}
