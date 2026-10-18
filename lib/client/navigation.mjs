const ABSENT = Object.freeze({ getSnapshot: () => undefined, subscribe: () => () => {} })
const UNAVAILABLE = Object.freeze({ inspectCallSource: ABSENT, openMaterial: undefined })
const cache = new WeakMap()

const sourceLike = source => typeof source?.getSnapshot === 'function' && typeof source?.subscribe === 'function'
const nonempty = value => typeof value === 'string' && value.trim().length > 0

/**
 * Reuse the mounted native Conversation store and its own navigation callbacks.
 * This adapter is intentionally tied to the current host's renderer face. Never
 * call entry.store.create(): that would make a second store with the same persisted
 * key, leaving the visible Conversation unaware of the requested tool focus.
 */
export function resolveProgressNavigation(ctx, sessionId) {
  if (!nonempty(sessionId)) return UNAVAILABLE
  try {
    const slots = ctx.slots
    const host = slots?.hostFace?.()
    const binding = ctx.sessions?.binding?.(sessionId)
    if (!host || !binding?.ctx || !['storeOf', 'entriesOfSlot', 'isLive', 'subscribe'].every(key => typeof host[key] === 'function')) return UNAVAILABLE
    const sessionEntry = host.entriesOfSlot('conversation.session')[0]
    const chatEntry = host.entriesOfSlot('conversation.view').find(entry => entry.options?.id === 'chat')
    let byBinding = cache.get(slots)
    if (!byBinding) cache.set(slots, byBinding = new WeakMap())
    const prior = byBinding.get(binding)
    if (prior && prior.sessionEntry === sessionEntry && prior.chatEntry === chatEntry) return prior.navigation

    const sameSession = () => ctx.sessions.binding(sessionId) === binding && binding.session?.getSnapshot?.()?.removed !== true
    const currentEntry = (key, entry) => sameSession() && entry !== undefined &&
      host.isLive(entry) && host.entriesOfSlot(key).includes(entry)
    const sessionCurrent = () => currentEntry('conversation.session', sessionEntry)
    const chatCurrent = () => currentEntry('conversation.view', chatEntry)
    let nativeInspect
    let nativeOpenFile
    if (sessionEntry?.store && typeof sessionEntry.inject === 'function') {
      const instance = host.storeOf(sessionEntry, { key: sessionId, ctx: binding.ctx })
      if (typeof instance?.actions?.openView === 'function') nativeInspect = sessionEntry.inject(sessionId, instance.actions)?.hooks?.inspectCall
    }
    if (typeof chatEntry?.inject === 'function') nativeOpenFile = chatEntry.inject(sessionId)?.openFile

    const inspect = callId => {
      if (!nonempty(callId) || !sessionCurrent()) return false
      // Re-read on click: a retained callback must not bypass a later developer-
      // mode change, target removal, or the native inspection availability gate.
      const open = nativeInspect.getSnapshot()
      if (typeof open !== 'function') return false
      open(callId)
      return true
    }
    const inspectCallSource = sourceLike(nativeInspect) ? {
      getSnapshot: () => sessionCurrent() && typeof nativeInspect.getSnapshot() === 'function' ? inspect : undefined,
      subscribe: listener => {
        const disposers = [nativeInspect.subscribe(listener),
          host.subscribe('conversation.session', listener), host.subscribe('conversation.view', listener)]
        if (sourceLike(binding.session)) disposers.push(binding.session.subscribe(listener))
        if (sourceLike(ctx.sessions.list)) disposers.push(ctx.sessions.list.subscribe(listener))
        return () => { for (const dispose of disposers) dispose() }
      },
    } : ABSENT
    const openMaterial = typeof nativeOpenFile === 'function' ? row => {
      if (!chatCurrent() || !['modified', 'delivered'].includes(row?.category) || !nonempty(row?.path)) return false
      // The native opener preserves the resource's session in its address, but
      // places that resource in the global on-screen Sidebar. A still-live old
      // binding alone cannot authorize opening into another chat's Sidebar.
      const sidebar = (typeof ctx.get === 'function' ? ctx.get('sidebarRight') : undefined) ?? ctx.sidebarRight
      if (typeof sidebar?.mounted?.getSnapshot !== 'function' || sidebar.mounted.getSnapshot() !== sessionId) return false
      return nativeOpenFile(row.path)
    } : undefined
    const navigation = Object.freeze({ inspectCallSource, openMaterial })
    byBinding.set(binding, { sessionEntry, chatEntry, navigation })
    return navigation
  } catch {
    // Unsupported host contracts leave these rows inert; they never invent a
    // trajectory target, bypass a native gate, or construct a second file route.
    return UNAVAILABLE
  }
}
