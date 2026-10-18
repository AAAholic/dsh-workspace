import { installLayoutStyle } from './layout-style.mjs';

export const MIN_READING_COLUMN = 560;
export const MIN_READING_HEIGHT = 120;
export const MIN_EXPANDED_HEIGHT = 120;
const PET_SIZE = 144;
const PET_SPACE = PET_SIZE + 20;

/** Independent of the card's current flow height, so opening cannot feed back. */
export function compactWorkspaceBudget({ height, headerHeight, composerHeight }) {
  const maxExpandedHeight = Math.max(0, Math.floor(Math.min(340, height * .4,
    height - headerHeight - composerHeight - MIN_READING_HEIGHT - 16)));
  return { maxExpandedHeight, canExpand: maxExpandedHeight >= MIN_EXPANDED_HEIGHT };
}

/** Fit only inside an explicitly reserved lane, avoiding every visible surface. */
export function workspacePetPlacement(area, blocked = [], size = PET_SIZE) {
  if (!area || area.right - area.left < size || area.bottom - area.top < size) return null;
  const left = area.right - size;
  const tops = [area.bottom - size, area.top, ...blocked.map(rect => rect.top - size - 8)];
  for (const top of tops.sort((a,b) => b-a)) {
    const rect = { left, top, right: left + size, bottom: top + size };
    if (top < area.top || rect.bottom > area.bottom) continue;
    if (blocked.some(other => other.right > rect.left - 8 && other.left < rect.right + 8 &&
      other.bottom > rect.top - 8 && other.top < rect.bottom + 8)) continue;
    return rect;
  }
  return null;
}

/** Actual conversation-column budget, excluding the native history column. */
export function inlineWorkspaceGeometry(columnWidth) {
  const width = columnWidth >= 1200 ? 258 : columnWidth >= 1032 ? 244 : 230;
  const compact = columnWidth < MIN_READING_COLUMN + width + 32;
  return { width, compact, readingWidth: compact ? columnWidth : columnWidth - width - 32 };
}

/**
 * Attach one session-owned card to the real ConversationRoot. The existing body
 * remains an in-flow flex child; margin shrinks its actual measured width so the
 * host's own ResizeObserver keeps composer, messages and width controls in sync.
 * No native sidebar state, layout store preference or fullscreen mode is touched.
 */
export function attachInlineWorkspace(anchor, { sessionId } = {}) {
  const body = anchor?.closest?.('[data-conversation-content]');
  const owner = body?.parentElement;
  const doc = owner?.ownerDocument;
  if (!body || !owner || !doc?.defaultView || (sessionId !== undefined && body.dataset.conversationSession !== sessionId)) return null;
  const held = owner.querySelector(':scope > [data-dsh-workspace-inline-host]');
  if (held) return null;
  const win = doc.defaultView;
  const element = doc.createElement('aside');
  element.dataset.dshWorkspaceInlineHost = '';
  element.setAttribute('aria-label', '本轮进度与插件');
  owner.dataset.dshWorkspaceInlineRoot = '';
  body.dataset.dshWorkspaceInlineBody = '';
  // Keep the compact entry in normal flow between native header and body.
  // Absolute wide mode ignores this order; compact mode reserves real space
  // instead of occupying the header's resource/action controls or the messages.
  owner.insertBefore(element, body);
  const listeners = new Set();
  let snapshot = Object.freeze({ width: 244, compact: false, readingWidth: 720, maxExpandedHeight: 340, canExpand: true });
  let disposed = false, pending = null;
  const names = ['--dsh-inline-workspace-width','--dsh-inline-workspace-top','--dsh-inline-workspace-pet-space','--dsh-inline-workspace-expanded-height'];
  const oldVars = names.map(name => [name, owner.style.getPropertyValue(name), owner.style.getPropertyPriority(name)]);
  const observed = new Set();
  const schedule = () => { if (!disposed && pending===null) pending=win.requestAnimationFrame(()=>{pending=null;sync()}); };
  const resize = typeof win.ResizeObserver==='function' ? new win.ResizeObserver(schedule) : null;
  const sync = () => {
    if (disposed || !owner.isConnected) return;
    const rootRect = owner.getBoundingClientRect();
    if (rootRect.width <= 0) return;
    const before = [];
    for (let sibling=element.previousElementSibling;sibling;sibling=sibling.previousElementSibling) before.push(sibling);
    // Slot wrappers can use display:contents and have a zero-sized box. Measure
    // the actual header/tab strip as well so the card clears their divider.
    const headerSurfaces = [...new Set(before.flatMap(node =>
      [node, ...node.querySelectorAll('header,[role="tablist"]')]))];
    const seat = body.querySelector('[data-composer-seat]');
    const targets = new Set([owner,body,element,...headerSurfaces,...(seat?[seat]:[])]);
    for (const target of observed) if (!targets.has(target)) { resize?.unobserve(target);observed.delete(target); }
    for (const target of targets) if (!observed.has(target)) { resize?.observe(target);observed.add(target); }
    const headerHeight = Math.max(0,...headerSurfaces.map(node=>node.getBoundingClientRect().bottom-rootRect.top));
    const next = { ...inlineWorkspaceGeometry(rootRect.width), ...compactWorkspaceBudget({
      height:rootRect.height, headerHeight, composerHeight:seat?.getBoundingClientRect().height || 0,
    }) };
    owner.toggleAttribute('data-inline-compact',next.compact);
    element.toggleAttribute('data-inline-compact',next.compact);
    const top = Math.max(60, Math.ceil(headerHeight) + 12);
    const widthValue = next.width + 'px', topValue = top + 'px';
    if (owner.style.getPropertyValue('--dsh-inline-workspace-width') !== widthValue) owner.style.setProperty('--dsh-inline-workspace-width',widthValue);
    if (owner.style.getPropertyValue('--dsh-inline-workspace-top') !== topValue) owner.style.setProperty('--dsh-inline-workspace-top',topValue);
    const heightValue = next.maxExpandedHeight + 'px';
    if (owner.style.getPropertyValue('--dsh-inline-workspace-expanded-height') !== heightValue) owner.style.setProperty('--dsh-inline-workspace-expanded-height',heightValue);
    if (Object.keys(next).some(key=>snapshot[key]!==next[key])) { snapshot=Object.freeze(next);for(const listener of listeners)listener(); }
  };
  const observer = new win.MutationObserver(records=>{
    if(records.some(record=>record.target===owner || [...record.addedNodes,...record.removedNodes].some(node=>
      node.nodeType===1 && (node.matches?.('[data-composer-seat]') || node.querySelector?.('[data-composer-seat]')))))schedule();
  });
  observer.observe(owner,{childList:true,subtree:true});
  win.addEventListener('resize',schedule);
  sync();
  return {
    element,
    getSnapshot:()=>snapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
    dispose(){
      if(disposed)return;disposed=true;
      if(pending!==null)win.cancelAnimationFrame(pending);
      observer.disconnect();resize?.disconnect();win.removeEventListener('resize',schedule);listeners.clear();element.remove();
      owner.removeAttribute('data-dsh-workspace-inline-root');owner.removeAttribute('data-inline-compact');owner.removeAttribute('data-inline-collapsed');body.removeAttribute('data-dsh-workspace-inline-body');
      for(const [name,value,priority] of oldVars) { if(value)owner.style.setProperty(name,value,priority);else owner.style.removeProperty(name); }
    },
  };
}

function visible(element) {
  return Boolean(element && element.getAttribute('data-workspace-visible') !== 'false' &&
    !element.closest('[hidden],[aria-hidden="true"]') && element.getClientRects().length &&
    element.ownerDocument.defaultView.getComputedStyle(element).visibility !== 'hidden');
}

/** Resolve alpha-bearing theme fills onto the root's opaque backing color. */
function opaqueThemeFill(doc) {
  const win = doc.defaultView;
  const root = doc.documentElement;
  const fallback = doc.body?.hasAttribute('data-ds-dark-theme') ? '#101a2a' : '#f8f9fb';
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = canvas.height = 1;
    const paint = canvas.getContext('2d', { willReadFrequently: true });
    if (!paint) return fallback;
    paint.fillStyle = fallback;
    paint.fillRect(0, 0, 1, 1);
    paint.fillStyle = win.getComputedStyle(root).backgroundColor;
    paint.fillRect(0, 0, 1, 1);
    paint.fillStyle = win.getComputedStyle(doc.body).getPropertyValue('--dsw-alias-bg-base').trim() || fallback;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b] = paint.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch { return fallback; }
}

/** Install the shared composer fade and companion positioning only. */
export function installWorkspaceLayout(ctx, { panelSelector = '[data-dsh-workspace-panel]', document: doc = globalThis.document } = {}) {
  if (!doc?.body || !doc.defaultView) return () => {};
  const win = doc.defaultView, root = doc.documentElement;
  if (root.hasAttribute('data-dsh-workspace-layout')) return () => {};
  root.setAttribute('data-dsh-workspace-layout', '');
  const removeStyle = installLayoutStyle(doc);
  root.setAttribute('data-dsh-workspace-inline','');
  let disposed = false, scheduled = null, lastColor = '', lastColorSource = '';
  const seats = new Map();
  const vars = ['--dsh-workspace-curtain-color', '--dsh-workspace-pet-right', '--dsh-workspace-pet-bottom'];
  const oldVars = new Map(vars.map(name => [name, root.style.getPropertyValue(name)]));
  const oldPetHidden = root.getAttribute('data-dsh-workspace-pet-hidden');
  const setVar = (name, value) => { if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value); };
  const schedule = () => {
    if (!disposed && scheduled === null) scheduled = win.requestAnimationFrame(() => { scheduled = null; sync(); });
  };
  const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(schedule) : null;
  function syncSeats() {
    for (const [seat, curtain] of seats) {
      if (!seat.isConnected) { resize?.unobserve(seat); curtain.remove(); seats.delete(seat); }
    }
    for (const seat of doc.querySelectorAll('[data-conversation-content] > [data-conversation-scroll] > [data-composer-seat]')) {
      if (!seats.has(seat)) {
        const curtain = doc.createElement('div');
        curtain.dataset.dshWorkspaceCurtain = '';
        curtain.setAttribute('aria-hidden', 'true');
        seat.appendChild(curtain);
        seats.set(seat, curtain);
        resize?.observe(seat);
      }
      const body = seat.closest('[data-conversation-content]');
      const active = body?.dataset.contentPhase === 'active' && !body.querySelector('[data-conversation-composer-overlay]');
      if (seat.hasAttribute('data-dsh-workspace-fade') !== active) seat.toggleAttribute('data-dsh-workspace-fade', active);
    }
  }

  function sync() {
    if (disposed) return;
    syncSeats();
    const colorSource = win.getComputedStyle(doc.body).getPropertyValue('--dsw-alias-bg-base') + win.getComputedStyle(root).backgroundColor;
    if (colorSource !== lastColorSource) {
      const color = opaqueThemeFill(doc);
      if (color !== lastColor) { setVar('--dsh-workspace-curtain-color', color); lastColor = color; }
      lastColorSource = colorSource;
    }
    const mountedHosts = [...doc.querySelectorAll('[data-dsh-workspace-inline-host]')];
    const panels = [...doc.querySelectorAll(panelSelector)].filter(element => visible(element) && element.closest('[data-dsh-workspace-inline-host]'));
    const panel = panels.find(element=>element.closest('[data-dockkit-pane-active="true"],[data-dockkit-float-active="true"]')) ||
      panels.find(element=>element.closest('[data-dsh-workspace-inline-root]')?.contains(doc.activeElement)) || panels[0];
    const host = panel?.closest('[data-dsh-workspace-inline-host]');
    const enabled = panel?.getAttribute('data-workspace-pet-active') === 'true';
    const owner = host?.parentElement;
    const ownerRect = owner?.getBoundingClientRect();
    const top = Number.parseFloat(owner?.style.getPropertyValue('--dsh-inline-workspace-top')) || 60;
    const petReserved = Boolean(enabled && !host.hasAttribute('data-inline-compact') && !host.hasAttribute('data-inline-collapsed') &&
      ownerRect.height - top - 16 >= MIN_EXPANDED_HEIGHT + PET_SPACE);
    for(const owner of doc.querySelectorAll('[data-dsh-workspace-inline-root]')){
      const space=petReserved && owner===host.parentElement?PET_SPACE+'px':'0px';
      if(owner.style.getPropertyValue('--dsh-inline-workspace-pet-space')!==space)owner.style.setProperty('--dsh-inline-workspace-pet-space',space);
    }
    const rect = host?.getBoundingClientRect();
    const blocked = [...doc.querySelectorAll('[data-conversation-content],[data-composer-seat],[data-forecast-root],[data-forecast-suggestion],[data-sidebar-right-panel],[data-dsh-workspace-inline-host],[data-dsh-workspace-inline-root],[data-dockkit-pane],[data-dockkit-float]')]
      .filter(element=>visible(element) && element!==owner && !element.contains(owner))
      .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
    const placement = petReserved ? workspacePetPlacement({left:rect.left,right:Math.min(rect.right-18,win.innerWidth-18),
      top:rect.bottom+12,bottom:Math.min(ownerRect.bottom,win.innerHeight)-24},blocked) : null;
    // A hidden, retained host still owns the companion's toggle. Keep its graphic
    // hidden until a card is visible; restore standalone controls only after unmount.
    root.toggleAttribute('data-dsh-workspace-pet-hidden',Boolean(mountedHosts.length && (!panel || enabled && !placement)));
    setVar('--dsh-workspace-pet-right', placement ? `${Math.ceil(win.innerWidth-placement.right)}px` : '18px');
    setVar('--dsh-workspace-pet-bottom', placement ? `${Math.ceil(win.innerHeight-placement.bottom)}px` : '72px');
  }

  const onFocus = event => {
    const element = event.target;
    if (!element?.getBoundingClientRect || element.closest('[data-composer-seat]')) return;
    const scrollport = element.closest('[data-conversation-scroll]');
    const seat = scrollport?.querySelector(':scope > [data-composer-seat][data-dsh-workspace-fade]');
    if (!seat) return;
    const hidden = element.getBoundingClientRect().bottom - seat.getBoundingClientRect().top + 8;
    if (hidden > 0) scrollport.scrollBy({ top: hidden, behavior: 'instant' });
  };
  const observer = new win.MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === 1 && (node.matches?.('[data-composer-seat],[data-sidebar-right-panel],[data-conversation-content],[data-dockkit-pane],[data-dockkit-float]') ||
        node.querySelector?.('[data-composer-seat],[data-sidebar-right-panel],[data-dockkit-pane],[data-dockkit-float]') || node.matches?.(panelSelector) || node.querySelector?.(panelSelector))))) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['hidden', 'aria-hidden', 'style', 'data-sidebar-right-open', 'data-sidebar-right-panel', 'data-content-phase', 'data-dockkit-pane-active', 'data-dockkit-float-active', 'data-ds-dark-theme', 'data-workspace-pet-active', 'data-workspace-visible', 'data-inline-compact', 'data-inline-expanded', 'data-inline-collapsed'] });
  observer.observe(root, { attributes: true, attributeFilter: ['data-dsh-skin', 'style'] });
  win.addEventListener('resize', schedule);
  doc.addEventListener('focusin', onFocus);
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    if (scheduled !== null) win.cancelAnimationFrame(scheduled);
    observer.disconnect();
    resize?.disconnect();
    win.removeEventListener('resize', schedule);
    doc.removeEventListener('focusin', onFocus);
    for (const [seat, curtain] of seats) { seat.removeAttribute('data-dsh-workspace-fade'); curtain.remove(); }
    for (const [name, value] of oldVars) { if (value) root.style.setProperty(name, value); else root.style.removeProperty(name); }
    root.removeAttribute('data-dsh-workspace-layout');
    root.removeAttribute('data-dsh-workspace-inline');
    if(oldPetHidden===null)root.removeAttribute('data-dsh-workspace-pet-hidden');else root.setAttribute('data-dsh-workspace-pet-hidden',oldPetHidden);
    removeStyle();
  };
}
