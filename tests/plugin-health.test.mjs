import test from 'node:test'
import assert from 'node:assert/strict'
import {createPluginHealth,observePluginHealth} from '../lib/client/plugin-health.mjs'
const row = (id,message='TypeError: host API missing sk-do-not-display /private/file') => ({id,message})
const state = (failures=[],syncing=false) => ({failures,syncing})

test('healthy, syncing, pending and unknown plugins stay silent', () => {
  const h=createPluginHealth()
  h.modules(state());h.modules(state([row('dsh-context')],true))
  h.modules(state([row('dsh-context','client-modules: dsh-context is waiting for activation')]))
  h.modules(state([row('unrelated-plugin')]))
  h.render('slot',{registrant:'unrelated-plugin'});h.render('slot',{options:{id:'dsh-context'}})
  assert.equal(h.state.getSnapshot().notice,null)
})
test('real load failure is deduplicated across sync and dismissal; recovery is silent', () => {
  const h=createPluginHealth()
  h.modules(state([row('dsh-context')]))
  const first=h.state.getSnapshot().notice
  assert.equal(first.text,'上下文插件加载异常，请打开插件详情。')
  assert.doesNotMatch(first.text,/sk-|private|TypeError/)
  h.dismiss(first.id);h.modules(state([],true));h.modules(state([row('dsh-context')]))
  assert.equal(h.state.getSnapshot().notice,null)
  h.modules(state([row('dsh-context','client-modules: dsh-context is waiting for activation')]))
  h.modules(state([row('dsh-context')]))
  assert.equal(h.state.getSnapshot().notice,null,'pending is not confirmed recovery')
  h.modules(state());assert.equal(h.state.getSnapshot().notice,null)
  h.modules(state([row('dsh-context')]))
  assert.ok(h.state.getSnapshot().notice.id>first.id)
})
test('render failures only trust registrant; queue and stale dismissals are safe', () => {
  const h=createPluginHealth()
  const registration={registrant:'whale-girl',options:{id:'pet'}}
  h.render('conversation.input.left',registration)
  const first=h.state.getSnapshot().notice
  h.render('conversation.input.left',registration)
  h.render('workspace.view',{registrant:'dsh-workspace',options:{id:'view-boundary'}})
  h.dismiss(first.id);const second=h.state.getSnapshot().notice
  assert.equal(second.owner,'dsh-workspace')
  h.dismiss(first.id);assert.equal(h.state.getSnapshot().notice,second)
  h.dismiss(second.id);h.render('conversation.input.left',registration)
  assert.equal(h.state.getSnapshot().notice,null)
  h.render('conversation.input.left',{...registration})
  assert.equal(h.state.getSnapshot().notice.owner,'whale-girl','new registration can report again after reload')
})
test('confirmed recovery removes visible and queued load notices', () => {
  const h=createPluginHealth()
  h.modules(state([row('dsh-context'),row('dsh-forecast')]))
  h.modules(state([row('dsh-forecast')]))
  assert.equal(h.state.getSnapshot().notice.owner,'dsh-forecast')
  h.modules(state())
  assert.equal(h.state.getSnapshot().notice,null)
})
test('recorded cold-start errors share load deduplication', () => {
  const h=createPluginHealth();h.load('@changfenhuang/dsh-genui')
  const n=h.state.getSnapshot().notice;assert.equal(n.owner,'@changfenhuang/dsh-genui');h.dismiss(n.id)
  h.modules(state([row('@changfenhuang/dsh-genui')]));assert.equal(h.state.getSnapshot().notice,null)
})
test('subscription cleanup is idempotent and leaves no callbacks', () => {
  const h=createPluginHealth();const listeners=new Set();let render
  const modules={entries:{state:{getSnapshot:()=>state(),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}}}}
  const slots={onEntryError(fn){render=fn;return()=>{render=null}}}
  const stop=observePluginHealth({modules,slots},h)
  assert.equal(listeners.size,1);assert.equal(typeof render,'function')
  render('slot',{registrant:'dsh-forecast'},new Error('secret'))
  assert.equal(h.state.getSnapshot().notice.owner,'dsh-forecast')
  stop();stop();h.dispose();h.dispose();assert.equal(listeners.size,0);assert.equal(render,null)
  h.load('dsh-context');assert.equal(h.state.getSnapshot().notice,null)
})
test('independent failure sources cannot clear each other and overlay faults do not recurse', () => {
  const h=createPluginHealth()
  h.modules(state([row('dsh-context')]),'lifecycle')
  h.modules(state(), 'modules')
  assert.equal(h.state.getSnapshot().notice.owner,'dsh-context')
  h.modules(state(), 'lifecycle')
  assert.equal(h.state.getSnapshot().notice,null)
  h.render('shell.overlay',{registrant:'dsh-workspace',options:{id:'dsh-workspace.health'}})
  assert.equal(h.state.getSnapshot().notice,null)
})
