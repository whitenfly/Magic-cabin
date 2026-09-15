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
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    // 用 `*>` 而不是 `>`：`*>` 把所有流按文本管道序列化，配合按 BOM 解码拿到 UTF-8。
    // ★ 末尾必须显式 `exit $LASTEXITCODE`：git 会把**正常提示**写到 stderr
    //   （如 `git switch -c` 的 "Switched to a new branch 'x'"），PowerShell 据此抛
    //   NativeCommandError 并使 powershell.exe 以 1 退出 —— 结果是"命令明明成功却被判定为失败"，
    //   `task:start` / `task:done` 会在动作已完成之后报错并跳过记录。
    const inner = `${cmdline} *> '${file.replace(/'/g, "''")}'; exit $LASTEXITCODE`;
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

/* ─────────────── 「实际执行的 git 操作」采集（J2 工具改造）───────────────
 *
 * 需求来源：`GitPushHistory.md` 的每条记录此前只有「分支 @ head + 主题」，
 * 看不出**到底跑了哪几条 git 命令** —— 事后无法复制复现，也无法核对
 * "记录里的操作"与"真实发生的事"是否一致。
 *
 * 现在每次运行本工具时，凡**变更类**命令都会按原样记进本次记录条目。
 * **只读查询一律不记**（`log` / `status` / `rev-parse` / `tag -l` /
 * `branch --show-current` / `ls-remote`…）—— 否则每次 status 都会灌进几十条噪音。
 */

/** 是否属于"会改变仓库状态"的 git 命令 */
function isMutatingGit(args) {
  const [cmd, ...rest] = args;
  const has = (...flags) => rest.some((a) => flags.some((f) => a === f || a.startsWith(f)));
  switch (cmd) {
    case 'switch':
    case 'checkout':
    case 'merge':
    case 'commit':
    case 'push':
    case 'pull':
    case 'fetch':
    case 'rebase':
    case 'reset':
    case 'add':
    case 'rm':
    case 'mv':
    case 'restore':
    case 'cherry-pick':
    case 'revert':
    case 'stash':
    case 'init':
    case 'clone':
    // ── 引用的直接操作与对象库操作（都确实改了仓库，别漏）──
    case 'update-ref':
    case 'symbolic-ref':
    case 'update-index':
    case 'read-tree':
    case 'checkout-index':
    case 'write-tree':
    // ── 工作区 / 补丁类 ──
    case 'clean':
    case 'apply':
    case 'am':
    // ── 维护类（会改写对象库与引用）──
    case 'gc':
    case 'prune':
    case 'pack-refs':
    case 'replace':
    case 'filter-branch':
    case 'sparse-checkout':
    case 'notes':
    case 'submodule':
    case 'worktree':
      return true;
    case 'config':
      // `config --get/--list/-l/…` 是查询；`config <key> <value>` / `--unset` / `--add` 是写
      return !has('--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '-l');
    case 'tag':
      // `tag -l` / `--points-at` / `--list` 是查询；`-a` / `-d` / `-s` / `-f` 才是写
      return has('-a', '-d', '-s', '-f');
    case 'branch':
      // `branch --show-current` / `-l` / `-vv` 是查询；增删改名才是写
      return has('-d', '-D', '-m', '-M', '-c', '-C', '--delete', '--move', '--copy');
    case 'remote':
      return rest.some((a) => ['add', 'remove', 'rm', 'rename', 'set-url'].includes(a));
    default:
      return false;
  }
}

/** 命令行参数格式化：含空白或引号的加双引号，保证复制出去就能执行 */
const fmtArg = (a) => (/[\s"]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : String(a));

/** 本次进程实际执行**成功**的变更类命令（按执行顺序，含原命令） */
const executedOps = [];

/** 取本次已采集的命令（副本；测试与 `--print-ops` 用） */
const opsSnapshot = () => executedOps.slice();

/**
 * 执行 git 并返回 stdout。
 * @param {string[]} args
 * @param {{allowFail?: boolean, timeout?: number}} [opt]
 */
function git(args, { allowFail = true, timeout = 0 } = {}) {
  // ★ 降级路径下参数必须逐个 quote：提交信息等含空格的参数一旦被裸拼进命令行，
  //   `git merge --no-ff <branch> -m merge J2.4：合入 dev` 会被解析成
  //   "merge: J2.4：合入 - not something we can merge"（实测 task:done 卡在这里）。
  //   与下面的 run() 保持一致。
  const cmdline = ['git', ...args].map((a) => (a.includes(' ') ? quote(a) : a)).join(' ');
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
    // ★ 采集"实际执行过的变更类命令"（原命令形式，可直接复制复现）。
    //   只记**成功**的：失败的命令不该出现在"已执行操作"里。
    if (status === 0 && isMutatingGit(args)) executedOps.push(`git ${args.map(fmtArg).join(' ')}`);
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

/**
 * 生成「当前需要人工执行的推送命令」。
 *
 * ★ 三件事缺一不可：**dev、main、以及所有未推送的 tag**。
 *
 *   2026-09-14 的真实事故促成了这个函数：当时每个任务收尾只生成一条
 *   `git push -u origin dev`（不含 main、不含 tag，也不带 `--follow-tags`），
 *   阶段收尾又漏跑了 `pnpm ship` —— 结果 main 的 37 个提交与 11 个 tag
 *   静静躺在本地，而 `GitPushHistory.md` 上"看不出少做了什么"。
 *
 * @returns {{ cmds: string[], unknown: string[] }} `cmds` = 待执行命令；`unknown` = 远端不可达时无法判定的 tag
 */
function pendingPushCommands(st) {
  const cmds = [];
  /** 分支：远端没这个分支 → `-u` 建立跟踪；落后 → 普通 push */
  const branch = (name, info) => {
    if (!info.exists) cmds.push(`git push -u origin ${name}`);
    else if (info.ahead > 0) cmds.push(`git push origin ${name}`);
  };
  branch(DEV_BRANCH, st.dev);
  branch(MAIN_BRANCH, st.main);

  // tag：**逐个列出**（而不是 `--tags`）—— 这样每条命令都能被 `isCommandDone()`
  // 逐字核对、自动翻 [x]；一行最多 CHUNK 个，避免命令过长。
  //
  // ★ 远端不可达时，tag 状态是 UNKNOWN（不是"已推送"）—— **也要列出来**：
  //   "无法确认"绝不等于"不用推"，漏列的后果正是 2026-09-14 的事故
  //   （记录里根本没有那条命令，于是没人知道少了什么）。
  //   多列一条的命令是**无害**的：已推送的 tag 再推一次只会回 `Everything up-to-date`。
  const un = unpushedTags(st);
  const uv = st.remoteReachable === false ? unverifiedTags(st) : [];
  const tags = [...un, ...uv];
  const CHUNK = 6;
  for (let i = 0; i < tags.length; i += CHUNK) {
    cmds.push(`git push origin ${tags.slice(i, i + CHUNK).join(' ')}`);
  }
  return { cmds, unknown: uv };
}

/**
 * 一条待执行命令是否**可由 git 状态证明**已完成（维护铁律第 3 条：标记不猜）。
 *
 * 目前只认推送类命令 —— 那是本工具唯一"只生成不执行"的动作：
 *   · `git push [-u] origin <dev|main>`  → 对应分支的远端跟踪引用存在且不 ahead
 *   · `git push origin v… v…`            → 列出的 tag **全部**已出现在远端
 *   · `git push origin main --follow-tags` → 只看 main（tag 由它自己的命令负责）
 */
function isCommandDone(st, cmd) {
  const push = /^git push (?:-u )?origin (.+)$/.exec(String(cmd).trim());
  if (!push) return false;
  const targets = push[1]
    .split(/\s+/)
    .filter((t) => t && !t.startsWith('-'));
  if (targets.length === 0) return false;
  return targets.every((t) => {
    if (t === DEV_BRANCH) return st.dev.exists && st.dev.ahead === 0;
    if (t === MAIN_BRANCH) return st.main.exists && st.main.ahead === 0;
    if (t.startsWith('v')) return tagVerdict(st, t) === TAG_STATE.PUSHED;
    return false;
  });
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
6. ★ **记录原命令**：每条时间轴记录都带「**实际执行**」段，逐条列出本次真正跑过的
   **变更类** git 命令（\`switch\` / \`merge\` / \`tag -a\` / \`commit\` / \`branch -d\` …；
   只读查询如 \`log\` / \`status\` / \`ls-remote\` 一律不列）。
   这样既能事后复制复现，也能核对"记录"与"真实发生的事"是否一致。
7. ★ **推送命令三件套**：任何生成推送命令的地方都必须覆盖 **dev、main、所有未推送的 tag**。
   2026-09-14 的事故正是只生成了 dev 的推送命令：main 的 37 个提交与 11 个 tag
   静静躺在本地，而记录上"看不出少做了什么"。
8. ★ **阶段收尾必须跑 \`pnpm ship\`**：只有它会生成 main 与正式版 tag 的推送命令；
   任务级 \`pnpm task:done\` 只管 dev。

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
 *
 * 判定依据**只有 git 状态，不做任何猜测**（维护铁律第 3 条）：
 * 逐行解析 `# [ ] <命令>`，交给 `isCommandDone()` 判断。
 *
 * ★ 早期版本用一组正则规则硬编码 `git push origin main` / `git push -u origin dev`
 *   两种写法，遇到新的命令形式（如一行推多个 tag）就漏判 —— 现在改为按命令语义判定，
 *   生成端怎么写都能被认出来。
 */
function markCompleted(text) {
  const st = collect(false);
  const flipped = [];
  const lines = text.split('\n').map((line) => {
    const m = /^# \[ \] (.+)$/.exec(line);
    if (!m) return line;
    if (!isCommandDone(st, m[1])) return line;
    const done = `# [x] ${m[1]}`;
    flipped.push(done);
    return done;
  });
  return { text: lines.join('\n'), changed: flipped.length > 0, flipped, st };
}

/* ──────────────────────────── 记录条目构建 ──────────────────────────── */
/**
 * 记录条目构建。
 *
 * 数据项（按顺序）：
 *   1. 标题：`#### 时间 · 任务 · 种类`
 *   2. `分支` / `tag`（HEAD 上的）
 *   3. ★ `实际执行`：本次进程真正跑过的**变更类 git 原命令**（只读查询不列）
 *   4. 自由正文（落点 / 门禁结果 / 依据…）
 *   5. 待执行命令区块（由 `syncHistory` 渲染成 `# [ ] …` 复选框）
 *   6. 备注
 *
 * @param {{task: string, kind?: string, st?: object, body?: string[], commands?: string[], note?: string, ops?: string[]}} spec
 *        `ops` 显式传入时覆盖本次采集结果（供需要"只记某几条"的调用方使用）
 */
function buildEntry({ task, kind, st, body = [], commands = [], note = '', ops = undefined }) {
  const lines = [`#### ${now()} · ${task}${kind ? ` · ${kind}` : ''}`, ''];
  if (st) {
    lines.push(`- 分支：\`${st.branch}\` @ \`${st.head}\` —— ${st.subject}`);
    if (st.tagHere?.length) lines.push(`- tag：${st.tagHere.map((t) => `\`${t}\``).join('、')}`);
  }
  // ★ 实际执行的 git 命令（原命令，可直接复制复现）
  const executed = ops === undefined ? opsSnapshot() : ops;
  if (executed.length) {
    lines.push('- 实际执行：');
    for (const c of executed) lines.push(`  - \`${c}\``);
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

  const after = collect(false);
  const push = pendingPushCommands(after);
  const flipped = appendRecord(
    buildEntry({
      task: `开任务分支 ${name}`,
      kind: 'start',
      st: after,
      body: [
        `- 依据：\`docs/VERSIONING.md\` §3；任务号 ${task}`,
        '- 下一步：开发 → `pnpm gate`（或 `pnpm task:done ' + task + '` 一并跑门禁+合并+打 tag）',
      ],
      note: '任务分支用完即删：`git branch -d` 由 `task:done` 自动完成。',
    }),
    push.cmds.length ? push.cmds : null,
  );
  say('');
  reportFlipped(flipped);
  ok('已追加记录到 GitPushHistory.md');
  if (push.cmds.length) printPending(after);
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

function nextDevVersion(st, task, baseOverride) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const cur = String(pkg.version).replace(/-dev\.\d+$/, '');
  const m = /^[A-Za-z](\d+)(?:\.(\d+))?$/.exec(task);
  let base = cur;
  // ★ 显式覆盖优先：`Jx.y` 这个写法在本项目里有**两种含义** ——
  //   ① 阶段内的第 y 个任务（如 `J2.4` 弹簧与滑轨）；② 一个独立的 `.5` 子阶段（如 `J2.5` 配置编排层）。
  //   规范的映射表与示例要求：阶段内任务**共用** `0.<x>.0-dev.N` 序列
  //   （`VERSIONING.md` §3 的示例写着 `J2.1 CameraRig` → `v0.2.0-dev.1`），只有子阶段才占 `0.<x>.5`。
  //   脚本无法从任务号自行区分两者，因此用 `--base=` 显式指定；不指定时保持原有推导。
  if (baseOverride) {
    if (!/^\d+\.\d+\.\d+$/.test(baseOverride)) die(`--base 应为 x.y.z 形式，收到：${baseOverride}`);
    base = baseOverride;
  } else if (m) base = m[2] ? `0.${m[1]}.${m[2]}` : `0.${m[1]}.0`;
  const existing = st.localTags.filter((t) => t.startsWith(`v${base}-dev.`)).length;
  return { base, tag: `v${base}-dev.${existing + 1}` };
}

function cmdDone(args) {
  const task = args[0];
  if (!task) die('用法：node scripts/release.mjs done <任务号> [--base=x.y.z]   例：done J2.1 --base=0.2.0');
  if (!TASK_RE.test(task)) die(`任务号格式应为 Jx / Jx.y / F0.x，收到：${task}`);
  const baseOverride = (args.find((a) => a.startsWith('--base=')) || '').slice('--base='.length) || null;

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

  const { base, tag } = nextDevVersion(st, task, baseOverride);
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
  const push = pendingPushCommands(after);
  const flipped = appendRecord(
    buildEntry({
      task: `${task} 完成`,
      kind: 'done',
      st: after,
      body: [
        `- 版本号：\`${base}\`（package.json 的 version 请同步）`,
        `- tag：\`${tag}\`（开发版快照，只打在 ${DEV_BRANCH} 上）`,
        `- 合并至：\`${DEV_BRANCH}\` @ \`${after.head}\``,
        `- 待补：\`docs/实施结果/${task}-实施结果.md\`（DoD 核对 / 落点 / 门禁项数 / 遗留交接）`,
      ],
      note:
        '★ **阶段收尾必须再跑 `pnpm ship`**（dev → main 合并 + 正式版 tag），' +
        '否则 main 与正式 tag 会一直留在本地 —— 任务级 `done` 只管 dev。',
    }),
    push.cmds.length ? push.cmds : null,
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
  const { cmds, unknown } = pendingPushCommands(st);
  if (unknown.length) info(`tag 状态无法确认：${unknown.join('、')}（远端不可达，不代表未推送）`);
  if (cmds.length === 0) {
    ok('分支与 tag 均已与 origin 同步');
    return;
  }
  say('');
  warn('★ 以下推送命令必须由人工在**普通终端**执行（本工具绝不自动 push）');
  for (const c of cmds) say(`  ${c}`);
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
      `# --follow-tags 会把 v${ver} 一起推上去（它是附注 tag 且指向 main 上的提交）`,
      `git push origin ${MAIN_BRANCH} --follow-tags`,
      `git switch ${DEV_BRANCH}`,
      `# 回到 dev 后仍需推送 dev 与开发版 tag —— 用 pnpm ship 复查`,
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

  // 默认：生成「待推送」命令清单（只生成，不执行）—— ★ 覆盖 dev / main / tag 三者
  const { cmds, unknown } = pendingPushCommands(st);
  const un = unpushedTags(st);

  step('待推送命令（复制到普通终端执行）');
  if (cmds.length === 0) {
    ok('分支与 tag 均已与 origin 同步');
  } else {
    for (const c of cmds) say(`  ${c}`);
  }
  if (unknown.length) {
    warn(
      `其中 ${unknown.length} 个 tag 的状态**无法确认**（远端不可达）—— 已一并列出；` +
        '已推送过的再推一次只会回 `Everything up-to-date`，无害。',
    );
  }
  say('');
  warn('本工具**不会**自动推送：推送一律由人工在普通终端完成');

  const flipped = appendRecord(
    buildEntry({
      task: '推送计划（人工执行）', kind: 'ship', st,
      body: [
        `- 依据：${st.remoteReachable === false ? '远端不可达，按本地跟踪引用估算' : '远端 tag 列表已核对'}`,
        `- 覆盖范围：dev（${st.dev.exists ? `领先 ${st.dev.ahead}` : '远端不存在'}）、` +
          `main（${st.main.exists ? `领先 ${st.main.ahead}` : '远端不存在'}）、未推送 tag（${un.length} 个）` +
          ' —— **三者缺一不可**',
        '- 待人工执行的推送命令：',
      ],
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
  if (pendingPushCommands(st).cmds.length) {
    say('');
    info(`要把上面的推送命令**写进记录的待执行命令区**（并纳入自动标记）：跑 \`pnpm ship\``);
  }
}

function cmdHistory() {
  const text = readHistory();
  say(autoBody(text).trim());
}

/**
 * 从 `git reflog` 的一行里解析出被合并的分支名。
 *
 * 输入形如：`merge task/J2.11-release-flow-docs: Merge made by the 'ort' strategy.`
 * （`reflog -1 --format=%gs` 的输出）
 *
 * 抽成纯函数是为了可测 —— 这是"钩子路径能否重建出命令"的关键一步。
 */
function parseMergeSource(reflogSubject) {
  const m = /^merge\s+(.+?):/.exec(String(reflogSubject).trim());
  return m ? m[1].trim() : null;
}

/**
 * ★ 钩子路径：由 git 状态**重建**等价命令。
 *
 * 为什么需要它：`post-commit` / `post-merge` 钩子是 git 拉起的**独立进程**，
 * 它只知道"发生了一次提交/合并"，**拿不到用户敲的那条命令行**——
 * 所以钩子写出的记录里没有「实际执行」段（那段是**本进程**跑过的命令）。
 *
 * 但 git 自己把关键信息都记下来了，足以还原出一条**等价且可复制复现**的命令：
 *   · 被合并的分支   ← `git reflog -1 --format=%gs`（`merge <branch>: Merge made by …`）
 *   · 是否 `--no-ff` ← `git rev-list --parents -n 1 HEAD` 的父提交个数（2 个 = 合并提交）
 *   · `-m` 的内容    ← `git log -1 --pretty=%s`
 *
 * ⚠️ 记录里会**明确标注"重建"**，与工具路径的「实际执行」（原样捕获）区分开 ——
 *    两者可信度不同，混在一起会让人误以为钩子也看见了原命令。
 *
 * @returns {string|null} 重建出的命令；无法判定时返回 `null`（宁可不写，也不猜）
 */
function reconstructOp(kind) {
  if (kind === 'merge') {
    const reflog = g(['reflog', '-1', '--format=%gs'], { allowFail: true }).trim();
    const src = parseMergeSource(reflog);
    if (!src) return null;
    const subject = g(['log', '-1', '--pretty=%s'], { allowFail: true }).trim();
    const parents = g(['rev-list', '--parents', '-n', '1', 'HEAD'], { allowFail: true }).trim().split(/\s+/).length - 1;
    const flag = parents >= 2 ? '--no-ff ' : '';
    return `git merge ${flag}${src}${subject ? ` -m "${subject}"` : ''}`;
  }
  if (kind === 'commit') {
    const subject = g(['log', '-1', '--pretty=%s'], { allowFail: true }).trim();
    return subject ? `git commit -m "${subject}"` : null;
  }
  return null;
}

/* ─────────── exec：模型执行 git 的**唯一**入口（J2 工具改造）───────────
 *
 * 需求边界（2026-09-14 明确）：**模型在开发中自动执行的每一条 git 命令都必须被记录**；
 * **不包括人工在终端敲的命令** —— 所以不走 git 的 trace2（那会把人工命令也卷进来，
 * 还得改用户级 git config）。边界划在"模型走这个入口"上，更精确，也不动用户环境。
 *
 * 用法（模型在会话里执行 git 时一律走它，不直接敲 git）：
 *
 *     node scripts/release.mjs exec -- git add -A
 *     node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt
 *     node scripts/release.mjs exec -- git tag -l "v0.2*"        # 只读查询同样记录
 *
 * 工具代为执行后，本次命令会**原样**写进本次记录（含只读查询）——
 * 于是"模型跑过什么"既不依赖事后回忆，也不依赖 git 的追踪机制。
 */
/**
 * 从 `exec` 的参数里取出真正的 git 参数（纯函数，可测）。
 *
 * 支持两种写法：
 *   `exec -- git status --short`  → `['status', '--short']`
 *   `exec git status --short`     → 同上（`--` 是可选的，但推荐写，避免歧义）
 */
function parseExecArgs(args) {
  const sep = args.indexOf('--');
  let argv = sep >= 0 ? args.slice(sep + 1) : args;
  if (argv[0] === 'git' || argv[0] === 'git.exe') argv = argv.slice(1);
  return argv;
}

/**
 * `record --ops="git …"` 的字符串是否值得记 —— 只留**对仓库有修改**的命令。
 *
 * 与 `isMutatingGit()` 同一套判据，只是输入是字符串而非 argv。
 * 抽出来是为了可测：补登记时把 `git status` 之类的查询混进去是很容易犯的错。
 */
function isRecordableOp(op) {
  const argv = String(op)
    .trim()
    .replace(/^git(\.exe)?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return argv.length > 0 && isMutatingGit(argv);
}

/**
 * ★ 受保护分支的机械防护（VERSIONING.md §1 R1 / 判例 P1）。
 *
 * 规则：**禁止在 `dev` / `main` 上产生开发提交**。所有改动必须在 `task/*` 分支上产生，
 * 并以 `--no-ff` 合并进入 —— 否则任务失去"一条 `revert` 整体撤销"的边界
 * （判例 P1：`J3` 的 6 个提交直接落在 dev 上，6217 行 / 35 个模块只能逐个挑）。
 *
 * 为什么必须有这层防护，而不是只写进文档：
 *   文档禁令已经存在（旧版 §12.5 红线 1），`J3` 依然违反了 —— **光靠自觉不够**。
 *
 * 两类**合法豁免**（白名单，宁窄勿宽）：
 *   ① 合并提交：`MERGE_HEAD` 存在（冲突解决后的 commit，本质是完成一次 merge）；
 *   ② 发布元数据提交：**暂存区只有 `package.json` 一个文件**（§5.2 的 `chore(release)`）。
 *      开发提交不可能只改 `package.json`，所以这条判据不会误伤。
 *
 * @returns {string|null} 违规说明；合规时返回 null
 */
function guardProtectedBranch(argv) {
  if (argv[0] !== 'commit') return null;
  const branch = g(['branch', '--show-current']).trim();
  if (branch !== DEV_BRANCH && branch !== MAIN_BRANCH) return null;

  // 豁免 ①：处于合并中（git merge 的收尾提交）
  if (gOK(['rev-parse', '--verify', '-q', 'MERGE_HEAD'])) return null;

  // 豁免 ②：发布元数据提交（只暂存了 package.json）
  const staged = g(['diff', '--cached', '--name-only'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (staged.length === 1 && staged[0] === 'package.json') return null;

  return (
    `在受保护分支 \`${branch}\` 上直接提交被拒绝（VERSIONING.md §1 R1）。\n` +
    `    正确做法：\n` +
    `      node scripts/release.mjs start <编号> <短名>     # 先开 task/ 分支（当前改动会一起带过去）\n` +
    `      node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt\n` +
    `      node scripts/release.mjs done <编号> --base=<x.y.z>   # 以 --no-ff 合回 ${branch}\n` +
    `    合法豁免只有两种：合并提交、发布元数据提交（只改 package.json）。`
  );
}

function cmdExec(args) {
  const argv = parseExecArgs(args);
  if (argv.length === 0) die('用法：node scripts/release.mjs exec -- git <args…>');

  // ★ 分支防护先于执行：违规尝试**必须留痕**，不得静默丢弃（§13 留痕原则）。
  const violation = guardProtectedBranch(argv);
  if (violation) {
    bad(violation);
    say('');
    appendRecord(
      buildEntry({
        task: `拒绝：git commit（${g(['branch', '--show-current']).trim()} 分支保护）`,
        kind: 'blocked',
        st: collectLight(),
        ops: [`git ${argv.map(fmtArg).join(' ')}`],
        body: ['- 结果：**已拒绝执行**（未产生提交）', `- 依据：${violation.split('\n')[0]}`],
        note: '★ 本条由 §1 R1 的机械防护写入：违规尝试留痕，便于事后复盘是哪条流程没走。',
      }),
    );
    process.exit(1);
  }

  // ★ 只记**对仓库有修改**的命令（`add` / `commit` / `merge` / `tag -a` / `branch -d` / `push`…）。
  //   只读查询（`status` / `log` / `diff` / `rev-parse` / `reflog`…）照常执行、照常输出，
  //   但**不进历史** —— 否则每次查看状态都会污染记录（见 docs/VERSIONING.md §13.1）。
  const recordable = isMutatingGit(argv);
  step(`exec: git ${argv.map(fmtArg).join(' ')}`);
  const r = git(argv, { allowFail: true });
  if (r.out) process.stdout.write(r.out);
  if (recordable) {
    const flipped = appendRecord(
      buildEntry({
        task: `git ${argv[0]}${argv[1] && !argv[1].startsWith('-') ? ` ${argv[1]}` : ''}`,
        kind: 'exec',
        st: collectLight(),
        ops: [`git ${argv.map(fmtArg).join(' ')}`],
        body: [`- 退出码：${r.status}${r.status === 0 ? '' : '  ⚠️ 非零'}`],
        note: '本命令由模型通过 exec 入口执行并自动记录（见 docs/VERSIONING.md §13）。',
      }),
    );
    reportFlipped(flipped);
    // ★ 变更之后顺手看一眼**是否产生了新的未推送提交**（只用本地跟踪引用，不碰网络）。
    //   目的是堵住"记录全绿、远端却落后"那个坑 —— 它曾让 main 的 37 个提交与 11 个 tag
    //   滞留本地，而记录上看不出少了什么。这里即时提醒，比事后跑 status 才发现要早。
    const aheadOf = (b) =>
      Number(g(['rev-list', '--count', `origin/${b}..${b}`], { allowFail: true }).trim() || 0);
    const aheadDev = aheadOf(DEV_BRANCH);
    const aheadMain = aheadOf(MAIN_BRANCH);
    if (aheadDev > 0 || aheadMain > 0) {
      say('');
      warn(`有未推送提交：${DEV_BRANCH} 领先 ${aheadDev} / ${MAIN_BRANCH} 领先 ${aheadMain}`);
      info('把推送命令写进记录的待执行命令区：`pnpm ship`（推送一律由人工在普通终端执行）');
    }
  } else {
    info('只读查询：已执行，按约定不进历史（§13.1）');
  }
  if (r.status !== 0) process.exitCode = r.status;
}

function cmdRecord(args) {
  const kindArg = args.find((a) => a.startsWith('--kind='));
  const kind = kindArg ? kindArg.slice('--kind='.length) : 'manual';
  const task = args.filter((a) => !a.startsWith('--')).join(' ') || '(未命名)';
  // 事后补登记：--ops="git add -A"（可多次传入）—— 给"忘了走 exec"的场景兜底。
  // ★ 只留**对仓库有修改**的命令：把 `git status` 之类的查询混进来是很容易犯的错，
  //   而它们按 §13.1 不该出现在历史里 ⇒ 这里直接过滤掉并如实报告忽略了几条。
  const allOps = args.filter((a) => a.startsWith('--ops=')).map((a) => a.slice('--ops='.length));
  const extraOps = allOps.filter(isRecordableOp);
  const droppedOps = allOps.length - extraOps.length;
  const KIND_DESC = {
    commit: 'git 钩子自动记录：产生了一次提交',
    merge: 'git 钩子自动记录：完成了一次合并',
    manual: '手工记录',
  };
  // ★ 钩子是 git 拉起的独立进程，**拿不到用户敲的命令行** —— 由 git 状态重建一条等价命令，
  //   并明确标注是"重建"（与工具路径的「实际执行」原样捕获区分开，两者可信度不同）。
  const rebuilt = reconstructOp(kind);
  const body = [`- 来源：${KIND_DESC[kind] ?? kind}`];
  if (droppedOps > 0) body.push(`- 已忽略 ${droppedOps} 条只读查询（按 §13.1 只记有修改的命令）`);
  if (rebuilt) {
    body.push(`- **重建**命令（钩子拿不到原文，此处由 git 状态还原）：\`${rebuilt}\``);
  } else if (kind === 'merge' || kind === 'commit') {
    body.push('- ⚠️ 命令无法重建（reflog 信息不足）—— 需要精确原命令请走 `pnpm task:done`');
  }
  const flipped = appendRecord(
    buildEntry({
      task,
      kind,
      st: collectLight(),
      body,
      // 钩子进程自己没跑变更命令 ⇒ 默认空；--ops 显式补登记时用传入的
      ops: extraOps,
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
    say('  done  <任务号>          收尾：门禁 → 合并回 dev → 打 -dev.N tag → 生成推送命令');
    say('  ship                    生成待推送命令：★ dev + main + 所有未推送 tag（只生成，不执行）');
    say('  ship main               生成正式版发布计划：dev→main 合并 + 正式 tag + 推送');
    say('  status                  仓库状态 + 待推送 + tag 同步情况（只读；会把已完成的 [ ] 翻 [x]）');
    say('  history                 打印自动记录区');
    say('  sync [N]                幂等补记：把最近 N 个未记录的提交补进时间轴（默认 20）');
    say('  exec -- git <args…>     ★ 模型执行 git 的**唯一入口**（自动记录原命令，含只读查询）');
    say('  record "<说明>"         追加一条记录（--kind=…，--ops="git …" 事后补登记，供 git 钩子调用）');
    say('');
    say(`  ${C.d}GitPushHistory.md 只增不改；唯一例外是把已执行的 [ ] 翻成 [x]。${C.x}`);
    say(`  ${C.d}每条记录都带「实际执行」段（变更类 git 原命令）；推送一律由人工执行。${C.x}`);
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
    case 'exec': return cmdExec(rest);
    case 'record': return cmdRecord(rest);
    default: die(`未知子命令：${sub}（用 --help 看用法）`);
  }
}

/*
 * ★ 只在**直接执行**时跑 CLI。被 `import` 时（单元测试）不执行 main ——
 *   这样"待推送命令生成"与"完成标记判定"这两处最容易出错、又最难靠肉眼验证的逻辑
 *   能被测试覆盖，而不是只能"跑一遍看看"。
 *   （2026-09-14 的事故就出在这里：`pendingPushCommands` 覆盖不全，
 *     而当时没有任何测试能发现。）
 */
const isDirectRun =
  Boolean(process.argv[1]) && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();

export {
  // 供 tests/unit/release-tool.test.mjs 使用
  pendingPushCommands,
  isCommandDone,
  isMutatingGit,
  fmtArg,
  buildEntry,
  parseMergeSource,
  parseExecArgs,
  isRecordableOp,
  TAG_STATE,
  DEV_BRANCH,
  MAIN_BRANCH,
};
