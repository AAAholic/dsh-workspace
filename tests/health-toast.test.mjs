import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {build} from 'esbuild'
const compiled=await build({entryPoints:['lib/client/health-toast.mjs'],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],logLevel:'silent'})
const module={exports:{}}
vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require:id=>({createElement:(component,props)=>({component,props})})})
const {applyHealthNotifications,HealthToast}=module.exports
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
function fixture({primitives,loader}={}) {
 let current={syncing:false,failures:[]},renderError,registration,removed=0
 const listeners=new Set(),errors=new Map()
 const ctx={get:name=>name==='loader'?loader:undefined,
  modules:{entries:{state:{getSnapshot:()=>current,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}}},import:()=>primitives??Promise.resolve({Toast(){}}),importError:id=>errors.get(id)},
  slots:{onEntryError(fn){renderError=fn;return()=>{renderError=null}},inject(_slot,fn){return fn()},register(descriptor,component){registration={descriptor,component};return()=>{removed++}}}}
 return{ctx,errors,listeners,registration:()=>registration,removed:()=>removed,renderError:()=>renderError,
  set(failures){current={syncing:false,failures};for(const fn of listeners)fn()}}
}
test('optional Toast failure preserves progress-independent subscriptions and cleanup',async()=>{
 const f=fixture({primitives:Promise.reject(new Error('unavailable'))})
 const dispose=applyHealthNotifications(f.ctx);await flush()
 assert.equal(f.registration(),undefined);assert.equal(f.listeners.size,1)
 dispose();dispose();assert.equal(f.listeners.size,0);assert.equal(f.renderError(),null)
})
test('disposal before asynchronous Toast and loader results never mounts or reports',async()=>{
 const toast=deferred(),load=deferred(),f=fixture({primitives:toast.promise,loader:{await:()=>load.promise}})
 const dispose=applyHealthNotifications(f.ctx);dispose()
 f.errors.set('dsh-context',new Error('private'));toast.resolve({Toast(){}});load.resolve();await flush()
 assert.equal(f.registration(),undefined);assert.equal(f.removed(),0);assert.equal(f.listeners.size,0)
})
test('cold import failure is shown once then disappears after recorded recovery',async()=>{
 const load=deferred(),f=fixture({loader:{await:()=>load.promise}})
 const dispose=applyHealthNotifications(f.ctx);await flush()
 f.errors.set('dsh-context',new Error('sk-secret'));load.resolve();await flush()
 const props=f.registration().descriptor.inject(),health=props.health
 assert.equal(health.state.getSnapshot().notice.owner,'dsh-context')
 assert.doesNotMatch(health.state.getSnapshot().notice.text,/sk-secret/)
 f.errors.clear();f.set([]);assert.equal(health.state.getSnapshot().notice,null)
 dispose();assert.equal(f.removed(),1)
})
test('native Toast actions dismiss current notice and never set focus',async()=>{
 const f=fixture(),dispose=applyHealthNotifications(f.ctx);await flush()
 f.set([{id:'dsh-context',message:'synthetic'}])
 const props=f.registration().descriptor.inject()
 const rendered=HealthToast({...props,useHealth:select=>select(props.health.state.getSnapshot())})
 assert.equal(rendered.props.holdMs,10000);assert.equal(rendered.props.actions[0].label,'关闭')
 rendered.props.actions[0].onClick();assert.equal(props.health.state.getSnapshot().notice,null)
 dispose()
})
test('optional native details action receives only the package identity',async()=>{
 const f=fixture(),opened=[]
 f.ctx.get=name=>name==='pluginNavigation'?{openBundle:id=>opened.push(id)}:undefined
 const dispose=applyHealthNotifications(f.ctx);await flush()
 f.set([{id:'dsh-context',message:'secret'}])
 const props=f.registration().descriptor.inject()
 const rendered=HealthToast({...props,useHealth:select=>select(props.health.state.getSnapshot())})
 assert.equal(rendered.props.actions[0].label,'查看详情')
 rendered.props.actions[0].onClick();assert.deepEqual(opened,['dsh-context'])
 assert.equal(props.health.state.getSnapshot().notice,null);dispose()
})
test('shipped plugin can observe failures while progress dependencies are pending',async()=>{
 const fs=await import('node:fs/promises')
 let plugin,diagnostics,removed=0
 const f=fixture()
 vm.runInNewContext(await fs.readFile('lib/client.js','utf8'),{
   window:{__ModuleLoader__:{load({factory}){plugin=factory(id=>id==='react'?{Component:class{},createElement(){}}:{})}}},
 })
 assert.equal(plugin.inject.length,0)
 const stop=plugin.apply({inject(dependencies,apply){
   if(dependencies.includes('modules'))diagnostics=apply(f.ctx)
   else {assert(dependencies.includes('layout'));removed++}
 }})
 await flush();assert.equal(removed,1);assert.ok(f.registration())
 f.set([{id:'dsh-context',message:'failure'}])
 assert.equal(f.registration().descriptor.inject().health.state.getSnapshot().notice.owner,'dsh-context')
 diagnostics();stop();assert.equal(f.listeners.size,0)
})
