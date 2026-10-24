// Read the Cordis client registry, never UI presence or a version number.
// DSH's inventory and inspector use the same FAILED state and registry fibers.
const FAILED = 3

export function readPluginLifecycleFailures(ctx, monitoredIds) {
  const allowed = new Set(monitoredIds)
  const failed = new Set()
  const registry = ctx?.registry
  if (typeof registry?.values !== 'function') return []
  for (const runtime of registry.values()) {
    if (typeof runtime?.fibers?.[Symbol.iterator] !== 'function') continue
    for (const fiber of runtime.fibers) {
      if (fiber?.state !== FAILED || fiber.uid === null) continue
      // Loader stamps this exact package identity onto child fibers too.
      // A display name or a slot's visual position is not an owner identity.
      const id = fiber.entry?.options?.name
      if (!allowed.has(id)) continue
      failed.add(id)
    }
  }
  return [...failed].sort().map(id => ({ id, message: 'Plugin startup failed' }))
}

export function observePluginLifecycle(ctx, onSnapshot, monitoredIds) {
  if (typeof ctx?.on !== 'function' || typeof ctx.registry?.values !== 'function') return () => {}
  let disposed = false, scheduled = false, previous
  const publish = () => {
    scheduled = false
    if (disposed) return
    let failures
    try { failures = readPluginLifecycleFailures(ctx, monitoredIds) }
    catch { return } // Optional diagnostics must not break the host's lifecycle.
    const identity = failures.map(row => row.id).join('\0')
    if (identity === previous) return
    previous = identity
    onSnapshot(failures)
  }
  const schedule = () => {
    if (disposed || scheduled) return
    scheduled = true
    // Disposal emits before the registry removes its fiber. Read after that
    // mutation, and coalesce bursts from one plugin tree transition.
    queueMicrotask(publish)
  }
  const disposers = [
    ctx.on('internal/status', schedule, { global: true }),
    ctx.on('internal/plugin', schedule, { global: true }),
  ]
  publish() // Includes apply() failures that predate this observer's activation.
  return () => {
    if (disposed) return
    disposed = true
    for (const dispose of disposers.reverse()) dispose?.()
  }
}
