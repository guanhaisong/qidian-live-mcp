# -*- coding: utf-8 -*-
# 一键建 Gitee 仓库并推送（不要把这个文件连同 token 发给别人）
# 用法：$env:GITEE_TOKEN="你的私人令牌"; .\push-gitee.ps1
#   可选：-Private 建私有仓库；-Name 改仓库名
param(
    [string]$Token = $env:GITEE_TOKEN,
    [string]$Name = "hana-live-mcp",
    [string]$Desc = "花酱直播工作台的 MCP 服务：让 TRAE/Cursor/Claude 等编辑器查看与控制本地直播工作台",
    [switch]$Private
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $Token) {
    Write-Host "缺 token。先生成 Gitee 私人令牌（勾 projects 权限），然后：" -ForegroundColor Yellow
    Write-Host '  $env:GITEE_TOKEN="你的令牌"; .\push-gitee.ps1' -ForegroundColor White
    exit 1
}

$api = "https://gitee.com/api/v5"

# 1. 我是谁
$me = Invoke-RestMethod -Uri "$api/user?access_token=$Token" -TimeoutSec 30
$login = $me.login
Write-Host "Gitee 账号：$login" -ForegroundColor Green

# 2. 建仓库（已存在就跳过）
$body = @{
    access_token = $Token
    name         = $Name
    description  = $Desc
    private      = [bool]$Private
    auto_init    = $false
    has_issues   = $true
} | ConvertTo-Json
try {
    $repo = Invoke-RestMethod -Uri "$api/user/repos" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "仓库已创建：$($repo.html_url)" -ForegroundColor Green
} catch {
    Write-Host "创建返回：$($_.Exception.Message)（若已存在，直接推送）" -ForegroundColor Yellow
}

$web = "https://gitee.com/$login/$Name.git"

# 3. 推送（token 只在这一条命令里用，推完把 remote 换成干净地址）
git branch -M main
$existing = git remote 2>$null
if ($existing -contains "origin") {
    git remote set-url origin "https://$login`:$Token@gitee.com/$login/$Name.git"
} else {
    git remote add origin "https://$login`:$Token@gitee.com/$login/$Name.git"
}

git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "推送失败，检查仓库名/权限/网络" -ForegroundColor Red
    exit 1
}

git remote set-url origin $web
Write-Host "" 
Write-Host "完成：https://gitee.com/$login/$Name" -ForegroundColor Cyan
Write-Host "remote 已换成不含 token 的地址：$web" -ForegroundColor Gray
