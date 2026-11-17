# qidian-live-mcp

[![license](https://img.shields.io/npm/l/qidian-live-mcp.svg)](./LICENSE)

麒典直播工作台的 MCP 服务。让 TRAE / Cursor / Claude / Codex 这类支持 MCP 的编辑器，直接在对话里查看直播状态、开播停止、跑自检、复盘留人数据、改写口播稿。

> 这个包只是「遥控器」。真正的直播能力在本地工作台（Windows 应用），两者通过 `127.0.0.1:8787` 通信。
>
> npm 包暂未上架（发布流程见文末），目前用**本机路径**方式接入，效果完全一样。

## 谁能用

只要客户端**跑在主播这台电脑上、并且支持 stdio 型 MCP**，就能用，配置都是同一段 JSON：

| 客户端 | 可用 | 说明 |
| --- | --- | --- |
| TRAE / Cursor / Windsurf / Cline / Continue | 是 | 桌面端，填 `mcpServers` |
| Claude Desktop / Claude Code | 是 | Desktop 用 `claude_desktop_config.json`；Code 用 `claude mcp add` |
| Codex CLI / VS Code + Copilot | 是 | 支持本地 stdio MCP |
| 豆包网页、扣子/Coze、百度智能体等云端 | 否 | 它们跑在厂商服务器上，连不到主播电脑的 `127.0.0.1:8787` |

云端智能体要接，只有把它们能访问的公网 MCP 地址暴露出来，那等于把直播间控制口开放到公网，需要单独做鉴权和限流，本项目不做。

## 前提

1. 本机已安装并启动「麒典直播工作台」（Windows 应用，双击桌面快捷方式，台面打开即算起来）。
2. 方式一、二用 Python 3.10+（安装包自带运行时，不用另装）；方式三用 Node.js ≥ 18。

工作台没启动时，所有工具都会返回一句「工作台没启动」，不会报错崩溃。

## 安装

### 方式一：主播（安装包自带，推荐）

装完「麒典直播工作台」后，安装目录里会有 `mcp.json`。直接把它里面的内容贴进编辑器的 MCP 配置即可：

```json
{
  "mcpServers": {
    "qidian-live": {
      "command": "C:\\Users\\你\\AppData\\Local\\麒典直播工作台\\runtime\\python\\python.exe",
      "args": ["C:\\Users\\你\\AppData\\Local\\麒典直播工作台\\工作台\\mcp_server.py"]
    }
  }
}
```

路径照抄 `mcp.json` 里的真实值，不要照抄上面的示例。

### 方式二：开发者（clone 本仓库）

`mcp_server.py` 只依赖 Python 标准库，不需要 `pip install`：

```json
{
  "mcpServers": {
    "qidian-live": {
      "command": "python",
      "args": ["D:\\路径\\qidian-live-mcp\\mcp_server.py"]
    }
  }
}
```

工作台装在别的机器、或改了端口，就加一个环境变量：

```json
{
  "mcpServers": {
    "qidian-live": {
      "command": "python",
      "args": ["D:\\路径\\qidian-live-mcp\\mcp_server.py"],
      "env": { "QIDIAN_HOST": "http://127.0.0.1:8788" }
    }
  }
}
```

### 方式三：npm（上架后可用）

```json
{
  "mcpServers": {
    "qidian-live": {
      "command": "npx",
      "args": ["-y", "qidian-live-mcp"]
    }
  }
}
```

## 能做什么（11 个工具）

| 工具 | 作用 |
| --- | --- |
| `qidian_state` | 是否在播、轮次、当前段和第几句、在线/看过/评论、掉人最多段、需求榜、合规计数、救场次数、告警、最近日志 |
| `qidian_start` / `qidian_stop` | 开播 / 停止 |
| `qidian_pause` | 暂停或继续（`on: true/false`） |
| `qidian_selftest` | 七项体检：稿子 / 语音 / 大屏 / 弹幕 / 声卡 / 合规词 / 开场钩子 |
| `qidian_stay` | 段落留人表：净掉人数、段内掉得最狠那句、TOP3 |
| `qidian_kw` | 观众需求榜（按次数） |
| `qidian_log` | 最近运行日志 |
| `qidian_fix` | 给掉人最多的段生成 3 个改法 |
| `qidian_fix_apply` | 选定一版写回 `话术.md`（写入前扫违禁词） |
| `qidian_ask` | 按知识库 + 红线试答一条弹幕，不开口播 |

## 合规

- 这个工具是**真人主播的副驾**，不是无人直播。开播必须真人出镜，平台明确禁止无人/录播。
- 所有口播走工作台的护栏：命中联系方式、收益承诺、绝对化、利益诱导等违禁词，那一句会被跳过。
- `qidian_fix_apply` 写回前会再扫一遍，命中直接拒绝。
- 本仓库不含任何直播平台账号、抓取脚本或绕过风控的实现。

## 常见问题

**连上了但每个工具都提示「工作台没启动」**
先双击工作台快捷方式，等台面出来（约 5 秒）再重试。

**`npx` 卡住不动**
国内网络换 `npm i -g qidian-live-mcp` 再用手册第二种配置。

**改了端口**
工作台默认 8787；换了就在 `env` 里设 `QIDIAN_HOST`。

## 开发

```bash
git clone <this repo>
cd qidian-live-mcp
node bin/qidian-live-mcp.js     # 直接跑，stdin 收 JSON-RPC
```

零依赖，没有 `npm install` 这一步。

## 发布 / 上架（维护者看）

MCP 生态里"一次开发、到处能装"靠三样东西：统一协议、npm 包、官方目录。对应到本仓库：

1. `package.json` 里的 `mcpName`（形如 `io.github.<用户名>/qidian-live`）
2. `server.json`（声明 `registryType: npm` + `transport: stdio`）
3. npm 包本体（官方目录只存元数据，不存包）

`publish.ps1` 会把前两样按当前登录的 GitHub 用户名自动补好，再提示剩下的授权步骤：

```powershell
powershell -ExecutionPolicy Bypass -File .\publish.ps1       # 体检 + 生成 + 下载 publisher
npm publish --access public
mcp-publisher login github
mcp-publisher publish
```

`-CheckOnly` 只体检不发布。

## License

MIT
