'use strict';

/**
 * 花酱直播工作台 · MCP 服务（stdio，零依赖）
 *
 * 只负责把 MCP 调用转成对本地工作台（默认 127.0.0.1:8787）的 HTTP 请求。
 * 工作台要先跑着；没跑的时候所有工具都会返回「没启动」而不是崩掉。
 */

const http = require('http');
const { URL } = require('url');

const BASE = process.env.HANA_HOST || 'http://127.0.0.1:8787';
const SERVER = { name: 'hana-live', version: '1.0.0' };
const PROTO = '2024-11-05';

// ---------- HTTP ----------
function request(method, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method,
      timeout: timeoutMs || 25000,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {},
    }, (res) => {
      let s = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { s += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(s)); }
        catch (e) { reject(new Error(`工作台返回的不是 JSON（HTTP ${res.statusCode}）`)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('超时')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const get = (p, t) => request('GET', p, null, t);
const cmd = (o, t) => request('POST', '/api/cmd', o, t);

const DOWN = '工作台没启动。先双击桌面「花酱直播工作台」，等台面打开再调我。';

async function alive() {
  try { await get('/api/state', 4000); return true; }
  catch (e) { return false; }
}

// ---------- 文案 ----------
function fmtState(d) {
  const on = d.running ? '正在播' : (d.paused ? '已暂停' : '未开播');
  const out = [`状态：${on}　轮次：${d.round}/${d.versions}　在线：${d.online}　看过：${d.total}　评论：${d.cmts}`];
  if (d.seg) out.push(`当前段：${d.seg}（第 ${(d.idx || 0) + 1}/${d.n} 句）`);
  const top = d.stay_top || [];
  if (top.length) out.push(`掉人最多：${top[0].seg}（进 ${top[0].enter} → 出 ${top[0].exit}）`);
  const kw = d.kw_top || [];
  if (kw.length) out.push('需求榜：' + kw.slice(0, 6).map(x => `${x.k} ${x.n}`).join(' · '));
  const a = d.audit || {};
  out.push(`合规：硬拦 ${a.hard || 0} 处、提示 ${a.soft || 0} 处　救场：${d.rescues || 0} 次`);
  if (d.alarm) out.push('⚠ ' + d.alarm);
  const log = d.log || [];
  if (log.length) out.push('最近：\n' + log.slice(-5).join('\n'));
  return out.join('\n');
}

function fmtSelftest(checks) {
  const lines = (checks || []).map(([name, good, detail]) => `${good ? '✓' : '✗'} ${name}：${detail}`);
  const bad = (checks || []).filter(c => !c[1]).map(c => c[0]);
  lines.push('', bad.length ? '先修这几项：' + bad.join('、') : '可以播。');
  return lines.join('\n');
}

function fmtStay(latest, rounds) {
  if (!latest) return '还没跑完一整遍，留人表要等第一遍读完才生成。';
  const out = [`第 ${latest.round} 遍 · ${latest.ts} · 全场净掉 ${latest.total_drop >= 0 ? '+' : ''}${latest.total_drop}`, '掉人 TOP3：'];
  (latest.top3 || []).forEach((t, i) => {
    out.push(`${i + 1}. ${t.seg}　进 ${t.enter} → 出 ${t.exit}（${t.drop >= 0 ? '+' : ''}${t.drop}）`);
  });
  out.push('', '逐段明细：');
  (latest.rows || []).forEach(r => {
    const w = r.worst;
    const tail = w && w.drop ? `　段内最狠：第 ${w.i + 1} 句 ${w.drop >= 0 ? '+' : ''}${w.drop}` : '';
    out.push(`- ${r.seg}　进 ${r.enter} → 出 ${r.exit}　净 ${r.drop >= 0 ? '+' : ''}${r.drop}${tail}`);
  });
  if ((rounds || []).length > 1) out.push(`\n（共记录 ${rounds.length} 遍）`);
  return out.join('\n');
}

// ---------- 工具 ----------
const tools = [
  {
    name: 'hana_state',
    description: '看直播工作台当前状态：是否在播、轮次、当前段和第几句、在线/看过/评论、掉人最多段、观众需求榜、合规计数、救场次数、告警、最近日志。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => fmtState(await get('/api/state')),
  },
  {
    name: 'hana_start',
    description: '开始口播（从第一段讲起）。已经开播时等于重启这一遍。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { await cmd({ cmd: 'start' }); return '已开播，从第一段开始讲。'; },
  },
  {
    name: 'hana_stop',
    description: '停止口播。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { await cmd({ cmd: 'stop' }); return '已停止。'; },
  },
  {
    name: 'hana_pause',
    description: '暂停或继续。on=true 暂停（当前这句掐断），on=false 继续。',
    inputSchema: {
      type: 'object',
      properties: { on: { type: 'boolean', description: 'true 暂停，false 继续' } },
      required: ['on'],
    },
    run: async (a) => {
      const on = a.on !== false;
      await cmd({ cmd: on ? 'pause' : 'resume' });
      return on ? '已暂停（当前这句掐断）。' : '已继续。';
    },
  },
  {
    name: 'hana_selftest',
    description: '开播前体检：稿子、语音合成、大屏端口、弹幕抓取、声卡、合规词、开场钩子。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => fmtSelftest((await get('/api/selftest', 60000)).checks),
  },
  {
    name: 'hana_stay',
    description: '段落留人表：每一遍直播各段的进入/离开/净掉人数、段内掉得最狠那句、掉人 TOP3。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => { const d = await get('/api/stay'); return fmtStay(d.latest, d.rounds); },
  },
  {
    name: 'hana_kw',
    description: '观众需求榜：公屏关键词按出现次数排序，下一次自动改写会优先回应。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const top = (await get('/api/kw')).top || [];
      return top.length ? '观众需求榜（按次数）：\n' + top.map(x => `- ${x.k}：${x.n} 次`).join('\n') : '还没有观众打关键词。';
    },
  },
  {
    name: 'hana_log',
    description: '取最近运行日志（花酱说的每句、点开的每张卡、每条弹幕应答）。',
    inputSchema: {
      type: 'object',
      properties: { n: { type: 'integer', description: '取多少行，默认 20，最多 80' } },
    },
    run: async (a) => {
      const n = Math.max(1, Math.min(Number(a.n) || 20, 80));
      const log = ((await get('/api/state')).log || []).slice(-n);
      return log.length ? log.join('\n') : '日志还是空的。';
    },
  },
  {
    name: 'hana_fix',
    description: '针对掉人最多的那一段生成 3 个替换版本（只改这一段，不改事实和红线）。',
    inputSchema: {
      type: 'object',
      properties: { seg: { type: 'string', description: '段标题，例如「开场」' } },
      required: ['seg'],
    },
    run: async (a) => {
      const seg = (a.seg || '').trim();
      if (!seg) return '要告诉我是哪一段（留人表里那段的名字）。';
      const d = await cmd({ cmd: 'fix', seg }, 120000);
      if (!d.ok) return '生成失败：' + (d.err || JSON.stringify(d));
      const vs = d.versions || [];
      if (!vs.length) return '没生成出可用版本（可能都含违禁词），换个时间再试。';
      const out = [`「${seg}」的 ${vs.length} 个改法（原文 ${(d.origin || '').length} 字）：`, ''];
      vs.forEach((v, i) => { out.push(`版本 ${i + 1}：\n${v.text}`, ''); });
      if (d.blocked && d.blocked.length) out.push(`另有 ${d.blocked.length} 版含违禁词，已拦下。`);
      out.push('要写回就说「用第 N 版」，我会调 hana_fix_apply。');
      return out.join('\n');
    },
  },
  {
    name: 'hana_fix_apply',
    description: '把选定的一版写回话术.md，只替换该段正文，其它段不动。写入前会扫违禁词，命中直接拒绝。',
    inputSchema: {
      type: 'object',
      properties: {
        seg: { type: 'string', description: '段标题' },
        text: { type: 'string', description: '要写回去的正文（整段句子）' },
      },
      required: ['seg', 'text'],
    },
    run: async (a) => {
      const seg = (a.seg || '').trim();
      const text = a.text || '';
      if (!seg || !text) return '要给我段名和要写回去的正文。';
      const d = await cmd({ cmd: 'fixapply', seg, text }, 30000);
      return d.ok ? `已写回「${seg}」。下一轮开头生效；想立刻生效就先停止再开播。`
        : '写入失败：' + (d.err || JSON.stringify(d));
    },
  },
  {
    name: 'hana_ask',
    description: '按知识库和红线试答一条弹幕（不开口播，只看它会怎么答）。',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: '模拟观众的问题' } },
      required: ['q'],
    },
    run: async (a) => {
      const q = (a.q || '').trim();
      if (!q) return '要给我一句话。';
      const d = await get('/api/ask?q=' + encodeURIComponent(q), 60000);
      return `问：${q}\n答：${d.a}`;
    },
  },
];
const MAP = Object.fromEntries(tools.map(t => [t.name, t]));

// ---------- 协议 ----------
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const method = msg.method;
  const id = msg.id;
  const params = msg.params || {};

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: PROTO,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER,
      instructions: '花酱直播工作台。先确认工作台主机在跑（8787）；开播前建议先 hana_selftest。',
    });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') {
    return ok(id, { tools: tools.map(({ run, ...t }) => t) });
  }
  if (method === 'tools/call') {
    const tool = MAP[params.name];
    if (!tool) return fail(id, -32602, `没有这个工具：${params.name}`);
    if (!(await alive())) {
      return ok(id, { content: [{ type: 'text', text: DOWN }], isError: true });
    }
    try {
      const text = await tool.run(params.arguments || {});
      return ok(id, { content: [{ type: 'text', text: String(text) }], isError: false });
    } catch (e) {
      return ok(id, {
        content: [{ type: 'text', text: '调用失败：' + String(e.message || e).slice(0, 200) }],
        isError: true,
      });
    }
  }
  if (id !== undefined && id !== null) fail(id, -32601, `不支持的方法：${method}`);
}

// ---------- stdio ----------
function main() {
  let buf = '';

  const pump = () => {
    while (true) {
      const b = buf.replace(/^\r?\n/, '');
      if (!b) { buf = ''; return; }
      const head = b.slice(0, 24).toLowerCase();
      if (head.startsWith('content-length:')) {
        const sepN = b.indexOf('\n\n');
        const sepR = b.indexOf('\r\n\r\n') >= 0 ? b.indexOf('\r\n\r\n') + 4 : -1;
        const sep = sepR >= 0 && (sepR < sepN || sepN < 0) ? sepR : sepN + 2;
        if (sep < 2) return;
        const len = parseInt(b.slice(0, b.indexOf('\n')).split(':')[1], 10);
        if (b.length < sep + len) return;
        const raw = b.slice(sep, sep + len);
        buf = b.slice(sep + len);
        try { dispatch(JSON.parse(raw)); } catch (e) { /* 忽略坏消息 */ }
        continue;
      }
      const nl = b.indexOf('\n');
      if (nl < 0) return;
      const line = b.slice(0, nl).trim();
      buf = b.slice(nl + 1);
      if (!line) continue;
      try { dispatch(JSON.parse(line)); } catch (e) { /* 忽略坏消息 */ }
    }
  };

  let pending = 0;
  let ending = false;
  const maybeExit = () => {
    if (ending && pending === 0) setTimeout(() => process.exit(0), 40);
  };

  const dispatch = (msg) => {
    pending++;
    handle(msg)
      .catch((e) => {
        if (msg.id !== undefined && msg.id !== null) fail(msg.id, -32603, '内部错误：' + String(e.message || e).slice(0, 200));
      })
      .finally(() => { pending--; maybeExit(); });
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { buf += chunk; pump(); });
  // stdin 关了不要立刻退：等手上的请求都回完再退（否则 npx 一次性调用会截断结果）
  process.stdin.on('end', () => { ending = true; maybeExit(); });
}

module.exports = { main };
