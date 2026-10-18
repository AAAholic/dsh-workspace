import React from 'react'
const el = React.createElement
const DEFAULT = Object.freeze({writable:true,busy:false,status:''})
function readAction(action) { try { return action?.getSnapshot?.() || DEFAULT } catch { return {writable:false,status:'暂不可用'} } }
export function useActions(registry) { return React.useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot) }
export function useActionState(action) {
  const [state, setState] = React.useState(() => readAction(action))
  React.useEffect(() => {
    const update = () => setState(readAction(action))
    update()
    let release
    try { release = action?.subscribe?.(update) }
    catch { setState({writable:false,status:'状态更新暂不可用'}) }
    return () => { if (typeof release === 'function') { try { release() } catch {} } }
  }, [action])
  return state
}
export function ActionButton({action, openAction, compact=false}) {
  const state = useActionState(action)
  const [error,setError] = React.useState('')
  const [pending,setPending] = React.useState(false)
  const toggle = action.kind === 'toggle'
  const feedback = error || (!compact || state.busy || state.writable === false || /失败|重试|未能|切换/.test(state.status || '') ? state.status : '')
  const invoke = async () => {
    if (state.busy || pending || state.writable === false) return
    setError('')
    if (action.kind === 'panel') { openAction(action.id); return }
    setPending(true)
    try { if (await action.execute() === false) setError('未能切换，请重试') }
    catch { setError('操作未完成，请重试') }
    finally { setPending(false) }
  }
  return el('div', {className:compact?'dw-action-compact':'dw-action-row','data-workspace-action':action.id},
    el('button', {type:'button',className:'dw-action-button',disabled:state.busy || pending || state.writable === false,
      ...(toggle ? {role:'switch','aria-checked':state.enabled === true} : {}),
      'aria-label': toggle ? `${action.label}，${state.enabled ? '已开启':'已关闭'}` : action.label,
      onClick:invoke},
      el('span', null, action.label),
      toggle && el('span', {className:'dw-switch', 'data-checked':state.enabled === true, 'aria-hidden':true}, el('span')),
      !compact && !toggle && el('span', {className:'dw-secondary'}, '打开')),
    feedback && el('span', {className:'dw-action-feedback',role:'status'}, feedback))
}
export function QuickActions({registry,openAction}) {
  const actions = useActions(registry)
  return actions.length ? el('div',{className:'dw-quick-actions','aria-label':'常用插件'},
    actions.slice(0,2).map(action => el(ActionButton,{key:action.id,action,openAction,compact:true}))) : null
}
function MountedPanel({action}) {
  const ref = React.useRef(null)
  const [error,setError] = React.useState('')
  React.useEffect(() => {
    setError('')
    let mounted
    try { mounted = action.mount(ref.current) }
    catch { setError('设置面板暂不可用') }
    return () => { if (typeof mounted === 'function') mounted(); else mounted?.dispose?.() }
  }, [action])
  return el('div',{className:'dw-mounted-plugin'}, error && el('p',{role:'status'},error), el('div',{ref,className:'dw-plugin-mount'}))
}
export function PluginPanel({registry,openAction,actionId}) {
  const actions = useActions(registry)
  const selected = actions.find(action => action.id === actionId && action.kind === 'panel')
  return el('section',{className:'dw-plugin-panel'},
    !selected && el('div',{className:'dw-section-heading'},el('h2',null,'插件中心'),el('span',{className:'dw-secondary'},`${actions.length} 个入口`)),
    selected ? el(React.Fragment,null,
      el('button',{type:'button',className:'dw-back',onClick:()=>openAction(null)},'‹ 全部插件'),
      el(MountedPanel,{key:selected.id,action:selected})) :
    el(React.Fragment,null,
      !actions.length && el('p',{className:'dw-secondary'},'已安装插件提供快捷入口后，会显示在这里。'),
      actions.map(action => el(ActionButton,{key:action.id,action,openAction}))))
}
export const PLUGIN_CSS = `
[data-dsh-workspace-panel]{box-sizing:border-box;min-width:0;height:100%;overflow:hidden;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font:inherit}
.dw-content{min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;padding:20px 18px 24px}
.dw-pet-reserve{height:164px;flex:none;border-top:1px solid var(--dsw-alias-border-l2)}
[data-dsh-workspace-panel] *{box-sizing:border-box}
[data-dsh-workspace-panel] button,.dw-header-button{font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:9px;padding:8px 10px}
[data-dsh-workspace-panel] button:hover:not(:disabled),.dw-header-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
[data-dsh-workspace-panel] button:focus-visible,.dw-header-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
[data-dsh-workspace-panel] button:disabled{cursor:default;opacity:.55}
[data-dsh-workspace-panel] h2{font-size:16px;font-weight:600;margin:0;line-height:1.5}
.dw-header-button{white-space:nowrap;font-size:12px;padding:5px 10px;min-height:30px}
.dw-quick-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dw-action-compact{flex:1;min-width:130px}
.dw-action-button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:38px;text-align:left}
.dw-section-heading{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:0 0 16px}
.dw-secondary{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.dw-action-row{margin-bottom:10px}.dw-action-feedback{display:block;color:var(--dsw-alias-label-secondary);font-size:12px;padding:5px 2px}
.dw-switch{flex:none;position:relative;display:inline-block;width:30px;height:18px;border-radius:20px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3)}
.dw-switch>span{position:absolute;width:12px;height:12px;border-radius:50%;top:2px;left:2px;background:var(--dsw-alias-label-secondary)}
.dw-switch[data-checked=true]{background:var(--dsw-alias-brand-primary)}.dw-switch[data-checked=true]>span{left:14px;background:var(--dsw-alias-label-primary-inverted)}
.dw-back{margin-bottom:14px}.dw-mounted-plugin{min-width:0;height:520px;max-height:calc(100dvh - 210px)}.dw-plugin-mount{height:100%;min-height:0}.dw-mounted-plugin [data-motion-settings]{width:100%;max-width:100%;padding:12px 0;background:transparent;border:0;box-shadow:none}
@media(prefers-reduced-motion:reduce){[data-dsh-workspace-panel] *{scroll-behavior:auto!important;transition:none!important}}
`
