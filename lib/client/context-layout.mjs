// dsh-context 0.56.2-dshrc2.5 footer classes. Presentation only; the plugin
// retains meter/balance state, focus anchors, portal tooltips and click handlers.
export const CONTEXT_LAYOUT_CSS = `
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail){grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);column-gap:6px;padding:5px}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-context{gap:6px}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-copy{min-width:0}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-label{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`

/** Removing this style restores the owner's original layout without DOM repair. */
export function installContextLayout(doc = globalThis.document) {
  if (!doc?.head) return () => {}
  const style = doc.createElement('style')
  style.dataset.dshWorkspaceContextLayout = ''
  style.textContent = CONTEXT_LAYOUT_CSS
  doc.head.appendChild(style)
  return () => style.remove()
}
