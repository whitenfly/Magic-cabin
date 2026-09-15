#!/usr/bin/env node
/**
 * 安装 git 钩子：把 scripts/hooks/* 复制到 .git/hooks/ 并赋予可执行权限。
 *
 * 为什么钩子要放在 scripts/hooks/ 而不是直接写 .git/hooks/：
 *   .git/hooks/ 不受版本控制、clone 不到新机器。放在 scripts/hooks/ 里被提交后，
 *   换机器 / 重新 clone 只需跑一次 `pnpm hooks:install` 就能恢复「自动记录」。
 *
 * 用法：node scripts/install-hooks.mjs
 */
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'scripts', 'hooks');
const DST = join(ROOT, '.git', 'hooks');

const C = process.stdout.isTTY === true ? { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', b: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m' } : { g: '', y: '', r: '', b: '', d: '', x: '' };

if (!existsSync(join(ROOT, '.git'))) {
  console.error(`${C.r}✗${C.x} 当前目录不是 git 仓库根：${ROOT}`);
  process.exit(1);
}
if (!existsSync(SRC)) {
  console.error(`${C.r}✗${C.x} 找不到钩子源目录：${SRC}`);
  process.exit(1);
}

const hooks = readdirSync(SRC).filter((f) => !f.startsWith('.'));
console.log(`${C.b}▸${C.x} 安装 git 钩子 → ${DST}`);

let installed = 0;
for (const name of hooks) {
  const from = join(SRC, name);
  const to = join(DST, name);

  // 强制 LF：Git for Windows 的 sh 无法解析 CRLF 的 shebang，钩子会静默失效
  const text = readFileSync(from, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(to, text, { encoding: 'utf8', mode: 0o755 });
  try {
    chmodSync(to, 0o755);
  } catch {
    /* Windows 上 chmod 基本无效，但 Git for Windows 只要能读就行 */
  }
  console.log(`  ${C.g}✓${C.x} ${name}`);
  installed += 1;
}

if (installed === 0) {
  console.log(`  ${C.y}!${C.x} scripts/hooks/ 里没有钩子文件`);
  process.exit(1);
}

console.log('');
console.log(`  ${C.d}记录类钩子（post-*）不阻塞 git：内部异常一律静默退出${C.x}`);
console.log(`  ${C.d}★ pre-commit 是唯一**阻塞型**钩子：在 dev/main 上拒绝开发提交（VERSIONING.md §1 R1）${C.x}`);
console.log(`  ${C.d}  合法豁免：合并提交、发布元数据提交（只改 package.json）；紧急绕过 git commit --no-verify${C.x}`);
console.log(`  ${C.d}它们只在 GitPushHistory.md 里追加记录（该文件不进版本库）${C.x}`);
console.log(`  ${C.g}✓${C.x} 完成：${installed} 个钩子已安装`);
