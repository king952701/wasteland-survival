# Starfield Ranch - Android toolchain installer
#   JDK 17      : huaweicloud mirror
#   Gradle 8.5  : tencent mirror
#   Android SDK : dl.google.com  (needs reachable network / proxy)
# Usage:
#   powershell -ExecutionPolicy Bypass -File _setup_toolchain.ps1
# With proxy:
#   set HTTPS_PROXY=http://127.0.0.1:7890  then run again

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Split-Path -Parent $here
$tc   = Join-Path $root '.toolchain'
$sdk  = Join-Path $tc 'android-sdk'
$tmp  = Join-Path $tc 'dl'

New-Item -ItemType Directory -Force -Path $tc  | Out-Null
New-Item -ItemType Directory -Force -Path $sdk | Out-Null
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Say {
    param($m)
    Write-Output ('[setup] ' + $m)
}

function Get-Proxy {
    $p = $env:HTTPS_PROXY
    if (-not $p) { $p = $env:HTTP_PROXY }
    return $p
}

# Downloads url -> out. Returns ONLY $true/$false (logs via Write-Host on purpose,
# otherwise the log strings leak into the return value and if(Dl ...) is always true).
function Dl {
    param($url, $out)

    if (Test-Path $out) {
        $sz = (Get-Item $out).Length
        if ($sz -gt 100000) {
            Write-Host '[setup] skip, already downloaded'
            return $true
        }
    }

    Write-Host '[setup] downloading ...'
    Write-Host ('[setup]   ' + $url)

    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'Mozilla/5.0')
        $px = Get-Proxy
        if ($px) {
            Write-Host ('[setup]   proxy ' + $px)
            $wc.Proxy = New-Object System.Net.WebProxy($px)
        }
        $wc.DownloadFile($url, $out)
        $wc.Dispose()
    } catch {
        Write-Host '[setup]   FAILED to download'
        return $false
    }

    if (-not (Test-Path $out)) {
        Write-Host '[setup]   FAILED, file missing'
        return $false
    }
    $len = (Get-Item $out).Length
    if ($len -lt 100000) {
        Write-Host '[setup]   FAILED, file too small'
        return $false
    }
    Write-Host ('[setup]   ok, ' + [math]::Round($len / 1048576, 1) + ' MB')
    return $true
}

# ---------------- 1. JDK 17 ----------------
$jdkZip = Join-Path $tmp 'jdk17.zip'
$jdkDir = $null
$hit = Get-ChildItem $tc -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'jdk*' } | Select-Object -First 1
if ($hit) {
    $jdkDir = $hit.FullName
    Say ('JDK already installed: ' + $jdkDir)
} else {
    if (Dl 'https://repo.huaweicloud.com/openjdk/17/openjdk-17_windows-x64_bin.zip' $jdkZip) {
        Say 'extracting JDK ...'
        Expand-Archive -Path $jdkZip -DestinationPath $tc -Force
        $hit = Get-ChildItem $tc -Directory | Where-Object { $_.Name -like 'jdk*' } | Select-Object -First 1
        if ($hit) { $jdkDir = $hit.FullName }
    }
}
if (-not $jdkDir) { Say '!! JDK missing' } else { Say ('JAVA_HOME = ' + $jdkDir) }

# ---------------- 2. Gradle 8.5 ----------------
$grZip = Join-Path $tmp 'gradle-8.5-bin.zip'
$grDir = Join-Path $tc 'gradle-8.5'
$grBat = Join-Path $grDir 'bin\gradle.bat'
if (Test-Path $grBat) {
    Say ('Gradle already installed: ' + $grBat)
} else {
    if (Dl 'https://mirrors.cloud.tencent.com/gradle/gradle-8.5-bin.zip' $grZip) {
        Say 'extracting Gradle ...'
        Expand-Archive -Path $grZip -DestinationPath $tc -Force
    }
}
if (-not (Test-Path $grBat)) { Say '!! Gradle missing' } else { Say ('GRADLE = ' + $grBat) }

# ---------------- 3. Android cmdline-tools ----------------
# From here on we need dl.google.com. Do not abort the whole script on failure.
$ErrorActionPreference = 'Continue'

$cmdZip = Join-Path $tmp 'cmdline-tools.zip'
$cmtDir = Join-Path $sdk 'cmdline-tools\latest'
$sdkmgr = Join-Path $cmtDir 'bin\sdkmanager.bat'

if (Test-Path $sdkmgr) {
    Say 'cmdline-tools already installed'
} else {
    $versions = @('11076708', '10406996', '9477386')
    foreach ($v in $versions) {
        $u = 'https://dl.google.com/android/repository/commandlinetools-win-' + $v + '_latest.zip'
        $ok = Dl $u $cmdZip
        if ($ok) {
            Say 'extracting cmdline-tools ...'
            try {
                $cmtTmp = Join-Path $tmp 'cmt'
                Expand-Archive -Path $cmdZip -DestinationPath $cmtTmp -Force
                $inner = Join-Path $cmtTmp 'cmdline-tools'
                New-Item -ItemType Directory -Force -Path (Split-Path $cmtDir) | Out-Null
                if (Test-Path $cmtDir) { Remove-Item $cmtDir -Recurse -Force }
                if (Test-Path $inner) { Move-Item $inner $cmtDir -Force }
            } catch {
                Say 'extract failed'
            }
            break
        }
    }
}
if (-not (Test-Path $sdkmgr)) {
    Say '!! Android cmdline-tools NOT available'
    Say '!! dl.google.com is unreachable from this network'
}

# ---------------- 4. SDK platform + build-tools ----------------
$platDir = Join-Path $sdk 'platforms\android-34'
$btDir   = Join-Path $sdk 'build-tools\34.0.0'
$needPlat = -not (Test-Path (Join-Path $platDir 'android.jar'))
$needBt   = -not (Test-Path (Join-Path $btDir 'aapt2.exe'))

if ((Test-Path $sdkmgr) -and ($needPlat -or $needBt)) {
    Say 'installing platform-tools, android-34, build-tools 34.0.0 ...'
    $env:JAVA_HOME = $jdkDir
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk

    $px = Get-Proxy
    if ($px) {
        try {
            $u = [Uri]$px
            $env:JAVA_OPTS = '-Dhttp.proxyHost=' + $u.Host + ' -Dhttp.proxyPort=' + $u.Port +
                             ' -Dhttps.proxyHost=' + $u.Host + ' -Dhttps.proxyPort=' + $u.Port
            Say ('sdkmanager proxy ' + $u.Host + ':' + $u.Port)
        } catch {
            Say 'bad proxy url'
        }
    }

    $licDir = Join-Path $sdk 'licenses'
    New-Item -ItemType Directory -Force -Path $licDir | Out-Null
    $h1 = '24333f8a63b6825ea9c5514f83c2829b004d1fee'
    $h2 = '84831b9409646a7e0ea75307c8fede8f78d3fbb1'
    Set-Content -Path (Join-Path $licDir 'android-sdk-license') -Value ($h1 + "`n" + $h2) -Encoding ASCII

    & $sdkmgr --sdk_root=$sdk --install 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0' 2>&1 | Out-String | Write-Output
}

if (Test-Path (Join-Path $platDir 'android.jar')) { Say 'platform android-34 ready' } else { Say '!! platform android-34 missing' }
if (Test-Path (Join-Path $btDir 'aapt2.exe'))     { Say 'build-tools 34.0.0 ready' } else { Say '!! build-tools 34.0.0 missing' }

# ---------------- 5. env.bat for cmd ----------------
$envBat = Join-Path $tc 'env.bat'
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add('@echo off')
if ($jdkDir) {
    [void]$lines.Add('set "JAVA_HOME=' + $jdkDir + '"')
    [void]$lines.Add('set "PATH=' + $jdkDir + '\bin;%PATH%"')
}
[void]$lines.Add('set "ANDROID_HOME=' + $sdk + '"')
[void]$lines.Add('set "ANDROID_SDK_ROOT=' + $sdk + '"')
[void]$lines.Add('set "GRADLE_BAT=' + $grBat + '"')
# ANSI encoding so cmd can read the Chinese path correctly
[System.IO.File]::WriteAllLines($envBat, $lines, [System.Text.Encoding]::Default)
Say ('wrote ' + $envBat)

Say '========== SUMMARY =========='
Say ('JAVA_HOME    = ' + $jdkDir)
Say ('GRADLE       = ' + $grBat)
Say ('ANDROID_HOME = ' + $sdk)
Say '============================='
