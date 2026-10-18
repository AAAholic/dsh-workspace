export const PROGRESS_CSS = String.raw`
.dsw-progress{box-sizing:border-box;min-width:0;padding:10px 12px;font-family:var(--dsw-font-family);font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.dsw-progress h2,.dsw-progress h3,.dsw-progress p{margin:0}
.dsw-progress-overview{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;min-height:20px;margin-bottom:4px;font-size:13px;line-height:20px}
.dsw-progress-headline{min-width:0;color:var(--dsw-alias-label-secondary);font-weight:500}
.dsw-progress-count{flex:none;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsw-progress-overview[data-tone=error] .dsw-progress-headline{color:var(--dsw-alias-state-error-primary)}
.dsw-progress-overview[data-tone=warning] .dsw-progress-headline{color:var(--dsw-alias-state-warn-primary)}
.dsw-progress-timeline{--dsw-progress-accent:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,#75caff)) 88%,var(--dsw-alias-bg-base,#111c2e) 12%);--dsw-progress-track:color-mix(in srgb,var(--dsw-alias-label-secondary,#b6c2d4) 35%,var(--dsw-alias-bg-base,#111c2e));position:relative;display:flex;flex-direction:column;list-style:none;margin:0;padding:0}
.dsw-progress-node{box-sizing:border-box;position:relative;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsw-progress-node:not(:last-child):after{content:'';position:absolute;z-index:0;top:12px;bottom:-12px;left:6.5px;width:1px;border-radius:.5px;background:var(--dsw-progress-track)}
.dsw-progress-node[data-status=completed]:not(:last-child):after{background:var(--dsw-progress-accent)}
.dsw-progress-node-row{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr);column-gap:8px;align-items:start;min-height:24px;padding:2px 0;box-sizing:border-box}
.dsw-progress-node-row[data-has-meta=true]{grid-template-columns:14px minmax(0,1fr) auto}
.dsw-progress-stage>.dsw-progress-node-row>.dsw-progress-node-label{font-weight:600}
.dsw-progress-marker{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:10px;height:10px;margin-top:5px;margin-left:2px;border:1.25px solid var(--dsw-progress-track);border-radius:50%;background:var(--dsh-workspace-curtain-color,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font:600 10px/10px var(--dsw-font-family)}
.dsw-progress-node-label{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsw-progress-node-status,.dsw-progress-node-count{font-size:13px;line-height:20px;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsw-progress-node[data-status=completed]>.dsw-progress-node-row>.dsw-progress-marker{border-color:var(--dsw-progress-accent);background:var(--dsw-progress-accent)}
.dsw-progress-node:is([data-status=completed],[data-status=in_progress])>.dsw-progress-node-row>.dsw-progress-node-label{color:var(--dsw-alias-label-primary)}
.dsw-progress-node[data-status=in_progress]>.dsw-progress-node-row>.dsw-progress-node-label{font-weight:600}
.dsw-progress-node[data-status=in_progress]>.dsw-progress-node-row>.dsw-progress-marker{border-color:var(--dsw-progress-accent);border-width:1.5px;box-shadow:none}
.dsw-progress-node:is([data-status=waiting],[data-status=stopped])>.dsw-progress-node-row>.dsw-progress-marker{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
.dsw-progress-node[data-status=error]>.dsw-progress-node-row>.dsw-progress-marker{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dsw-progress-node[data-status=error]>.dsw-progress-node-row>.dsw-progress-node-status{color:var(--dsw-alias-state-error-primary)}
.dsw-progress-subtasks{list-style:none;margin:0 0 2px 22px;padding:0}
.dsw-progress-subtask>.dsw-progress-node-row{grid-template-columns:10px minmax(0,1fr);column-gap:7px;min-height:22px;padding:1px 0}
.dsw-progress-subtask>.dsw-progress-node-row[data-has-meta=true]{grid-template-columns:10px minmax(0,1fr) auto}
.dsw-progress-subtask>.dsw-progress-node-row>.dsw-progress-marker{width:7px;height:7px;margin-top:6.5px;margin-left:1.5px;border-width:1px;font-size:9px;line-height:7px}
.dsw-progress-subtask:not(:last-child):after{top:11px;bottom:-11px;left:4.5px}
.dsw-progress-details,.dsw-progress-files{margin-top:6px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:3px;font-size:13px;line-height:20px}
.dsw-progress-details>summary,.dsw-progress-files>summary{display:flex;align-items:center;gap:5px;min-height:26px;width:fit-content;max-width:100%;list-style:none;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;border-radius:4px}
.dsw-progress-details>summary:before,.dsw-progress-files>summary:before{content:'›';display:inline-block;flex:none;width:10px;text-align:center;font-size:16px;line-height:20px}
.dsw-progress-details[open]>summary:before,.dsw-progress-files[open]>summary:before{transform:rotate(90deg)}
.dsw-progress-details>summary::-webkit-details-marker,.dsw-progress-files>summary::-webkit-details-marker{display:none}
.dsw-progress-detail-section{padding:5px 0}
.dsw-progress-detail-section h3{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-bottom:3px}
.dsw-progress-note{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);padding:4px 0}
.dsw-progress-dot{display:inline-block;box-sizing:border-box;flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);opacity:.75}
.dsw-progress-dot[data-status=running],.dsw-progress-dot[data-status=in_progress],.dsw-progress-dot[data-status=preparing]{background:var(--dsw-alias-state-business-primary);opacity:1}
.dsw-progress-dot[data-status=pending]{background:transparent;border:1px solid var(--dsw-alias-label-tertiary)}
.dsw-progress-dot[data-status=waiting],.dsw-progress-dot[data-status=stopping],.dsw-progress-dot[data-status=stopped]{background:var(--dsw-alias-state-warn-primary);opacity:1}
.dsw-progress-dot[data-status=error]{background:var(--dsw-alias-state-error-primary);opacity:1}
.dsw-progress-activities,.dsw-progress-materials{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.dsw-progress-activity{min-width:0}
.dsw-progress-row-button{box-sizing:border-box;display:flex;gap:6px;align-items:flex-start;width:100%;padding:5px 0;border:0;background:transparent;font:inherit;color:inherit;text-align:left;min-width:0}
.dsw-progress-row-button .dsw-progress-dot{margin-top:6px}
.dsw-progress button.dsw-progress-row-button{cursor:pointer;border:0;background:transparent;border-radius:6px;padding:5px 4px;margin-inline:-4px;width:calc(100% + 8px);font:inherit;color:inherit}
.dsw-progress button.dsw-progress-row-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsw-progress-row-body{display:flex;flex-direction:column;flex:1;min-width:0;gap:2px}
.dsw-progress-row-title{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsw-progress-row-detail{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsw-progress-row-status{font-size:13px;line-height:20px;flex:none;color:var(--dsw-alias-label-secondary)}
.dsw-progress-activity[data-state=error] .dsw-progress-row-status{color:var(--dsw-alias-state-error-primary)}
.dsw-progress-file-button{display:flex;align-items:center;gap:6px;min-width:0;width:100%;padding:5px 0;border:0;color:inherit;background:transparent;font:inherit;text-align:left}
.dsw-progress button.dsw-progress-file-button{cursor:pointer;border-radius:6px;border:0;background:transparent;font:inherit;padding:5px 0;color:inherit}
.dsw-progress button.dsw-progress-file-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsw-progress-file-icon{flex:none;font-size:14px;color:var(--dsw-alias-label-tertiary)}
.dsw-progress-file-label{flex:1;min-width:0;font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsw-progress-file-category{flex:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsw-progress button:focus-visible,.dsw-progress summary:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dsw-progress-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`
