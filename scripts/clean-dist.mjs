#!/usr/bin/env node
/**
 * 构建前清理输出目录 —— 规避 astro 的 emptyDir 失败（L20）。
 *
 * ## 背景（实测）
 *
 * `astro build` 会先清空输出目录。在**受限环境**里经 **pnpm 子进程**执行时，这一步报 `EPERM`：
 *
 *   EPERM, Permission denied: \\?\D:\…\dist\posts      ← astro 的 emptyDir
 *   EPERM, Permission denied: \\?\D:\…\dist            ← 连 fs.rmSync 也一样（J3.13 实测）
 *
 * ★ **关键实测结论**：
 *   - **根因不是 astro 的 API，而是 pnpm 子进程删不掉 `dist/`** ——
 *     同一环境下**直接**跑 `node_modules/.bin/astro.CMD build` **成功**，经 pnpm 则失败。
 *   - 现象是**偶发**（并非每次），但足以让 `task:done` 的门禁 `die`、阻塞工具路径收尾。
 *   - astro 自身确实也用了**已废弃的** `fs.rmdirSync(recursive)`（Node 会打 `DEP0147` 警告），
 *     这让它在 Windows 上更脆弱 —— 但那是次要因素。
 *   - ⇒ 因此对策有两条：① 用 `rmSync` + 重试**预先**清掉（本脚本）；② 门禁**不走 pnpm**（`runGates`）。
 *
 * ## 做法
 *
 * 改用 Node 官方推荐的 `fs.rmSync`（`rmdirSync` 的替代品），并开启
 * `maxRetries` / `retryDelay` —— Node 对 `EBUSY / EMFILE / ENFILE / ENOTEMPTY / EPERM`
 * **会自动重试**，正好覆盖这里的偶发占用（文件索引器、杀软扫描等）。
 *
 * 清理发生在 astro 之前，于是 astro 的 `emptyDir` 面对的是一个**不存在**的目录，
 * 不再走到那条脆弱的代码路径。
 *
 * ## 用法
 *
 * 由 `package.json` 的 `build` 脚本自动调用，**无需手动跑**：
 *
 *   "build": "node scripts/clean-dist.mjs && astro build"
 *
 * 也可手动指定要清理的目录：
 *
 *   node scripts/clean-dist.mjs dist dist-single
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dirs = process.argv.slice(2);
const targets = dirs.length > 0 ? dirs : ['dist'];

for (const d of targets) {
  const p = join(process.cwd(), d);
  if (!existsSync(p)) {
    console.log(`  · ${d}/ 不存在，跳过清理`);
    continue;
  }
  try {
    // ★ maxRetries/retryDelay：对 EBUSY / EPERM / ENOTEMPTY 等自动重试 —— 这是本脚本存在的意义
    rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
    console.log(`  ✓ 已清理 ${d}/`);
  } catch (e) {
    console.error(`  ✗ 清理 ${d}/ 失败：${e.message}`);
    process.exit(1);
  }
}
