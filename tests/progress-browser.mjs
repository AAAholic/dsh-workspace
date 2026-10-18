// Isolated Chromium fixture: real component, hooks, and packaged host React/ReactDOM.
// Blocks external network, borrows no user browser/profile, and never reads session files.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { chromium } from './helpers/browser-runtime.mjs'
import { build } from 'esbuild'
import { hostPackage } from './helpers/read-installed-asar.mjs'
import { PROGRESS_CSS } from '../lib/client/styles.mjs'
import { verificationOutput } from './verification-output.mjs'
import { frontend, vendorPrelude } from './host-runtime.mjs'

const root = path.resolve(import.meta.dirname, '..')
const vendor = vendorPrelude('__ProgressVendor')
const conversationCss = JSON.parse(hostPackage('dsh-client-ui-conversation/lib/client.js').match(/const css\$4 = ("[^\n]+")/)[1])
const entry = `
import React, {useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
const {apply,PROGRESS_KIND,PLUGINS_KIND}=globalThis.__TimelineWorkspace;
const source=value=>{let current=value;const listeners=new Set();return {getSnapshot:()=>current,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)},set:value=>{current=value;for(const fn of listeners)fn()}}};
const hook=store=>selector=>selector(useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot));
const reopened=new URL(location.href).searchParams.has('completed');
const noPlan=new URL(location.href).searchParams.has('no-plan');
const taskNames=["Recon: identify yesterday's (Oct 14) interface overhaul artifacts and deployed state",'Deep-dive A: adversarial review of layout and responsive behavior','Deep-dive B: audit progress state and session boundaries','Validate failed and cancelled tasks','Run regression tests and verify native navigation','Summarize findings and remaining risks'];
const initialTodos=taskNames.map((content,i)=>({content,status:reopened?'completed':i===0?'completed':i<3?'in_progress':'pending'}));
const todos=source(noPlan?[]:reopened?null:initialTodos);
const statuses=source(new Map([['selected',{running:!reopened}]]));
const connection=source('connected');const summaries=source({byId:{}});const jobs=source({rows:{selected:[]}});
const data=source({produced:[{path:'/workspace/docs/方案审查.md',seq:12}]});
const turn={turn:4,status:reopened?'closed':'open',end:reopened?{data:{reason:{kind:'completed'}}}:undefined,data:{get:key=>key==='deliverables'?data.getSnapshot():undefined,source:()=>data}};
const call=(id,name,state='start')=>({phase:state,callId:id,name,argsRaw:JSON.stringify({path:'/workspace/src/client/progress.mjs'}),time:1720000000000,subCalls:[]});
const toolNode=root=>({key:root.callId,kind:'tool-call',location:{kind:'step',turn},data:{root},visibility:'visible'});
const planNode=items=>toolNode({kind:'tool-result',callId:'plan',call:{name:'todo_write',argsRaw:JSON.stringify({todos:items})},isError:false,time:1719999999000,seq:10,subCalls:[]});
const finalNode=()=>({key:'final',kind:'assistant-step',location:{kind:'step',turn},data:{blocks:[{kind:'text',text:'核对完成。'}],finalNode:{kind:'assistant',seq:100,interrupted:false}},visibility:'visible'});
const requestNode={key:'user',kind:'user',location:{kind:'turn',turn},data:{content:[{type:'text',text:'我本人做了真实检验，大体上验收通过，只是进度模块不够精简，我认为只需要微调即可'}]},visibility:'visible'};
const completed=planNode(initialTodos);
const toChat=nodes=>({order:nodes.map(n=>n.key),nodes:new Map(nodes.map(n=>[n.key,n])),timeline:{turnOrder:[4],turns:new Map([[4,turn]])}});
const chat=source(toChat(noPlan?[requestNode,...(reopened?[finalNode()]:[])]:reopened?[completed,finalNode()]:[completed,toolNode(call('read','read')),toolNode(call('search','web_search'))]));
const session=source({sessionId:'selected',running:!reopened,openState:'open'});
const catalog=source([]);let watches=0,unwatches=0;const inspected=[];
const assistant=source({enabled:false,writable:true});let mounts=0,unmounts=0;const hosted=[];
const provider={id:'whale-girl',label:'欢迎与助手',setHosted:state=>hosted.push(state),actions:[
 {id:'whale-girl.assistant',label:'鲨鲨助手',kind:'toggle',getSnapshot:assistant.getSnapshot,subscribe:assistant.subscribe,execute(){assistant.set({...assistant.getSnapshot(),enabled:!assistant.getSnapshot().enabled});return true}},
 {id:'whale-girl.fixture-panel',label:'示例面板',kind:'panel',mount(container){mounts++;const panel=document.createElement('section');panel.dataset.fixturePanel='';panel.innerHTML='<h3>插件面板示例</h3><label>流动效果 <input type="checkbox" checked></label><p>插件原设置面板的挂载生命周期夹具。</p>';container.append(panel);return()=>{unmounts++;panel.remove()}}}]};
const request=()=>document.dispatchEvent(new CustomEvent('dsh-workspace:provider',{detail:provider}));document.addEventListener('dsh-workspace:providers-request',request);
const registrations=[];let nativeCalls=0;const native=()=>{nativeCalls++;throw new Error('Layout must not call native sidebar')};
const sidebarMounted=source('selected');const inspectedFiles=[];const nativeInspect=source(id=>inspected.push(id));const binding={sessionId:'selected',ctx:{},session};
const mountedConversationStore={actions:{openView(){}}};
const sessionEntry={store:{},inject(_id,actions){if(actions!==mountedConversationStore.actions)throw Error('Not the mounted store');return{hooks:{inspectCall:nativeInspect}}}};
const chatEntry={options:{id:'chat'},inject:id=>({openFile:path=>inspectedFiles.push({sessionId:id,path})})};
const navigationHost={entriesOfSlot:name=>name==='conversation.session'?[sessionEntry]:name==='conversation.view'?[chatEntry]:[],storeOf:()=>mountedConversationStore,isLive:()=>true,subscribe:()=>()=>{}};
const ctx={slots:{hostFace:()=>navigationHost,inject(_name,fn){return fn()},register(descriptor,component){registrations.push({descriptor,component});return()=>{}}},sidebarRight:{mounted:sidebarMounted,openTab:native,toggleFullscreen:native},sidebarRightTabs:{register:native},layout:{panels:{setRightbar:native}},sessions:{binding:id=>id==='selected'?binding:undefined,list:summaries},uiConversation:{binding:()=>({target:()=>chat})},connection:{state:connection},jobs:{state:jobs,watchRows(){watches++;return()=>unwatches++}},get:()=>undefined};
const disposePlugin=apply(ctx);const registration=registrations.find(row=>row.descriptor.name==='conversation.input.left');
const injected=registration.descriptor.inject('selected');
const props={...injected,sessionId:'selected',useSession:hook(session),useSessionStatus:hook(statuses),useSessions:hook(summaries),useChat:hook(injected.hooks.chat),useConnection:hook(injected.hooks.connection),useJobs:hook(injected.hooks.jobs),useProjection:key=>hook(key==='todos'?todos:catalog)(v=>v)};
const renderRoot=createRoot(document.getElementById('panel'));const render=()=>renderRoot.render(React.createElement(registration.component,props));render();
const updateWidth=()=>{const body=document.querySelector('[data-conversation-content]');body.style.setProperty('--dsh-conversation-column-width',body.getBoundingClientRect().width+'px')};const observer=new ResizeObserver(updateWidth);observer.observe(document.querySelector('[data-conversation-content]'));updateWidth();
globalThis.progressFixture={statuses,connection,summaries,jobs,data,chat,session,todos,catalog,props,call,toolNode,toChat,turn,planNode,finalNode,initialTodos,taskNames,inspected,inspectedFiles,nativeInspect,assistant,provider,registration,ctx,pluginCounts:()=>({mounts,unmounts,hosted}),nativeCalls:()=>nativeCalls,watchCounts:()=>({watches,unwatches}),switchSession(){sidebarMounted.set('next');session.set({sessionId:'next',running:false,blank:true,openState:'open'});chat.set({order:[],nodes:new Map(),timeline:{turnOrder:[],turns:new Map()}});todos.set([]);document.querySelector('[data-conversation-content]').dataset.conversationSession='next';props.sessionId='next';render()},hero(){sidebarMounted.set(null);session.set(undefined);statuses.set(new Map());chat.set({order:[],nodes:new Map(),timeline:{turnOrder:[],turns:new Map()}});document.querySelector('[data-conversation-content]').removeAttribute('data-conversation-session');props.sessionId=undefined;props.useChat=undefined;render()},dispose(){renderRoot.unmount();disposePlugin();observer.disconnect();document.removeEventListener('dsh-workspace:providers-request',request)}};
`
const result = await build({stdin:{contents:entry,resolveDir:root,sourcefile:'progress-fixture.mjs'},bundle:true,
  write:false,format:'cjs',platform:'browser',target:'es2020',external:['react','react-dom','react-dom/client'],logLevel:'silent'})
const code = `import '/host/index.js';\nwindow.__ModuleLoader__={load:({factory})=>{globalThis.__TimelineWorkspace=factory(id=>globalThis.__ProgressVendor[id])}};\nawait import('/workspace/client.js');\nconst require=id=>globalThis.__ProgressVendor[id];const module={exports:{}};const exports=module.exports;\n${result.outputFiles[0].text}`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${conversationCss}
html,body{margin:0;height:100%;background:#0f1624;color:#dbe7f4;font:14px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;--dsw-font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;--dsw-alias-label-primary:#dbe7f4;--dsw-alias-label-secondary:#b6c4d5;--dsw-alias-label-tertiary:#8d9aae;--dsw-alias-border-l2:#263345;--dsw-alias-interactive-bg-hover:#233149;--dsw-alias-state-business-primary:#7aabce;--dsw-alias-brand-primary:#7aabce;--dsw-alias-bg-base:#101a2a;--dsw-alias-bg-layer-1:#18263b;--dsw-alias-bg-layer-2:#23354e;--dsw-alias-bg-layer-3:#263345;--dsw-alias-label-primary-inverted:#f7fbff;--dsw-alias-state-warn-primary:#deb47c;--dsw-alias-state-error-primary:#e88d92}
.fixture-frame{display:grid;grid-template-columns:280px minmax(0,1fr);height:100vh}.fixture-history{background:#131d2d;padding:24px;box-sizing:border-box}.fixture-main{min-width:0;min-height:0;height:100%;position:relative;overflow:hidden}.fixture-heading{height:48px;padding:12px 22px;box-sizing:border-box}.ST7X_W_viewArea{flex:1 0 auto}.fixture-messages{max-width:var(--dsh-chat-content-width,680px);padding:28px 0 36px;margin:auto}.fixture-messages h1{font-size:22px;line-height:1.5;font-weight:500}.fixture-messages p{color:#aebacd;line-height:1.8}.fixture-card{width:min(calc(100% - 32px),var(--dsh-composer-card-max-width,712px));height:108px;box-sizing:border-box;background:#17263b;margin:auto;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:16px}.fixture-tools{display:flex;align-items:center;gap:12px}.ST7X_W_composerSeat{padding-bottom:28px}#panel{display:inline-flex;min-width:0}${PROGRESS_CSS}
</style></head><body data-ds-dark-theme><div class="fixture-frame"><aside class="fixture-history">聊天历史<br><br>当前方案实现<br>插件开发记录<br>研究与审核</aside><main class="fixture-main"><section class="ST7X_W_root" data-phase="active"><header class="fixture-heading">当前方案实现 · 本地隔离夹具</header><div class="ST7X_W_body" data-conversation-content data-conversation-session="selected" data-content-phase="active"><div class="ST7X_W_scrollBody" data-conversation-scroll><div class="ST7X_W_viewArea"><article class="fixture-messages"><h1>正文右侧常显进度卡片</h1><p>卡片附着在当前会话的正文容器。正文与输入框共同左移，为进度、示例面板与助手留出稳定空间。</p><p>进度使用本轮任务节点，支持多个步骤并行。完成节点保留，工具详情按需展开。</p><p>预测入口仍留在输入区，继续保持原来的位置与流程。</p><p>这个隔离夹具验证真实 React 组件、portal、插件状态与清理行为。原生窗口仍由用户进行最终体验验收。</p></article></div><div class="ST7X_W_composerSeat" data-composer-seat><div class="fixture-card" data-composer-card><span>回复或描述任务</span><div class="fixture-tools">＋ <button id="forecast">预测</button><span id="panel" data-slot="conversation.input.left"></span></div></div></div></div></div></section></main></div><script type="module" src="/fixture.js"></script></body></html>`
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost')
  res.setHeader('Content-Type',url.pathname==='/'?'text/html':'text/javascript')
  if(url.pathname==='/'){res.end(html);return}
  if(url.pathname==='/fixture.js'){res.end(code);return}
  if(url.pathname==='/workspace/client.js'){res.end(fs.readFileSync(path.join(root,'lib/client.js')));return}
  if(url.pathname==='/host/index.js'){res.end(vendor);return}
  if(/^\/host\/vendor-[A-Za-z0-9_-]+\.js$/.test(url.pathname)){res.end(hostPackage('dsh-web-frontend/dist/assets/'+path.basename(url.pathname)));return}
  res.writeHead(404);res.end()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:1440,height:1100}})
const errors=[];page.on('pageerror',error=>errors.push(error.message))
await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'?route.continue():route.abort()})
const out=verificationOutput('progress', {hostInputs:{frontend,conversationCss}})
const checks=[];const checked=name=>checks.push(name)
const url=`http://127.0.0.1:${server.address().port}/`
const snapshot=async name=>{await page.locator('.dw-content').evaluate(element=>{element.scrollTop=0});await page.locator('[data-dsh-workspace-panel]').screenshot({path:path.join(out,name+'.png')})}
try{
  await page.goto(url)
  await page.waitForSelector('.dsw-progress-timeline')
  assert.equal(await page.locator('.dsw-progress-subtask[data-status=in_progress]').count(),2)
  const labels=await page.locator('.dsw-progress-node-label').allTextContents()
  assert.deepEqual(await page.locator('.dsw-progress-stage>.dsw-progress-node-row>.dsw-progress-node-label').allTextContents(),['接收任务','分析规划','任务执行','总结返回'])
  assert.equal(await page.locator('.dsw-progress-subtask').count(),5)
  assert.equal(await page.locator('.dsw-progress-count').textContent(),'2/4')
  assert(labels.length===9)
  assert(labels.every(label=>/[\u3400-\u9fff]/.test(label)&&label.length<=24),'labels are concise Chinese')
  assert(!labels.some(label=>/Recon|Deep-dive|yesterday|adversarial/.test(label)))
  assert(await page.locator('.dsw-progress-node-label[title*="yesterday"]').count()>0,'original wording remains available in tooltip')
  assert.equal(await page.locator('.dsw-progress-details').getAttribute('open'),null)
  assert.equal(await page.locator('.dsw-progress-activity').first().isVisible(),false)
  assert.equal(await page.locator('.dsw-progress-files').getAttribute('open'),null)
  const visible=await page.locator('.dsw-progress').innerText()
  assert(!/运行命令|执行命令|读取文件|本轮计划|第 4 轮|已返回|待核验/.test(visible),'default card is a progress overview, not a log')
  checked('shipped bundle renders Chinese task nodes without duplicate headings or visible logs')
  const current=await page.locator('.dsw-progress-subtask[aria-current=step]').count();assert.equal(current,2)
  assert.equal(await page.locator('.dsw-progress-marker').allTextContents().then(values=>values.some(value=>/[✓✔?？]/.test(value))),false,'stages use lit dots without checkmarks or question marks')
  const markers=await page.locator('.dsw-progress-stage>.dsw-progress-node-row>.dsw-progress-marker').evaluateAll(items=>items.map(x=>x.getBoundingClientRect().left))
  assert(markers.every(x=>Math.abs(x-markers[0])<1),'four parent stages share one vertical axis')
  assert.equal(await page.locator('.dsw-progress-node[data-status=completed]').count()>0,true)
  checked('four stages contain concrete indented tasks and use dots instead of checkmarks')
  const geometry=await page.evaluate(()=>{const h=document.querySelector('[data-dsh-workspace-inline-host]').getBoundingClientRect(),b=document.querySelector('[data-conversation-content]').getBoundingClientRect();return{width:h.width,height:h.height,bodyRight:b.right,hostLeft:h.left}})
  assert(geometry.width>=230&&geometry.width<=258&&geometry.height<=341&&geometry.bodyRight<=geometry.hostLeft)
  await snapshot('running-244')
  await page.setViewportSize({width:1280,height:900})
  await page.waitForFunction(()=>document.querySelector('[data-dsh-workspace-inline-host]').getBoundingClientRect().width===230)
  assert(await page.locator('.dsw-progress').evaluate(e=>e.scrollWidth<=e.clientWidth))
  assert.equal(await page.locator('.dsw-progress-node-label').first().evaluate(e=>getComputedStyle(e).fontSize),'13px')
  assert(await page.locator('.dsw-progress-stage').last().evaluate(e=>{
    const row=e.querySelector('.dsw-progress-node-row').getBoundingClientRect();
    const viewport=e.closest('.dw-content').getBoundingClientRect();
    return row.bottom<=viewport.bottom+1;
  }),'all four phases including the final summary stay in the first view with five short subtasks');
  await snapshot('running-230')
  checked('230px card keeps readable labels without horizontal overflow')
  const rail=await page.evaluate(()=>{
    const completed=document.querySelector('.dsw-progress-stage[data-status=completed]');
    const current=document.querySelector('.dsw-progress-stage[data-status=in_progress]');
    const dot=current.querySelector(':scope>.dsw-progress-node-row>.dsw-progress-marker');
    const color=getComputedStyle(completed,'::after').backgroundColor;
    const track=getComputedStyle(current,'::after').backgroundColor;
    const c=document.createElement('canvas').getContext('2d');
    const luma=value=>{c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);const rgb=[...c.getImageData(0,0,1,1).data].slice(0,3).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
    const background=getComputedStyle(document.querySelector('[data-dsh-workspace-panel]')).backgroundColor;
    const a=luma(color),b=luma(background);
    return {color,track,width:getComputedStyle(completed,'::after').width,currentBorder:getComputedStyle(dot).borderTopColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  assert.equal(rail.width,'1px');assert.notEqual(rail.color,rail.track);assert.equal(rail.currentBorder,rail.color);assert(rail.contrast>=3,'highlight rail is clearly distinguishable from the card');
  await page.evaluate(()=>{const f=progressFixture;f.todos.set(f.initialTodos.map((x,i)=>({...x,status:i===0?'pending':i===1?'completed':i===2?'in_progress':x.status})))})
  const separate=await page.locator('.dsw-progress-subtask').evaluateAll(items=>items.slice(0,3).map(item=>({status:item.dataset.status,line:getComputedStyle(item,'::after').backgroundColor})));
  assert.deepEqual(separate.map(row=>row.status),['pending','completed','in_progress']);
  assert.equal(separate[0].line,rail.track);assert.equal(separate[1].line,rail.color);assert.equal(separate[2].line,rail.track);
  await page.evaluate(()=>progressFixture.todos.set(progressFixture.initialTodos));
  checked('restrained one-pixel segments light only the completed local task and never bridge an unfinished gap')
  if(process.argv.includes('--visual-only')){
    const markers=await page.evaluate(()=>{
      const stage=document.querySelector('.dsw-progress-stage>.dsw-progress-node-row>.dsw-progress-marker');
      const sub=document.querySelector('.dsw-progress-subtask>.dsw-progress-node-row>.dsw-progress-marker');
      const current=document.querySelector('.dsw-progress-node[data-status=in_progress]>.dsw-progress-node-row>.dsw-progress-marker');
      return {stage:stage.getBoundingClientRect().width,subtask:sub.getBoundingClientRect().width,
        stageRow:stage.parentElement.getBoundingClientRect().height,subtaskRow:sub.parentElement.getBoundingClientRect().height,
        glow:getComputedStyle(current).boxShadow};
    });
    assert.equal(markers.stage,10);assert.equal(markers.subtask,7);assert.equal(markers.glow,'none');
    assert(markers.stageRow>=24&&markers.subtaskRow>=22);
    await page.locator('.dsw-progress-details>summary').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.dsw-progress-details').open);
    await page.locator('.dsw-progress-activity button').first().click();assert.equal(await page.evaluate(()=>progressFixture.inspected.length),1);
    checked('smaller markers retain row size, keyboard disclosure and native tool click targets');
    const report={at:new Date().toISOString(),passed:true,scope:'visual-only; synthetic browser fixture',checks,geometry,rail,markers,errors};
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }else{
  await page.locator('.dsw-progress-details>summary').focus();await page.keyboard.press('Enter')
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-details').open)
  assert.equal(await page.locator('.dsw-progress-activity button').first().isVisible(),true)
  await page.locator('.dsw-progress-activity button').first().click()
  assert.equal(await page.evaluate(()=>progressFixture.inspected.length),1)
  await page.evaluate(()=>{const f=progressFixture;f.chat.set(f.toChat([f.planNode(f.initialTodos),...Array.from({length:11},(_,i)=>f.toolNode({kind:'tool-result',callId:'record-'+i,call:{name:'read',argsRaw:'{}'},isError:i===0,time:1720000000000+i,seq:20+i,subCalls:[]}))]))})
  assert.equal(await page.locator('.dsw-progress-activity').count(),12)
  assert.equal(await page.locator('.dsw-progress-activity[data-state=error]').count(),1)
  await page.locator('.dsw-progress-details>summary').click()
  checked('keyboard disclosure preserves all twelve records and native tool navigation')
  await page.evaluate(()=>progressFixture.data.set({presented:[{path:'/workspace/report.pdf',seq:40,index:0}]}))
  await page.locator('.dsw-progress-files>summary').click()
  await page.getByTitle('查看report.pdf',{exact:true}).click()
  assert.deepEqual(await page.evaluate(()=>progressFixture.inspectedFiles),[{sessionId:'selected',path:'/workspace/report.pdf'}])
  await page.locator('.dsw-progress-files>summary').click()
  checked('files stay collapsed and use the native session-qualified route')
  await page.evaluate(()=>{const f=progressFixture;const next=f.initialTodos.map((x,i)=>({...x,status:i<2?'completed':i===2?'in_progress':'pending'}));f.todos.set(next);f.chat.set(f.toChat([f.planNode(next)]))})
  await page.waitForFunction(()=>document.querySelectorAll('.dsw-progress-subtask[data-status=in_progress]').length===1)
  assert.equal(await page.locator('.dsw-progress-subtask[aria-current=step] .dsw-progress-node-label').textContent(),labels.find(x=>x.includes('进度')))
  checked('completing a task advances the highlighted node while keeping finished nodes')
  await page.evaluate(()=>progressFixture.statuses.set(new Map([['selected',{running:true,pendingInteraction:{kind:'question',sessionId:'selected'}}]])))
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent.includes('等待'))
  assert.equal(await page.locator('.dsw-progress-node[data-status=waiting]').count()>0,true)
  assert.equal(await page.locator('.dsw-progress-node[data-status=in_progress]').count(),0)
  await snapshot('waiting')
  checked('waiting for the user suspends the corresponding task marker')
  await page.evaluate(()=>{const f=progressFixture;f.connection.set('disconnected')})
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent.includes('连接'))
  assert.equal(await page.locator('.dsw-progress-node[data-status=in_progress]').count(),0)
  assert.equal(await page.locator('.dsw-progress-marker').allTextContents().then(values=>values.some(value=>/[?？]/.test(value))),false);
  assert.match(await page.locator('.dsw-progress').innerText(),/同步中/);
  assert.doesNotMatch(await page.locator('.dsw-progress').innerText(),/待核验/);
  checked('disconnection pauses running markers with a neutral syncing label and no question marks')
  await page.evaluate(()=>{const f=progressFixture;f.connection.set('connected');f.statuses.set(new Map([['selected',{running:false}]]));f.session.set({sessionId:'selected',running:false,openState:'open'});f.turn.status='closed';f.turn.end={data:{reason:{kind:'aborted'}}};f.chat.set(f.toChat([f.planNode(f.todos.getSnapshot())]))})
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent.includes('停止'))
  assert.equal(await page.locator('.dsw-progress-node[data-status=stopped]').count()>0,true)
  assert(await page.locator('.dsw-progress-node:not([data-status=completed])').count()>0)
  await snapshot('stopped')
  checked('stopped work keeps completed nodes and does not manufacture completion')
  await page.evaluate(()=>{const f=progressFixture;f.turn.end={data:{reason:{kind:'completed'}}};f.chat.set(f.toChat([f.planNode(f.todos.getSnapshot()),f.finalNode()]))})
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent==='已完成')
  assert.equal(await page.locator('.dsw-progress-node:not([data-status=completed])').count(),0)
  assert.doesNotMatch(await page.locator('.dsw-progress').innerText(),/待核验|同步中/);
  checked('a normal ending closes the whole process even when authored plan items remain open')
  await page.goto(url+'?completed=1')
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline')?.textContent==='已完成')
  const completedLabels=await page.locator('.dsw-progress-node-label').allTextContents()
  assert.equal(completedLabels.length,labels.length)
  assert.equal(await page.locator('.dsw-progress-node:not([data-status=completed])').count(),0)
  assert.equal(await page.locator('.dsw-progress-details').getAttribute('open'),null)
  await snapshot('completed-230')
  await page.reload()
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline')?.textContent==='已完成')
  assert.deepEqual(await page.locator('.dsw-progress-node-label').allTextContents(),completedLabels)
  checked('cold reload reconstructs the complete timeline without a live plan projection')
  await page.getByRole('button',{name:'插件',exact:true}).click()
  await page.getByRole('button',{name:'进度',exact:true}).click()
  assert.equal(await page.locator('.dsw-progress-node[data-status=completed]').count(),completedLabels.length)
  checked('switching card tabs preserves the completed process for review')
  await page.goto(url+'?completed=1&no-plan=1')
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline')?.textContent==='已答复')
  assert.equal(await page.locator('.dsw-progress-subtask').count(),0,'a request is reply context, not an execution task')
  assert.equal(await page.locator('[data-node-id="execution"]').getAttribute('data-status'),'completed')
  assert.equal(await page.locator('[data-node-id="summary"]').getAttribute('data-status'),'completed')
  assert.equal(await page.locator('.dsw-progress-count').count(),0,'no-plan replies must not imply a task completion fraction')
  await page.locator('.dsw-progress-details>summary').click()
  assert.match(await page.locator('[aria-label="完整原文"]').textContent(),/进度模块不够精简/)
  await page.locator('.dsw-progress-details>summary').click()
  await snapshot('no-plan-reply-230')
  assert.equal(await page.locator('.dsw-progress-stage:not([data-status=completed])').count(),0);
  assert.doesNotMatch(await page.locator('.dsw-progress').innerText(),/待核验|同步中/);
  checked('no-plan reply completes the four-stage overview and keeps its original request in details')
  await page.evaluate(()=>{
    const f=progressFixture, prior=f.chat.getSnapshot().nodes.get('user');
    const question={...prior,data:{...prior.data,content:[{type:'text',text:'这个项目近九天，哪些更新值得用？'}]}};
    f.chat.set(f.toChat([question,f.finalNode()]));
  });
  await page.waitForFunction(()=>document.querySelector('[data-node-id="summary"]>.dsw-progress-node-row>.dsw-progress-node-label').title.includes('这个项目近九天，哪些更新值得用？'));
  checked('reply context preserves the entire original question without rewriting it as a completed task')
  await page.evaluate(()=>{
    const f=progressFixture, prior=f.chat.getSnapshot().nodes.get('user');
    const request={...prior,data:{...prior.data,content:[{type:'text',text:'生成销售报表并保存为 report.xlsx'}]}};
    const final=f.finalNode();final.data.blocks=[{kind:'text',text:'无法读取源文件，因此尚未生成或保存报表。请补充文件后再继续。'}];
    f.chat.set(f.toChat([request,final]));
  });
  await page.waitForFunction(()=>document.querySelector('[data-node-id="summary"]>.dsw-progress-node-row>.dsw-progress-node-label').title.includes('report.xlsx'));
  assert.equal(await page.locator('.dsw-progress-headline').textContent(),'已答复');
  assert.equal(await page.locator('[data-node-id="execution"]').getAttribute('data-status'),'completed');
  await snapshot('unfulfilled-request')
  checked('normal reply wording remains in the conversation while the overview tracks the completed process')
  await page.evaluate(()=>{
    const f=progressFixture;
    const command=f.toolNode({kind:'tool-result',callId:'screenshot-command',call:{name:'bash',argsRaw:JSON.stringify({command:'cd "/Users/person/project" && cat "plugins/dsh-workspace/package.json"'})},isError:false,time:1720000000010,seq:10});
    f.chat.set(f.toChat([command,f.finalNode()]));
  });
  await page.waitForFunction(()=>document.querySelectorAll('.dsw-progress-subtask').length===1);
  assert.match(await page.locator('.dsw-progress-subtask .dsw-progress-node-label').textContent(),/^(打开|检查) package\.json$/);
  assert.equal(await page.locator('.dsw-progress-headline').textContent(),'已答复');
  assert.equal(await page.locator('.dsw-progress-stage:not([data-status=completed])').count(),0);
  const screenshotCard=await page.locator('.dsw-progress').innerText();
  assert.doesNotMatch(screenshotCard,/待核验|同步中|执行命令|已返回|[?？]|\/Users\/|plugins\//);
  assert(await page.locator('.dsw-progress').evaluate(element=>element.scrollWidth<=element.clientWidth));
  assert(await page.locator('.dsw-progress-subtask .dsw-progress-node-label').evaluate(element=>{
    const label=element.getBoundingClientRect(),row=element.closest('.dsw-progress-node-row').getBoundingClientRect();
    return element.scrollWidth<=element.clientWidth&&label.left>=row.left&&label.right<=row.right+1;
  }),'the file action fits within the 230px card without horizontal truncation');
  await snapshot('screenshot-command-fixed-230');
  checked('the reported screenshot now shows a clean completed reply and a short package.json action without paths or question marks');
  await page.evaluate(()=>{
    const f=progressFixture;
    const settled=(id,name,args,seq)=>f.toolNode({kind:'tool-result',callId:id,call:{name,argsRaw:JSON.stringify(args)},isError:false,time:1720000000000+seq,seq});
    const records=[...Array.from({length:8},(_,i)=>settled('read-'+i,'read',{path:'/workspace/source-'+i+'.mjs'},i+2)),
      settled('web-1','web_search',{query:'版本更新记录'},12),settled('web-2','web_fetch',{url:'https://example.test/releases'},13),
      settled('cmd-1','bash',{command:'git diff --stat'},14),settled('cmd-2','exec',{cmd:'npm test'},15),settled('cmd-3','bash',{command:'git status --short'},16)];
    f.chat.set(f.toChat([...records,f.finalNode()]));
  });
  await page.waitForFunction(()=>document.querySelectorAll('.dsw-progress-subtask').length===4);
  const noPlanLabels=await page.locator('.dsw-progress-subtask .dsw-progress-node-label').allTextContents();
  assert(noPlanLabels.some(label=>/example.test/.test(label)));
  assert(noPlanLabels.some(label=>/测试/.test(label)));
  assert(noPlanLabels.every(label=>!/执行命令|查阅资料|等8项|\/workspace\//.test(label)));
  assert.equal(await page.locator('.dsw-progress-subtask .dsw-progress-node-status').count(),0);
  assert.equal(await page.locator('[data-node-id="execution"]').getAttribute('data-status'),'completed');
  assert.equal(await page.locator('.dsw-progress-count').count(),0);
  assert.equal(await page.locator('[data-node-id="activity:cmd-3"] .dsw-progress-node-label').evaluate(element=>element.title.includes('[cmd-3]')),true);
  await page.locator('.dsw-progress-details>summary').click();
  assert.equal(await page.locator('.dsw-progress-activity').count(),13);
  await page.locator('.dsw-progress-details>summary').click();
  await snapshot('no-plan-actions-230');
  checked('the overview keeps four recent concrete actions while details retain all thirteen calls');
  await page.evaluate(()=>progressFixture.todos.set([
    {content:'Implement responsive navigation',status:'completed'},
    {content:'Research customer requirements',status:'completed'},
    {content:'Refactor account settings panel',status:'completed'},
    {content:'Review progress module without UI changes',status:'completed'},
  ]));
  await page.waitForFunction(()=>document.querySelectorAll('.dsw-progress-subtask').length===4);
  assert.deepEqual(await page.locator('.dsw-progress-subtask .dsw-progress-node-label').allTextContents(),['实现：响应式导航','调研：用户需求','重构：账户设置面板','审查进度模块']);
  await page.locator('.dsw-progress-details>summary').click();
  assert.match(await page.locator('[aria-label="完整原文"]').textContent(),/Review progress module without UI changes/);
  await page.locator('.dsw-progress-details>summary').click();
  checked('common English task objects have concise Chinese labels and complete constraints in details');
  await page.setViewportSize({width:1000,height:650})
  await page.waitForSelector('[data-dsh-workspace-inline-host][data-inline-compact]')
  await page.getByRole('button',{name:'进度与插件',exact:true}).click()
  await page.waitForSelector('.dsw-progress-timeline')
  assert(await page.evaluate(()=>{const h=document.querySelector('[data-dsh-workspace-inline-host]').getBoundingClientRect(),b=document.querySelector('[data-conversation-content]').getBoundingClientRect();return h.bottom<=b.top+1&&h.height<=340}))
  checked('compact mode still occupies safe space below the native header')
  await page.setViewportSize({width:1440,height:1100})
  await page.waitForFunction(()=>!document.querySelector('[data-dsh-workspace-inline-host]').hasAttribute('data-inline-compact'))
  await page.evaluate(()=>progressFixture.switchSession())
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent==='等待开始')
  assert.equal(await page.locator('.dsw-progress-node').count(),0)
  await page.evaluate(()=>progressFixture.hero())
  await page.waitForFunction(()=>document.querySelector('.dsw-progress-headline').textContent==='选择聊天')
  assert.equal(await page.locator('.dsw-progress-node').count(),0)
  checked('switching sessions and the empty home view never inherit another task timeline')
  assert.equal(await page.evaluate(()=>progressFixture.nativeCalls()),0)
  await page.evaluate(()=>progressFixture.dispose())
  const watches=await page.evaluate(()=>progressFixture.watchCounts());assert.equal(watches.watches,watches.unwatches)
  assert.equal(await page.locator('[data-dsh-workspace-inline-host]').count(),0)
  assert.deepEqual(errors,[])
  checked('cleanup releases live subscriptions with no runtime errors')
  const report={at:new Date().toISOString(),passed:true,evidence:'Isolated Chromium loading the generated workspace bundle with installed host React and CSS; synthetic session data, not native acceptance.',checks,labels,completedLabels,noPlanLabels,geometry,rail,errors}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
