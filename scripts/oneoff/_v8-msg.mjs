// 确定 V8 的 "X(...) is not a function" 消息对应哪种代码形态
const cases = {
  'a: 变量非函数': () => {
    const f = 1
    f()
  },
  'b: 属性非函数': () => {
    const o = { m: 1 }
    o.m()
  },
  'c: 调用返回值（箭头）': () => {
    const g = () => 1
    g()()
  },
  'd: 调用返回值（具名函数）': () => {
    function runtime() {
      return 1
    }
    runtime()()
  },
  'e: 别名指向具名函数，调用返回值': () => {
    function runtime() {
      return 1
    }
    const runtimeRng = runtime
    runtimeRng()()
  },
  'f: 别名指向具名函数，直接调用': () => {
    function runtime() {
      return 1
    }
    const runtimeRng = runtime
    runtimeRng()
  },
  'g: 解构出的属性非函数': () => {
    const scene = { slime: 1 }
    const { slime } = scene
    slime()
  },
  'h: 对象方法返回非函数再调用': () => {
    const o = {
      m: () => 1,
    }
    o.m()()
  },
}

for (const [name, fn] of Object.entries(cases)) {
  try {
    fn()
    console.log(`  ${name.padEnd(34)} → 无错误`)
  } catch (e) {
    console.log(`  ${name.padEnd(34)} → ${e.message}`)
  }
}
