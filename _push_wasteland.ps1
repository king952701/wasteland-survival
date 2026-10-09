# 通过 GitHub REST API 推送代码（git/443 不通）。空仓库先用 Contents API 建 README，再走标准 commit。
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$base = Join-Path $env:USERPROFILE 'Desktop\hunyuanji'
$git  = Join-Path $base '.toolchain\MinGit\cmd\git.exe'
$Owner = 'king952701'
$Repo  = 'wasteland-survival'

$tok = (Select-String -Path (Join-Path $base '_push_retry.ps1') -Pattern 'ghp_[A-Za-z0-9]+').Matches[0].Value
$h = @{
    'Authorization' = 'token ' + $tok
    'Accept'        = 'application/vnd.github+json'
    'User-Agent'    = 'wasteland-survival'
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function GH($m,$u,$body) {
    for ($i=1; $i -le 5; $i++) {
        try {
            if ($body) {
                $json = $body | ConvertTo-Json -Depth 10
                return Invoke-RestMethod -Uri $u -Method $m -Headers $h -Body $json -ContentType 'application/json' -TimeoutSec 90
            }
            Write-Output ('REQ ' + $m + ' ' + $u)
            return Invoke-RestMethod -Uri $u -Method $m -Headers $h -TimeoutSec 90
        } catch {
            if ($i -eq 5) { throw }
            Start-Sleep -Seconds 5
        }
    }
}

$repo = $null
try { $repo = GH 'Get' "https://api.github.com/repos/$Owner/$Repo" $null } catch {}

# 空仓库没有 git database，直接走 git/blobs 会 409；先用 Contents API 建一个 README 产生 initial commit
if ($repo -and $repo.size -eq 0) {
    $readme = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("# 末世废土\n\n2.5D 等距废土生存游戏。\n"))
    GH 'Put' "https://api.github.com/repos/$Owner/$Repo/contents/README.md" @{ message = 'init: readme'; content = $readme; branch = 'main' } | Out-Null
    Write-Output 'seeded empty repo with README'
}

$msg = (& $git -C $root log -1 --format=%s).Trim()
$files = @(& $git -C $root -c core.quotepath=false ls-files) |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -notmatch '\.bat$') }
Write-Output ("FILES=" + $files.Count)

$ref = GH 'Get' "https://api.github.com/repos/$Owner/$Repo/git/refs/heads/main" $null
$baseSha = $ref.object.sha
Write-Output ("BASE=" + $baseSha)

$tree = @()
foreach ($f in $files) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { continue }
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($p))
    $blob = GH 'Post' "https://api.github.com/repos/$Owner/$Repo/git/blobs" @{ content = $b64; encoding = 'base64' }
    $tree += @{ path = ($f -replace '\\','/'); mode = '100644'; type = 'blob'; sha = $blob.sha }
    Write-Output ('  + ' + $f)
}
if ($tree.Count -eq 0) { Write-Output 'NO FILES'; exit 1 }

$cm = GH 'Get' "https://api.github.com/repos/$Owner/$Repo/git/commits/$baseSha" $null
$nt = GH 'Post' "https://api.github.com/repos/$Owner/$Repo/git/trees" @{ base_tree = $cm.tree.sha; tree = $tree }
$nc = GH 'Post' "https://api.github.com/repos/$Owner/$Repo/git/commits" @{ message = $msg; tree = $nt.sha; parents = @($baseSha) }
$up = GH 'Patch' "https://api.github.com/repos/$Owner/$Repo/git/refs/heads/main" @{ sha = $nc.sha }
Write-Output ('COMMIT=' + $nc.sha)
Write-Output ('REF=' + $up.ref + ' -> ' + $up.object.sha)
Write-Output ("https://github.com/$Owner/$Repo/commit/" + $nc.sha)
