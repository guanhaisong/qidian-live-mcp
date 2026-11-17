# hana-live-mcp

花酱直播工作台的 MCP 服务。让 TRAE / Cursor / Claude 这类支持 MCP 的编辑器，直接在对话里查看直播状态、开播停止、跑自检、复盘留人数据、改写口播稿。

> 这个包只是「遥控器」。真正的直播能力在本地工作台（Windows 应用），两者通过 `127.0.0.1:8787` 通信。

## 前提

1. 本机已安装并启动「花酱直播工作台」（Windows 应用，双击桌面快捷方式，台面打开即算起来）。
2. Node.js ≥ 18（`node -v` 能出版本号即可）。

工作台没启动时，所有工具都会返回一句「工作台没启动」，不会报错崩溃。

## 安装

在编辑器的 MCP 配置里加一段（TRAE / Cursor 都是这个格式）：

```json
{
  "mcpServers": {
    "hana-live": {
      "command": "npx",
      "args": ["-y", "hana-live-mcp"]
    }
  }
}
```

国内网络如果拉包慢，可以先装到本地再指路径：

```bash
npm i -g hana-live-mcp
```

```json
{
  "mcpServers": {
    "hana-live": {
      "command": "hana-live-mcp"
    }
  }
}
```

工作台装在别的机器、或改了端口，就加一个环境变量：

```json
{
  "mcpServers": {
    "hana-live": {
      "command": "npx",
      "args": ["-y", "hana-live-mcp"],
      "env": { "HANA_HOST": "http://127.0.0.1:8788" }
    }
  }
}
```

## 能做什么（11 个工具）

| 工具 | 作用 |
| --- | --- |
| `hana_state` | 是否在播、轮次、当前段和第几句、在线/看过/评论、掉人最多段、需求榜、合规计数、救场次数、告警、最近日志 |
| `hana_start` / `hana_stop` | 开播 / 停止 |
| `hana_pause` | 暂停或继续（`on: true/false`） |
| `hana_selftest` | 七项体检：稿子 / 语音 / 大屏 / 弹幕 / 声卡 / 合规词 / 开场钩子 |
| `hana_stay` | 段落留人表：净掉人数、段内掉得最狠那句、TOP3 |
| `hana_kw` | 观众需求榜（按次数） |
| `hana_log` | 最近运行日志 |
| `hana_fix` | 给掉人最多的段生成 3 个改法 |
| `hana_fix_apply` | 选定一版写回 `话术.md`（写入前扫违禁词） |
| `hana_ask` | 按知识库 + 红线试答一条弹幕，不开口播 |

## 合规

- 这个工具是**真人主播的副驾**，不是无人直播。开播必须真人出镜，平台明确禁止无人/录播。
- 所有口播走工作台的护栏：命中联系方式、收益承诺、绝对化、利益诱导等违禁词，那一句会被跳过。
- `hana_fix_apply` 写回前会再扫一遍，命中直接拒绝。
- 本仓库不含任何直播平台账号、抓取脚本或绕过风控的实现。

## 常见问题

**连上了但每个工具都提示「工作台没启动」**
先双击工作台快捷方式，等台面出来（约 5 秒）再重试。

**`npx` 卡住不动**
国内网络换 `npm i -g hana-live-mcp` 再用手册第二种配置。

**改了端口**
工作台默认 8787；换了就在 `env` 里设 `HANA_HOST`。

## 开发

```bash
git clone <this repo>
cd hana-live-mcp
node bin/hana-live-mcp.js     # 直接跑，stdin 收 JSON-RPC
```

零依赖，没有 `npm install` 这一步。

## License

MIT
