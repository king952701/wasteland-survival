param([string]$Token)
$repo = 'king952701/wasteland-survival'
$h = @{
    'Authorization' = 'token ' + $Token
    'Accept'        = 'application/vnd.github+json'
    'User-Agent'    = 'wasteland-survival'
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$log = 'D:\moshi\wasteland\production\qa\evidence\build.log'
function W($m) { $t = Get-Date -Format 'HH:mm:ss'; Add-Content -Path $log -Value ("[$t] " + $m) -Encoding UTF8; Write-Output $m }

W 'watching CI...'
$runId = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 15
    $runs = Invoke-RestMethod ("https://api.github.com/repos/$repo/actions/runs?per_page=5") -Headers $h -TimeoutSec 60
    $r = $runs.workflow_runs | Where-Object { $_.head_sha -eq '00e004c2c61951c0d7758d65d616515435169a4f' } | Select-Object -First 1
    if (-not $r) { $r = $runs.workflow_runs[0] }
    if ($r) {
        $runId = $r.id
        W ("run=" + $runId + " status=" + $r.status + " conclusion=" + $r.conclusion + " sha=" + $r.head_sha)
        if ($r.status -eq 'completed') { break }
    }
}
if (-not $runId) { W 'no run found'; exit 1 }

$arts = Invoke-RestMethod ("https://api.github.com/repos/$repo/actions/runs/$runId/artifacts") -Headers $h -TimeoutSec 60
if ($arts.total_count -eq 0) { W 'no artifacts'; exit 1 }
$a = $arts.artifacts[0]
W ('artifact=' + $a.name)
$zip = "$env:TEMP\wasteland-apk.zip"
Invoke-WebRequest -Uri $a.archive_download_url -Headers $h -OutFile $zip -TimeoutSec 300
$out = Join-Path $env:USERPROFILE 'Desktop\末世废土APK'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $out | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $out)
Get-ChildItem $out -Recurse -Filter *.apk | ForEach-Object {
    $dst = Join-Path $out ($_.Name -replace 'app-', '末世废土-')
    Move-Item $_.FullName $dst -Force
    W ('APK: ' + $dst)
}
W 'DONE'
