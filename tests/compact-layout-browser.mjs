// Regression fixture: exact installed ConversationRoot CSS/header structure and
// production layout adapter; buttons and card contents use synthetic state.
// This does not interact with DSH or replace native/user acceptance.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from './helpers/browser-runtime.mjs'
import {hostPackage} from './helpers/read-installed-asar.mjs';
import {verificationOutput} from './verification-output.mjs';

const base=path.resolve(import.meta.dirname,'..');
const conversation=hostPackage('dsh-client-ui-conversation/lib/client.js');
const nativeCss=JSON.parse(conversation.match(/const css\$4 = ("[^\n]+")/)[1]);
const resource=hostPackage('dsh-client-ui-sidebar-right/lib/client.js');
assert(conversation.includes('"data-conversation-header-corner": ""'));
assert(resource.includes('name: "conversation.session.header.corner"'));
assert(resource.includes('.wmirxG_button{width:28px;'));
const fixture=`<!doctype html><html data-platform="darwin"><head><meta charset="utf-8"><style>
${nativeCss}
html,body{margin:0;height:100%;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:#111b2c;color:#e6edf8;--dsw-alias-bg-base:#111b2c;--dsw-alias-border-l2:#334059;--dsw-alias-border-l3:#334059;--dsw-alias-label-secondary:#abb8ce}
.frame{display:grid;grid-template-columns:216px minmax(0,1fr);height:100%;overflow:hidden}.history{background:#172238}.center{min-width:0;min-height:0;overflow:hidden}
button{font:inherit;color:inherit;background:#23334d;border:1px solid #40536e;border-radius:6px;cursor:pointer;padding:4px 8px}button:focus-visible{outline:2px solid #7aa2eb;outline-offset:2px}
.wmirxG_button{width:28px;height:28px;flex:none;padding:0}.native-utility{height:28px}
[data-dsh-workspace-panel]{display:flex;flex-direction:column;height:100%;min-height:0}.card-header{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;flex:none;gap:8px}.card-body{overflow:auto;min-height:0;flex:1;padding:8px 12px}.card-body p{margin:8px 0}.card-body[hidden]{display:none}
.rows{max-width:var(--dsh-chat-content-width);margin:auto}.rows p{margin:8px 0;height:28px}.composer{width:min(calc(100% - 32px),var(--dsh-composer-card-max-width));height:108px;box-sizing:border-box;margin:auto;background:#21324c;border-radius:16px;padding:16px}.ST7X_W_composerSeat{padding-bottom:28px}
</style></head><body data-ds-dark-theme><div class="frame"><aside class="history">216px 历史栏</aside><main class="center"><section class="ST7X_W_root" data-phase="active">
<header class="ST7X_W_header"><div class="ST7X_W_headerLeading"></div><div class="ST7X_W_titleRow"><div class="ST7X_W_titleCluster"><nav class="ST7X_W_crumbs"><span class="ST7X_W_crumb ST7X_W_crumbCurrent">窄屏入口回归验证</span></nav><div class="ST7X_W_headerActions"></div></div><div class="ST7X_W_headerUtilities"><button class="native-utility">原生操作</button></div><div class="ST7X_W_headerCorner" data-conversation-header-corner><button class="wmirxG_button" data-sidebar-right-expand aria-label="展开资源侧栏">↔</button></div></div></header>
<div class="ST7X_W_body" data-conversation-content data-conversation-session="fixture" data-content-phase="active"><div class="ST7X_W_scrollBody" data-conversation-scroll><div class="ST7X_W_viewArea"><article class="rows">${Array.from({length:30},(_,i)=>`<p>第 ${i+1} 行正文：原生操作、进度与输入保持独立可用。</p>`).join('')}<button id="last-action">末行操作</button></article></div><div class="ST7X_W_composerSeat" data-composer-seat><span id="anchor"></span><div class="composer" data-composer-card contenteditable="true">输入区域</div></div></div></div>
</section></main></div><script type="module">
import {installWorkspaceLayout,attachInlineWorkspace} from '/lib/client/layout.mjs';
const body=document.querySelector('[data-conversation-content]');
const measure=new ResizeObserver(()=>body.style.setProperty('--dsh-conversation-column-width',body.offsetWidth+'px'));measure.observe(body);
const stop=installWorkspaceLayout({});
const host=attachInlineWorkspace(document.querySelector('#anchor'),{sessionId:'fixture'});
let expanded=false,resourceClicks=0,utilityClicks=0;
document.querySelector('[data-sidebar-right-expand]').onclick=()=>resourceClicks++;
document.querySelector('.native-utility').onclick=()=>utilityClicks++;
function render(){
 const compact=host.getSnapshot().compact;
 host.element.toggleAttribute('data-inline-expanded',compact&&expanded);
 host.element.innerHTML='<section data-dsh-workspace-panel data-workspace-visible="true"><div class="card-header"><button id="entry">'+(compact&&!expanded?'进度与插件':'收起进度卡片')+'</button></div><div class="card-body"'+(compact&&!expanded?' hidden':'')+'><strong>本轮进度</strong>'+Array.from({length:16},(_,i)=>'<p>步骤 '+(i+1)+' · 保留可滚动内容</p>').join('')+'</div></section>';
 host.element.querySelector('#entry').onclick=()=>{expanded=!expanded;render()};
}
let previousCompact=host.getSnapshot().compact;
host.subscribe(()=>{const compact=host.getSnapshot().compact;if(compact!==previousCompact)expanded=false;previousCompact=compact;render()});render();
window.compactFixture={host,get clicks(){return{resourceClicks,utilityClicks}},stop(){host.dispose();measure.disconnect();stop()}};
</script></body></html>`;

const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return}
 const target=path.join(base,url.pathname);
 if(!target.startsWith(base+path.sep)||!fs.existsSync(target)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(target));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const errors=[],checks=[],measurements=[];
const output=verificationOutput('compact-layout',{hostInputs:{conversation,resource}});
try {
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1016,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.locator('[data-inline-compact]').first().waitFor();
 const settle=()=>page.waitForTimeout(120);
 const measure=()=>page.evaluate(()=>{
  const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
  const centerHit=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
  const header=rect('header'),host=rect('[data-dsh-workspace-inline-host]'),body=rect('[data-conversation-content]'),root=rect('.ST7X_W_root'),rows=rect('.rows'),composer=rect('.composer');
  return{header,host,body,root,resourceHit:centerHit('[data-sidebar-right-expand]'),utilityHit:centerHit('.native-utility'),entryHit:centerHit('#entry'),compact:compactFixture.host.getSnapshot().compact,axisError:Math.abs(rows.x+rows.width/2-composer.x-composer.width/2),fade:getComputedStyle(document.querySelector('[data-composer-seat]')).paddingTop};
 });
 async function compactCheck(label){await settle();const g=await measure();measurements.push({label,...g});assert(g.compact,label);assert(g.resourceHit&&g.utilityHit&&g.entryHit,label+': all control centers remain clickable');assert(g.host.top>=g.header.bottom,label+': card clears native header');assert(g.body.top>=g.host.bottom,label+': card reserves body space');assert.equal(g.body.width,g.root.width,label+': full reading width retained');assert(g.body.height>200,label+': composer retains space');assert(g.axisError<=1,label+': composer and reading axis match');assert.equal(g.fade,'56px');checks.push(label)}
 await compactCheck('800px conversation: collapsed card leaves native header and body clear');
 await page.getByRole('button',{name:'展开资源侧栏'}).click();await page.getByRole('button',{name:'原生操作',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>compactFixture.clicks),{resourceClicks:1,utilityClicks:1});
 checks.push('native resource and utility pointer actions fire exactly once');
 await page.getByRole('button',{name:'进度与插件',exact:true}).click();
 await compactCheck('expanded card remains below header and above body');
 assert((await measure()).host.height<=340);
 await page.setViewportSize({width:816,height:500});
 await compactCheck('600px conversation in 500px short window keeps reading and composer space');
 const short=await measure();assert(short.host.height<=short.root.height*.4+1);
 await page.getByRole('button',{name:'收起进度卡片'}).click();
 await compactCheck('collapse returns reserved vertical space without covering controls');
 await page.getByRole('button',{name:'展开资源侧栏'}).focus();await page.keyboard.press('Enter');
 assert.equal((await page.evaluate(()=>compactFixture.clicks)).resourceClicks,2);checks.push('native resource button remains keyboard operable');
 await page.evaluate(()=>{const scroll=document.querySelector('[data-conversation-scroll]');scroll.scrollTop=scroll.scrollHeight});await settle();
 assert(await page.evaluate(()=>document.querySelector('#last-action').getBoundingClientRect().bottom<=document.querySelector('[data-composer-seat]').getBoundingClientRect().top+1));checks.push('last body action remains above unchanged composer fade');
 await page.setViewportSize({width:1440,height:900});await settle();
 const wide=await measure();assert.equal(wide.compact,false);assert.equal(wide.root.width-wide.body.width,258+32);assert(wide.axisError<=1);assert(wide.resourceHit&&wide.utilityHit);checks.push('wide mode restores its 258px side card and original reading axis');
 await page.setViewportSize({width:1016,height:900});await settle();
 await compactCheck('wide-to-compact transition restores safe collapsed row');
 fs.mkdirSync(output,{recursive:true});
 await page.screenshot({path:path.join(output,'compact-collapsed.png')});
 await page.getByRole('button',{name:'进度与插件',exact:true}).click();await settle();
 await page.screenshot({path:path.join(output,'compact-expanded.png')});
 await page.evaluate(()=>compactFixture.stop());await settle();
 assert.equal(await page.locator('[data-dsh-workspace-inline-host]').count(),0);
 assert.equal(await page.locator('[data-dsh-workspace-curtain]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-dsh-workspace-layout')),false);
 assert(await page.evaluate(()=>{const header=document.querySelector('header').getBoundingClientRect(),body=document.querySelector('[data-conversation-content]').getBoundingClientRect();return Math.abs(header.bottom-body.top)<1}));
 checks.push('unload removes the compact row, fade and all reserved space');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,evidence:'exact installed header CSS/DOM geometry and production layout adapter; synthetic card and button state; isolated Chromium, not native acceptance',checks,measurements,errors},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks,report:path.join(output,'report.json')},null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
