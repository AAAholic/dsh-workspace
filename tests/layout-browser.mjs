// Browser fixture verification: current installed CSS + real layout module.
// This checks DOM/layout behavior; it does not substitute for native acceptance.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from './helpers/browser-runtime.mjs'
import assert from 'node:assert/strict';
import { hostPackage } from './helpers/read-installed-asar.mjs';
import { verificationOutput } from './verification-output.mjs';

const base = path.resolve(import.meta.dirname, '..');
const conversation = hostPackage('dsh-client-ui-conversation/lib/client.js');
const declaration = conversation.match(/const css\$4 = ("[^\n]+")/);
const hostCss = JSON.parse(declaration[1]);
const theme = hostPackage('dsh-client-ui-theme/lib/client.js');
const scrollbarCss = JSON.parse(theme.match(/var scrollbar_css_default = ("[^\n]+")/)[1]);
const fixture = `<!doctype html><html data-platform="darwin" data-dsh-backdrop-active><head><meta charset="utf-8"><style>${scrollbarCss}${hostCss}
html,body{margin:0;height:100%;background:#071321;--dsw-alias-bg-base:rgba(18,25,39,.74);color:#eee;font:16px/1.5 sans-serif}
.frame{display:grid;grid-template-rows:100%;height:100vh;position:relative;overflow:hidden}.center{min-width:0;min-height:0;height:100%;position:relative;overflow:hidden}.history{background:#182030}.ST7X_W_viewArea{flex:1 0 auto}.rows{max-width:var(--dsh-chat-content-width);margin:0 auto}.rows p{height:28px;margin:8px 0}.card{height:108px;width:min(calc(100% - 32px),var(--dsh-composer-card-max-width));background:#17202f;margin:auto;border-radius:18px;display:flex;align-items:center;justify-content:center}.ST7X_W_composerSeat{padding-bottom:28px}
html[data-dsh-backdrop-active] [data-composer-seat],html[data-dsh-backdrop-active] [data-composer-seat]::before{background:none!important;backdrop-filter:none!important}
header{height:70px;flex:none;padding:16px;box-sizing:border-box}[data-dsh-workspace-panel]{height:100%;padding:18px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px}.dw-content{flex:1;overflow:auto}.dw-pet-reserve{height:164px;flex:none;border-top:1px dashed #43516b}.dw-content p{font-size:14px;color:#bbc3d3;margin:18px 0}.inline-shortcut{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
</style></head><body data-ds-dark-theme><div class="frame" data-rightbar-frame><aside class="history">会话历史</aside><main class="center"><section class="ST7X_W_root" data-phase="active"><header>当前会话</header><div class="ST7X_W_body" data-conversation-content data-conversation-session="session-1" data-content-phase="active"><div class="ST7X_W_scrollBody" data-conversation-scroll><div class="ST7X_W_viewArea"><div class="rows">${Array.from({length:40},(_,i)=>`<p>消息段落 ${i+1} — 正文与输入框在同一阅读列。</p>`).join('')}<button id="last">末行复制</button></div></div><div class="ST7X_W_composerSeat" data-composer-seat><span id="anchor"></span><div class="card" data-composer-card contenteditable="true">输入 / 预测保留在原位</div></div></div></div></section></main><div data-rightbar-col>原生资源侧栏</div></div>
<script type="module">
import {installWorkspaceLayout,attachInlineWorkspace} from '/lib/client/layout.mjs';
const frame=document.querySelector('.frame'),body=document.querySelector('[data-conversation-content]');
const state={nativeWidth:0,forbidden:0};
function render(){frame.style.gridTemplateColumns='280px minmax(0px,1fr) '+state.nativeWidth+'px'}
const source=new ResizeObserver(()=>body.style.setProperty('--dsh-conversation-column-width',body.offsetWidth+'px'));source.observe(body);
window.addEventListener('resize',render);render();
const ctx=new Proxy({},{get(){state.forbidden++;throw Error('native sidebar was touched')}});
const dispose=installWorkspaceLayout(ctx);
const attached=attachInlineWorkspace(document.querySelector('#anchor'),{sessionId:'session-1'});
const invalid=attachInlineWorkspace(document.querySelector('#anchor'),{sessionId:'stale-session'});
function content(){const compact=attached.getSnapshot().compact;attached.element.innerHTML=compact?'<button class="inline-shortcut">本轮进度 ›</button>':'<section data-dsh-workspace-panel data-workspace-visible="true" data-workspace-pet-active="false"><strong>本轮进度</strong><div class="dw-content"><p>● 正在检查运行体验</p><p>✓ 核对现有界面与数据接口</p><p>✓ 检查边界状态</p><p>○ 汇总验收结论</p><hr><button>动画设置</button> <button>开启助手</button><p>插件入口集中在这里，正文与输入保留在左侧。</p></div><div class="dw-pet-reserve" hidden></div></section>'}
attached.subscribe(content);content();
window.fixture={state,render,attached,invalid,dispose(){attached.dispose();source.disconnect();dispose()}};
</script></body></html>`;

const server = http.createServer((req, res) => {
  const target = req.url === '/' ? null : path.join(base, new URL(req.url, 'http://localhost').pathname);
  if (!target) { res.setHeader('Content-Type','text/html'); res.end(fixture); return; }
  if (!target.startsWith(base + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type','text/javascript'); res.end(fs.readFileSync(target));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars'],executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const wait = () => page.waitForTimeout(160);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await wait();
  assert.equal(await page.evaluate(()=>fixture.invalid),null,'stale session never mounts');
  assert.equal(await page.evaluate(()=>document.querySelector('[data-conversation-content]').getBoundingClientRect().width),884,'inline card reserves actual measured body width');
  assert.equal(await page.evaluate(()=>fixture.attached.element.getBoundingClientRect().width),244);
  assert.equal(await page.evaluate(()=>fixture.attached.element.getBoundingClientRect().height),340,'compact square card uses a 340px height');
  assert.equal(await page.evaluate(()=>fixture.state.forbidden),0,'native sidebar/layout is never accessed');
  const bar=await page.evaluate(()=>{const s=document.querySelector('[data-conversation-scroll]');return {width:getComputedStyle(s,'::-webkit-scrollbar').width,radius:getComputedStyle(s,'::-webkit-scrollbar-thumb').borderRadius,track:getComputedStyle(s,'::-webkit-scrollbar-track').backgroundColor,standards:getComputedStyle(s).scrollbarWidth}});
  assert.deepEqual(bar,{width:'8px',radius:'999px',track:'rgba(0, 0, 0, 0)',standards:'auto'});
  const thumb=await page.evaluate(()=>{const s=document.querySelector('[data-conversation-scroll]'),r=s.getBoundingClientRect();return {x:r.right-6,y:r.top+6+(s.clientHeight/s.scrollHeight)*(s.clientHeight-12)/2}});
  await page.mouse.move(thumb.x,thumb.y);await page.mouse.down();await page.mouse.move(thumb.x,thumb.y+200,{steps:8});await page.mouse.up();await wait();
  assert(await page.evaluate(()=>document.querySelector('[data-conversation-scroll]').scrollTop>100),'the real capsule thumb drags the conversation');
  await page.evaluate(()=>{const s=document.querySelector('[data-conversation-scroll]');s.scrollTop=s.scrollHeight});await wait();
  let geometry=await page.evaluate(()=>{const seat=document.querySelector('[data-composer-seat]'),last=document.querySelector('#last'),curtain=seat.querySelector('[data-dsh-workspace-curtain]');return {bottom:last.getBoundingClientRect().bottom,top:seat.getBoundingClientRect().top,height:seat.getBoundingClientRect().height,padding:getComputedStyle(seat).paddingTop,color:getComputedStyle(curtain).backgroundImage}});
  assert(geometry.bottom<=geometry.top+1,'last action is above the entire fade band');
  assert.equal(geometry.padding,'56px');assert(geometry.color.includes('rgb('));
  assert(await page.evaluate(()=>document.querySelector('[data-composer-seat]').getBoundingClientRect().bottom<=innerHeight+1),'sticky input is within the viewport');
  assert(await page.evaluate(()=>{const seat=document.querySelector('[data-composer-seat]'),r=seat.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.top+30)?.hasAttribute('data-dsh-workspace-curtain')}),'faded message controls cannot be clicked through the curtain');
  await page.evaluate(()=>{document.querySelector('[data-composer-card]').style.height='280px'});await wait();
  await page.evaluate(()=>{const s=document.querySelector('[data-conversation-scroll]');s.scrollTop=s.scrollHeight});await wait();
  assert(await page.evaluate(()=>document.querySelector('#last').getBoundingClientRect().bottom<=document.querySelector('[data-composer-seat]').getBoundingClientRect().top+1),'growing composer does not consume the last action');
  const before=await page.evaluate(()=>document.querySelector('[data-conversation-scroll]').scrollTop);
  await page.locator('[data-composer-card]').focus();await page.keyboard.type('abc');await wait();
  assert.equal(await page.evaluate(()=>document.querySelector('[data-conversation-scroll]').scrollTop),before,'typing does not induce parent scroll-padding/caret micro-scroll');
  await page.setViewportSize({width:1280,height:900});await wait();
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().compact),false);
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().width),230);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-conversation-content]').getBoundingClientRect().width),738,'1280px window stays inline with readable body');
  await page.setViewportSize({width:1100,height:900});await wait();
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().compact),true);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-conversation-content]').getBoundingClientRect().width),820,'very narrow view gives all body width back');
  await page.setViewportSize({width:1440,height:900});await wait();
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().compact),false);
  await page.evaluate(()=>{fixture.state.nativeWidth=500;fixture.render()});await wait();
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().compact),true,'opening a native resource keeps its own column and compacts inline card');
  assert.equal(await page.evaluate(()=>fixture.state.forbidden),0);
  await page.evaluate(()=>{fixture.state.nativeWidth=0;fixture.render()});await wait();
  assert.equal(await page.evaluate(()=>fixture.attached.getSnapshot().compact),false);
  await page.evaluate(()=>{document.querySelector('[data-dsh-workspace-panel]').setAttribute('data-workspace-pet-active','true');document.querySelector('.dw-pet-reserve').hidden=false});await wait();
  assert.equal(await page.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--dsh-workspace-pet-right'))),34,'pet sits inside the inline card');
  assert.equal(await page.evaluate(()=>window.scrollY),0,'focus stays within the conversation scrollport');
  assert(await page.locator('[data-dsh-workspace-panel]').isVisible());
  const out=verificationOutput('layout',{hostInputs:{conversation,theme}});
  await page.evaluate(()=>{document.querySelector('[data-composer-card]').style.height='108px';document.querySelector('[data-conversation-scroll]').scrollTop=240});await wait();
  await page.screenshot({path:path.join(out,'layout-browser-fixture.png')});
  await page.evaluate(()=>fixture.dispose());await wait();
  assert.equal(await page.locator('[data-dsh-workspace-curtain]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-dsh-workspace-layout')),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['inline measured body width','real capsule thumb drag','last-line clearance','dynamic composer','caret stability','narrow compact entry','native resource independence','pet reserve','teardown'],screenshot:path.join(out,'layout-browser-fixture.png')},null,2));
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
