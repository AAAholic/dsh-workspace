import test from 'node:test'
import assert from 'node:assert/strict'
import {ActionRegistry} from '../lib/client/action-registry.mjs'
const provider = (id='owner') => {const hosted=[];return {id,label:id,hosted,actions:[{id:id+'.toggle',label:'Toggle',kind:'toggle',execute(){}}],setHosted(value){hosted.push(value)}}}
test('replacement and late removal keep current owner authoritative',()=>{
 const registry=new ActionRegistry(),first=provider(),second=provider()
 registry.register(first);registry.register(first);registry.register(second)
 assert.deepEqual(first.hosted,[true,false]);assert.equal(registry.remove(first.id,first),false)
 assert.equal(registry.getSnapshot().length,1);registry.dispose();assert.deepEqual(second.hosted,[true,false])
})
test('invalid or conflicting providers do not hide original controls',()=>{
 const registry=new ActionRegistry(),valid=provider();registry.register(valid)
 const other=provider('other');other.actions[0].id=valid.actions[0].id
 assert.equal(registry.register(other),false);assert.deepEqual(other.hosted,[])
 assert.equal(registry.register({id:'invalid',actions:[{id:'x',label:'X',kind:'panel'}]}),false)
 assert.equal(registry.getSnapshot()[0].ownerId,'owner')
})
test('snapshot identity changes only on actual provider changes',()=>{
 const registry=new ActionRegistry(),valid=provider();let updates=0;registry.subscribe(()=>updates++)
 const empty=registry.getSnapshot();assert.equal(empty,registry.getSnapshot())
 registry.register(valid);const filled=registry.getSnapshot();registry.register(valid)
 assert.equal(filled,registry.getSnapshot());assert.equal(updates,1)
 registry.remove(valid.id,valid);assert.equal(updates,2)
})
test('unrelated owners do not remount existing action views',()=>{
 const registry=new ActionRegistry(),first=provider('first'),second=provider('second')
 registry.register(first);const action=registry.getSnapshot()[0]
 registry.register(second);assert.equal(registry.getSnapshot()[0],action)
 registry.remove(second.id,second);assert.equal(registry.getSnapshot()[0],action)
})
test('inline host claims retain fallback controls until a real card exists',()=>{
 const registry=new ActionRegistry(()=>{},false),valid=provider()
 registry.register(valid);assert.deepEqual(valid.hosted,[false])
 const release=registry.claimHost({});assert.deepEqual(valid.hosted,[false,true])
 release();assert.deepEqual(valid.hosted,[false,true,false])
})
