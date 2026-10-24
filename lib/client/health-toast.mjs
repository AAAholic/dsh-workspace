import React from 'react'
import {PLUGINS,createPluginHealth,observePluginHealth} from './plugin-health.mjs'
import {observePluginLifecycle} from './plugin-lifecycle.mjs'

// Render through the host overlay and its existing Toast component. No custom
// positioning, focus changes, timers, raw exception text or background polling.
export function HealthToast({useHealth,health,Toast,openDetails}) {
  const notice = useHealth(snapshot => snapshot.notice)
  if (!notice) return null
  const dismiss = () => health.dismiss(notice.id)
  const actions = []
  if (openDetails) actions.push({prefix:' ',label:'查看详情',onClick:() => {openDetails(notice.owner);dismiss()}})
  actions.push({prefix:' ',label:'关闭',onClick:dismiss})
  return React.createElement(Toast, { key:notice.id, text:notice.text, holdMs:10000,
    onDone:dismiss, actions })
}

export function applyHealthNotifications(ctx, sharedHealth) {
  let disposed = false
  const health = sharedHealth || createPluginHealth()
  const importSnapshot = () => {
    if (disposed || typeof ctx.modules.importError !== 'function') return
    health.modules({syncing:false,failures:Object.keys(PLUGINS)
      .filter(id => ctx.modules.importError(id)).map(id => ({id,message:'import failed'}))}, 'imports')
  }
  const stop = observePluginHealth(ctx, health, importSnapshot)
  const stopLifecycle = observePluginLifecycle(ctx, failures => {
    health.modules({syncing:false,failures}, 'lifecycle')
  }, Object.keys(PLUGINS))
  const loader = ctx.get?.('loader')
  if (typeof loader?.await === 'function' && typeof ctx.modules.importError === 'function') {
    // Boot's entry state does not publish import failures. Read recorded import
    // errors once after activation settles, without blocking this plugin's apply.
    Promise.resolve().then(() => loader.await()).then(() => {
      importSnapshot()
    }).catch(() => { /* Loader still owns its original error. */ })
  }
  let removeOverlay
  // The diagnostic UI is optional. A missing Toast export must never prevent
  // the original progress/layout plugin from loading.
  Promise.resolve().then(() => ctx.modules.import('@deepseek-ai/dsh-client-ui-primitives')).then(primitives => {
    if (disposed || typeof primitives?.Toast !== 'function') return
    removeOverlay = ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name:'shell.overlay', id:'dsh-workspace.health',
      inject:() => {
        const navigation = ctx.get?.('pluginNavigation')
        return {hooks:{health:health.state},health,Toast:primitives.Toast,
          openDetails:typeof navigation?.openBundle === 'function' ? id => navigation.openBundle(id) : undefined}
      },
    }, HealthToast))
  }).catch(() => { /* The host retains its own module-import diagnostic. */ })
  return () => {
    if (disposed) return
    disposed = true; removeOverlay?.(); stop(); stopLifecycle(); if (!sharedHealth) health.dispose()
  }
}
