// Exact installed footer render function + native host React/Tooltip. The source
// values are synthetic; no provider balance request or user session is accessed.
import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import { chromium } from './helpers/browser-runtime.mjs'
import { build } from 'esbuild'
import { hostPackage } from './helpers/read-installed-asar.mjs'
import { verificationOutput } from './verification-output.mjs'
import { frontend, vendorPrelude } from './host-runtime.mjs'

const root = path.resolve(import.meta.dirname, '..')
const contextRoot = process.env.DSH_CONTEXT_ROOT || path.join(homedir(), '.dsh/profiles/desktop/node_modules/dsh-context')
const version = JSON.parse(fs.readFileSync(path.join(contextRoot, 'package.json'))).version
assert.equal(version, '0.56.2-dshrc2.5', 'recheck footer contract before using a newer installed context plugin')
const source = fs.readFileSync(path.join(contextRoot, 'lib/client.js'), 'utf8')
const region = source.slice(source.indexOf('function sidebarContextOf('), source.indexOf('const sidebarStatusCss = '))
assert(region.includes('function makeSidebarStatus('))
const originalCss = JSON.parse(source.match(/const sidebarStatusCss = ("[^\n]+");/)[1])
const vendor = vendorPrelude('__ContextVendor')
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import * as primitives from '@deepseek-ai/dsh-client-ui-primitives';
import {installContextLayout} from ${JSON.stringify(path.join(root, 'lib/client/context-layout.mjs'))};
const react=React;const _deepseek_ai_dsh_client_ui_primitives=primitives;
const contextPressureOf=value=>value;
let projectedTokens=30720;
const sessionsSnapshotOf=()=>({byId:{selected:{id:'selected',retainedBy:{mainView:1},running:false}},projectionsBySession:{selected:{values:{contextPressure:{projectedTokens,contextWindow:256000}}}}});
const useSelectedProvider=()=> 'deepseek-account';const balanceEntryOf=value=>value?.balances?.[0]??null;const symbolOf=()=> '¥';
let clicks=0;const overviewStore={set:()=>clicks++};
${region}
const balance={status:'ready',provider:'deepseek-account',value:{source:'account',balances:[{currency:'cny',total:12345.67,toppedUp:12000,granted:345.67}]}};
const monitor={subscribe:()=>()=>{},getSnapshot:()=>balance,selectProvider:()=>{},refresh:()=>{}};
const settings={store:{subscribe:()=>()=>{}},sidebarStatus:()=> 'show'};
const Component=makeSidebarStatus({locale:{getLocale:()=>({active:'zh'})}}, {}, settings, monitor);
let wide=true;const root=createRoot(document.getElementById('mount'));
const render=()=>root.render(React.createElement(Component,{wide,usePanelInfo:()=>({activePanelId:null})}));render();
const dispose=installContextLayout();
globalThis.contextFixture={setWide:value=>{wide=value;render()},setLargeValues(){projectedTokens=256000;balance.value.balances[0].total=987654321.12;render()},clicks:()=>clicks,dispose,unmount:()=>root.unmount()};
`
const compiled = await build({stdin:{contents:entry,resolveDir:root,sourcefile:'context-fixture.mjs'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',external:['react','react-dom/client','@deepseek-ai/dsh-client-ui-primitives'],logLevel:'silent'})
const code = `import '/host/index.js';\nconst require=id=>globalThis.__ContextVendor[id];const module={exports:{}};const exports=module.exports;\n${compiled.outputFiles[0].text}`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${originalCss}
html,body{margin:0;min-height:100%;font:14px -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:#101a2a;color:#eef5ff;--dsw-alias-bg-layer-1:#18263b;--dsw-alias-label-primary:#eef5ff;--dsw-alias-label-secondary:#b6c4d5;--dsw-alias-border-l2:#263345;--dsw-alias-border-l1:#526780;--dsw-alias-brand-primary:#7aabce;--dsw-alias-interactive-bg-hover:#233149}
#sidebar{width:264px;box-sizing:border-box;padding:12px;margin-top:400px}#mount{width:100%;min-width:0;display:flex;flex-direction:column}
</style></head><body><aside id="sidebar"><div id="mount" class="lc-sidebar-footer"></div></aside><script type="module" src="/fixture.js"></script></body></html>`
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost')
  res.setHeader('Content-Type',url.pathname==='/'?'text/html':'text/javascript')
  if(url.pathname==='/'){res.end(html);return}
  if(url.pathname==='/fixture.js'){res.end(code);return}
  if(url.pathname==='/host/index.js'){res.end(vendor);return}
  if(/^\/host\/vendor-[A-Za-z0-9_-]+\.js$/.test(url.pathname)){res.end(hostPackage('dsh-web-frontend/dist/assets/'+path.basename(url.pathname)));return}
  res.writeHead(404);res.end()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let browser
const checks=[],errors=[]
const check=(name,success)=>{assert(success,name);checks.push(name)}
try{
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
  const page=await browser.newPage({viewport:{width:1000,height:800}})
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.locator('.lc-sidebar-status-context').waitFor()
  for(const width of [216,264,280]){
    await page.evaluate(width=>document.getElementById('sidebar').style.width=width+'px',width)
    check(`${width}px keeps both the context and balance visible without overflow`,await page.evaluate(()=>{
      const status=document.querySelector('.lc-sidebar-status'),a=document.querySelector('.lc-sidebar-status-context'),b=document.querySelector('.lc-sidebar-status-balance'),svg=a.querySelector('svg'),copy=a.querySelector('.lc-sidebar-status-copy'),value=b.querySelector('.lc-sidebar-status-value');
      const s=status.getBoundingClientRect(),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      return status.scrollWidth<=status.clientWidth&&ar.right<br.left&&br.right<=s.right&&svg.getBoundingClientRect().width===23&&copy.textContent.includes('12%')&&value.textContent==='¥12345.67'&&value.scrollWidth<=value.clientWidth;
    }))
  }
  await page.evaluate(()=>document.getElementById('sidebar').style.width='216px')
  const out=verificationOutput('context-footer', {hostInputs: {context: source, frontend}})
  await page.locator('#sidebar').screenshot({path:path.join(out,'footer-216.png')})
  await page.locator('.lc-sidebar-status-context').hover()
  await page.getByRole('tooltip').waitFor()
  check('native context portal tooltip and click remain functional',await page.getByRole('tooltip').textContent().then(text=>text.includes('30,720 / 256,000')))
  await page.locator('.lc-sidebar-status-context').click()
  check('context overview handler still runs once',await page.evaluate(()=>contextFixture.clicks()===1))
  await page.locator('.lc-sidebar-status-balance').hover()
  await page.getByRole('tooltip').waitFor()
  check('native balance tooltip retains recharge and bonus details',await page.getByRole('tooltip').textContent().then(text=>text.includes('充值')&&text.includes('赠送')))
  await page.mouse.move(800,20)
  await page.evaluate(()=>{
    document.getElementById('sidebar').style.width='216px';
    document.querySelector('.lc-sidebar-status-balance .lc-sidebar-status-label').textContent='Very long provider account balance label';
  })
  check('long provider label truncates within its own column and leaves the value clear',await page.evaluate(()=>{
    const label=document.querySelector('.lc-sidebar-status-balance .lc-sidebar-status-label'),status=document.querySelector('.lc-sidebar-status');
    return getComputedStyle(label).textOverflow==='ellipsis'&&label.scrollWidth>label.clientWidth&&status.scrollWidth<=status.clientWidth&&label.getBoundingClientRect().right<=status.getBoundingClientRect().right;
  }))
  await page.evaluate(()=>contextFixture.setLargeValues())
  await page.waitForFunction(()=>document.querySelector('.lc-sidebar-status-balance .lc-sidebar-status-value').textContent==='¥987654321.12')
  check('216px keeps 100% readable and large amounts inside their balance column at the original digit size',await page.evaluate(()=>{
    const status=document.querySelector('.lc-sidebar-status'),percent=document.querySelector('.lc-sidebar-status-context .lc-sidebar-status-value'),amount=document.querySelector('.lc-sidebar-status-balance .lc-sidebar-status-value');
    return status.scrollWidth<=status.clientWidth&&percent.textContent==='100%'&&percent.scrollWidth<=percent.clientWidth&&getComputedStyle(amount).fontSize==='12px'&&getComputedStyle(amount).textOverflow==='ellipsis'&&amount.getBoundingClientRect().right<=status.getBoundingClientRect().right&&amount.textContent==='¥987654321.12';
  }))
  await page.locator('.lc-sidebar-status-balance').hover()
  await page.getByRole('tooltip').waitFor()
  check('the real tooltip retains the complete large amount',await page.getByRole('tooltip').textContent().then(text=>text.includes('987654321.12')))
  await page.mouse.move(800,20)
  await page.evaluate(()=>{contextFixture.setWide(false);document.getElementById('sidebar').style.width='72px'})
  await page.locator('.lc-sidebar-status-rail').waitFor()
  const rail=await page.locator('.lc-sidebar-status-rail').evaluate(node=>({height:node.getBoundingClientRect().height,columns:getComputedStyle(node).gridTemplateColumns,padding:getComputedStyle(node).padding,copy:getComputedStyle(node.querySelector('.lc-sidebar-status-copy')).display,font:getComputedStyle(node.querySelector('.lc-sidebar-status-value')).fontSize}))
  await page.evaluate(()=>contextFixture.dispose())
  check('collapsed rail geometry and typography remain unchanged on unloading',await page.locator('.lc-sidebar-status-rail').evaluate((node,before)=>{
    const current={height:node.getBoundingClientRect().height,columns:getComputedStyle(node).gridTemplateColumns,padding:getComputedStyle(node).padding,copy:getComputedStyle(node.querySelector('.lc-sidebar-status-copy')).display,font:getComputedStyle(node.querySelector('.lc-sidebar-status-value')).fontSize};return JSON.stringify(current)===JSON.stringify(before);
  },rail))
  await page.evaluate(()=>{contextFixture.setWide(true);document.getElementById('sidebar').style.width='216px'})
  await page.locator('.lc-sidebar-status:not(.lc-sidebar-status-rail)').waitFor()
  check('unloading restores the exact owner grid ratio and removes the compatibility style',await page.evaluate(()=>{
    const status=document.querySelector('.lc-sidebar-status'),columns=getComputedStyle(status).gridTemplateColumns.split(' ').map(parseFloat);return !document.querySelector('[data-dsh-workspace-context-layout]')&&Math.abs(columns[0]/columns[1]-1.35)<.01;
  }))
  check('no browser runtime errors',errors.length===0)
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({installedContextVersion:version,evidence:'isolated native React/Tooltip with exact installed footer renderer and synthetic state; not native acceptance',checks,errors},null,2)+'\n')
  console.log(`[context-layout] ${checks.length} checks passed; ${path.join(out,'report.json')}`)
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
