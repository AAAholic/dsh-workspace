import React from 'react'
import {createPortal} from 'react-dom'
import {ActionRegistry,connectProviders} from './action-registry.mjs'
import {ActionButton,PluginPanel,QuickActions,PLUGIN_CSS,useActions,useActionState} from './plugin-panel.mjs'
import {ProgressPanel} from './progress.mjs'
import {PROGRESS_CSS} from './styles.mjs'
import {installWorkspaceLayout,attachInlineWorkspace} from './layout.mjs'
import {installNarrowLeftSidebar} from './left-sidebar.mjs'
import {installContextLayout} from './context-layout.mjs'
import {resolveProgressNavigation} from './navigation.mjs'
import {applyHealthNotifications} from './health-toast.mjs'
import {createPluginHealth} from './plugin-health.mjs'

export const name = 'dsh-workspace'
export const inject = []
export const PROGRESS_DEPENDENCIES = ['slots','sessions','uiConversation','connection','jobs','layout']
export const PROGRESS_KIND = 'dsh-workspace.progress'
export const PLUGINS_KIND = 'dsh-workspace.plugins'
const el = React.createElement
const EMPTY_GEOMETRY=Object.freeze({width:244,compact:false,readingWidth:720,maxExpandedHeight:340,canExpand:true})
const ABSENT=Object.freeze({subscribe:()=>()=>{},getSnapshot:()=>EMPTY_GEOMETRY})

class ViewBoundary extends React.Component {
  state = {failed:false}
  static getDerivedStateFromError() { return {failed:true} }
  componentDidCatch() { this.props.onError?.() }
  render() { return this.state.failed ? el('p',{role:'status'},'工作区视图暂不可用，请收起后重新打开。') : this.props.children }
}

function InlineWorkspace(props) {
  const inspectSource=props.inspectCallSource
  const openCall=React.useSyncExternalStore(inspectSource.subscribe,inspectSource.getSnapshot,inspectSource.getSnapshot)
  const anchor=React.useRef(null)
  const [attached,setAttached]=React.useState(null)
  const [page,setPage]=React.useState(PROGRESS_KIND)
  const [actionId,setActionId]=React.useState(null)
  const [collapsed,setCollapsed]=React.useState(false)
  const [expanded,setExpanded]=React.useState(false)
  const [spaceNotice,setSpaceNotice]=React.useState(false)
  const reopen=React.useRef(null)
  const cardFocused=React.useRef(false)
  const source=attached || ABSENT
  const geometry=React.useSyncExternalStore(source.subscribe,source.getSnapshot,source.getSnapshot)
  React.useEffect(()=>{if(geometry.compact)setExpanded(false)},[geometry.compact])
  const heightLimited=geometry.compact && !geometry.canExpand
  React.useLayoutEffect(()=>{
    if(heightLimited){setExpanded(false);setSpaceNotice(true)}else setSpaceNotice(false)
  },[heightLimited])
  const actions=useActions(props.registry)
  const companion=actions.find(action=>action.id==='whale-girl.assistant')
  const companionState=useActionState(companion)
  React.useLayoutEffect(()=>{
    const host=attachInlineWorkspace(anchor.current,{sessionId:props.sessionId})
    setAttached(host)
    if(!host)return
    const release=props.registry.claimHost(host)
    return()=>{release();host.dispose()}
  },[props.sessionId,props.registry])
  React.useLayoutEffect(()=>{
    if(!attached)return
    attached.element.toggleAttribute('data-inline-expanded',geometry.compact && expanded && !heightLimited)
    attached.element.toggleAttribute('data-inline-collapsed',!geometry.compact && collapsed)
    attached.element.parentElement?.toggleAttribute('data-inline-collapsed',!geometry.compact && collapsed)
  },[attached,geometry.compact,expanded,collapsed,heightLimited])
  const openAction=next=>{setPage(PLUGINS_KIND);setActionId(next);setCollapsed(false);setExpanded(geometry.compact && !heightLimited)}
  React.useEffect(()=>{
    const open=event=>{
      if(!attached || !attached.element.isConnected || !attached.element.getClientRects().length)return
      openAction(event.detail?.id || null)
    }
    document.addEventListener('dsh-workspace:select-action',open)
    return()=>document.removeEventListener('dsh-workspace:select-action',open)
  },[attached,geometry.compact,heightLimited])
  const compact=geometry.compact && (!expanded || heightLimited)
  const closed=compact || collapsed
  React.useLayoutEffect(()=>{
    if(closed && cardFocused.current && document.activeElement===document.body)reopen.current?.focus()
  },[closed])
  const plugins=page===PLUGINS_KIND
  const card=el('section',{'data-dsh-workspace-panel':'','data-workspace-visible':true,
    'data-workspace-pet-active':companionState.enabled===true,
    'data-workspace-kind':page,'aria-label':'进度与插件卡片',
    onFocusCapture:()=>{cardFocused.current=true},
    onBlurCapture:event=>{if(event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))cardFocused.current=false}},
    el('div',{className:'dw-card-header'},
      closed ? el('button',{ref:reopen,type:'button',className:'dw-card-reopen',
        title:heightLimited?'缩短输入内容或增高窗口后可展开；助手开关仍可用':'展开进度与插件',
        'aria-disabled':heightLimited || undefined,
        onClick:()=>{if(heightLimited){setSpaceNotice(true);return}setCollapsed(false);setExpanded(geometry.compact)}},spaceNotice?'空间不足，暂已收起':'进度与插件') :
      el('div',{className:'dw-card-tabs','aria-label':'卡片内容'},
        el('button',{type:'button','aria-pressed':!plugins,onClick:()=>{setPage(PROGRESS_KIND);setActionId(null)}},'进度'),
        el('button',{type:'button','aria-pressed':plugins,onClick:()=>{setPage(PLUGINS_KIND);setActionId(null)}},'插件')),
      closed && heightLimited && companion && el('div',{className:'dw-closed-assistant',title:'鲨鲨助手'},el(ActionButton,{action:companion,openAction,compact:true})),
      !closed && el('button',{type:'button',className:'dw-card-collapse','aria-label':'收起进度卡片',onClick:()=>geometry.compact?setExpanded(false):setCollapsed(true)},'−')),
    !closed && el('div',{className:'dw-content'},
      el(ViewBoundary,{key:props.sessionId+':'+page,onError:props.onViewError},plugins ?
        el(PluginPanel,{registry:props.registry,openAction,actionId}) :
        el(ProgressPanel,{...props,openCall}))),
    !closed && !plugins && el('div',{className:'dw-controls'},el(QuickActions,{registry:props.registry,openAction})))
  return el(React.Fragment,null,
    el('span',{ref:anchor,'data-workspace-anchor':'',style:{display:'none'},'aria-hidden':true}),
    attached && createPortal(card,attached.element))
}

export function applyWorkspace(ctx, onViewError = () => {}) {
  const registry=new ActionRegistry(error=>console.warn('dsh-workspace provider lifecycle',error?.name||'Error'),false)
  const disposers=[]
  const style=document.createElement('style')
  style.dataset.dshWorkspaceStyle=''
  style.textContent=PLUGIN_CSS+'\n'+PROGRESS_CSS+'\n'+`
    .dw-content>.dsw-progress{padding:0}
    .dw-card-header{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
    .dw-card-tabs{display:flex;gap:4px}.dw-card-tabs button{border:0;background:transparent;padding:4px 8px;font-size:14px}
    .dw-card-tabs button[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
    [data-dsh-workspace-panel] .dw-card-collapse{border:0;background:transparent;padding:2px 7px;font-size:18px}
    [data-dsh-workspace-panel] .dw-card-reopen{border:0;background:transparent;text-align:left;padding:2px 0;font-size:14px}
    [data-dsh-workspace-panel] .dw-card-reopen[aria-disabled=true]{font-size:12px;cursor:default}
    .dw-closed-assistant{flex:0 0 98px;min-width:0}.dw-closed-assistant .dw-action-compact{min-width:0}
    .dw-closed-assistant .dw-action-button{min-height:28px;padding:3px 5px;font-size:12px;gap:5px;white-space:nowrap}
    .dw-card-header:has(.dw-closed-assistant){position:relative}
    .dw-card-header:has(.dw-closed-assistant .dw-action-feedback){padding-bottom:20px}
    .dw-closed-assistant .dw-action-feedback{position:absolute;left:10px;right:10px;bottom:2px;padding:0;font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    [data-inline-collapsed] .dw-card-header,[data-inline-compact]:not([data-inline-expanded]) .dw-card-header{border-bottom:0}
    .dw-content{padding:8px 10px;scrollbar-width:thin}
    .dw-controls{flex:none;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2)}
    .dw-controls .dw-quick-actions{padding:0;margin:0;border:0;gap:6px;flex-wrap:nowrap}
    .dw-controls .dw-action-compact{min-width:0}.dw-controls .dw-action-button{font-size:13px;min-height:32px;padding:5px 6px;gap:5px;white-space:nowrap}
    .dw-controls .dw-switch{width:26px;height:16px}.dw-controls .dw-switch>span{width:10px;height:10px}.dw-controls .dw-switch[data-checked=true]>span{left:12px}
    .dw-section-heading{margin-bottom:10px}.dw-section-heading h2{font-size:16px}
    .dw-mounted-plugin{height:240px;max-height:calc(100dvh - 190px)}
    .dw-back{margin-bottom:8px;padding:4px 6px!important;font-size:13px!important}
  `
  document.head.appendChild(style);disposers.push(()=>style.remove())
  disposers.push(installWorkspaceLayout(ctx))
  disposers.push(installNarrowLeftSidebar(ctx))
  disposers.push(installContextLayout())
  disposers.push(ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({
    name:'conversation.input.left',id:name,order:100,
    inject:sessionId=>{
      const binding=sessionId ? ctx.sessions.binding(sessionId) : undefined
      const chat=binding ? ctx.uiConversation.binding(binding).target('chat') : undefined
      return {registry,onViewError,...resolveProgressNavigation(ctx,sessionId),hooks:{...(chat?{chat}:{}),connection:ctx.connection.state,jobs:ctx.jobs.state},
        watchJobs:id=>ctx.jobs.watchRows(id)}
    },
  },InlineWorkspace)))
  disposers.push(connectProviders(document,registry,id=>document.dispatchEvent(new CustomEvent('dsh-workspace:select-action',{detail:{id}}))))
  let disposed=false
  return()=>{if(disposed)return;disposed=true;for(const dispose of disposers.reverse())dispose?.()}
}

// Independent injection scopes keep diagnostics available when a progress
// dependency is pending, and keep optional diagnostics out of progress startup.
export function apply(ctx) {
  const health = createPluginHealth()
  const viewRegistration = {registrant:name}
  const onViewError = () => health.render('workspace.view', viewRegistration)
  ctx.inject(PROGRESS_DEPENDENCIES, child => applyWorkspace(child,onViewError))
  ctx.inject(['slots','modules'], child => applyHealthNotifications(child,health))
  return () => health.dispose()
}
