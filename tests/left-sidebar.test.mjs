import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installNarrowLeftSidebar, resolveLeftSidebarAdapter, leftPresentationGeometry } from '../lib/client/left-sidebar.mjs';

function fixture({sidebar=280,viewportWidth=1440,narrowExpanded=false}={}) {
  let state={layoutInfo:{sidebar,viewportWidth,narrowExpanded}};
  const listeners=new Set(), writes=[];
  const update=fn=>{state=structuredClone(state);fn(state.layoutInfo);for(const listener of [...listeners])listener()};
  const actions={
    setSidebar(value){writes.push(value);update(info=>info.sidebar=Math.min(420,Math.max(264,Math.round(value))))},
    toggleSidebar(){update(info=>{if(info.viewportWidth<1024)info.narrowExpanded=!info.narrowExpanded;else info.sidebar=info.sidebar===0?280:0})},
    setViewportWidth(value){update(info=>{info.viewportWidth=value;info.narrowExpanded=false})},
  };
  const instance={actions,getSnapshot:()=>state,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}};
  const entry={children:{sidebar:{},main:{},rightbar:{}},store:{create:()=>instance}};
  const ctx={layout:{panels:actions},slots:{entries:()=>[entry]}};
  return {ctx,actions,instance,writes,listeners};
}

test('initial native width narrows to 264 and normal reopening uses 264',()=>{
  const f=fixture(),dispose=installNarrowLeftSidebar(f.ctx);
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,264);
  f.actions.toggleSidebar();assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,0);
  f.actions.toggleSidebar();assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,264);
  assert.deepEqual(f.writes,[264,264]);
  dispose();assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,280);
  assert.equal(f.listeners.size,0);
});

test('later native drag preference is retained and not undone on cleanup',()=>{
  const f=fixture(),dispose=installNarrowLeftSidebar(f.ctx);
  f.actions.setSidebar(316);
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,316);
  f.actions.setViewportWidth(900);
  f.actions.toggleSidebar();
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,316);
  dispose();assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,316);
});

test('collapsed startup stays collapsed and invalid/future store faces are untouched',()=>{
  const f=fixture({sidebar:0}),dispose=installNarrowLeftSidebar(f.ctx);
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,0);
  f.actions.toggleSidebar();assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,264);
  dispose();
  assert.equal(resolveLeftSidebarAdapter({}),null);
  const foreign=fixture();foreign.ctx.layout.panels={...foreign.actions};
  assert.equal(resolveLeftSidebarAdapter(foreign.ctx),null);
  installNarrowLeftSidebar(foreign.ctx)();assert.deepEqual(foreign.writes,[]);
});

test('narrow temporary expansion preserves the closed desktop preference',()=>{
  const f=fixture({sidebar:0,viewportWidth:900}),dispose=installNarrowLeftSidebar(f.ctx);
  assert.equal(f.instance.getSnapshot().layoutInfo.narrowExpanded,false);
  f.actions.toggleSidebar();
  assert.equal(f.instance.getSnapshot().layoutInfo.narrowExpanded,true);
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,0);
  f.actions.toggleSidebar();
  dispose();
  f.actions.setViewportWidth(1440);
  assert.equal(f.instance.getSnapshot().layoutInfo.sidebar,0);
  assert.deepEqual(f.writes,[]);
  const expanded=fixture({sidebar:0,viewportWidth:900,narrowExpanded:true});
  installNarrowLeftSidebar(expanded.ctx)();
  assert.equal(expanded.instance.getSnapshot().layoutInfo.sidebar,0);
  assert.equal(expanded.instance.getSnapshot().layoutInfo.narrowExpanded,true);
});

test('216px presentation solves grid, rightbar and native logical drag scale together',()=>{
  const info={sidebar:264,viewportWidth:1440,narrowExpanded:false,rightbar:600,rightbarShown:true,rightbarTrack:true};
  const g=leftPresentationGeometry(info);
  assert.equal(g.columns.sidebar,216);
  assert.equal(g.columns.center,624);
  assert.equal(g.normal.rightbar,600);
  const dx=40;
  const logical=264+dx/g.scale;
  const moved=leftPresentationGeometry({...info,sidebar:logical});
  assert(Math.abs(moved.columns.sidebar-216-dx)<=1);
  const closed=leftPresentationGeometry({...info,sidebar:0,rightbarShown:false,rightbarTrack:false});
  assert.equal(closed.columns.sidebar,0);
  const narrow=leftPresentationGeometry({...info,viewportWidth:900,sidebar:0,narrowExpanded:true,rightbarShown:false,rightbarTrack:false});
  assert.equal(narrow.columns.sidebar,216);
});

test('compact left presentation preserves native unavailable rightbar boundaries',()=>{
  const full={sidebar:420,viewportWidth:1060,narrowExpanded:false,rightbar:620,rightbarShown:true,rightbarTrack:true};
  const large=leftPresentationGeometry(full);
  assert.equal(large.columns.sidebar,344);
  assert.equal(large.normal.rightbar,0);
  assert.equal(large.columns.rightbar,0);
  assert.equal(large.rightMax,0);
  const narrow=leftPresentationGeometry({...full,sidebar:0,viewportWidth:940,narrowExpanded:true});
  assert.equal(narrow.columns.sidebar,216);
  assert.equal(narrow.normal.rightbar,0);
  assert.equal(narrow.columns.rightbar,0);
});
