/**
 * Current-host adapter for the native sidebar preference. The root slot's store
 * factory returns the SAME instance that LayoutController.panels uses. Verify
 * that identity before reading/subscribing; write only through native setSidebar.
 * Native computeColumns retains its own 264px minimum and drag geometry.
 */
export function resolveLeftSidebarAdapter(ctx) {
  try {
    const layout = (typeof ctx.get === 'function' ? ctx.get('layout') : undefined) ?? ctx.layout;
    const slots = ctx.slots ?? (typeof ctx.get === 'function' ? ctx.get('slots') : undefined);
    if (!layout || typeof layout.panels?.setSidebar !== 'function' || typeof slots?.entries !== 'function') return null;
    for (const entry of slots.entries('root')) {
      if (!entry.children?.sidebar || !entry.children?.main || !entry.children?.rightbar || typeof entry.store?.create !== 'function') continue;
      const instance = entry.store.create();
      if (instance?.actions !== layout.panels || typeof instance.getSnapshot !== 'function' || typeof instance.subscribe !== 'function') continue;
      const info = instance.getSnapshot()?.layoutInfo;
      if (!info || !Number.isFinite(info.sidebar) || !Number.isFinite(info.viewportWidth) || typeof info.narrowExpanded !== 'boolean') continue;
      return { instance, actions: layout.panels, entry, slots };
    }
  } catch {}
  return null;
}

export function leftSidebarCollapsed(info) {
  return info.viewportWidth < 1024 ? !info.narrowExpanded : info.sidebar === 0;
}

const clamp = (value,min,max)=>Math.min(max,Math.max(min,Math.round(value)));

/** A single geometry solve used by grid, slot reports, and both drag handles. */
export function leftPresentationGeometry(info,{presentationWidth=216,collapsedWidth=0}={}) {
  const scale=presentationWidth/264;
  const collapsed=leftSidebarCollapsed(info);
  const logical=collapsed?0:info.sidebar===0?264:clamp(info.sidebar,264,420);
  const preference=logical===0?0:Math.round(logical*scale);
  const viewport=info.viewportWidth;
  const rightPreference=info.rightbar??viewport*.45;
  const solve=(side,right)=>{
    const sidebar=side===0?collapsedWidth:side;
    const available=viewport-sidebar-400;
    const rightbar=right===0||available<300?0:Math.min(available,clamp(right,300,viewport*.7));
    return {sidebar,center:Math.max(0,viewport-sidebar-rightbar),rightbar};
  };
  const normalSide=!info.rightbarShown&&viewport<1024?0:preference;
  const nativePreference=collapsed?0:info.sidebar===0?280:clamp(info.sidebar,264,420);
  const nativeNormalSide=!info.rightbarShown&&viewport<1024?0:nativePreference;
  const nativeNormal=solve(nativeNormalSide,rightPreference);
  const nativeColumns=solve(nativePreference,info.rightbarTrack?rightPreference:0);
  // Compacting the left column must not enable a right resource surface that
  // the native frame considered unavailable (and created no drag handle for).
  const normal=solve(normalSide,nativeNormal.rightbar===0?0:rightPreference);
  const columns=solve(preference,nativeColumns.rightbar===0?0:rightPreference);
  return {scale,logical,collapsed,viewport,normal,columns,rightMax:columns.rightbar===0?0:clamp(rightPreference,300,viewport*.7)};
}

// React element props-only cloning, retaining the original $$typeof/key/ref/owner.
// No runtime React import is needed: the native frame already creates the elements.
const cloneProps=(element,patch)=>({...element,props:{...element.props,...patch}});
const isElement=value=>Boolean(value&&typeof value==='object'&&value.$$typeof&&value.props);

function notifyRoot(slots) {
  // The registry batches subscription delivery in a microtask. A lower-priority
  // temporary entry is never elected and leaves no registration behind.
  const entries=slots.entries('root');
  const priority=Math.max(0,...entries.map(entry=>entry.options?.priority??0))+1;
  const stop=slots.register({name:'root',priority},()=>null);
  if(typeof stop==='function')stop();else stop?.dispose?.();
}

/**
 * rc.2 presentation adapter: preserve the same registered entry, store, native
 * AppFrame hooks and child-slot authority. Only the frame's output geometry and
 * sidebar report are projected. Native preferences/actions remain unmodified.
 */
export function installLeftPresentation(resolved,{presentationWidth=216,document:doc=globalThis.document}={}) {
  const {entry,slots,instance,actions}=resolved;
  const original=entry?.component;
  if(typeof original!=='function'||typeof slots?.register!=='function')return()=>{};
  const source=Function.prototype.toString.call(original);
  if(original.name!=='AppFrame'||!source.includes('gridTemplateColumns')||!source.includes('rightbarPreference')||
    !source.includes('onSidebarStart')||!source.includes('onRightbarStart')||!source.includes('renderSlot'))return()=>{};
  const descriptor=Object.getOwnPropertyDescriptor(entry,'component');
  if(descriptor?.writable===false)return()=>{};
  const root=doc?.documentElement;
  let leftOrigin=264,rightOrigin=300,disposed=false;
  function LeftPresentationFrame(props) {
    const info=props.useStore(state=>state.layoutInfo);
    const platform=doc?.documentElement?.dataset.platform;
    const closed=platform==='darwin'||root?.hasAttribute('data-windows-titlebar')?0:56;
    const geometry=leftPresentationGeometry(info,{presentationWidth,collapsedWidth:closed});
    const renderSlot=(name,owner,options)=>props.renderSlot(name,
      name==='sidebar'?{...owner,width:geometry.columns.sidebar,collapsed:geometry.collapsed}:
        name==='rightbar'?{...owner,width:geometry.normal.rightbar,viewportWidth:geometry.viewport,canShow:geometry.normal.rightbar>0}:owner,options);
    const base=original({...props,renderSlot});
    if(!isElement(base)||typeof base.props.style?.gridTemplateColumns!=='string')return base;
    const rewrite=value=>{
      if(Array.isArray(value))return value.map(rewrite);
      if(!isElement(value))return value;
      if(value.props.side==='sidebar')return cloneProps(value,{
        left:geometry.columns.sidebar,
        onStart:()=>{leftOrigin=geometry.logical;value.props.onStart()},
        onDrag:dx=>actions.setSidebar(leftOrigin+dx/geometry.scale),
      });
      if(value.props.side==='rightbar')return cloneProps(value,{
        left:geometry.viewport-geometry.normal.rightbar,
        onStart:()=>{rightOrigin=geometry.normal.rightbar;value.props.onStart()},
        onDrag:dx=>actions.setRightbar(rightOrigin-dx),
      });
      if(typeof value.props.className==='string'&&value.props.className.includes('_sidebarCol'))return cloneProps(value,{'data-dsh-left-sidebar-column':'','data-dsh-left-sidebar-width':geometry.columns.sidebar});
      if(value.type===Symbol.for('react.fragment'))return cloneProps(value,{children:rewrite(value.props.children)});
      return value;
    };
    return cloneProps(base,{
      style:{...base.props.style,
        ...(root?.hasAttribute('data-windows-titlebar')?{'--dsh-windows-sidebar-width':`${geometry.columns.sidebar}px`}:{}),
        gridTemplateColumns:`${geometry.columns.sidebar}px minmax(${geometry.columns.rightbar===0?0:400}px, 1fr) minmax(0px, ${geometry.rightMax}px)`},
      'data-dsh-left-presentation':'',
      'data-rightbar-collapsed':geometry.columns.rightbar===0||undefined,
      children:rewrite(base.props.children),
    });
  }
  try {
    entry.component=LeftPresentationFrame;
    notifyRoot(slots);
  } catch {entry.component=original;return()=>{}};
  return()=>{
    if(disposed)return;disposed=true;
    if(entry.component===LeftPresentationFrame){entry.component=original;try{notifyRoot(slots)}catch{}}
  };
}

/**
 * Set the native default to its legal minimum. Reopening still runs the host's
 * own toggle; only its default 280px result is then changed to 264px, before the
 * next render. Subsequent user drag preferences pass through untouched.
 */
export function installNarrowLeftSidebar(ctx, { width = 264, presentationWidth = 216, document: doc = globalThis.document } = {}) {
  const resolved = resolveLeftSidebarAdapter(ctx);
  if (!resolved) return () => {};
  const { instance, actions } = resolved;
  const target = Math.min(420, Math.max(264, Math.round(Number(width) || 264)));
  const initial = instance.getSnapshot().layoutInfo;
  const restoreWidth = initial.sidebar > 0 ? initial.sidebar : 280;
  const root = doc?.documentElement;
  const attrs = ['data-dsh-workspace-left-adapter', 'data-dsh-workspace-left-expanded'];
  const oldAttrs = new Map(attrs.map(name => [name, root?.getAttribute(name) ?? null]));
  const oldWidth = root?.style.getPropertyValue('--dsh-workspace-left-width') ?? '';
  const stopPresentation=installLeftPresentation(resolved,{presentationWidth,document:doc});
  let collapsed = leftSidebarCollapsed(initial), disposed = false, writing = false, wrote = false;
  root?.setAttribute('data-dsh-workspace-left-adapter','');

  function reflect(info) {
    const expanded = !leftSidebarCollapsed(info);
    root?.toggleAttribute('data-dsh-workspace-left-expanded', expanded);
    const projected=resolved.entry.component?.name==='LeftPresentationFrame';
    const geometry=leftPresentationGeometry(info,{presentationWidth});
    const value = `${expanded ? projected?geometry.columns.sidebar:info.sidebar||280 : 0}px`;
    if (root && root.style.getPropertyValue('--dsh-workspace-left-width') !== value) root.style.setProperty('--dsh-workspace-left-width',value);
  }
  function setDefault() {
    if (disposed || writing) return;
    writing = true;
    try { actions.setSidebar(target); wrote = true; } catch {}
    finally { writing = false; }
  }
  function sync() {
    if (disposed) return;
    const info = instance.getSnapshot().layoutInfo;
    const nextCollapsed = leftSidebarCollapsed(info);
    const reopened = collapsed && !nextCollapsed;
    collapsed = nextCollapsed;
    reflect(info);
    // 280 is exactly the host's reopen default. A retained explicit drag width
    // on breakpoint expansion is not a default and must not be overwritten.
    // A narrow-screen expansion with sidebar=0 is a temporary 280px surface,
    // not an expanded desktop preference. Keep 0 so widening stays collapsed.
    if (reopened && info.sidebar === 280) setDefault();
  }
  const unsubscribe = instance.subscribe(sync);
  if (!collapsed && initial.sidebar > 0) setDefault();
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    stopPresentation();
    const info = instance.getSnapshot().layoutInfo;
    if (wrote && info.sidebar === target) {
      try { actions.setSidebar(restoreWidth); } catch {}
    }
    for (const [name,value] of oldAttrs) { if (value === null) root?.removeAttribute(name); else root?.setAttribute(name,value); }
    if (root) { if (oldWidth) root.style.setProperty('--dsh-workspace-left-width',oldWidth); else root.style.removeProperty('--dsh-workspace-left-width'); }
  };
}
