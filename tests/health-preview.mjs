// Isolated manual fixture: current host React and Toast, synthetic failures only.
import path from 'node:path'
import http from 'node:http'
import {build} from 'esbuild'
import {vendorPrelude} from './host-runtime.mjs'
import {hostPackage} from './helpers/read-installed-asar.mjs'
const root=path.resolve(import.meta.dirname,'..')
const vendor=vendorPrelude('__HealthVendor')
const nativeCss=[...hostPackage('dsh-web-frontend/dist/index.html')
 .matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/g)]
 .map(match=>hostPackage('dsh-web-frontend/dist/'+match[1])).join('\n')
const entry=`
import React,{useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {applyHealthNotifications} from './lib/client/health-toast.mjs';
const listeners=new Set();let snapshot={syncing:false,failures:[]};let renderError;
const state={getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
const set=failures=>{snapshot={syncing:false,failures};for(const fn of listeners)fn()};
const mount=createRoot(document.getElementById('overlay'));
const ctx={modules:{entries:{state},import:async id=>globalThis.__HealthVendor[id],importError:()=>undefined},get:()=>undefined,
 slots:{onEntryError(fn){renderError=fn;return()=>{renderError=null}},inject(_slot,fn){return fn()},register(descriptor,Component){const props=descriptor.inject();mount.render(React.createElement(Component,{...props,useHealth:select=>select(useSyncExternalStore(props.hooks.health.subscribe,props.hooks.health.getSnapshot))}));return()=>mount.unmount()}}};
const dispose=applyHealthNotifications(ctx);
let registration={registrant:'whale-girl',options:{id:'fixture'}};
const status=text=>{document.getElementById('status').textContent=text};
const render=()=>{renderError?.('conversation.input.left',registration,new Error('SYNTHETIC_ERROR_ONLY'));status('已发送同一注册实例的渲染失败事件')};
document.getElementById('render').onclick=render;
document.getElementById('repeat').onclick=render;
document.getElementById('reload').onclick=()=>{registration={...registration};render();status('已重建注册实例并模拟再次失败')};
document.getElementById('load').onclick=()=>{set([{id:'dsh-context',message:'SYNTHETIC_IMPORT_ERROR'}]);status('已发送加载失败事件')};
document.getElementById('healthy').onclick=()=>{set([]);status('正常状态：应清除已恢复的加载提示，不弹成功消息')};
document.getElementById('pending').onclick=()=>{set([{id:'dsh-context',message:'client-modules: dsh-context is waiting for activation'}]);status('等待激活：不产生新提醒')};
document.getElementById('focus').onclick=()=>{document.getElementById('composer').focus();setTimeout(()=>{registration={...registration};render();status('已在输入框保持焦点时模拟失败')},500)};
document.getElementById('dispose').onclick=()=>{dispose();status('已卸载监听；此后按钮不应再显示提示')};
globalThis.healthFixture={set,render,dispose};
`
const built=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'health-fixture.mjs'},bundle:true,write:false,format:'cjs',platform:'browser',target:'es2020',external:['react','react-dom/client'],logLevel:'silent'})
const code=`import '/host/index.js';\nconst require=id=>globalThis.__HealthVendor[id];const module={exports:{}};const exports=module.exports;\n${built.outputFiles[0].text}`
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>插件实际故障提示 · 隔离验证</title><style>${nativeCss}</style><style>
:root{color-scheme:dark;--dsw-alias-bg-base:#151923;--dsw-alias-bg-layer-1:#202633;--dsw-alias-bg-layer-2:#293344;--dsw-alias-label-primary:#e0e6ef;--dsw-alias-label-secondary:#b7c1d0;--dsw-alias-label-tertiary:#8290a5;--dsw-alias-border-l2:#3b4657;--dsw-alias-state-business-primary:#70cad4;--dsw-alias-interactive-bg-hover:#303b4e;--dsw-font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
*{box-sizing:border-box}body{margin:0;background:#151923;color:#e0e6ef;font:15px/1.7 var(--dsw-font-family)}main{max-width:820px;padding:44px 24px;margin:auto}h1{font-size:24px;font-weight:600}p{color:#b7c1d0}.buttons{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}button{font:inherit;border:1px solid #3b4657;border-radius:7px;color:inherit;background:#202633;padding:8px 14px;cursor:pointer}button:hover{background:#293344}button:focus-visible,textarea:focus-visible{outline:2px solid #70cad4;outline-offset:3px}textarea{display:block;margin:12px 0 20px;width:100%;min-height:130px;border:1px solid #3b4657;border-radius:9px;padding:14px;background:#202633;color:inherit;font:inherit}#status{min-height:54px;color:#94b4be}small{color:#8290a5}
</style></head><body data-ds-dark-theme><main><h1>插件实际故障提示</h1><p>本页只模拟故障事件，复用当前 DSH 的原生 Toast。不会连接模型或读取用户会话。</p><div class="buttons"><button id="render">模拟插件渲染失败</button><button id="repeat">重复同一错误</button><button id="reload">重载后再次失败</button><button id="load">模拟插件加载失败</button><button id="healthy">正常 / 已恢复</button><button id="pending">等待依赖</button></div><label for="composer">输入焦点检查</label><textarea id="composer" placeholder="输入内容后触发故障，提示不应抢走焦点。"></textarea><div class="buttons"><button id="focus">聚焦输入框并模拟失败</button><button id="dispose">卸载监听</button></div><p id="status" role="status">就绪：没有故障时保持安静。</p><small>关闭提示后重复相同事件不应再弹。明确恢复只清除加载失败提示。重载产生新的注册实例后允许再次提醒。</small></main><div id="overlay"></div><script type="module" src="/fixture.js"></script></body></html>`
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname
 res.setHeader('Cache-Control','no-store')
 res.setHeader('Content-Type',pathname==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8')
 if(pathname==='/')return res.end(html)
 if(pathname==='/fixture.js')return res.end(code)
 if(pathname==='/host/index.js')return res.end(vendor)
 if(/^\/host\/vendor-[A-Za-z0-9_-]+\.js$/.test(pathname))return res.end(hostPackage('dsh-web-frontend/dist/assets/'+path.basename(pathname)))
 res.writeHead(404);res.end()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
console.log(`Health preview: http://127.0.0.1:${server.address().port}/`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)))
