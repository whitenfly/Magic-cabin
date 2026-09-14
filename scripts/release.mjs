#!/usr/bin/env node
/**
 * 魔法小屋 · 版本管理工具
 * ---------------------------------------------------------------------------
 * 把 docs/VERSIONING.md 的流程变成可执行命令：一个开发任务 = 一个版本。
 *
 * ★ GitPushHistory.md 的维护铁律（本工具严格遵守）：
 *   1. **只增不改**：时间轴只在末尾追加，绝不重写历史记录；
 *   2. **唯一例外**是完成标记：把**已验证执行完毕**的命令从 `[ ]` 翻成 `[x]`，
 *      且仅在 git 状态能证明它确实执行了时才翻（不猜）；
 *   3. **不做任何 push**：推送一律生成命令交给人工执行。
 *
 * 子命令：
 *   start <任务号> [短名]   开任务分支（自动做前置检查 + 记录）
 *   done  <任务号>          收尾：门禁 → --no-ff 合并回 dev → 打 -dev.N tag → 记录
 *   verify [任务号]         跑门禁并把结果写进记录（含耗时）
 *   status                  当前分支 / 未推送提交 / tag 同步情况（只读，不写文件）
 *   ship [main]             生成推送 / 发布命令（只打印 + 追加记录，绝不执行 push）
 *   history                 打印自动记录区
 *   record "<说明>"         追加一条记录（--kind=commit|merge|manual，供 git 钩子调用）
 *
 * ★ 环境自适应：本仓库可能在「禁止创建命名管道」的受限环境中运行
 *   （实测 Node 的 execFileSync / 异步 spawn 会 EPERM）。因此所有 git 调用统一走
 *   spawnSync(stdio:'ignore') + 重定向到文件再读回；Windows 上必须用 PowerShell
 *   而不是 cmd.exe（cmd 的引号/重定向在该环境下被破坏），并按 BOM 识别编码。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const HISTORY = join(ROOT, 'GitPushHistory.md');
const DEV_BRANCH = 'dev';
const MAIN_BRANCH = 'main';

/* ────────────────────────────── 终端输出 ────────────────────────────── */
const C = process.stdout.isTTY === true
  ? { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', b: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m' }
  : { g: '', y: '', r: '', b: '', d: '', x: '' };
const say = (s = '') => console.log(s);
const step = (s) => console.log(`${C.b}▸${C.x} ${s}`);
const ok = (s) => console.log(`  ${C.g}✓${C.x} ${s}`);
const warn = (s) => console.log(`  ${C.y}!${C.x} ${s}`);
const bad = (s) => console.log(`  ${C.r}✗${C.x} ${s}`);
const info = (s) => console.log(`  ${C.d}${s}${C.x}`);

function die(msg) {
  bad(msg);
  process.exit(1);
}

/* ─────────────────────────── git 调用（带降级） ─────────────────────────── */
const IS_WIN = process.platform === 'win32';
// 受限环境（沙箱禁止命名管道）下为 true：之后一律走「重定向到文件」的降级路径。
let isPipeDisabled = process.env.MAGIC_CABIN_NO_PIPE === '1';

function quote(s) {
  return `"${String(s).replace(/"/g, '\\"')}"`;
}

/**
 * 读取降级 shell 写出的文件并按 BOM 识别编码。
 *
 * ★ PowerShell 的 `>` / `2>&1` 重定向写出的是 **UTF-16LE**（实测文件头 FF FE），
 *   而 Node 按 UTF-8 读会得到「1 4 3 5 5 8 6」这种带空字节的乱码。
 *   实测 `[Console]::OutputEncoding` / `$OutputEncoding` / `chcp 65001` 都改不了，
 *   所以这里按 BOM 自适应。
 */
function decodeOutput(file) {
  if (!existsSync(file)) return '';
  const buf = readFileSync(file);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le', 2);
  else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) text = buf.toString('utf8', 3);
  else text = buf.toString('utf8');
  return text.replace(/\r\n/g, '\n');
}

/** 降级 shell：把单条命令的输出重定向到文件再读回 */
function launchShell(cmdline) {
  const dir = mkdtempSync(join(tmpdir(), 'mc-sh-'));
  const file = join(dir, 'out.txt');
  const opts = { cwd: ROOT, stdio: 'ignore' };
  let r;
  if (IS_WIN) {
    // 用 `*>` 而不是 `>`：`*>` 把所有流按文本管道序列化，配合按 BOM 解码拿到 UTF-8
    const inner = `${cmdline} *> '${file.replace(/'/g, "''")}'`;
    r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', inner], opts);
  } else {
    r = spawnSync('/bin/sh', ['-c', `${cmdline} > '${file}' 2>&1`], opts);
  }
  const out = decodeOutput(file);
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status ?? 1, out };
}

/**
 * 批量执行多个 git 命令：一次 shell 调用搞定。
 * 实测降级路径下每次调用要起一个 PowerShell（约 1s），collect() 原本十几次调用
 * 需要 20s；批量后只要 1 次。
 */
function gitBatch(cmds) {
  const dir = mkdtempSync(join(tmpdir(), 'mc-batch-'));
  const files = cmds.map((_, i) => join(dir, `o${i}.txt`));

  if (!isPipeDisabled) {
    const out = [];
    let allOK = true;
    for (let i = 0; i < cmds.length; i += 1) {
      const r = spawnSync('git', cmds[i], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      if (r.status === null || r.error) { allOK = false; break; }
      out.push(r.stdout ?? '');
    }
    if (allOK) { rmSync(dir, { recursive: true, force: true }); return out; }
    isPipeDisabled = true;
  }

  const script = cmds
    .map((c, i) => `git ${c.join(' ')} *> '${files[i].replace(/'/g, "''")}'`)
    .join('\n');
  const scriptPath = join(dir, 'run.ps1');
  writeFileSync(scriptPath, script, 'utf8');
  const opts = { cwd: ROOT, stdio: 'ignore' };
  if (IS_WIN) {
    spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], opts);
  } else {
    spawnSync('/bin/sh', ['-c', cmds.map((c, i) => `git ${c.join(' ')} > '${files[i]}' 2>&1`).join('; ')], opts);
  }
  const result = files.map((f) => decodeOutput(f));
  rmSync(dir, { recursive: true, force: true });
  return result;
}

/**
 * 执行 git 并返回 stdout。
 * @param {string[]} args
 * @param {{allowFail?: boolean, timeout?: number}} [opt]
 */
function git(args, { allowFail = true, timeout = 0 } = {}) {
  const cmdline = `git ${args.join(' ')}`;
  let out = '';
  let status = 0;

  if (!isPipeDisabled) {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout });
    // ★ 关键：被沙箱拦下时 spawnSync 不抛异常，而是返回 status===null。
    //   早期版本只看 r.error，导致所有 git 信息被静默读成空（分支显示 (detached)）。
    const blocked = r.status === null || r.error;
    if (!blocked) {
      out = r.stdout ?? '';
      status = r.status ?? 1;
      return finish();
    }
    isPipeDisabled = true;
  }

  const sh = launchShell(cmdline);
  status = sh.status;
  out = sh.out;
  return finish();

  function finish() {
    if (status !== 0 && !allowFail) die(`git ${args.join(' ')} 失败：\n${out.trim()}`);
    return { ok: status === 0, out: out.replace(/\r\n/g, '\n'), status };
  }
}

/** 执行任意命令（用于门禁），返回 { ok, out, code }。同样带管道降级。 */
function run(cmd, args) {
  if (!isPipeDisabled) {
    const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== null && !r.error) return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, code: r.status };
    isPipeDisabled = true;
  }
  const cmdline = [cmd, ...args].map((a) => (a.includes(' ') ? quote(a) : a)).join(' ');
  const sh = launchShell(cmdline);
  return { ok: sh.status === 0, out: sh.out, code: sh.status };
}

const g = (args, opt) => git(args, opt).out.trim();
const gOK = (args) => git(args).ok;

/* ────────────────────────────── git 状态 ────────────────────────────── */
const now = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const BATCHES = [
  ['branch', ['branch', '--show-current']],
  ['head', ['rev-parse', '--short', 'HEAD']],
  ['headFull', ['rev-parse', 'HEAD']],
  ['subject', ['log', '-1', '--pretty=%s']],
  ['dirty', ['status', '--porcelain']],
  ['tagHere', ['tag', '--points-at', 'HEAD']],
  ['lastTag', ['describe', '--tags', '--abbrev=0']],
  ['isMerge', ['rev-parse', '--verify', '-q', 'HEAD^2']],
  ['localTags', ['tag', '-l']],
  ['hasOriginDev', ['rev-parse', '--verify', '-q', 'origin/dev']],
  ['hasOriginMain', ['rev-parse', '--verify', '-q', 'origin/main']],
];

const AHEAD_BATCH = [
  ['aheadDev', ['rev-list', '--count', 'origin/dev..dev']],
  ['aheadMain', ['rev-list', '--count', 'origin/main..main']],
  ['commitsDev', ['log', '--oneline', 'origin/dev..dev']],
  ['commitsMain', ['log', '--oneline', 'origin/main..main']],
];

function gitBatchMap(batch) {
  const out = gitBatch(batch.map(([, args]) => args));
  const map = {};
  batch.forEach(([key], i) => (map[key] = (out[i] ?? '').trim()));
  return map;
}

const TAG_STATE = { PUSHED: 'pushed', UNPUSHED: 'unpushed', UNKNOWN: 'unknown' };

function collect(light = false) {
  const b = gitBatchMap(BATCHES);
  const localTags = b.localTags.split('\n').filter(Boolean);

  const has = { dev: b.hasOriginDev.length > 0, main: b.hasOriginMain.length > 0 };
  const a = has.dev || has.main
    ? gitBatchMap(AHEAD_BATCH)
    : { aheadDev: '', aheadMain: '', commitsDev: '', commitsMain: '' };
  const pending = (name, exists) => ({
    exists,
    ahead: exists ? Number(a[`ahead${name}`] || 0) : 0,
    commits: exists ? a[`commits${name}`].split('\n').filter(Boolean) : [],
  });

  // ★ light 模式（git 钩子内）不碰网络：否则每次 commit 都要等 ls-remote
  let remoteReachable = null;
  let tagStates = new Map();
  if (!light) {
    // --exit-code 让「远端可达但无 tag」与「远端不可达」可区分
    const r = git(['ls-remote', '--exit-code', '--tags', 'origin'], { allowFail: true, timeout: 3000 });
    remoteReachable = r.status === 0 || r.status === 2;
    if (remoteReachable) {
      const remote = new Set(
        r.out.split('\n')
          .map((l) => (l.split('refs/tags/')[1] ?? '').replace(/\^\{\}$/, ''))
          .filter(Boolean),
      );
      tagStates = new Map(localTags.map((t) => [
        t,
        remote.has(t) ? TAG_STATE.PUSHED : TAG_STATE.UNPUSHED,
      ]));
    }
  }

  return {
    branch: b.branch || '(detached)',
    head: b.head,
    headFull: b.headFull,
    subject: b.subject,
    dirty: b.dirty,
    tagHere: b.tagHere.split('\n').filter(Boolean),
    lastTag: b.lastTag,
    isMerge: b.isMerge.length > 0,
    localTags,
    dev: pending('Dev', has.dev),
    main: pending('Main', has.main),
    remoteReachable,
    tagStates,
    light,
  };
}

/** 正式版 tag 的（状态）三元判定：pushed / unpushed / unknown */
function tagVerdict(st, tag) {
  if (st.tagStates.size === 0 && !st.remoteReachable) return TAG_STATE.UNKNOWN;
  return st.tagStates.get(tag) ?? TAG_STATE.UNKNOWN;
}
function unverifiedTags(st) {
  return st.localTags.filter((t) => t.startsWith('v') && tagVerdict(st, t) === TAG_STATE.UNKNOWN);
}
function unpushedTags(st) {
  return st.localTags.filter((t) => t.startsWith('v') && tagVerdict(st, t) === TAG_STATE.UNPUSHED);
}

/* ────────────────────────── GitPushHistory.md ────────────────────────── */
const MARK = {
  autoBegin: '<!-- AUTO:BEGIN —— 以下区块由 scripts/release.mjs 追加维护（只增不改） -->',
  autoEnd: '<!-- AUTO:END -->',
  timeline: '### 追加记录（只增不改）',
};

const HEADER = `# Git 操作历史（本地专用 · 不进版本库）

> 本文件记录**每个阶段实际执行的 commit / tag / branch / push 命令**，以及**等待人工执行的命令**。
>
> ⚠️ 本文件已加入 \`.gitignore\`，**不会上传 GitHub**，仅作本地记录与交接。

---

## 维护铁律

1. **只增不改**：历史记录一旦写入就不再修改，新的记录追加在末尾。
2. **唯一允许的改动**：把**已执行**命令的 \`[ ]\` 翻成 \`[x]\`（完成标记）。
3. **标记不猜**：只有 git 状态能证明命令确实执行了，才翻成 \`[x]\`；否则保持 \`[ ]\`。
4. **推送由人工执行**：工具只生成命令，绝不自动 push。
5. 命令输出/报错如实记录——否则下次还会踩同一个坑。

---

`;

/** 读历史文件（不存在则用 HEADER 创建）。只读取，不重写既有内容。 */
function readHistory() {
  if (!existsSync(HISTORY)) {
    writeFileSync(HISTORY, `${HEADER}${MARK.autoBegin}\n\n${MARK.timeline}\n\n${MARK.autoEnd}\n`, 'utf8');
  }
  let text = readFileSync(HISTORY, 'utf8');

  // ★ 兼容早期版本的标记文本：就地替换标记，**不追加新区块**
  //   （否则会变成两个 AUTO 区块，把历史记录切碎）
  const LEGACY_MARKS = ['<!-- AUTO:BEGIN —— 以下区块由 scripts/release.mjs 自动生成/维护 -->'];
  for (const old of LEGACY_MARKS) {
    if (text.includes(old)) {
      text = text.split(old).join(MARK.autoBegin);
      writeFileSync(HISTORY, text, 'utf8');
    }
  }

  if (!text.includes(MARK.autoBegin)) {
    text = `${text.trimEnd()}\n\n---\n\n${MARK.autoBegin}\n\n${MARK.timeline}\n\n${MARK.autoEnd}\n`;
    writeFileSync(HISTORY, text, 'utf8');
  }
  return text;
}

/** 取自动记录区内容（不含标记） */
function autoBody(text) {
  const b = text.indexOf(MARK.autoBegin);
  const e = text.indexOf(MARK.autoEnd);
  if (b < 0 || e < 0) return '';
  return text.slice(b + MARK.autoBegin.length, e);
}

/**
 * 执行与历史之间的**唯一同步点**：
 *   1. 把已验证执行完毕的 `[ ]` 翻成 `[x]`（这是唯一允许的原地修改）；
 *   2. 追加一条时间轴记录；
 *   3. 按需追加新的命令区块。
 */
function syncHistory({ entry = null, commands = null } = {}) {
  let text = readHistory();
  const completed = markCompleted(text);
  if (completed.changed) {
    text = completed.text;
    writeFileSync(HISTORY, text, 'utf8');
  }

  if (!entry && !commands) return completed.flipped;

  const b = text.indexOf(MARK.autoBegin);
  const e = text.indexOf(MARK.autoEnd);
  const body = text.slice(b + MARK.autoBegin.length, e).trimEnd();

  let addition = '';
  if (entry) addition += `\n\n${entry.trimEnd()}`;
  if (commands && commands.length) {
    addition += `\n\n#### 待执行命令（追加于 ${now()}）\n\n\`\`\`powershell\ncd D:\\FireflyQAQ\\Project\\FrontProj\\Magic-cabin\n\n`;
    for (const c of commands) {
      addition += c.startsWith('#') ? `${c}\n` : `# [ ] ${c}\n`;
    }
    addition += '```\n';
  }

  const next = `${text.slice(0, b + MARK.autoBegin.length)}${body}${addition}\n\n${text.slice(e)}`;
  writeFileSync(HISTORY, next, 'utf8');
  return completed.flipped;
}

/**
 * 把「已验证执行完毕」的命令行 `[ ]` 翻成 `[x]`。
 * 判定依据只有 git 状态，不做任何猜测。
 */
function markCompleted(text) {
  const st = collect(false);
  const rules = [
    // 分支推送完成：远端跟踪引用存在且不 ahead
    [() => st.main.exists && st.main.ahead === 0, /^# \[ \] git push origin main\b/],
    [() => st.dev.exists && st.dev.ahead === 0, /^# \[ \] git push -u origin dev\b/],
    [() => st.main.exists && st.main.ahead === 0, /^# \[ \] git push origin main$/],
  ];
  // 正式版 tag：逐个按 tagVerdict 判定
  for (const t of st.localTags.filter((x) => x.startsWith('v'))) {
    if (tagVerdict(st, t) === TAG_STATE.PUSHED) {
      rules.push([() => true, new RegExp(`^# \\[ \\] git push origin( --follow-tags)? .*\\b${t.replace(/\./g, '\\.')}\\b`)]);
      rules.push([() => true, new RegExp(`^# \\[ \\] git push origin ${t.replace(/\./g, '\\.')}$`)]);
    }
  }

  let changed = false;
  const flipped = [];
  const lines = text.split('\n').map((line) => {
    for (const [cond, re] of rules) {
      if (re.test(line) && cond()) {
        changed = true;
        flipped.push(line.replace('# [ ]', '# [x]'));
        return line.replace('# [ ]', '# [x]');
      }
    }
    return line;
  });
  return { text: lines.join('\n'), changed, flipped, st };
}

/* ──────────────────────────── 记录条目构建 ──────────────────────────── */
function buildEntry({ task, kind, st, body = [], commands = [], note = '' }) {
  const lines = [`#### ${now()} · ${task}${kind ? ` · ${kind}` : ''}`, ''];
  if (st) {
    lines.push(`- 分支：\`${st.branch}\` @ \`${st.head}\` —— ${st.subject}`);
    if (st.tagHere?.length) lines.push(`- tag：${st.tagHere.map((t) => `\`${t}\``).join('、')}`);
  }
  if (body.length) { lines.push(''); lines.push(...body); }
  if (commands.length) {
    lines.push('', '```powershell', ...commands, '```');
  }
  if (note) { lines.push('', `> ${note}`); }
  lines.push('');
  return lines.join('\n');
}

/** 把一条记录追加进时间轴（纯追加，不重写任何已有内容） */
function appendRecord(entry, commands = null) {
  return syncHistory({ entry, commands });
}

/* ────────────────────────────── 门禁 ────────────────────────────── */
function runGates(quick = false) {
  const plan = quick
    ? [['typecheck', ['pnpm', 'typecheck']], ['verify', ['pnpm', 'verify']]]
    : [['typecheck', ['pnpm', 'typecheck']], ['verify', ['pnpm', 'verify']], ['build', ['pnpm', 'build']]];
  const parts = [];
  for (const [name, cmd] of plan) {
    process.stdout.write(`  ${C.d}跑 ${name} …${C.x}`);
    const t0 = Date.now();
    const r = run(cmd[0], cmd.slice(1));
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    parts.push({ name, ok: r.ok, sec: Number(sec), out: r.out });
    process.stdout.write(`\r  ${r.ok ? `${C.g}✓${C.x}` : `${C.r}✗${C.x}`} ${name} ${C.d}(${sec}s)${C.x}\n`);
  }
  const failed = parts.filter((p) => !p.ok).map((p) => p.name);
  const res = { ok: failed.length === 0, parts, failed };
  if (!res.ok) {
    for (const p of parts.filter((x) => !x.ok)) {
      say('');
      say(`${C.r}── ${p.name} 输出（末 25 行）──${C.x}`);
      say(p.out.trimEnd().split('\n').slice(-25).join('\n'));
    }
  }
  return res;
}

/* ────────────────────────────── 子命令 ────────────────────────────── */
const TASK_RE = /^[A-Za-z][0-9]+(\.[0-9]+)*$/;

function cmdStart(args) {
  const [task, slug] = args;
  if (!task) die('用法：node scripts/release.mjs start <任务号> [短名]   例：start J2.1 camera-rig');
  if (!TASK_RE.test(task)) die(`任务号格式应为 Jx / Jx.y / F0.x，收到：${task}`);

  const st = collect(false);
  const name = `task/${task}${slug ? `-${slug}` : ''}`;
  step(`开任务分支：${name}`);
  if (st.branch !== DEV_BRANCH) warn(`当前不在 ${DEV_BRANCH}（在 ${st.branch}）—— 任务分支应从 ${DEV_BRANCH} 切出`);
  if (st.dirty) warn('工作区不干净，建议先提交或 stash');
  if (st.dev.exists && st.dev.ahead > 0) warn(`${DEV_BRANCH} 有 ${st.dev.ahead} 个提交未推送（不阻塞开发，但别忘 ship）`);
  if (gOK(['rev-parse', '--verify', '-q', name])) die(`分支 ${name} 已存在`);

  const r = git(['switch', '-c', name], { allowFail: false });
  ok(r.out.trim() || `已切到 ${name}`);

  const flipped = appendRecord(
    buildEntry({
      task: `开任务分支 ${name}`,
      kind: 'start',
      st: collect(false),
      body: [
        `- 依据：\`docs/VERSIONING.md\` §3；任务号 ${task}`,
        '- 下一步：开发 → `pnpm gate`（或 `pnpm task:done ' + task + '` 一并跑门禁+合并+打 tag）',
      ],
      note: '任务分支用完即删：`git branch -d` 由 `task:done` 自动完成。',
    }),
  );
  say('');
  reportFlipped(flipped);
  ok('已追加记录到 GitPushHistory.md');
}

function reportFlipped(flipped) {
  if (flipped?.length) {
    ok(`完成标记：${flipped.length} 条命令已由 git 状态证实执行 → [x]`);
    for (const f of flipped) info(f);
  }
}

function cmdVerify(args) {
  const task = args.find((a) => !a.startsWith('-')) ?? '(未指定任务)';
  const quick = args.includes('--quick');
  step(`跑门禁${quick ? '（quick：typecheck + verify）' : '（完整：typecheck + verify + build）'}`);
  const gate = runGates(quick);
  appendRecord(
    buildEntry({
      task: `${task} 门禁`,
      kind: 'verify',
      st: collect(false),
      body: [
        `- 门禁结果：${gate.ok ? '✅ 全绿' : `❌ 失败（${gate.failed.join('、')}）`}`,
        `- 明细：${gate.parts.map((p) => `${p.name} ${p.ok ? '✓' : '✗'} ${p.sec}s`).join(' / ')}`,
        '- 完整门禁另含（需先 `pnpm build && pnpm serve`）：`test:visual` / `test:smoke` / `test:perf`',
      ],
    }),
  );
  say('');
  gate.ok ? ok('门禁全绿，已追加记录') : die('门禁未通过（已追加记录）');
}

function nextDevVersion(st, task) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const cur = String(pkg.version).replace(/-dev\.\d+$/, '');
  const m = /^[A-Za-z](\d+)(?:\.(\d+))?$/.exec(task);
  let base = cur;
  if (m) base = m[2] ? `0.${m[1]}.${m[2]}` : `0.${m[1]}.0`;
  const existing = st.localTags.filter((t) => t.startsWith(`v${base}-dev.`)).length;
  return { base, tag: `v${base}-dev.${existing + 1}` };
}

function cmdDone(args) {
  const task = args[0];
  if (!task) die('用法：node scripts/release.mjs done <任务号>   例：done J2.1');
  if (!TASK_RE.test(task)) die(`任务号格式应为 Jx / Jx.y / F0.x，收到：${task}`);

  let st = collect(false);
  step(`收尾任务 ${task}（当前分支 ${st.branch}）`);
  if (st.dirty) die('工作区有未提交改动——先提交，再跑 done');
  if (st.branch === DEV_BRANCH || st.branch === MAIN_BRANCH) {
    die(`当前在 ${st.branch} 上，done 需要在任务分支上执行（task/${task}…）`);
  }

  step('跑门禁（typecheck + verify + build）');
  const gate = runGates(false);
  if (!gate.ok) {
    appendRecord(buildEntry({
      task: `${task} 收尾中止`, kind: 'done', st,
      body: ['- 原因：门禁未通过，未执行合并', `- 失败项：${gate.failed.join('、')}`],
    }));
    die('门禁未通过——已中止合并并追加记录');
  }
  ok('门禁全绿');

  const { base, tag } = nextDevVersion(st, task);
  const srcBranch = collect(false).branch;
  const mergeMsg = `merge ${task}：合入 ${DEV_BRANCH}`;
  const cmds = [
    `git switch ${DEV_BRANCH}`,
    `git merge --no-ff ${srcBranch} -m "${mergeMsg}"`,
    `git tag -a ${tag} -m "${task} 完成（开发版）"`,
    `git branch -d ${srcBranch}`,
  ];
  step('执行合并与打 tag');
  for (const c of cmds) {
    const argv = c.replace(/^git /, '').match(/"[^"]*"|\S+/g).map((x) => x.replace(/^"|"$/g, ''));
    const r = git(argv, { allowFail: false });
    ok(`${c}${r.out.trim() ? `  ${C.d}(${r.out.trim().split('\n')[0]})${C.x}` : ''}`);
  }

  const after = collect(false);
  const flipped = appendRecord(
    buildEntry({
      task: `${task} 完成`,
      kind: 'done',
      st: after,
      body: [
        `- 版本号：\`${base}\`（package.json 的 version 请同步）`,
        `- tag：\`${tag}\`（开发版快照，只打在 ${DEV_BRANCH} 上）`,
        `- 合并至：\`${DEV_BRANCH}\` @ \`${after.head}\``,
        `- 待补：\`docs/${task}-实施结果.md\`（DoD 核对 / 落点 / 门禁项数 / 遗留交接）`,
      ],
      note: '阶段验收通过后，用 `pnpm ship` 生成正式版发布计划。',
    }),
    [`git push -u origin ${DEV_BRANCH}`],
  );
  say('');
  reportFlipped(flipped);
  step('推送状态');
  printPending(collect(false));
}

function printPending(st) {
  if (st.remoteReachable === false) warn('远端不可达（受限环境）——待推送状态按本地跟踪引用估算');
  if (!st.main.exists || st.main.ahead > 0) info(`main：${st.main.exists ? `${st.main.ahead} 个提交待推送` : '远端不存在'}`);
  if (!st.dev.exists || st.dev.ahead > 0) info(`dev：${st.dev.exists ? `${st.dev.ahead} 个提交待推送` : '远端不存在'}`);
  const un = unpushedTags(st);
  if (un.length) warn(`tag 确认未推送：${un.join('、')}`);
  const uv = unverifiedTags(st);
  if (uv.length) info(`tag 状态无法确认：${uv.join('、')}（远端不可达，不代表未推送）`);
  if (st.main.exists && st.dev.exists && st.main.ahead === 0 && st.dev.ahead === 0 && un.length === 0) {
    ok('分支与 origin 一致');
  }
}

function cmdShip(args) {
  const target = args.find((a) => !a.startsWith('-')) ?? 'push';
  const st = collect(false);

  if (target === MAIN_BRANCH) {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const ver = String(pkg.version).replace(/-dev\.\d+$/, '');
    step(`生成正式版发布计划（target=${MAIN_BRANCH}，version=${ver}）`);
    const cmds = [
      `git switch ${DEV_BRANCH}`,
      `git switch ${MAIN_BRANCH}`,
      `git merge --no-ff ${DEV_BRANCH} -m "release: v${ver}（${st.lastTag || '阶段验收通过'} 之后）"`,
      `# 手动：把 package.json 的 version 改为 ${ver}（去掉 -dev 后缀）`,
      `git commit -am "chore(release): v${ver}"`,
      `git tag -a v${ver} -m "v${ver} 正式版"`,
      `git push origin ${MAIN_BRANCH} --follow-tags`,
      `git switch ${DEV_BRANCH}`,
    ];
    say('');
    for (const c of cmds) say(`  ${c.startsWith('#') ? `${C.d}${c}${C.x}` : c}`);
    const flipped = appendRecord(
      buildEntry({
        task: `发布计划 v${ver}`, kind: 'ship', st,
        body: ['- 计划内容：`dev` → `main` 的 `--no-ff` 合并 + 正式版 tag', '- 以下命令**待人工执行**'],
        note: '`main` 上永远不要直接开发；发布完立刻 `git switch dev`。本工具不做任何 push。',
      }),
      cmds,
    );
    say('');
    reportFlipped(flipped);
    info('已追加记录到 GitPushHistory.md');
    return;
  }

  // 默认：生成「待推送」命令清单（只生成，不执行）
  const cmds = [];
  if (!st.main.exists || st.main.ahead > 0) cmds.push(`git push origin ${MAIN_BRANCH} --follow-tags`);
  if (!st.dev.exists || st.dev.ahead > 0) cmds.push(`git push -u origin ${DEV_BRANCH}`);
  const un = unpushedTags(st);
  if (un.length) cmds.push(`git push origin ${un.join(' ')}`);

  step('待推送命令（复制到普通终端执行）');
  if (cmds.length === 0) {
    ok('无可生成的推送命令（分支已同步）');
    if (st.remoteReachable === false) {
      const uv = unverifiedTags(st);
      if (uv.length) warn(`tag 状态无法确认：${uv.join('、')} —— 请用 git ls-remote --tags origin 人工确认`);
    }
  } else {
    for (const c of cmds) say(`  ${c}`);
  }
  say('');
  warn('本工具**不会**自动推送：推送一律由人工在普通终端完成');

  const flipped = appendRecord(
    buildEntry({
      task: '推送计划（人工执行）', kind: 'ship', st,
      body: [`- 依据：${st.remoteReachable === false ? '远端不可达，按本地跟踪引用估算' : '远端 tag 列表已核对'}`, '- 待人工执行的推送命令：'],
      note: '执行完成后重跑 `pnpm git:status`；脚本会在能证明其已执行时把 `[ ]` 翻成 `[x]`。',
    }),
    cmds.length ? cmds : null,
  );
  say('');
  reportFlipped(flipped);
}

function cmdStatus() {
  const st = collect(false);
  step('仓库状态');
  info(`分支 ${st.branch} @ ${st.head} —— ${st.subject}`);
  info(`工作区：${st.dirty ? '⚠️ 有未提交改动' : '干净'}`);
  info(`最近 tag：${st.lastTag || '（无）'}${st.tagHere.length ? `（HEAD：${st.tagHere.join('、')}）` : ''}`);
  info(`dev：${st.dev.exists ? `领先 ${st.dev.ahead}` : '远端不存在'}    main：${st.main.exists ? `领先 ${st.main.ahead}` : '远端不存在'}`);
  say('');
  step('待推送');
  printPending(st);
  say('');
  step('本地 tag');
  for (const t of st.localTags) {
    const v = tagVerdict(st, t);
    const sym = v === TAG_STATE.PUSHED ? `${C.g}✓${C.x}` : v === TAG_STATE.UNPUSHED ? `${C.y}·${C.x}` : `${C.y}?${C.x}`;
    const tail = v === TAG_STATE.PUSHED ? '' : v === TAG_STATE.UNPUSHED ? `  ${C.d}(未推送)${C.x}` : `  ${C.d}(未验证：远端不可达，不代表未推送)${C.x}`;
    say(`  ${sym} ${t}${tail}`);
  }
  say('');
  step('dev 未推送提交');
  if (!st.dev.exists) warn('origin/dev 不存在（首次推送前）');
  for (const c of st.dev.commits) say(`  ${c}`);
  say('');
  step('main 未推送提交');
  if (!st.main.exists) warn('origin/main 不存在（首次推送前）');
  for (const c of st.main.commits) say(`  ${c}`);
  say('');
  const flipped = syncHistory({}); // 只做完成标记：把已验证执行的 [ ] 翻成 [x]，不追加任何内容
  if (flipped?.length) {
    say('');
    step('完成标记（自动）');
    reportFlipped(flipped);
  } else {
    info('（status 不改动 GitPushHistory.md：仅在能证明命令已执行时才翻 [x]）');
  }
}

function cmdHistory() {
  const text = readHistory();
  say(autoBody(text).trim());
}

function cmdRecord(args) {
  const kindArg = args.find((a) => a.startsWith('--kind='));
  const kind = kindArg ? kindArg.slice('--kind='.length) : 'manual';
  const task = args.filter((a) => !a.startsWith('--')).join(' ') || '(未命名)';
  const KIND_DESC = {
    commit: 'git 钩子自动记录：产生了一次提交',
    merge: 'git 钩子自动记录：完成了一次合并',
    manual: '手工记录',
  };
  const flipped = appendRecord(
    buildEntry({
      task,
      kind,
      st: collectLight(),
      body: [`- 来源：${KIND_DESC[kind] ?? kind}`],
    }),
  );
  if (process.stdout.isTTY === true) {
    reportFlipped(flipped);
    ok(`已追加记录（kind=${kind}）`);
  }
}

/** 轻量收集：钩子路径用，只取记录一条时间轴所需字段（一次批量调用） */
function collectLight() {
  const b = gitBatchMap([
    ['branch', ['branch', '--show-current']],
    ['head', ['rev-parse', '--short', 'HEAD']],
    ['headFull', ['rev-parse', 'HEAD']],
    ['subject', ['log', '-1', '--pretty=%s']],
    ['tagHere', ['tag', '--points-at', 'HEAD']],
  ]);
  return {
    branch: b.branch || '(detached)',
    head: b.head,
    headFull: b.headFull,
    subject: b.subject,
    tagHere: b.tagHere.split('\n').filter(Boolean),
  };
}

/**
 * 幂等补记：把最近若干提交中**尚未记录**的补进时间轴。
 *
 * 存在的理由：git 钩子在某些受限环境里跑不起来（实测沙箱禁止命名管道，
 * Git 执行 hook 时用的 sh.exe 直接 fatal），但「自动记录」这件事不能因此丢掉。
 * 于是提供一条可重复执行的补偿命令：已经记过的 commit 不会重复追加。
 */
function cmdSync(args) {
  const nArg = args.find((a) => /^\d+$/.test(a));
  const limit = nArg ? Number(nArg) : 20;

  const raw = g(['log', `-${limit}`, '--pretty=%H%x1f%h%x1f%s%x1f%ci']);
  const commits = raw
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [full, short, subject, date] = l.split('\x1f');
      return { full, short, subject, date: (date ?? '').slice(0, 16) };
    });

  const text = readHistory();
  const missing = commits.filter((c) => !text.includes(c.full));

  step(`补记检查：最近 ${commits.length} 个提交，未记录 ${missing.length} 个`);
  if (missing.length === 0) {
    ok('时间轴已是最新，无需补记');
    return;
  }

  // 按时间正序追加（git log 是新→旧）
  for (const c of missing.reverse()) {
    const entry = [
      `#### ${c.date} · 提交 · sync`,
      '',
      `- 分支记录：\`${c.short}\` —— ${c.subject}`,
      `- 完整哈希：\`${c.full}\``,
      '- 来源：`pnpm git:sync` 幂等补记（钩子未触发时的补偿路径）',
      '',
    ].join('\n');
    syncHistory({ entry });
  }

  const flipped = syncHistory({});
  ok(`已补记 ${missing.length} 条`);
  reportFlipped(flipped);
}

/* ────────────────────────────── 入口 ────────────────────────────── */
function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (!sub || sub === 'help' || sub === '--help') {
    say(`${C.b}魔法小屋 · 版本管理工具${C.x}   详见 docs/VERSIONING.md\n`);
    say('  start <任务号> [短名]   开任务分支');
    say('  verify [任务号]         跑门禁并记录（--quick 只跑 typecheck+verify）');
    say('  done  <任务号>          收尾：门禁 → 合并回 dev → 打 -dev.N tag');
    say('  ship [main]             生成推送 / 发布命令（★ 只生成，绝不执行 push）');
    say('  status                  仓库状态 + 待推送 + tag 同步情况（只读）');
    say('  history                 打印自动记录区');
    say('  sync [N]                幂等补记：把最近 N 个未记录的提交补进时间轴（默认 20）');
    say('  record "<说明>"         追加一条记录（--kind=commit|merge|manual，供 git 钩子调用）');
    say('');
    say(`  ${C.d}GitPushHistory.md 只增不改；唯一例外是把已执行的 [ ] 翻成 [x]。${C.x}`);
    say(`  ${C.d}推送一律由人工执行。${C.x}`);
    return;
  }
  switch (sub) {
    case 'start': return cmdStart(rest);
    case 'verify': return cmdVerify(rest);
    case 'done': return cmdDone(rest);
    case 'ship': return cmdShip(rest);
    case 'status': return cmdStatus();
    case 'history': return cmdHistory();
    case 'sync': return cmdSync(rest);
    case 'record': return cmdRecord(rest);
    default: die(`未知子命令：${sub}（用 --help 看用法）`);
  }
}

main();
