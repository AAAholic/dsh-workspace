// Real installed AppFrame, SidebarRoot, LayoutController, snapshot store and drag
// handle in isolated Chromium. Session/footer values are synthetic fixture data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from './helpers/browser-runtime.mjs'
import {build} from 'esbuild';
import {hostPackage} from './helpers/read-installed-asar.mjs';
import {verificationOutput} from './verification-output.mjs';
import {frontend,vendorPrelude} from './host-runtime.mjs';
const base=path.resolve(import.meta.dirname,'..');
const vendor=vendorPrelude('__LeftVendor');
const layoutSource=hostPackage('dsh-client-ui-layout/lib/client.js').replace('exports.apply = apply;','exports.AppFrame = AppFrame; exports.apply = apply;');
const sidebarSource=hostPackage('dsh-client-ui-sidebar/lib/client.js').replace('exports.apply = apply;','exports.SidebarRoot = SidebarRoot; exports.apply = apply;');
const source=`
import React,{useSyncExternalStore} from 'react';import {createRoot} from 'react-dom/client';
import {installNarrowLeftSidebar} from ${JSON.stringify(path.join(base,'lib/client/left-sidebar.mjs'))};
const native={};window.__ModuleLoader__={load({id,factory}){native[id]=factory(id=>globalThis.__LeftVendor[id])}};
${layoutSource}
${sidebarSource}
const entries=[],listeners=new Set();let revision=0,pending=false;
const notify=()=>{revision++;if(!pending){pending=true;queueMicrotask(()=>{pending=false;for(const fn of listeners)fn()})}};
const slots={entries(name){return name==='root'?entries:[]},register(options,component){const entry={...options,options,component};entries.push(entry);entries.sort((a,b)=>(a.options.priority??0)-(b.options.priority??0));notify();return()=>{const i=entries.indexOf(entry);if(i>=0)entries.splice(i,1);notify()}},provideRoot(){return()=>{}},subscribe(name,fn){if(name==='root'){listeners.add(fn);return()=>listeners.delete(fn)}return()=>{}}};
const effects=[];const ctx={slots,locale:{register(){return()=>{}},bind(){return k=>({'session.new':'新会话','brand.localBuild':'DeepSeek Harness','toggle.collapse':'收起历史','toggle.open':'打开历史','product.title':'DSH'}[k]||k)}},shortcuts:{register(){return()=>{}}},reflect:{provide(name,value){ctx[name]=value;return()=>{delete ctx[name]}}},effect(fn,label){if(label==='ui-layout: theme presenter')return;const off=fn();if(typeof off==='function')effects.push(off)},get(name){return this[name]}};
native['@deepseek-ai/dsh-client-ui-layout'].apply(ctx);
const entry=entries[0],instance=entry.store.create(),original=entry.component,originalActions={...instance.actions};
const hook=store=>selector=>selector(useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot));
const sessionsValue={byId:{}};const sessions={getSnapshot:()=>sessionsValue,subscribe:()=>()=>{}};
const empty=selector=>selector([]);
const sidebarSlot=(name,props,options)=>name==='sidebar.workspaces'?React.createElement('div',{id:'history-items'},'当前项目审查',React.createElement('p',null,'进度与插件布局'),React.createElement('p',null,'研究记录')):name==='sidebar.footer.action'?React.createElement('div',{id:'footer',style:{width:'100%'}},'上下文 12% · 余额 ¥100'):name==='sidebar.settings'?React.createElement('button',{id:'settings'},'设置'):options?.fallback??null;
const renderSlot=(name,owner,options)=>{
 if(name==='sidebar')return React.createElement('div',{'data-slot':'sidebar',style:{display:'contents'}},React.createElement(native['@deepseek-ai/dsh-client-ui-sidebar'].SidebarRoot,{...owner,startSession(){},toggleSidebar:()=>ctx.layout.toggleSidebar(),selectPanel:id=>ctx.layout.selectPanel(id),usePanels:empty,useShortcuts:empty,usePanelInfo:hook(ctx.layout.panelInfo),t:ctx.locale.bind(),renderSlot:sidebarSlot}));
 if(name==='main')return React.createElement('main',{id:'main',style:{height:'100%',padding:'28px',boxSizing:'border-box'}},React.createElement('h2',null,'正文区域'),React.createElement('p',null,'正文、输入框和右侧进度卡片按实际列宽重新测量。'));
 if(name==='rightbar')return React.createElement('aside',{id:'resource',style:{width:owner.width,position:'absolute',right:0,top:0,bottom:0,background:'#21314c',display:instance.getSnapshot().layoutInfo.rightbarShown?'block':'none'},'data-reported-width':owner.width},'原生资源区域');
 if(name==='shell.leading')return React.createElement('button',{id:'leading-toggle',onClick:()=>ctx.layout.toggleSidebar()},'历史');
 return options?.fallback??null;
};
const props={useStore:hook(instance),useSessions:hook(sessions),usePanelInfo:hook(ctx.layout.panelInfo),actions:instance.actions,renderSlot,t:ctx.locale.bind()};
function RootMount(){useSyncExternalStore(fn=>slots.subscribe('root',fn),()=>revision);return React.createElement(entries[0].component,props)}
const root=createRoot(document.getElementById('mount'));root.render(React.createElement(RootMount));
let dispose;window.leftFixture={ctx,instance,entry,original,install(){dispose=installNarrowLeftSidebar(ctx);return entry.component.name},stop(){dispose?.();dispose=undefined},logical:()=>instance.getSnapshot().layoutInfo.sidebar,actionsUnchanged:()=>Object.keys(originalActions).every(k=>originalActions[k]===instance.actions[k]),rootCount:()=>entries.length,dispose(){dispose?.();root.unmount();effects.reverse().forEach(fn=>fn())}};
`;
const compiled=await build({stdin:{contents:source,resolveDir:base,sourcefile:'native-left-fixture.mjs'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',external:['react','react-dom/client'],logLevel:'silent'});
const code=`import '/host/index.js';\nconst require=id=>globalThis.__LeftVendor[id];const module={exports:{}};const exports=module.exports;\n${compiled.outputFiles[0].text}`;
const html=`<!doctype html><html data-platform="darwin"><head><meta charset="utf-8"><style>html,body,#mount{margin:0;height:100%;background:#111b2c;color:#e5edf7;font:14px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;--dsw-alias-bg-base:#111b2c;--dsw-specific-sidebar-fill:#142033;--dsw-alias-label-primary:#e5edf7;--dsw-alias-label-tertiary:#bac5d7;--dsw-alias-border-l3:#334059;--dsw-alias-button-elevated-fill:#243b58}button{color:inherit}#footer{font-size:12px;white-space:nowrap}#resource{padding:20px;box-sizing:border-box}</style></head><body data-ds-dark-theme><div id="mount"></div><script type="module" src="/fixture.js"></script></body></html>`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type',url.pathname==='/'?'text/html':'text/javascript');if(url.pathname==='/'){res.end(html);return}if(url.pathname==='/fixture.js'){res.end(code);return}if(url.pathname==='/host/index.js'){res.end(vendor);return}if(/^\/host\/vendor-[A-Za-z0-9_-]+\.js$/.test(url.pathname)){res.end(hostPackage('dsh-web-frontend/dist/assets/'+path.basename(url.pathname)));return}res.writeHead(404);res.end()});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const errors=[],checks=[];
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#history-items').waitFor({timeout:5000});
 assert.equal(await page.evaluate(()=>leftFixture.install()),'LeftPresentationFrame');await page.waitForTimeout(700);
 const metrics=()=>page.evaluate(()=>{const c=document.querySelector('[data-dsh-left-sidebar-column]'),s=document.querySelector('[data-slot="sidebar"]>div'),m=document.querySelector('#main'),h=document.querySelector('[data-side="sidebar"]');return {column:c?.getBoundingClientRect().width,sidebar:s?.getBoundingClientRect().width,mainLeft:m.getBoundingClientRect().left,handle:h?parseFloat(h.style.left):0,logical:leftFixture.logical(),footer:document.querySelector('#footer').getBoundingClientRect().right,sideRight:s?.getBoundingClientRect().right}});
 let g=await metrics();console.log('initial native geometry',g);assert.equal(g.column,216);assert.equal(g.sidebar,216);assert(Math.abs(g.mainLeft-216)<=1);assert.equal(g.handle,216);assert.equal(g.logical,264);assert(g.footer<=g.sideRight+1);checks.push('native column/SidebarRoot/main/handle/footer all fit 216');
 assert(await page.evaluate(()=>leftFixture.actionsUnchanged()));assert.equal(await page.evaluate(()=>leftFixture.rootCount()),1);checks.push('native action identities and root registration preserved');
 await page.mouse.move(216,450);await page.mouse.down();await page.mouse.move(246,450,{steps:6});await page.mouse.up();await page.waitForTimeout(120);g=await metrics();assert(Math.abs(g.column-246)<=1);assert.equal(g.column,g.handle);assert.equal(g.column,g.sidebar);checks.push('real native pointer drag tracks physical 30px delta');
 await page.evaluate(()=>leftFixture.ctx.layout.toggleSidebar());await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>leftFixture.logical()),0);
 await page.evaluate(()=>leftFixture.ctx.layout.toggleSidebar());await page.waitForTimeout(700);g=await metrics();assert.equal(g.column,216);checks.push('native close/reopen retains the new default');
 await page.setViewportSize({width:900,height:900});await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>document.querySelector('#main').getBoundingClientRect().left),0);
 await page.evaluate(()=>leftFixture.ctx.layout.toggleSidebar());await page.waitForTimeout(700);g=await metrics();assert.equal(g.column,216);checks.push('native 1024 breakpoint and manual narrow expansion preserved');
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(700);
 await page.evaluate(()=>{leftFixture.instance.actions.setRightbar(620);leftFixture.ctx.layout.openRightbar(true,false)});await page.waitForTimeout(700);
 const r=await page.evaluate(()=>{const side=document.querySelector('[data-dsh-left-sidebar-column]'),main=document.querySelector('#main'),resource=document.querySelector('#resource'),handle=document.querySelector('[data-side="rightbar"]');return {side:side.getBoundingClientRect().width,main:main.getBoundingClientRect().width,right:resource.getBoundingClientRect().width,reported:Number(resource.dataset.reportedWidth),handle:parseFloat(handle.style.left)}});assert.equal(r.side,216);assert.equal(r.right,620);assert.equal(r.reported,620);assert.equal(r.handle,820);assert(Math.abs(r.main-604)<=1);checks.push('native right-resource width and handle use the same geometry');
 await page.mouse.move(820,450);await page.mouse.down();await page.mouse.move(790,450,{steps:6});await page.mouse.up();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>Number(document.querySelector('#resource').dataset.reportedWidth)),650);checks.push('native right resource drag remains physical pixels');
 await page.evaluate(()=>{leftFixture.instance.actions.setSidebar(420);leftFixture.instance.actions.setRightbar(300)});await page.setViewportSize({width:1060,height:900});await page.waitForTimeout(700);
 const edge=await page.evaluate(()=>({side:document.querySelector('[data-dsh-left-sidebar-column]').getBoundingClientRect().width,right:Number(document.querySelector('#resource').dataset.reportedWidth),handle:document.querySelector('[data-side="rightbar"]')?.style.left,collapsed:document.querySelector('[data-dsh-left-presentation]').hasAttribute('data-rightbar-collapsed')}));assert.equal(edge.side,344);assert.equal(edge.right,0);assert.equal(edge.handle,undefined);assert.equal(edge.collapsed,true);checks.push('native unavailable right-track boundary remains unavailable after left projection');
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>leftFixture.instance.actions.setSidebar(264));await page.waitForTimeout(700);
 await page.evaluate(()=>leftFixture.ctx.layout.closeRightbar());await page.waitForTimeout(700);
 const out=verificationOutput('left-sidebar', {hostInputs:{frontend}});await page.screenshot({path:path.join(out,'native-frame-216.png')});
 await page.evaluate(()=>leftFixture.stop());await page.waitForTimeout(700);assert(await page.evaluate(()=>leftFixture.entry.component===leftFixture.original));assert.equal(await page.evaluate(()=>document.querySelector('[data-slot="sidebar"]>div').getBoundingClientRect().width),280);assert(await page.evaluate(()=>leftFixture.actionsUnchanged()));checks.push('unload restores original native component, width and actions');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,evidence:'exact installed native AppFrame/SidebarRoot/DragHandle/LayoutController with real packaged React/store; synthetic sessions and footer',checks,errors},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,screenshot:path.join(out,'native-frame-216.png')},null,2));
}catch(error){console.error('Fixture page errors:',errors);throw error}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
