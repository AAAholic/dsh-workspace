// Only explicit host failures are notices. Missing UI, pending services and
// version changes are not evidence of a broken plugin.
export const PLUGINS = Object.freeze({
  'dsh-context': '上下文插件',
  'dsh-workspace': '进度插件',
  'whale-girl': '鲨鲨助手',
  'dsh-forecast': '提示词预报',
  '@changfenhuang/dsh-genui': 'GenUI',
  '@linxin666/dsh-client-ui-skin-center': '皮肤中心',
})
const ownerOf = id => Object.hasOwn(PLUGINS, id) ? id :
  id === 'dsh-workspace.progress' ? 'dsh-workspace' : undefined
const waiting = row => row.message === `client-modules: ${row.id} is waiting for activation`

export function createPluginHealth() {
  let stopped = false, sequence = 0
  let snapshot = { notice: null }
  const listeners = new Set(), queue = [], loadFailures = new Set(), sources = new Map()
  let renderFailures = new WeakMap()
  const publish = () => {
    snapshot = { notice: queue[0] || null }
    for (const listener of [...listeners]) listener()
  }
  const report = (owner, kind) => {
    if (stopped) return
    if (kind === 'load') {
      if (loadFailures.has(owner)) return
      loadFailures.add(owner)
    }
    queue.push({ id: ++sequence, owner, kind,
      text: `${PLUGINS[owner]}${kind === 'load' ? '加载' : '界面'}异常，请打开插件详情。` })
    publish()
  }
  return {
    state: { getSnapshot: () => snapshot, subscribe(listener) {
      if (stopped) return () => {}
      listeners.add(listener); return () => listeners.delete(listener)
    } },
    load(id) { const owner = ownerOf(id); if (owner) report(owner, 'load') },
    modules(snapshot, source = 'modules') {
      if (stopped || !snapshot || snapshot.syncing || !Array.isArray(snapshot.failures)) return
      sources.set(source, snapshot.failures)
      const present = new Set()
      for (const row of [...sources.values()].flat()) {
        const owner = ownerOf(row?.id)
        if (!owner || typeof row.message !== 'string') continue
        present.add(owner)
        if (!waiting(row)) report(owner, 'load')
      }
      // A settled graph with no failure/pending row is the host's recovery
      // signal. Do not reset deduplication during its transient syncing phase.
      for (const owner of loadFailures) if (!present.has(owner)) loadFailures.delete(owner)
      let changed = false
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].kind === 'load' && !present.has(queue[i].owner)) {
          queue.splice(i, 1); changed = true
        }
      }
      if (changed) publish()
    },
    render(slot, registration) {
      if (stopped || typeof slot !== 'string') return
      const owner = ownerOf(registration?.registrant)
      if (!owner) return
      if (slot === 'shell.overlay' && registration.options?.id === 'dsh-workspace.health') return
      let slots = renderFailures.get(registration)
      if (!slots) renderFailures.set(registration, slots = new Set())
      if (slots.has(slot)) return
      slots.add(slot)
      // A new registration after reloading is a new instance. Repeated errors
      // from the same registration stay quiet even after the notice is closed.
      report(owner, 'render')
    },
    dismiss(id) {
      if (stopped || queue[0]?.id !== id) return
      queue.shift(); publish()
    },
    dispose() {
      if (stopped) return
      stopped = true; queue.length = 0; snapshot = { notice: null }
      loadFailures.clear(); sources.clear(); renderFailures = new WeakMap(); listeners.clear()
    },
  }
}

export function observePluginHealth({ modules, slots }, health, onModules = () => {}) {
  const state = modules?.entries?.state
  const disposers = []
  if (typeof state?.getSnapshot === 'function' && typeof state.subscribe === 'function') {
    const update = () => {
      const snapshot = state.getSnapshot()
      health.modules(snapshot)
      if (snapshot && !snapshot.syncing) onModules()
    }
    disposers.push(state.subscribe(update)); update()
  }
  if (typeof slots?.onEntryError === 'function') {
    disposers.push(slots.onEntryError((slot, registration) => health.render(slot, registration)))
  }
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of disposers.reverse()) dispose?.()
  }
}
