/** Providers keep configuration and execution ownership; this registry owns presentation. */
export class ActionRegistry {
  providers = new Map()
  listeners = new Set()
  snapshot = []
  wrapped = new WeakMap()
  hosts = new Set()
  constructor(onError = () => {}, hosted = true) { this.onError = onError; this.hosted = hosted }
  claimHost(token) {
    this.hosts.add(token)
    this.setHosted(true)
    return () => { this.hosts.delete(token); this.setHosted(this.hosts.size > 0) }
  }
  setHosted(value) {
    if (this.hosted === value) return
    this.hosted = value
    for (const provider of this.providers.values()) this.host(provider,value)
  }
  getSnapshot = () => this.snapshot
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  register(provider) {
    if (!provider || typeof provider.id !== 'string' || !Array.isArray(provider.actions)) return false
    const actions = provider.actions
    if (actions.some(action => !action || typeof action.id !== 'string' || typeof action.label !== 'string'
      || !['toggle', 'panel', 'command'].includes(action.kind)
      || (action.kind === 'panel' ? typeof action.mount !== 'function' : typeof action.execute !== 'function'))) return false
    if (new Set(actions.map(action => action.id)).size !== actions.length) return false
    for (const [id, existing] of this.providers) if (id !== provider.id && existing.actions.some(action => actions.some(next => action.id === next.id))) return false
    const previous = this.providers.get(provider.id)
    if (previous === provider) return true
    this.host(previous, false)
    this.providers.set(provider.id, provider)
    this.host(provider, this.hosted)
    this.publish()
    return true
  }
  host(provider, hosted) { try { provider?.setHosted?.(hosted) } catch (error) { this.onError(error) } }
  remove(id, provider) {
    const existing = this.providers.get(id)
    if (!existing || (provider && provider !== existing)) return false
    this.providers.delete(id); this.host(existing, false); this.publish(); return true
  }
  publish() {
    this.snapshot = Array.from(this.providers.values()).flatMap(provider => {
      if (!this.wrapped.has(provider)) this.wrapped.set(provider, provider.actions.map(action => ({...action, ownerId: provider.id, ownerLabel: provider.label || provider.id})))
      return this.wrapped.get(provider)
    })
    for (const listener of this.listeners) { try { listener() } catch (error) { this.onError(error) } }
  }
  dispose() {
    for (const provider of this.providers.values()) this.host(provider, false)
    this.providers.clear(); this.publish(); this.listeners.clear()
    this.hosts.clear()
  }
}

export function connectProviders(doc, registry, openAction) {
  const add = event => registry.register(event.detail)
  const remove = event => registry.remove(event.detail?.id, event.detail?.provider)
  const open = event => { if (typeof event.detail?.id === 'string') openAction(event.detail.id) }
  doc.addEventListener('dsh-workspace:provider', add)
  doc.addEventListener('dsh-workspace:provider-remove', remove)
  doc.addEventListener('dsh-workspace:open-action', open)
  doc.dispatchEvent(new CustomEvent('dsh-workspace:providers-request'))
  return () => {
    doc.removeEventListener('dsh-workspace:provider', add)
    doc.removeEventListener('dsh-workspace:provider-remove', remove)
    doc.removeEventListener('dsh-workspace:open-action', open)
    registry.dispose()
  }
}
