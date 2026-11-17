# -*- coding: utf-8 -*-
# 麒典 MCP 上架脚本：补 mcpName、生成 server.json、查依赖、发 npm、进官方目录
# 用法：powershell -ExecutionPolicy Bypass -File .\publish.ps1
#       powershell ... .\publish.ps1 -CheckOnly    # 只体检，不发布
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Say($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }

# ---------- 0. 工具检查 ----------
$gh = (Get-Command gh -ErrorAction SilentlyContinue)
if (-not $gh) {
    $cand = Join-Path $env:LOCALAPPDATA "gh-cli\gh.exe"
    if (Test-Path $cand) { $gh = $cand }
}
if (-not $gh) { Say "缺 gh（GitHub CLI）。先装：winget install GitHub.cli" "Red"; exit 1 }
$ghExe = if ($gh -is [string]) { $gh } else { $gh.Source }

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Say "缺 npm。先装 Node.js 18+。" "Red"; exit 1 }

Say "== 1/5 检查登录状态 ==" "Cyan"

$login = $null
try { $login = (& $ghExe api user --jq .login 2>$null) } catch { }
if (-not $login) {
    Say "GitHub 未登录。先执行：" "Yellow"
    Say "  gh auth login --hostname github.com --git-protocol https --web" "White"
    Say "授权完再跑一次本脚本。" "Yellow"
    exit 2
}
Say "GitHub: $login" "Green"

$who = $null
try { $who = (& npm whoami 2>$null) } catch { }
if (-not $who) {
    Say "npm 未登录。先执行：" "Yellow"
    Say "  npm login" "White"
    Say "登录完再跑一次本脚本。" "Yellow"
    exit 2
}
Say "npm: $who" "Green"

# ---------- 1. 补 package.json ----------
Say "== 2/5 补 package.json（mcpName / repository）==" "Cyan"
$pkgPath = Join-Path $PSScriptRoot "package.json"
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$serverName = "io.github.$login/qidian-live"
$repoUrl = "https://github.com/$login/qidian-live-mcp"

$pkg | Add-Member -NotePropertyName "mcpName" -NotePropertyValue $serverName -Force
$pkg | Add-Member -NotePropertyName "repository" -NotePropertyValue ([pscustomobject]@{ type = "git"; url = "$repoUrl.git" }) -Force
$pkg | Add-Member -NotePropertyName "homepage" -NotePropertyValue $repoUrl -Force
$pkg | Add-Member -NotePropertyName "bugs" -NotePropertyValue ([pscustomobject]@{ url = "$repoUrl/issues" }) -Force
($pkg | ConvertTo-Json -Depth 10) | Set-Content $pkgPath -Encoding UTF8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($pkgPath, ((Get-Content $pkgPath -Raw -Encoding UTF8)), $utf8NoBom)
Say "mcpName = $serverName" "Green"

# ---------- 2. 生成 server.json ----------
Say "== 3/5 生成 server.json ==" "Cyan"
$ver = $pkg.version
$server = [ordered]@{
    '${SCHEMA}' = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
    name        = $serverName
    title       = "麒典直播工作台"
    description = "Control and inspect a local live-streaming workbench (status, start/stop, self-test, retention data, script rewrite)."
    repository  = [ordered]@{ url = $repoUrl; source = "github" }
    version     = $ver
    packages    = @(
        [ordered]@{
            registryType = "npm"
            identifier   = "qidian-live-mcp"
            version      = $ver
            transport    = [ordered]@{ type = "stdio" }
        }
    )
}
$json = $server | ConvertTo-Json -Depth 10
$json = $json.Replace('"${SCHEMA}"', '"$schema"')
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "server.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
Say "server.json 已写入（$serverName @ $ver）" "Green"

# ---------- 3. 查重 ----------
Say "== 4/5 检查 npm 上是否已有这个版本 ==" "Cyan"
$published = $null
try { $published = (& npm view "qidian-live-mcp@$ver" version 2>$null) } catch { }
if ($published) { Say "npm 上已有 qidian-live-mcp@$ver，跳过发布" "Yellow" }
else { Say "npm 上还没有 qidian-live-mcp@$ver" "Gray" }

# ---------- 4. mcp-publisher ----------
Say "== 5/5 检查 mcp-publisher ==" "Cyan"
$exe = (Get-Command mcp-publisher -ErrorAction SilentlyContinue)
if (-not $exe) {
    $tools = Join-Path $PSScriptRoot "tools"
    if (-not (Test-Path $tools)) { New-Item -ItemType Directory -Path $tools | Out-Null }
    $target = Join-Path $tools "mcp-publisher.exe"
    if (Test-Path $target) { $exe = $target }
}
if (-not $exe) {
    Say "没找到 mcp-publisher，尝试下载（走镜像，失败的源会自动跳过）" "Gray"
    $urls = @(
        "https://gh-proxy.com/https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_amd64.tar.gz",
        "https://ghfast.top/https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_amd64.tar.gz",
        "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_amd64.tar.gz"
    )
    $tgz = Join-Path $tools "mcp-publisher.tar.gz"
    foreach ($u in $urls) {
        try {
            Say "  下载：$u" "DarkGray"
            Invoke-WebRequest -Uri $u -OutFile $tgz -TimeoutSec 120
            if ((Get-Item $tgz).Length -gt 1000000) { break }
        } catch { Say "  失败，换下一个源" "DarkGray" }
    }
    if (Test-Path $tgz) {
        tar xf $tgz -C $tools mcp-publisher.exe 2>$null
        Remove-Item $tgz -Force -ErrorAction SilentlyContinue
        if (Test-Path (Join-Path $tools "mcp-publisher.exe")) { $exe = Join-Path $tools "mcp-publisher.exe" }
    }
}
if (-not $exe) {
    Say "mcp-publisher 没下下来。手动装：winget install Anysphere...（或从 github.com/modelcontextprotocol/registry/releases 下 mcp-publisher_windows_amd64.tar.gz）" "Yellow"
} else {
    Say "mcp-publisher: $exe" "Green"
}

# ---------- 结束：给人看的最后几步 ----------
Say "" ; Say "== 体检完成 ==" "Cyan"
Say "接下来按顺序执行（都需要浏览器授权）：" "White"
if (-not $published) { Say "  1) npm publish --access public" "White" }
if ($exe) {
    Say "  2) mcp-publisher login github" "White"
    Say "  3) mcp-publisher publish" "White"
}
Say "" 
Say "验证：npm view qidian-live-mcp version / 官方目录搜 $serverName" "Gray"

if ($CheckOnly) { Say "（-CheckOnly：没有真的发布）" "Yellow" }
