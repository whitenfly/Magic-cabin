/**
 * 更新调度器 —— 把"每帧要跑什么"从 `animate()` 里搬出来
 *
 * 来源：新增（`J2.5`）。原实现的每帧调用全部内联在 `tickOnce()` 里（约 940 行），
 * 顺序即语义：`updateSprings(); updatePlayer(...); updateWeatherSystem(...); updateInteractHint();`
 * —— 谁先谁后只能靠读代码知道，`J4` 要把 `animate()` 收缩为调度骨架（DoD：≤ 60 行）。
 *
 * ## ★ 本阶段（`J2`）的纪律：**只登记，不改顺序**
 *
 * `update()` 严格按**登记顺序**执行，`tier` 只是**元数据**（`always` / `near` / `idle`），
 * `J2` 期间不做任何裁剪 —— 因为 `J2` 的判据是像素逐字节零差异，
 * 而"跳过远处物件"恰恰会改变画面。按 tier 裁剪留给 `J8`（性能与低配档）。
 *
 * ## 为什么 tier 现在就写上
 *
 * `J3`/`J4` 搬物件时，每个 `defineProp` 都要声明自己的 `update` 与档位；
 * 档位信息在搬迁时顺手写下最省事，事后补要重新审一遍 67 件物件的更新代价。
 */
export function createUpdateScheduler() {
  /** @type {{ id: number, name: string, fn: Function, tier: string, enabled: boolean }[]} */
  const tasks = []
  let nextId = 1
  /** 一次 `update()` 里实际调用的任务数（诊断用） */
  let lastRun = 0

  /**
   * 登记一个每帧任务。
   *
   * ⚠️ **登记顺序 = 执行顺序**。搬迁期间请按 `tickOnce()` 里的原有先后登记，
   * 否则画面会变（`pnpm test:visual` 会拦下）。
   *
   * @param {string} name 可读名（出现在诊断里）
   * @param {(dt: number, time: number) => void} fn
   * @param {{ tier?: 'always'|'near'|'idle' }} [opts]
   * @returns {{id: number, name: string, tier: string, enabled: boolean}} 任务句柄（可改 `enabled`）
   */
  function add(name, fn, opts = {}) {
    if (typeof fn !== 'function') throw new TypeError(`任务 ${name} 的 fn 必须是函数`)
    const task = { id: nextId++, name, fn, tier: opts.tier || 'always', enabled: true }
    tasks.push(task)
    return task
  }

  /** 移除任务（传句柄或名字） */
  function remove(taskOrName) {
    const i = typeof taskOrName === 'string' ? tasks.findIndex((t) => t.name === taskOrName) : tasks.indexOf(taskOrName)
    if (i >= 0) tasks.splice(i, 1)
  }

  /** 跑一帧（按登记顺序；`enabled === false` 的跳过） */
  function update(dt, time) {
    let ran = 0
    for (const t of tasks) {
      if (!t.enabled) continue
      t.fn(dt, time)
      ran++
    }
    lastRun = ran
    return ran
  }

  /** 某个档位下的任务名（`J8` 按 tier 裁剪时会读它） */
  const namesIn = (tier) => tasks.filter((t) => t.tier === tier).map((t) => t.name)

  function stats() {
    const byTier = {}
    for (const t of tasks) byTier[t.tier] = (byTier[t.tier] || 0) + 1
    return { total: tasks.length, enabled: tasks.filter((t) => t.enabled).length, byTier, lastRun }
  }

  return { add, remove, update, namesIn, stats, tasks, get lastRun() { return lastRun } }
}
