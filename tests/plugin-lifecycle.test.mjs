import test from 'node:test'
import assert from 'node:assert/strict'
import {observePluginLifecycle,readPluginLifecycleFailures} from '../lib/client/plugin-lifecycle.mjs'

const ids = ['dsh-context','dsh-workspace','whale-girl']
const fiber = (name, state, uid = 1) => ({ uid, state, entry:{options:{name}} })
const flush = () => new Promise(resolve => queueMicrotask(resolve))
function fixture(fibers = []) {
  const listeners = new Map(), runtime = {fibers}, snapshots = []
  const ctx = {
    registry:{values:() => [runtime].values()},
    on(event, callback, options) {
      assert.deepEqual(options, {global:true})
      const callbacks = listeners.get(event) || new Set()
      listeners.set(event, callbacks); callbacks.add(callback)
      return () => callbacks.delete(callback)
    },
  }
  const emit = event => { for (const listener of listeners.get(event) || []) listener() }
  const stop = observePluginLifecycle(ctx, rows => snapshots.push(rows.map(row => row.id)), ids)
  return {ctx,runtime,listeners,snapshots,emit,stop}
}

test('cold startup reports an already failed apply and nested fiber only once per package', () => {
  const f = fixture([fiber('dsh-workspace',2),fiber('dsh-workspace',3,2),fiber('dsh-context',3,3)])
  assert.deepEqual(f.snapshots,[['dsh-context','dsh-workspace']])
  f.stop()
})

test('active, pending, loading, unloading, disposed and unknown owners stay quiet', () => {
  const f = fixture([0,1,2,4,5].map((state,index) => fiber('dsh-context',state,index+1)).concat([
    fiber('unknown-plugin',3,7),fiber('whale-girl',3,null),{uid:8,state:3,name:'dsh-workspace'},
  ]))
  assert.deepEqual(f.snapshots,[[]])
  f.stop()
})

test('lifecycle events publish failure, confirmed recovery and a new failure without repeats', async () => {
  const plugin = fiber('dsh-context',2), f = fixture([plugin])
  plugin.state = 3
  f.emit('internal/status'); f.emit('internal/plugin'); await flush()
  f.emit('internal/status'); await flush()
  assert.deepEqual(f.snapshots,[[],['dsh-context']])
  plugin.state = 2; f.emit('internal/status'); await flush()
  plugin.state = 3; f.emit('internal/status'); await flush()
  assert.deepEqual(f.snapshots,[[],['dsh-context'],[],['dsh-context']])
  f.stop()
})

test('one recovered sibling cannot hide another failed fiber of the same package', async () => {
  const first = fiber('dsh-workspace',3), second = fiber('dsh-workspace',3,2)
  const f = fixture([first,second])
  first.state = 2; f.emit('internal/status'); await flush()
  assert.deepEqual(f.snapshots,[['dsh-workspace']])
  second.state = 2; f.emit('internal/status'); await flush()
  assert.deepEqual(f.snapshots,[['dsh-workspace'],[]])
  f.stop()
})

test('unload reads after registry mutation; a replacement failure can notify again', async () => {
  const f = fixture([fiber('whale-girl',3)])
  f.emit('internal/plugin'); f.runtime.fibers.length = 0; await flush()
  f.runtime.fibers.push(fiber('whale-girl',3,2)); f.emit('internal/status'); await flush()
  assert.deepEqual(f.snapshots,[['whale-girl'],[],['whale-girl']])
  f.stop()
})

test('disposal unsubscribes both events and suppresses an already queued publication', async () => {
  const plugin = fiber('dsh-context',2), f = fixture([plugin])
  plugin.state = 3; f.emit('internal/status'); f.stop(); f.stop(); await flush()
  assert.deepEqual(f.snapshots,[[]])
  assert.equal([...f.listeners.values()].reduce((sum,rows) => sum + rows.size,0),0)
})

test('optional unsupported registry or malformed unrelated rows cannot cause a notice', () => {
  assert.deepEqual(readPluginLifecycleFailures({},ids),[])
  assert.deepEqual(readPluginLifecycleFailures({registry:{values:() => [null,{}, {fibers:[null]}]}},ids),[])
  assert.doesNotThrow(() => observePluginLifecycle({},() => assert.fail('must remain quiet'),ids)())
})
