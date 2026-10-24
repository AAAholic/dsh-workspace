// Source integration fixture: actual React workspace and companion, synthetic stores.
// Compiles in memory; never updates a package bundle or contacts an installed profile.
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
const whale=path.resolve(base,'../whale-girl');
const vendor=vendorPrelude('__LayoutVendor');
const conversation=hostPackage('dsh-client-ui-conversation/lib/client.js');
const css=JSON.parse(conversation.match(/const css\$4 = ("[^\n]+")/)[1]);
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {applyWorkspace as apply} from ${JSON.stringify(path.join(base,'lib/client/index.mjs'))};
import {mountSharkCompanion} from ${JSON.stringify(path.join(whale,'lib/client/shark-companion.mjs'))};
import {registerWorkspaceProvider} from ${JSON.stringify(path.join(whale,'lib/client/workspace-provider.mjs'))};
const store=value=>{let current=value;const listeners=new Set();return {getSnapshot:()=>current,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},set:value=>{current=value;for(const fn of listeners)fn()}}};
const connection=store('connected'),jobs=store({rows:{fixture:[]}}),settings=store({status:'ready',writable:true,value:{enabled:true,pollMs:30000}});
let changes=0,failure='';const scope={...settings,async set(key,value){changes++;if(failure==='reject')return false;if(failure==='throw')throw new Error('Synthetic save failure');settings.set({...settings.getSnapshot(),value:{...settings.getSnapshot().value,[key]:value}});return true}};
globalThis.EventSource=undefined;
const companion=mountSharkCompanion({defaults:{pollMs:30000},settingsScope:scope,endpoints:{state:'/pet-state',assets:'/pet-assets'}});
const offProvider=registerWorkspaceProvider(document,{id:'whale-girl',actions:[companion.workspaceAction],setHosted:companion.setHosted});
let registration;const ctx={slots:{inject(_name,fn){return fn()},register(descriptor,component){registration={descriptor,component};return()=>{}}},sessions:{binding:()=>undefined},connection:{state:connection},jobs:{state:jobs,watchRows:()=>()=>{}},get:()=>undefined};
const disposePlugin=apply(ctx);
const session={sessionId:'fixture',running:false,blank:true};const statuses=new Map(),summaries={byId:{}};
const props={...registration.descriptor.inject('fixture'),sessionId:'fixture',useSession:fn=>fn(session),useSessionStatus:fn=>fn(statuses),useSessions:fn=>fn(summaries),useConnection:fn=>fn('connected'),useJobs:fn=>fn(jobs.getSnapshot()),useProjection:()=>[]};
let mount=createRoot(document.querySelector('#mount'));mount.render(React.createElement(registration.component,props));
const body=document.querySelector('[data-conversation-content]');const measure=new ResizeObserver(()=>body.style.setProperty('--dsh-conversation-column-width',body.getBoundingClientRect().width+'px'));measure.observe(body);
window.fixture={settings,changes:()=>changes,fail(mode){failure=mode},unmount(){mount.unmount()},remount(){mount=createRoot(document.querySelector('#mount'));mount.render(React.createElement(registration.component,props))},dispose(){mount.unmount();disposePlugin();offProvider();companion.dispose();measure.disconnect()}};
`;
const compiled=await build({stdin:{contents:source,resolveDir:base,sourcefile:'layout-integration-fixture.mjs'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',external:['react','react-dom','react-dom/client'],logLevel:'silent'});
const code=`import '/host/index.js';const require=id=>globalThis.__LayoutVendor[id];const module={exports:{}};const exports=module.exports;\n${compiled.outputFiles[0].text}`;
const html=`<!doctype html><html data-platform="darwin"><head><meta charset="utf-8"><style>${css}
html,body{height:100%;margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:#111b2c;color:#e6edf8;--dsw-font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;--dsw-alias-bg-base:#111b2c;--dsw-alias-label-primary:#e6edf8;--dsw-alias-label-secondary:#b4c3dc;--dsw-alias-border-l2:#334059;--dsw-alias-border-l3:#334059;--dsw-alias-bg-layer-1:#21324c;--dsw-alias-bg-layer-2:#293d5b;--dsw-alias-brand-primary:#83b5dc}
.frame{display:grid;grid-template-columns:216px minmax(0,1fr);height:100%;overflow:hidden}.history{padding:20px;background:#172238;box-sizing:border-box}.center{min-width:0;min-height:0;overflow:hidden}.fixture-header{height:50px;flex:none;box-sizing:border-box;padding:10px 20px;display:flex;align-items:center;justify-content:space-between}.rows{width:var(--dsh-chat-content-width);max-width:100%;margin:auto}.code{position:relative;border:1px solid #52627e;padding:8px}.code button{position:absolute;right:0;top:0}.rows p{margin:10px 0;min-height:24px}.composer{width:min(calc(100% - 32px),var(--dsh-composer-card-max-width));box-sizing:border-box;margin:auto;background:#21324c;border-radius:16px;padding:16px}.editor{min-height:36px;line-height:24px}.editor p{margin:0}.tools{display:flex;gap:12px;height:28px;align-items:center;margin-top:12px}[data-composer-seat]{padding-bottom:28px}button{font:inherit;color:inherit;background:#243752;border:1px solid #56708f;border-radius:6px;padding:4px 8px;cursor:pointer}.forecast{padding:8px 0;line-height:24px}#mount{display:inline-flex}@media(max-width:1023px){.frame{grid-template-columns:minmax(0,1fr)}.history{display:none}}
</style></head><body data-ds-dark-theme><div class="frame"><aside class="history">历史 · 216px</aside><main class="center"><section class="ST7X_W_root" data-phase="active" data-dockkit-pane-active="true"><header class="fixture-header">真实布局源码夹具<button id="resource">资源</button></header><div class="ST7X_W_body" data-conversation-content data-conversation-session="fixture" data-content-phase="active"><div class="ST7X_W_scrollBody" data-conversation-scroll><div class="ST7X_W_viewArea"><article class="rows"><div class="code">代码与右上角复制操作<button id="copy">复制</button></div>${Array.from({length:30},(_,i)=>'<p>第'+(i+1)+'行正文：独立卡片与输入区域保持清晰。</p>').join('')}<button id="last">末行操作</button></article></div><div class="ST7X_W_composerSeat" data-composer-seat><div class="composer" data-composer-card><div class="editor" contenteditable="true">回复或描述任务</div><div class="tools"><button id="forecast">预测</button><span id="mount"></span><button id="send">发送</button></div></div></div></div></div></section></main></div><script type="module" src="/fixture.js"></script></body></html>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type',url.pathname==='/'?'text/html':'text/javascript');
 if(url.pathname==='/'){res.end(html);return}if(url.pathname==='/fixture.js'){res.end(code);return}if(url.pathname==='/host/index.js'){res.end(vendor);return}
 if(/^\/host\/vendor-[A-Za-z0-9_-]+\.js$/.test(url.pathname)){res.end(hostPackage('dsh-web-frontend/dist/assets/'+path.basename(url.pathname)));return}
 if(/^\/pet-assets\/characters\/ellen-bangboo\/(sleep|working)\.png$/.test(url.pathname)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(path.join(whale,'lib/assets/characters/ellen-bangboo',path.basename(url.pathname))));return}
 if(url.pathname==='/pet-state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({activity:{}}));return}
 res.writeHead(404);res.end();
});
const output=verificationOutput('layout-integration',{hostInputs:{conversation,frontend,fixtureSource:source}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const errors=[],checks=[],measurements=[];
try {
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-dsh-workspace-panel]').waitFor();
 const settle=()=>page.waitForTimeout(180);
 const metrics=()=>page.evaluate(()=>{
  const q=s=>document.querySelector(s),rect=s=>q(s)?.getBoundingClientRect().toJSON();const pet=q('[data-shark-companion]')?.shadowRoot.querySelector('.pet');
  return {host:rect('[data-dsh-workspace-inline-host]'),body:rect('[data-conversation-content]'),seat:rect('[data-composer-seat]'),composer:rect('[data-composer-card]'),rows:rect('.rows'),pet:pet?.getBoundingClientRect().toJSON(),petVisible:pet&&!pet.hidden&&getComputedStyle(pet).visibility!=='hidden',height:innerHeight,compact:q('[data-dsh-workspace-inline-host]')?.hasAttribute('data-inline-compact'),expanded:q('[data-dsh-workspace-inline-host]')?.hasAttribute('data-inline-expanded')};
 });
 const hit=selector=>page.locator(selector).evaluate(element=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
 const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 await settle();let m=await metrics();assert(m.petVisible);assert(!intersects(m.pet,m.body)&&!intersects(m.pet,m.host));checks.push('actual companion fits only its reserved lane, outside the body and card');
 for(const attribute of ['hidden','aria-hidden']){
  await page.locator('.ST7X_W_root').evaluate((root,attribute)=>root.setAttribute(attribute,attribute==='aria-hidden'?'true':''),attribute);await settle();assert(!(await metrics()).petVisible);
  await page.locator('.ST7X_W_root').evaluate((root,attribute)=>root.removeAttribute(attribute),attribute);await settle();assert((await metrics()).petVisible);
 }
 checks.push('hidden and aria-hidden retained panes keep the hosted pet hidden, then recover without preference changes');
 await page.evaluate(rect=>{const pane=document.createElement('section');pane.id='floating-fixture';pane.dataset.dockkitFloat='fixture';pane.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;background:#284161;z-index:9999`;pane.innerHTML='<button id="float-title">浮窗标题操作</button>';document.body.append(pane)},m.pet);await settle();
 let floating=await metrics();const floatRect=await page.locator('#floating-fixture').evaluate(e=>e.getBoundingClientRect().toJSON());assert(!floating.petVisible||!intersects(floating.pet,floatRect));assert(await hit('#float-title'));
 await page.locator('#floating-fixture').evaluate(e=>e.remove());await settle();assert((await metrics()).petVisible);checks.push('a second floating pane blocks the pet lane including its title control');
 await page.getByRole('button',{name:'收起进度卡片',exact:true}).click();await settle();m=await metrics();const wideHits={copy:await hit('#copy'),resource:await hit('#resource')};measurements.push({case:'wide-collapsed',...m,hitTargets:wideHits});
 assert(m.host.bottom<=m.body.top);assert(wideHits.copy);assert(wideHits.resource);assert(!m.petVisible);assert(Math.abs(m.rows.left+m.rows.width/2-m.composer.left-m.composer.width/2)<=1);
 await page.screenshot({path:path.join(output,'wide-collapsed.png')});checks.push('wide collapsed entry has its own row; copy/header hit targets and reading axis remain intact');
 await page.getByRole('button',{name:'进度与插件',exact:true}).click();await settle();m=await metrics();assert(m.body.right<=m.host.left);assert(m.petVisible);checks.push('reopening restores the side lane and companion without accumulated offsets');
 await page.setViewportSize({width:800,height:758});await settle();m=await metrics();const halfHits={forecast:await hit('#forecast'),send:await hit('#send')};assert(m.compact&&!m.expanded&&!m.petVisible);assert(halfHits.forecast&&halfHits.send);measurements.push({case:'half-width',...m,hitTargets:halfHits});await page.screenshot({path:path.join(output,'half-width.png')});
 await page.getByRole('button',{name:'进度与插件',exact:true}).click();await settle();assert(await page.getByRole('switch',{name:'鲨鲨助手，已开启'}).isVisible());
 await page.getByRole('switch',{name:'鲨鲨助手，已开启'}).click();await settle();assert.equal(await page.evaluate(()=>fixture.settings.getSnapshot().value.enabled),false);
 await page.getByRole('switch',{name:'鲨鲨助手，已关闭'}).click();await settle();assert.equal(await page.evaluate(()=>fixture.settings.getSnapshot().value.enabled),true);assert(!(await metrics()).petVisible);checks.push('half-width hides the pet graphic while its real hosted switch stays writable');
 await page.setViewportSize({width:800,height:540});await settle();
 await page.locator('.editor').evaluate(element=>{element.innerHTML=Array.from({length:6},(_,i)=>'<p>自然增高的输入第'+(i+1)+'行</p>').join('');element.focus()});await settle();
 await page.waitForFunction(()=>!document.querySelector('[data-dsh-workspace-inline-host]').hasAttribute('data-inline-expanded'));
 m=await metrics();const compactHits={send:await hit('#send'),forecast:await hit('#forecast')};measurements.push({case:'compact-natural-input-growth',...m,hitTargets:compactHits});assert(m.body.height-m.seat.height>=100);assert(compactHits.send&&compactHits.forecast);assert(await page.locator('.editor').evaluate(e=>document.activeElement===e));
 assert(await page.getByRole('switch',{name:'鲨鲨助手，已开启'}).isVisible());await page.getByRole('switch',{name:'鲨鲨助手，已开启'}).click();await settle();assert.equal(await page.evaluate(()=>fixture.settings.getSnapshot().value.enabled),false);
 assert(await page.getByRole('button',{name:'空间不足，暂已收起'}).isVisible());assert(await page.locator('.dw-closed-assistant .dw-action-button>span:first-child').isVisible());await page.screenshot({path:path.join(output,'compact-long-input.png')});checks.push('natural input growth automatically releases card height, preserves typing focus and retains the named assistant switch');
 for(const mode of ['reject','throw']){
  await page.evaluate(mode=>fixture.fail(mode),mode);await page.getByRole('switch',{name:'鲨鲨助手，已关闭'}).click();await settle();assert.equal(await page.evaluate(()=>fixture.settings.getSnapshot().value.enabled),false);
  const feedback=page.locator('.dw-closed-assistant [role="status"]');assert(await feedback.isVisible());assert.match(await feedback.textContent(),/未能|重试/);
  const feedbackRect=await feedback.evaluate(e=>e.getBoundingClientRect().toJSON());m=await metrics();assert(feedbackRect.bottom<=m.host.bottom);assert(await hit('#send'));
 }
 await page.screenshot({path:path.join(output,'compact-toggle-failure.png')});await page.evaluate(()=>fixture.fail(''));checks.push('short-window assistant preserves visible failure feedback for rejected and thrown setting writes');
 await page.locator('.editor').evaluate(element=>{element.textContent='回复或描述任务'});await page.setViewportSize({width:800,height:758});await settle();
 await page.getByRole('button',{name:'进度与插件',exact:true}).click();await settle();await page.getByRole('button',{name:'插件',exact:true}).focus();
 await page.locator('.editor').evaluate(element=>{element.innerHTML=Array.from({length:15},()=>'<p>足够高的输入内容</p>').join('')});await settle();
 assert(await page.locator('.dw-card-reopen').evaluate(e=>document.activeElement===e));checks.push('automatic collapse returns focus from removed card controls to the retained entry');
 await page.evaluate(()=>fixture.unmount());await settle();assert.equal(await page.locator('[data-dsh-workspace-inline-host]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-dsh-workspace-pet-hidden')),false);
 assert(await page.locator('[data-shark-companion]').evaluate(root=>getComputedStyle(root.shadowRoot.querySelector('.toggle')).visibility==='visible'&&!root.shadowRoot.querySelector('.toggle').hidden));checks.push('removing the last card restores the original companion toggle instead of hiding its root forever');
 await page.evaluate(()=>{fixture.remount()});await settle();await page.evaluate(()=>{document.querySelector('.editor').textContent='收尾';fixture.dispose()});await settle();
 assert.equal(await page.locator('[data-dsh-workspace-inline-host],[data-dsh-workspace-curtain],[data-dsh-workspace-layout-style]').count(),0);
 assert.equal(await page.evaluate(()=>document.querySelector('.ST7X_W_root').hasAttribute('data-inline-collapsed')||document.documentElement.hasAttribute('data-dsh-workspace-pet-hidden')),false);assert.deepEqual(errors,[]);checks.push('pending resize followed by disposal leaves no owned nodes, collapsed marker or hidden-pet state');
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,evidence:'Current source compiled in memory with host React/CSS and actual companion; synthetic stores, not native application acceptance',checks,measurements,errors},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,output},null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
