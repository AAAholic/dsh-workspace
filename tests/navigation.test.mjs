import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resolveProgressNavigation } from '../lib/client/navigation.mjs'
import { archivePath, hostPackage } from './helpers/read-installed-asar.mjs'

const installed = fs.existsSync(archivePath)
const hostTest = (name, fn) => test(name, { skip: installed ? false : 'requires the installed DSH host contract' }, fn)
const source = initial => {
  let value = initial
  const listeners = new Set()
  return { getSnapshot: () => value, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    set: next => { value = next; for (const fn of listeners) fn() }, listeners }
}
const execute = (code, env) => new Function(...Object.keys(env), code)(...Object.values(env))
const section = (text, first, last) => {
  const start = text.indexOf(first)
  const end = text.indexOf(last, start + first.length)
  assert(start >= 0 && end > start, `installed host contract changed: ${first}`)
  return text.slice(start, end + last.length)
}

/**
 * Execute the installed native descriptors and renderer store resolver, with only
 * their transport/UI effects replaced by in-memory seats. No fabricated openCall
 * prop is passed to the adapter. No source extraction is written back to disk.
 */
function fixture() {
  const conversationCode = hostPackage('dsh-client-ui-conversation/lib/client.js')
  const chatCode = hostPackage('dsh-client-ui-chat/lib/client.js')
  const rendererCode = hostPackage('dsh-client-ui-renderer/lib/client.js')
  const sidebarCode = hostPackage('dsh-client-ui-sidebar-right/lib/client.js')
  const registrations = new Map(), slotListeners = new Map(), owners = new Map()
  const effects = [], resources = [], placements = [], activations = []
  let createdStores = 0
  const list = source({ byId: { alpha: { cwd: '/work/alpha' }, beta: { cwd: '/work/beta' } } })
  const makeBinding = id => ({ sessionId: id, ctx: { effect: fn => { effects.push(fn()) } },
    session: source({ sessionId: id, removed: false }) })
  owners.set('alpha', makeBinding('alpha')); owners.set('beta', makeBinding('beta'))
  const conversationViews = source([{ id: 'chat' }, { id: 'trajectory' }])
  const mounted = source('alpha')
  const definitions = source([{ target: 'trajectory', toolCallFocus: callId => ({ callId }) }])
  const uiConversation = {
    views: { entries: definitions.getSnapshot, subscribe: definitions.subscribe },
    binding: owner => ({ activate: view => activations.push([typeof owner === 'string' ? owner : owner.sessionId, view]),
      snapshot: source({ views: { grouped: () => undefined } }) }),
  }
  const conversationStore = { create(key) {
    createdStores++
    const state = source({ view: null, viewRequest: null })
    return { ...state, key, actions: { openView(view, focus) { state.set({ view, viewRequest: { view, focus } }) } } }
  } }
  const nativeResolveStore = execute('return ({' + section(rendererCode,
    'resolveStore(handle, scopeBinding) {', '\n\t\t\t}') + '}).resolveStore', { ROOT_INSTANCE_KEY: Symbol('root') })
  const registry = {
    _stores: new Map([[conversationStore, { scope: 'session', instances: new Map() }]]),
    scopeOwners: new Map(),
    bindStoreScope(binding) {
      if (this.scopeOwners.get(binding.key) === binding.ctx) return
      if (this.scopeOwners.has(binding.key)) for (const record of this._stores.values()) record.instances.delete(binding.key)
      this.scopeOwners.set(binding.key, binding.ctx)
    },
  }
  const host = {
    storeOf: (entry, binding) => nativeResolveStore.call(registry, entry.store, binding),
    entriesOfSlot: key => registrations.get(key) ?? [],
    isLive: entry => [...registrations.values()].some(entries => entries.includes(entry)),
    subscribe(key, fn) {
      let listeners = slotListeners.get(key)
      if (!listeners) slotListeners.set(key, listeners = new Set())
      listeners.add(fn); return () => listeners.delete(fn)
    },
  }
  const slots = {
    hostFace: () => host,
    register(options, component) {
      const entry = { ...options, component, options: { id: options.id, priority: options.priority } }
      registrations.set(options.name, [...registrations.get(options.name) ?? [], entry])
      return () => registrations.set(options.name, registrations.get(options.name).filter(row => row !== entry))
    },
    inject(_key, run) { return run() },
  }
  const sidebarRight = {
    mounted,
    actionsFor: id => owners.has(id) ? { sessionId: id } : undefined,
    require: execute('return ({' + section(sidebarCode, 'require() {', '\n\t\t\t}') + '}).require', {}),
    openResource: execute('return ({' + section(sidebarCode, 'openResource(address, options = {}) {', '\n\t\t\t}') + '}).openResource', {}),
    placeResource(sessionId, _actions, address, options) {
      resources.push(Object.keys(options).length ? [address, options] : [address])
      placements.push({ sessionId, address })
    },
  }
  const ctx = { slots, sessions: { binding: id => owners.get(id), list }, uiConversation,
    sidebarRight, get: key => key === 'sidebarRight' ? sidebarRight : undefined }
  execute(section(conversationCode, 'const registerConversationSession = () => slots.register({', '}, ConversationSession);') +
    '\nregisterConversationSession();', { slots, conversationStore, conversationViews, uiConversation,
    viewTabs: conversationViews.getSnapshot, activateView: (id, view) => uiConversation.binding(id).activate(view),
    inputHub: { shell: () => ({ bindMirror: () => () => {} }) }, ConversationSession: () => {} })
  const fileAddressFor = execute(section(chatCode, 'const FILE_ADDRESS_PREFIX =', '\n\t\tfunction fileMediaUrl')
    .replace(/\n\t\tfunction fileMediaUrl$/, '') + '\nreturn fileAddressFor;', {})
  execute(section(chatCode, 'ctx.slots.inject("conversation.view", () => {', '\n\t\t\t});'), {
    ctx, t: key => key, NS: 'chat', CHAT_FLOW_INJECT: {}, nodeSources: () => ({}), chatStore: {},
    chatSource: () => source({ nodes: {} }), presentation: source({}),
    fileAddressFor, linkOpening: source('sidebar'), chatScrollPositions: new Map(), ChatView: () => {},
  })
  const entry = host.entriesOfSlot('conversation.session')[0]
  // Materialize exactly the instance that the real renderer has already mounted.
  const mountedStore = host.storeOf(entry, { key: 'alpha', ctx: owners.get('alpha').ctx })
  return { ctx, host, registrations, owners, mounted: mountedStore, sidebarMounted: mounted, resources, placements, activations, conversationViews, definitions,
    createdStores: () => createdStores, slotListeners, list }
}

hostTest('native inspection updates the mounted store and keeps callback identity stable', () => {
  const f = fixture()
  const navigation = resolveProgressNavigation(f.ctx, 'alpha')
  assert.equal(f.createdStores(), 1, 'resolving navigation must reuse the mounted Conversation store')
  assert.equal(resolveProgressNavigation(f.ctx, 'alpha'), navigation)
  const inspect = navigation.inspectCallSource.getSnapshot()
  assert.equal(typeof inspect, 'function')
  assert.equal(navigation.inspectCallSource.getSnapshot(), inspect)
  assert.equal(inspect('call-42'), true)
  assert.deepEqual(f.mounted.getSnapshot(), { view: 'trajectory', viewRequest: { view: 'trajectory', focus: { callId: 'call-42' } } })
  assert.deepEqual(f.activations, [['alpha', 'trajectory']])
})

hostTest('native availability changes disable retained inspection callbacks and notify subscribers', () => {
  const f = fixture(), navigation = resolveProgressNavigation(f.ctx, 'alpha')
  const inspect = navigation.inspectCallSource.getSnapshot()
  let changes = 0
  const dispose = navigation.inspectCallSource.subscribe(() => changes++)
  f.conversationViews.set([{ id: 'chat' }])
  assert.equal(navigation.inspectCallSource.getSnapshot(), undefined)
  assert.equal(inspect('must-not-open'), false)
  assert.equal(f.mounted.getSnapshot().view, null)
  f.conversationViews.set([{ id: 'chat' }, { id: 'trajectory' }])
  assert.equal(navigation.inspectCallSource.getSnapshot(), inspect)
  f.definitions.set([])
  assert.equal(navigation.inspectCallSource.getSnapshot(), undefined)
  assert(changes >= 3)
  dispose()
  assert.equal(f.conversationViews.listeners.size, 0)
  assert.equal(f.definitions.listeners.size, 0)
  assert.equal(f.list.listeners.size, 0)
  assert([...f.slotListeners.values()].every(listeners => listeners.size === 0))
})

hostTest('materials use the native opener and preserve session-qualified relative paths', async () => {
  const f = fixture()
  const alpha = resolveProgressNavigation(f.ctx, 'alpha'), beta = resolveProgressNavigation(f.ctx, 'beta')
  await alpha.openMaterial({ category: 'modified', path: '/work/alpha/docs/结果 1.md' })
  f.sidebarMounted.set('beta')
  await beta.openMaterial({ category: 'delivered', path: 'docs/结果 1.md' })
  assert.deepEqual(f.resources, [
    ['dsh-resource://file/session/alpha/docs/%E7%BB%93%E6%9E%9C%201.md'],
    ['dsh-resource://file/session/beta/docs/%E7%BB%93%E6%9E%9C%201.md'],
  ])
  assert.equal(alpha.openMaterial({ category: 'provided', path: '/work/alpha/given.pdf' }), false)
  assert.equal(alpha.openMaterial({ category: 'modified', path: '' }), false)
  assert.equal(f.resources.length, 2)
})

hostTest('a retained material callback cannot place an old-session resource into the current Sidebar', async () => {
  const f = fixture(), navigation = resolveProgressNavigation(f.ctx, 'alpha')
  const binding = f.owners.get('alpha')
  f.sidebarMounted.set('beta')
  assert.equal(f.ctx.sessions.binding('alpha'), binding, 'switching the visible Sidebar does not retire the old Session')
  assert.equal(navigation.openMaterial({ category: 'modified', path: 'old.md' }), false)
  assert.deepEqual(f.placements, [])
  f.sidebarMounted.set(undefined)
  assert.equal(navigation.openMaterial({ category: 'delivered', path: 'old.md' }), false)
  f.sidebarMounted.set('alpha')
  await navigation.openMaterial({ category: 'modified', path: 'current.md' })
  assert.deepEqual(f.placements, [{ sessionId: 'alpha', address: 'dsh-resource://file/session/alpha/current.md' }])
  f.ctx.get = () => undefined
  f.sidebarMounted.set('beta')
  assert.equal(navigation.openMaterial({ category: 'modified', path: 'direct-service.md' }), false,
    'the direct ctx.sidebarRight fallback enforces the same mounted-session gate')
})

hostTest('replaced or removed sessions cannot navigate through a stale closure', async () => {
  const f = fixture(), navigation = resolveProgressNavigation(f.ctx, 'alpha')
  const inspect = navigation.inspectCallSource.getSnapshot()
  const previous = f.owners.get('alpha')
  f.owners.set('alpha', { ...previous, ctx: {}, session: source({ sessionId: 'alpha' }) })
  assert.equal(navigation.inspectCallSource.getSnapshot(), undefined)
  assert.equal(inspect('stale'), false)
  assert.equal(navigation.openMaterial({ category: 'modified', path: 'stale.md' }), false)
  const renewed = resolveProgressNavigation(f.ctx, 'alpha')
  assert.notEqual(renewed, navigation)
  assert.equal(f.createdStores(), 2, 'a new binding generation must receive its own native instance')
  assert.equal(renewed.inspectCallSource.getSnapshot()('fresh'), true)
  assert.equal(f.mounted.getSnapshot().view, null, 'the expired instance was not mutated')
  f.owners.get('alpha').session.set({ sessionId: 'alpha', removed: true })
  assert.equal(renewed.inspectCallSource.getSnapshot(), undefined)
  assert.equal(renewed.openMaterial({ category: 'delivered', path: 'gone.md' }), false)
  assert.equal(f.resources.length, 0)
})

hostTest('unloaded native registrations invalidate their navigation callbacks', () => {
  const f = fixture(), navigation = resolveProgressNavigation(f.ctx, 'alpha')
  const inspect = navigation.inspectCallSource.getSnapshot()
  f.registrations.set('conversation.session', [])
  f.registrations.set('conversation.view', [])
  assert.equal(navigation.inspectCallSource.getSnapshot(), undefined)
  assert.equal(inspect('stale'), false)
  assert.equal(navigation.openMaterial({ category: 'modified', path: 'stale.md' }), false)
  assert.equal(f.resources.length, 0)
})

test('unsupported host contracts leave navigation unavailable without constructing a store', () => {
  let creates = 0
  const ctx = { slots: { entries: () => [{ store: { create() { creates++ } } }] }, sessions: { binding: () => ({ ctx: {} }) } }
  const navigation = resolveProgressNavigation(ctx, 'alpha')
  assert.equal(navigation.inspectCallSource.getSnapshot(), undefined)
  assert.equal(navigation.openMaterial, undefined)
  assert.equal(creates, 0)
  assert.equal(resolveProgressNavigation(ctx, undefined).inspectCallSource.getSnapshot(), undefined)
})
