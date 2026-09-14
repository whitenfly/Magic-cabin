/**
 * 单元测试 —— 版本管理工具（`release.mjs`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * ## 为什么单独给工具写测试
 *
 * 2026-09-14 的真实事故：J2 阶段收尾后，`main` 的 37 个提交与 11 个 tag
 * 静静躺在本地，而 `GitPushHistory.md` 上"看不出少做了什么" —— 因为
 * **生成待推送命令的那段逻辑只覆盖 dev**。
 *
 * 这类缺陷靠"跑一遍看看"发现不了（跑完是绿的），必须用**构造出来的状态**去断言：
 * 给定"dev 同步 / main 领先 / 若干 tag 未推送"，工具应该生成哪些命令；
 * 反过来，给定一条历史命令，工具该不该把它标成已完成。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pendingPushCommands,
  isCommandDone,
  isMutatingGit,
  fmtArg,
  buildEntry,
  parseMergeSource,
  parseExecArgs,
  TAG_STATE,
} from '../../scripts/release.mjs'

/** 构造一份 `collect()` 形态的状态（只填被测逻辑读到的字段） */
function fakeSt({ devAhead = 0, mainAhead = 0, devExists = true, mainExists = true, tags = {}, remoteReachable = true } = {}) {
  const tagStates = new Map()
  for (const [name, state] of Object.entries(tags)) {
    tagStates.set(name, state === 'pushed' ? TAG_STATE.PUSHED : state === 'unpushed' ? TAG_STATE.UNPUSHED : TAG_STATE.UNKNOWN)
  }
  return {
    branch: 'dev',
    head: 'abc1234',
    subject: '测试提交',
    tagHere: [],
    lastTag: 'v0.2.0',
    localTags: Object.keys(tags),
    dev: { exists: devExists, ahead: devAhead, commits: [] },
    main: { exists: mainExists, ahead: mainAhead, commits: [] },
    remoteReachable,
    tagStates,
  }
}

/* ─────────────────────── ① 待推送命令必须覆盖三件套 ─────────────────────── */

test('★ 待推送命令覆盖 dev / main / tag 三者（事故复盘：旧实现只有 dev）', () => {
  const st = fakeSt({
    devAhead: 2,
    mainAhead: 37,
    tags: { 'v0.1.5': 'pushed', 'v0.2.0': 'unpushed', 'v0.2.0-dev.1': 'unpushed' },
  })
  const { cmds } = pendingPushCommands(st)
  assert.ok(cmds.includes('git push origin dev'), 'dev 落后时必须给出 dev 推送命令')
  assert.ok(cmds.includes('git push origin main'), 'main 落后时必须给出 main 推送命令')
  const tagLine = cmds.find((c) => c.includes('v0.2.0'))
  assert.ok(tagLine, '未推送的 tag 必须逐个列出')
  assert.ok(tagLine.includes('v0.2.0-dev.1'), '同一行应包含另一个未推送 tag')
  assert.ok(!tagLine.includes('v0.1.5'), '已推送的 tag 不再列出')
})

test('远端没有分支时用 -u 建立跟踪', () => {
  const st = fakeSt({ devExists: false, mainExists: false })
  const { cmds } = pendingPushCommands(st)
  assert.deepEqual(cmds, ['git push -u origin dev', 'git push -u origin main'])
})

test('全部同步时不生成任何命令', () => {
  const st = fakeSt({ tags: { 'v0.2.0': 'pushed' } })
  assert.deepEqual(pendingPushCommands(st).cmds, [])
})

test('★ 远端不可达时：UNKNOWN 的 tag **也要列出来**（"无法确认"≠"不用推"）', () => {
  const st = fakeSt({ remoteReachable: false, tags: { 'v0.2.0': 'unknown', 'v0.2.0-dev.1': 'unknown' } })
  const { cmds, unknown } = pendingPushCommands(st)
  const tagLine = cmds.find((c) => c.includes('v0.2.0'))
  assert.ok(tagLine, '远端不可达也必须列出 tag 推送命令 —— 漏列正是 2026-09-14 事故的形态')
  assert.ok(tagLine.includes('v0.2.0-dev.1'))
  assert.deepEqual(unknown, ['v0.2.0', 'v0.2.0-dev.1'], '同时在 unknown 里提示"状态无法确认"')
})

test('tag 过多时分行（每行最多 6 个，避免命令过长）', () => {
  const tags = {}
  for (let i = 1; i <= 14; i++) tags[`v0.2.0-dev.${i}`] = 'unpushed'
  const { cmds } = pendingPushCommands(fakeSt({ tags }))
  const tagCmds = cmds.filter((c) => c.startsWith('git push origin v'))
  assert.equal(tagCmds.length, 3, '14 个 tag 应分成 6 + 6 + 2 三行')
  /** 去掉 `git push origin` 三个词后的 tag 个数 */
  const count = (cmd) => cmd.split(/\s+/).slice(3).length
  assert.deepEqual(tagCmds.map(count), [6, 6, 2])
})

/* ─────────────────────── ② 完成标记的判定（标记不猜） ─────────────────────── */

test('★ 分支推送：远端跟踪引用已同步才算完成', () => {
  const synced = fakeSt({ devAhead: 0, mainAhead: 0 })
  assert.equal(isCommandDone(synced, 'git push -u origin dev'), true)
  assert.equal(isCommandDone(synced, 'git push origin main'), true)

  const behind = fakeSt({ devAhead: 1, mainAhead: 5 })
  assert.equal(isCommandDone(behind, 'git push origin dev'), false, 'dev 仍领先 ⇒ 不能标完成')
  assert.equal(isCommandDone(behind, 'git push origin main'), false, 'main 仍领先 ⇒ 不能标完成')
})

test('★ tag 推送：一行里**所有** tag 都到远端才标完成', () => {
  const st = fakeSt({ tags: { 'v0.2.0': 'pushed', 'v0.2.0-dev.1': 'unpushed' } })
  assert.equal(isCommandDone(st, 'git push origin v0.2.0'), true)
  assert.equal(isCommandDone(st, 'git push origin v0.2.0-dev.1'), false)
  assert.equal(isCommandDone(st, 'git push origin v0.2.0 v0.2.0-dev.1'), false, '有一个没推 ⇒ 整行都不算完成')
})

test('tag 状态无法确认（远端不可达）时**不**标完成', () => {
  const st = fakeSt({ remoteReachable: false, tags: { 'v0.2.0': 'unknown' } })
  assert.equal(isCommandDone(st, 'git push origin v0.2.0'), false, '标记不猜：未知就不翻 [x]')
})

test('`--follow-tags` 只看分支（tag 由它自己的命令负责）', () => {
  const st = fakeSt({ mainAhead: 0, tags: { 'v0.2.0': 'unpushed' } })
  assert.equal(isCommandDone(st, 'git push origin main --follow-tags'), true)
  const st2 = fakeSt({ mainAhead: 3 })
  assert.equal(isCommandDone(st2, 'git push origin main --follow-tags'), false)
})

test('非推送命令一律不判定为完成（本工具只生成推送命令）', () => {
  const st = fakeSt()
  for (const cmd of ['git merge --no-ff dev -m "x"', 'git tag -a v1 -m "x"', 'git switch main', '']) {
    assert.equal(isCommandDone(st, cmd), false)
  }
})

/* ─────────────────────── ③ 哪些 git 命令会被记进历史 ─────────────────────── */

test('变更类命令被识别；只读查询不被识别', () => {
  const mutating = [
    ['switch', '-c', 'task/J2.4-x'],
    ['merge', '--no-ff', 'task/J2.4-x', '-m', 'merge J2.4'],
    ['tag', '-a', 'v0.2.0-dev.1', '-m', 'x'],
    ['commit', '-F', 'msg.txt'],
    ['branch', '-d', 'task/J2.4-x'],
    ['push', 'origin', 'dev'],
    ['add', '-A'],
  ]
  for (const args of mutating) assert.equal(isMutatingGit(args), true, `应识别为变更：git ${args.join(' ')}`)

  const readOnly = [
    ['log', '-1', '--pretty=%s'],
    ['status', '--porcelain'],
    ['rev-parse', '--short', 'HEAD'],
    ['tag', '-l'],
    ['tag', '--points-at', 'HEAD'],
    ['branch', '--show-current'],
    ['branch', '-vv'],
    ['ls-remote', '--exit-code', '--tags', 'origin'],
    ['describe', '--tags', '--abbrev=0'],
  ]
  for (const args of readOnly) assert.equal(isMutatingGit(args), false, `不该记查询：git ${args.join(' ')}`)
})

test('含空格的参数在记录里加引号（保证复制出去就能执行）', () => {
  assert.equal(fmtArg('dev'), 'dev')
  assert.equal(fmtArg('merge J2.4：合入 dev'), '"merge J2.4：合入 dev"')
  assert.equal(fmtArg('v0.2.0-dev.1'), 'v0.2.0-dev.1')
})

/* ─────────────────────── ④ 记录条目带「实际执行」原命令 ─────────────────────── */

test('★ 记录条目包含「实际执行」段与原命令', () => {
  const entry = buildEntry({
    task: 'J2.4 完成',
    kind: 'done',
    st: { branch: 'dev', head: 'abc1234', subject: 'x', tagHere: ['v0.2.0-dev.1'] },
    body: ['- 门禁：全绿'],
    ops: ['git switch dev', 'git merge --no-ff task/J2.4-spring -m "merge J2.4：合入 dev"', 'git tag -a v0.2.0-dev.1 -m "J2.4 完成（开发版）"'],
    note: '备注',
  })
  assert.match(entry, /- 分支：`dev` @ `abc1234`/)
  assert.match(entry, /- tag：`v0\.2\.0-dev\.1`/)
  assert.match(entry, /- 实际执行：/)
  assert.match(entry, /  - `git switch dev`/)
  assert.match(entry, /  - `git merge --no-ff task\/J2\.4-spring -m "merge J2\.4：合入 dev"`/)
  assert.match(entry, /  - `git tag -a v0\.2\.0-dev\.1 -m "J2\.4 完成（开发版）"`/)
})

test('没有执行任何变更命令时不出现空的「实际执行」段', () => {
  const entry = buildEntry({ task: '只读操作', st: { branch: 'dev', head: 'abc1234', subject: 'x', tagHere: [] }, ops: [] })
  assert.ok(!entry.includes('实际执行'), '空段落不该出现')
})

/* ───────────── ⑤ 钩子路径：由 git 状态重建命令（钩子拿不到原命令行） ───────────── */

test('★ parseMergeSource：从 reflog 主题解析出被合并的分支', () => {
  assert.equal(
    parseMergeSource("merge task/J2.11-release-flow-docs: Merge made by the 'ort' strategy."),
    'task/J2.11-release-flow-docs',
  )
  assert.equal(parseMergeSource('merge dev: Fast-forward'), 'dev')
  assert.equal(parseMergeSource('merge origin/main: Merge made by the ort strategy.'), 'origin/main')
})

test('parseMergeSource：非合并行一律返回 null（宁可不写，也不猜）', () => {
  for (const line of [
    'checkout: moving from task/J2.11 to dev',
    'commit: docs(versioning): 把推送写成必做步骤',
    'commit (amend): fix(release): 工具改造',
    '',
    '   ',
  ]) {
    assert.equal(parseMergeSource(line), null, `不该解析：${JSON.stringify(line)}`)
  }
})

/* ───────────── ⑥ exec 入口：模型执行 git 的唯一通道（只记模型，不记人工） ───────────── */

test('★ parseExecArgs：剥离 `--` 与 `git`，留下真正的 git 参数', () => {
  assert.deepEqual(parseExecArgs(['--', 'git', 'add', '-A']), ['add', '-A'])
  assert.deepEqual(parseExecArgs(['--', 'git', 'commit', '-F', '.cache/commit-msg.txt']), ['commit', '-F', '.cache/commit-msg.txt'])
  // `--` 可选（写它是推荐做法，避免与 git 自身的选项混淆）
  assert.deepEqual(parseExecArgs(['git', 'status', '--short']), ['status', '--short'])
  assert.deepEqual(parseExecArgs(['status', '--short']), ['status', '--short'])
  // 末尾的 git.exe（Windows）也认
  assert.deepEqual(parseExecArgs(['--', 'git.exe', 'tag', '-l']), ['tag', '-l'])
})

test('parseExecArgs：空参数返回空数组（调用方据此报用法错误）', () => {
  assert.deepEqual(parseExecArgs([]), [])
  assert.deepEqual(parseExecArgs(['--', 'git']), [])
})

test('parseExecArgs：只剥掉第一个 git（参数里再有 git 字样不动它）', () => {
  assert.deepEqual(parseExecArgs(['--', 'git', 'log', '--grep=git']), ['log', '--grep=git'])
})
