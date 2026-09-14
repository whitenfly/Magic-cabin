/**
 * 魔法小屋 —— 应用入口
 *
 * 同一个文件被两种运行方式共用：
 *   A. Vite（pnpm dev / pnpm build）：Vite 转译并打包依赖
 *   B. 零构建（pnpm serve）：浏览器原生 ESM + index.html 的 importmap
 *
 * 演进路线：
 *   F3  引入 Clock / EventBus / UpdateScheduler / store，接管持久化与更新调度
 *   F6  改为「门厅 HTML 先渲染 → 3D 空闲时挂载」（门厅策略），并接入路由与阅读器
 *   F7  接入各功能域（src/domains/*）与场景物品的绑定
 */
import { bootCabin } from './cabin/boot.js'

void bootCabin()
