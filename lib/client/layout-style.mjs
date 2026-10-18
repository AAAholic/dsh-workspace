/** This is intentionally a child surface: skin-center neutralizes seat backgrounds. */
export const LAYOUT_CSS = `
/* Chromium paints the actual scroll thumb; no duplicate track or scroll logic. */
html[data-dsh-workspace-layout] body * {
  scrollbar-width:auto !important;
  scrollbar-color:auto !important;
}
html[data-dsh-workspace-layout] ::-webkit-scrollbar { width:8px; height:8px; }
html[data-dsh-workspace-layout] ::-webkit-scrollbar-track {
  background:transparent;
  margin-block:6px;
}
html[data-dsh-workspace-layout] ::-webkit-scrollbar-thumb {
  border:1px solid transparent;
  border-radius:999px;
  corner-shape:round;
  background:color-mix(in srgb,var(--dsw-alias-label-secondary,#9296a0) 52%,transparent);
  background-clip:content-box;
}
html[data-dsh-workspace-layout] ::-webkit-scrollbar-thumb:hover {
  background-color:color-mix(in srgb,var(--dsw-alias-label-secondary,#9296a0) 74%,transparent);
}
html[data-dsh-workspace-layout] ::-webkit-scrollbar-corner { background:transparent; }
html[data-dsh-workspace-layout] ::-webkit-scrollbar-button { display:none; }
@supports not selector(::-webkit-scrollbar) {
  html[data-dsh-workspace-layout] body * {
    scrollbar-width:thin !important;
    scrollbar-color:color-mix(in srgb,var(--dsw-alias-label-secondary,#9296a0) 52%,transparent) transparent !important;
  }
}
html[data-dsh-workspace-layout] [data-composer-seat][data-dsh-workspace-fade] {
  --dsh-workspace-fade-length:56px;
  padding-top:var(--dsh-workspace-fade-length) !important;
}
html[data-dsh-workspace-layout] [data-composer-seat][data-dsh-workspace-fade] > [data-dsh-workspace-curtain] {
  position:absolute;
  inset:0 auto 0 50%;
  width:min(100%, calc(var(--dsh-composer-card-max-width, 712px) + 32px));
  translate:-50% 0;
  z-index:-1;
  background:linear-gradient(to bottom,
    transparent 0px,
    var(--dsh-workspace-curtain-color,#101a2a) var(--dsh-workspace-fade-length));
  pointer-events:auto;
  user-select:none;
}
html[data-dsh-workspace-layout] [data-composer-seat]:not([data-dsh-workspace-fade]) > [data-dsh-workspace-curtain] { display:none; }
html[data-dsh-workspace-layout] [data-composer-seat][data-dsh-workspace-fade] [data-composer-card] {
  box-shadow:none !important;
}
html[data-dsh-workspace-layout] [data-dsh-workspace-panel] {
  min-width:0;
  max-width:100%;
}
html[data-dsh-workspace-pet-hidden] [data-shark-companion] { visibility:hidden; }
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-root] {
  position:relative;
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-body] {
  box-sizing:border-box;
  margin-inline-end:calc(var(--dsh-inline-workspace-width,244px) + 32px) !important;
  min-width:0;
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-body] {
  --dsh-chat-content-width:min(var(--dsh-chat-user-width,800px),max(240px,calc(var(--dsh-conversation-column-width,720px) - 64px))) !important;
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-root][data-inline-compact] > [data-dsh-workspace-inline-body] {
  margin-inline-end:0 !important;
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-host] {
  position:absolute;
  top:var(--dsh-inline-workspace-top,72px);
  right:16px;
  width:var(--dsh-inline-workspace-width,244px);
  height:min(340px,calc(100% - var(--dsh-inline-workspace-top,72px) - 16px - var(--dsh-inline-workspace-pet-space,0px)));
  min-height:120px;
  box-sizing:border-box;
  border:1px solid var(--dsw-alias-border-l2,#ffffff20);
  border-radius:18px;
  overflow:hidden;
  z-index:8;
  background:var(--dsh-workspace-curtain-color,var(--dsw-alias-bg-base));
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-host]:is([data-inline-compact],[data-inline-collapsed]) {
  position:relative;
  top:auto;
  right:auto;
  align-self:flex-end;
  flex:none;
  margin:8px 16px;
  width:min(250px,calc(100% - 32px));
  height:auto;
  min-height:40px;
  max-height:56px;
  border-radius:12px;
}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-root][data-inline-collapsed] > [data-dsh-workspace-inline-body]{margin-inline-end:0!important}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-host][data-inline-collapsed]{width:220px;height:44px;min-height:44px;border-radius:12px}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-host][data-inline-compact][data-inline-expanded]{width:min(230px,calc(100% - 32px));height:var(--dsh-inline-workspace-expanded-height,120px);max-height:none;border-radius:18px}
html[data-dsh-workspace-inline] [data-dsh-workspace-inline-host] [data-dsh-workspace-panel] {
  background:var(--dsh-workspace-curtain-color,var(--dsw-alias-bg-base));
}
`;

export function installLayoutStyle(doc) {
  const style = doc.createElement('style');
  style.dataset.dshWorkspaceLayoutStyle = '';
  style.textContent = LAYOUT_CSS;
  doc.head.appendChild(style);
  return () => style.remove();
}
