window.__ModuleLoader__.load({id:"dsh-workspace",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// lib/client/index.mjs
var index_exports = {};
__export(index_exports, {
  PLUGINS_KIND: () => PLUGINS_KIND,
  PROGRESS_KIND: () => PROGRESS_KIND,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react3 = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// lib/client/action-registry.mjs
var ActionRegistry = class {
  constructor(onError = () => {
  }, hosted = true) {
    __publicField(this, "providers", /* @__PURE__ */ new Map());
    __publicField(this, "listeners", /* @__PURE__ */ new Set());
    __publicField(this, "snapshot", []);
    __publicField(this, "wrapped", /* @__PURE__ */ new WeakMap());
    __publicField(this, "hosts", /* @__PURE__ */ new Set());
    __publicField(this, "getSnapshot", () => this.snapshot);
    __publicField(this, "subscribe", (listener) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    });
    this.onError = onError;
    this.hosted = hosted;
  }
  claimHost(token) {
    this.hosts.add(token);
    this.setHosted(true);
    return () => {
      this.hosts.delete(token);
      this.setHosted(this.hosts.size > 0);
    };
  }
  setHosted(value) {
    if (this.hosted === value) return;
    this.hosted = value;
    for (const provider of this.providers.values()) this.host(provider, value);
  }
  register(provider) {
    if (!provider || typeof provider.id !== "string" || !Array.isArray(provider.actions)) return false;
    const actions = provider.actions;
    if (actions.some((action2) => !action2 || typeof action2.id !== "string" || typeof action2.label !== "string" || !["toggle", "panel", "command"].includes(action2.kind) || (action2.kind === "panel" ? typeof action2.mount !== "function" : typeof action2.execute !== "function"))) return false;
    if (new Set(actions.map((action2) => action2.id)).size !== actions.length) return false;
    for (const [id, existing] of this.providers) if (id !== provider.id && existing.actions.some((action2) => actions.some((next) => action2.id === next.id))) return false;
    const previous = this.providers.get(provider.id);
    if (previous === provider) return true;
    this.host(previous, false);
    this.providers.set(provider.id, provider);
    this.host(provider, this.hosted);
    this.publish();
    return true;
  }
  host(provider, hosted) {
    try {
      provider?.setHosted?.(hosted);
    } catch (error) {
      this.onError(error);
    }
  }
  remove(id, provider) {
    const existing = this.providers.get(id);
    if (!existing || provider && provider !== existing) return false;
    this.providers.delete(id);
    this.host(existing, false);
    this.publish();
    return true;
  }
  publish() {
    this.snapshot = Array.from(this.providers.values()).flatMap((provider) => {
      if (!this.wrapped.has(provider)) this.wrapped.set(provider, provider.actions.map((action2) => ({ ...action2, ownerId: provider.id, ownerLabel: provider.label || provider.id })));
      return this.wrapped.get(provider);
    });
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.onError(error);
      }
    }
  }
  dispose() {
    for (const provider of this.providers.values()) this.host(provider, false);
    this.providers.clear();
    this.publish();
    this.listeners.clear();
    this.hosts.clear();
  }
};
function connectProviders(doc, registry, openAction) {
  const add = (event) => registry.register(event.detail);
  const remove = (event) => registry.remove(event.detail?.id, event.detail?.provider);
  const open = (event) => {
    if (typeof event.detail?.id === "string") openAction(event.detail.id);
  };
  doc.addEventListener("dsh-workspace:provider", add);
  doc.addEventListener("dsh-workspace:provider-remove", remove);
  doc.addEventListener("dsh-workspace:open-action", open);
  doc.dispatchEvent(new CustomEvent("dsh-workspace:providers-request"));
  return () => {
    doc.removeEventListener("dsh-workspace:provider", add);
    doc.removeEventListener("dsh-workspace:provider-remove", remove);
    doc.removeEventListener("dsh-workspace:open-action", open);
    registry.dispose();
  };
}

// lib/client/plugin-panel.mjs
var import_react = __toESM(require("react"), 1);
var el = import_react.default.createElement;
var DEFAULT = Object.freeze({ writable: true, busy: false, status: "" });
function readAction(action2) {
  try {
    return action2?.getSnapshot?.() || DEFAULT;
  } catch {
    return { writable: false, status: "\u6682\u4E0D\u53EF\u7528" };
  }
}
function useActions(registry) {
  return import_react.default.useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
}
function useActionState(action2) {
  const [state, setState] = import_react.default.useState(() => readAction(action2));
  import_react.default.useEffect(() => {
    const update = () => setState(readAction(action2));
    update();
    let release;
    try {
      release = action2?.subscribe?.(update);
    } catch {
      setState({ writable: false, status: "\u72B6\u6001\u66F4\u65B0\u6682\u4E0D\u53EF\u7528" });
    }
    return () => {
      if (typeof release === "function") {
        try {
          release();
        } catch {
        }
      }
    };
  }, [action2]);
  return state;
}
function ActionButton({ action: action2, openAction, compact = false }) {
  const state = useActionState(action2);
  const [error, setError] = import_react.default.useState("");
  const [pending, setPending] = import_react.default.useState(false);
  const toggle = action2.kind === "toggle";
  const feedback = error || (!compact || state.busy || state.writable === false || /失败|重试|未能|切换/.test(state.status || "") ? state.status : "");
  const invoke = async () => {
    if (state.busy || pending || state.writable === false) return;
    setError("");
    if (action2.kind === "panel") {
      openAction(action2.id);
      return;
    }
    setPending(true);
    try {
      if (await action2.execute() === false) setError("\u672A\u80FD\u5207\u6362\uFF0C\u8BF7\u91CD\u8BD5");
    } catch {
      setError("\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5");
    } finally {
      setPending(false);
    }
  };
  return el(
    "div",
    { className: compact ? "dw-action-compact" : "dw-action-row", "data-workspace-action": action2.id },
    el(
      "button",
      {
        type: "button",
        className: "dw-action-button",
        disabled: state.busy || pending || state.writable === false,
        ...toggle ? { role: "switch", "aria-checked": state.enabled === true } : {},
        "aria-label": toggle ? `${action2.label}\uFF0C${state.enabled ? "\u5DF2\u5F00\u542F" : "\u5DF2\u5173\u95ED"}` : action2.label,
        onClick: invoke
      },
      el("span", null, action2.label),
      toggle && el("span", { className: "dw-switch", "data-checked": state.enabled === true, "aria-hidden": true }, el("span")),
      !compact && !toggle && el("span", { className: "dw-secondary" }, "\u6253\u5F00")
    ),
    feedback && el("span", { className: "dw-action-feedback", role: "status" }, feedback)
  );
}
function QuickActions({ registry, openAction }) {
  const actions = useActions(registry);
  return actions.length ? el(
    "div",
    { className: "dw-quick-actions", "aria-label": "\u5E38\u7528\u63D2\u4EF6" },
    actions.slice(0, 2).map((action2) => el(ActionButton, { key: action2.id, action: action2, openAction, compact: true }))
  ) : null;
}
function MountedPanel({ action: action2 }) {
  const ref = import_react.default.useRef(null);
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    setError("");
    let mounted;
    try {
      mounted = action2.mount(ref.current);
    } catch {
      setError("\u8BBE\u7F6E\u9762\u677F\u6682\u4E0D\u53EF\u7528");
    }
    return () => {
      if (typeof mounted === "function") mounted();
      else mounted?.dispose?.();
    };
  }, [action2]);
  return el("div", { className: "dw-mounted-plugin" }, error && el("p", { role: "status" }, error), el("div", { ref, className: "dw-plugin-mount" }));
}
function PluginPanel({ registry, openAction, actionId }) {
  const actions = useActions(registry);
  const selected = actions.find((action2) => action2.id === actionId && action2.kind === "panel");
  return el(
    "section",
    { className: "dw-plugin-panel" },
    !selected && el("div", { className: "dw-section-heading" }, el("h2", null, "\u63D2\u4EF6\u4E2D\u5FC3"), el("span", { className: "dw-secondary" }, `${actions.length} \u4E2A\u5165\u53E3`)),
    selected ? el(
      import_react.default.Fragment,
      null,
      el("button", { type: "button", className: "dw-back", onClick: () => openAction(null) }, "\u2039 \u5168\u90E8\u63D2\u4EF6"),
      el(MountedPanel, { key: selected.id, action: selected })
    ) : el(
      import_react.default.Fragment,
      null,
      !actions.length && el("p", { className: "dw-secondary" }, "\u5DF2\u5B89\u88C5\u63D2\u4EF6\u63D0\u4F9B\u5FEB\u6377\u5165\u53E3\u540E\uFF0C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002"),
      actions.map((action2) => el(ActionButton, { key: action2.id, action: action2, openAction }))
    )
  );
}
var PLUGIN_CSS = `
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
`;

// lib/client/progress.mjs
var import_react2 = __toESM(require("react"), 1);

// lib/client/action-labels.mjs
var text = (value) => typeof value === "string" ? value.trim() : "";
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var clip = (value, limit = 64) => {
  const chars = Array.from(text(value).replace(/\s+/g, " "));
  return chars.length > limit ? `${chars.slice(0, limit - 1).join("")}\u2026` : chars.join("");
};
function shortFileName(value) {
  const path = text(value).replace(/^['"]|['"]$/g, "");
  if (!path || /[\r\n\x00-\x1f`$]/.test(path) || /^\w+:\/\//.test(path)) return "";
  return clip(path.replaceAll("\\", "/").replace(/\/+$/, "").split("/").at(-1), 40);
}
function conciseFileReferences(value) {
  const fileReference = (path) => !/^\w+:\/\//.test(path) && (/^(?:[A-Za-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])/.test(path) || /^[A-Za-z\d_@.-]+[\\/]/.test(path) && (/[\\/][^\\/]+\.[A-Za-z\d]{1,12}(?::\d+(?::\d+)?)?$/.test(path) || /[\\/](?:README|LICENSE|Dockerfile|Makefile)(?:\.[A-Za-z\d]+)?$/i.test(path)));
  const shorten = (path) => fileReference(path) ? shortFileName(path) || path : path;
  return text(value).replace(/(["'`])([^"'`\n]*[\\/][^"'`\n]*)\1/g, (whole, quote, path) => `${quote}${shorten(path)}${quote}`).replace(
    /https?:\/\/[^\s<>"'`]+|(?<![\p{L}\p{N}_])(?:[A-Za-z]:[\\/]|(?:~|\.{1,2})?[\\/]|[\p{L}\p{N}_@.-]+[\\/])[^\s<>"'`，。；：、（）()\[\]{}]+/gu,
    (path) => shorten(path)
  );
}
function action(verb, paths = [], fallback = "\u6587\u4EF6") {
  const names = [...new Set(paths.map(shortFileName).filter(Boolean))];
  const target = names.slice(0, 2).join("\u3001") + (names.length > 2 ? ` \u7B49${names.length}\u4E2A\u6587\u4EF6` : "");
  return { actionLabel: clip(`${verb}${target ? ` ${target}` : fallback}`), detail: target, detailKind: target ? "file_name" : null };
}
function shellParts(command) {
  const parts = [], tokens = [];
  let value = "", quote = "", started = false, heredoc = false;
  const token = () => {
    if (started) tokens.push(value);
    value = "";
    started = false;
  };
  const part = () => {
    token();
    if (tokens.length) parts.push(tokens.splice(0));
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = "";
      else if (char === "\\" && quote === '"' && /["\\$`\n]/.test(command[i + 1] || "")) value += command[++i] || "";
      else value += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === "\\") {
      value += command[++i] || "";
      started = true;
    } else if (char === "#" && !started) {
      while (i < command.length && command[i] !== "\n") i++;
      part();
    } else if (";|&\n".includes(char)) {
      part();
      if (char === "\n" && heredoc) return parts;
      if (command[i + 1] === char) i++;
    } else if (/\s/.test(char)) token();
    else if (char === "<" || char === ">") {
      const fd = /^\d+$/.test(value) ? value : "";
      if (fd) {
        value = "";
        started = false;
      } else token();
      let operator = char;
      if (command[i + 1] === char) operator += command[++i];
      if (operator === "<<") {
        heredoc = true;
        if (command[i + 1] === "-") operator += command[++i];
      } else if (command[i + 1] === "&") operator += command[++i];
      tokens.push(fd + operator);
    } else {
      value += char;
      started = true;
    }
  }
  part();
  return parts;
}
function operands(tokens, valueOptions = /* @__PURE__ */ new Set()) {
  const values = [];
  let literal = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\d*(?:[<>]{1,2}-?|[<>]&)$/.test(token)) {
      i++;
      continue;
    }
    if (!literal && token === "--") {
      literal = true;
      continue;
    }
    if (!literal && token.startsWith("-")) {
      if (valueOptions.has(token)) i++;
      continue;
    }
    values.push(token);
  }
  return values;
}
var FILE_OPTIONS = /* @__PURE__ */ new Set(["-n", "-c", "--lines", "--bytes", "-s", "--suffix"]);
var SEARCH_OPTIONS = /* @__PURE__ */ new Set([
  "-e",
  "--regexp",
  "-f",
  "--file",
  "-g",
  "--glob",
  "--iglob",
  "-t",
  "--type",
  "-T",
  "--type-not",
  "-m",
  "--max-count",
  "-A",
  "-B",
  "-C",
  "--after-context",
  "--before-context",
  "--context",
  "--max-depth",
  "--encoding",
  "--color",
  "--sort",
  "--sortr",
  "--include",
  "--exclude",
  "--exclude-dir",
  "--exclude-from",
  "--type-add",
  "--type-clear",
  "--ignore-file",
  "--pre",
  "--pre-glob",
  "--path-separator",
  "--replace",
  "-r",
  "--field-match-separator",
  "--field-context-separator",
  "--max-filesize",
  "-j",
  "--threads"
]);
function commandAction(original, depth = 0) {
  const tokens = [...original];
  while (tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || ["env", "command", "sudo"].includes(tokens[0]))) tokens.shift();
  const executable = shortFileName(tokens.shift()) || "";
  const program = executable.toLowerCase();
  if (!program) return null;
  if (["bash", "sh", "zsh", "fish"].includes(program)) {
    const index = tokens.findIndex((token) => /^-[a-z]*c[a-z]*$/i.test(token));
    if (index !== -1 && tokens[index + 1] && depth < 2) return summarizeCommand(tokens[index + 1], depth + 1);
  }
  const redirect = tokens.findIndex((token, index) => /^\d*>{1,2}$/.test(token) && tokens[index + 1] && !/^(?:\/dev\/(?:null|stdout|stderr|stdin|fd\/\d+)|\d+|-)$/.test(tokens[index + 1]));
  if (redirect !== -1 && tokens[redirect + 1]) return action("\u7F16\u5199", [tokens[redirect + 1]]);
  if (["cd", "pwd", "echo", "printf", "true", "sleep", "export", "set"].includes(program)) return {
    setup: true,
    actionLabel: program === "cd" ? "\u5207\u6362\u5DE5\u4F5C\u76EE\u5F55" : "\u51C6\u5907\u5DE5\u4F5C\u73AF\u5883",
    detail: "",
    detailKind: null
  };
  if (["cat", "head", "tail", "less", "more"].includes(program)) return action("\u6253\u5F00", operands(tokens, FILE_OPTIONS));
  if (["sed", "awk"].includes(program)) {
    const inlineScript = tokens.some((token) => ["-e", "-f", "--expression", "--file"].includes(token));
    const files = operands(tokens, /* @__PURE__ */ new Set(["-e", "-f", "--expression", "--file"]));
    if (tokens.includes("-i") && files[0] === "") files.shift();
    if (!inlineScript) files.shift();
    return action(tokens.some((token) => token === "-i" || token.startsWith("-i.")) ? "\u7F16\u8F91" : "\u6253\u5F00", files);
  }
  if (["rg", "grep", "ag"].includes(program)) {
    const files = operands(tokens, SEARCH_OPTIONS);
    const explicitPattern = tokens.some((token) => ["-e", "--regexp", "-f", "--file"].includes(token) || /^--regexp=/.test(token));
    if (!tokens.includes("--files") && !explicitPattern) files.shift();
    return action(tokens.includes("--files") ? "\u67E5\u627E" : "\u68C0\u67E5", files, tokens.includes("--files") ? "\u6587\u4EF6" : "\u4EE3\u7801\u5185\u5BB9");
  }
  if (program === "git") {
    while (tokens.length && tokens[0].startsWith("-")) {
      const option = tokens.shift();
      if (["-C", "-c", "--git-dir", "--work-tree"].includes(option)) tokens.shift();
    }
    const subcommand = tokens.shift();
    const divider = tokens.indexOf("--");
    const files = divider === -1 ? operands(tokens).filter((token) => /[\\/]|\.[A-Za-z\d]+$/.test(token) && !token.includes("..")) : tokens.slice(divider + 1);
    if (["diff", "show"].includes(subcommand)) return action("\u68C0\u67E5", files, "\u6587\u4EF6\u6539\u52A8");
    if (["status", "log", "branch", "rev-parse", "ls-files"].includes(subcommand)) return { actionLabel: { status: "\u68C0\u67E5\u4ED3\u5E93\u72B6\u6001", log: "\u67E5\u770B\u63D0\u4EA4\u8BB0\u5F55", branch: "\u67E5\u770B\u5206\u652F", "rev-parse": "\u68C0\u67E5\u4ED3\u5E93\u4FE1\u606F", "ls-files": "\u67E5\u627E\u4ED3\u5E93\u6587\u4EF6" }[subcommand], detail: "", detailKind: null };
    return { actionLabel: { add: "\u6574\u7406\u6587\u4EF6\u6539\u52A8", commit: "\u63D0\u4EA4\u4EE3\u7801", push: "\u4E0A\u4F20\u4EE3\u7801", pull: "\u540C\u6B65\u4EE3\u7801", fetch: "\u83B7\u53D6\u8FDC\u7A0B\u66F4\u65B0", checkout: "\u5207\u6362\u4EE3\u7801\u7248\u672C", switch: "\u5207\u6362\u5206\u652F" }[subcommand] || "\u68C0\u67E5 Git \u4ED3\u5E93", detail: "", detailKind: null };
  }
  if (["node", "nodejs", "python", "python3", "ruby", "perl", "bash", "sh", "zsh"].includes(program)) {
    if (tokens.includes("--test") || tokens.some((token) => /^(?:pytest|unittest)$/.test(token))) return action("\u6D4B\u8BD5", operands(tokens, /* @__PURE__ */ new Set(["-m"])), "\u4EE3\u7801");
    if (tokens.some((token) => ["-e", "-c", "--eval", "-"].includes(token))) return { actionLabel: "\u8FD0\u884C\u811A\u672C", detail: "", detailKind: null };
    return action("\u8FD0\u884C", operands(tokens).slice(0, 1), "\u811A\u672C");
  }
  if (["npm", "pnpm", "yarn", "bun"].includes(program)) {
    const task = tokens[0] === "run" ? tokens[1] : tokens[0];
    return { actionLabel: { test: "\u8FD0\u884C\u6D4B\u8BD5", build: "\u6784\u5EFA\u9879\u76EE", check: "\u68C0\u67E5\u9879\u76EE", lint: "\u68C0\u67E5\u4EE3\u7801\u683C\u5F0F", install: "\u5B89\u88C5\u4F9D\u8D56", ci: "\u5B89\u88C5\u4F9D\u8D56", dev: "\u542F\u52A8\u9884\u89C8", start: "\u542F\u52A8\u5E94\u7528" }[task] || `\u8FD0\u884C ${executable}`, detail: "", detailKind: null };
  }
  if (program === "find") {
    const start = tokens[0] === "-H" || tokens[0] === "-L" || tokens[0] === "-P" ? 1 : 0;
    const end = tokens.findIndex((token, index) => index >= start && (token.startsWith("-") || ["!", "(", ")"].includes(token)));
    return action("\u67E5\u627E", tokens.slice(start, end === -1 ? tokens.length : end).filter((token) => token !== "."));
  }
  if (["ls", "stat", "wc", "file", "du"].includes(program)) return action("\u68C0\u67E5", operands(tokens).filter((token) => token !== "."), "\u6587\u4EF6");
  if (["touch", "mkdir"].includes(program)) return action("\u521B\u5EFA", operands(tokens), program === "mkdir" ? "\u76EE\u5F55" : "\u6587\u4EF6");
  if (["cp", "mv"].includes(program)) return action(program === "cp" ? "\u590D\u5236" : "\u79FB\u52A8", operands(tokens));
  if (program === "apply_patch") return action("\u7F16\u8F91");
  return { actionLabel: /^[\p{L}\p{N}_.+-]+$/u.test(executable) ? clip(`\u8FD0\u884C ${executable}`) : "\u8FD0\u884C\u811A\u672C", detail: "", detailKind: null };
}
function summarizeCommand(command, depth = 0) {
  if (!text(command) || command.length > 1e5) return { actionLabel: "\u8FD0\u884C\u811A\u672C", detail: "", detailKind: null };
  const patchFiles = [...command.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)].map((match) => match[1]);
  if (patchFiles.length && /\bapply_patch\b/.test(command)) return action("\u7F16\u8F91", patchFiles);
  const parsed = shellParts(command).map((tokens) => commandAction(tokens, depth)).filter(Boolean);
  const useful = parsed.filter((item) => !item.setup);
  const selected = useful.length ? useful : parsed;
  const meaningful = selected.length > 1 ? selected.filter((item) => item.actionLabel !== "\u6253\u5F00\u6587\u4EF6") : selected;
  const unique = [...new Map((meaningful.length ? meaningful : selected).map((item) => [item.actionLabel, item])).values()];
  if (!unique.length) return { actionLabel: "\u8FD0\u884C\u811A\u672C", detail: "", detailKind: null };
  if (unique.length === 1) {
    const { setup, ...result } = unique[0];
    return result;
  }
  return {
    actionLabel: clip(unique.slice(0, 2).map((item) => item.actionLabel).join("\uFF1B") + (unique.length > 2 ? " \u7B49\u64CD\u4F5C" : "")),
    detail: "",
    detailKind: null
  };
}
function describeToolAction(name2, raw, fallback = "\u5904\u7406\u4EFB\u52A1") {
  let args;
  if (typeof raw === "string" && raw.length <= 1e5) {
    try {
      args = JSON.parse(raw);
    } catch {
    }
  }
  const empty = { actionLabel: fallback, detail: "", detailKind: null };
  if (!record(args)) return empty;
  const tool = text(name2).split(/__|[.:]/).at(-1);
  if (["bash", "exec", "exec_command", "shell", "run_command"].includes(tool)) return summarizeCommand(args.command || args.cmd || args.script);
  const paths = [args.file_path, args.path, args.filename, args.file, args.target_file].filter((value) => typeof value === "string");
  if (["read", "read_file", "open_file"].includes(tool)) return action("\u6253\u5F00", paths);
  if (["write", "write_file", "create_file"].includes(tool)) return action("\u7F16\u5199", paths);
  if (["edit", "edit_file", "str_replace_editor", "apply_patch"].includes(tool)) {
    const patchFiles = [...text(args.patch || args.input).matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)].map((match) => match[1]);
    return action("\u7F16\u8F91", paths.length ? paths : patchFiles);
  }
  if (["rg", "grep", "search_files"].includes(tool)) return action("\u68C0\u67E5", paths, "\u4EE3\u7801\u5185\u5BB9");
  if (["glob", "list_files"].includes(tool)) return action("\u67E5\u627E", paths);
  if (["web_fetch", "fetch", "open_url"].includes(tool) && text(args.url)) {
    try {
      const host = new URL(args.url).hostname;
      return { actionLabel: `\u67E5\u770B ${host}`, detail: host, detailKind: "hostname" };
    } catch {
      return empty;
    }
  }
  return { ...empty, detail: paths.map(shortFileName).filter(Boolean).slice(0, 2).join("\u3001"), detailKind: paths.length ? "file_name" : null };
}

// lib/client/progress-timeline.mjs
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var list = (value) => Array.isArray(value) ? value : [];
var text2 = (value) => typeof value === "string" ? value.trim() : "";
var finite = (value) => typeof value === "number" && Number.isFinite(value);
var clip2 = (value, limit = 24) => {
  const chars = Array.from(text2(value).replace(/\s+/g, " "));
  return chars.length > limit ? chars.slice(0, limit - 1).join("") + "\u2026" : chars.join("");
};
var ACTIONS = Object.freeze({
  inspect: "\u68C0\u67E5",
  review: "\u5BA1\u67E5",
  audit: "\u5BA1\u6838",
  check: "\u68C0\u67E5",
  research: "\u8C03\u7814",
  investigate: "\u6392\u67E5",
  explore: "\u68B3\u7406",
  analyze: "\u5206\u6790",
  analyse: "\u5206\u6790",
  implement: "\u5B9E\u73B0",
  develop: "\u5F00\u53D1",
  build: "\u6784\u5EFA",
  create: "\u521B\u5EFA",
  add: "\u6DFB\u52A0",
  update: "\u66F4\u65B0",
  refactor: "\u91CD\u6784",
  fix: "\u4FEE\u590D",
  test: "\u6D4B\u8BD5",
  validate: "\u9A8C\u8BC1",
  verify: "\u9A8C\u8BC1",
  run: "\u8FD0\u884C",
  compare: "\u5BF9\u6BD4",
  document: "\u8BB0\u5F55",
  summarize: "\u603B\u7ED3",
  write: "\u7F16\u5199",
  read: "\u8BFB\u53D6",
  search: "\u641C\u7D22",
  remove: "\u5220\u9664",
  simplify: "\u7B80\u5316",
  optimize: "\u4F18\u5316",
  migrate: "\u8FC1\u79FB",
  deploy: "\u90E8\u7F72",
  package: "\u6253\u5305",
  plan: "\u89C4\u5212",
  design: "\u8BBE\u8BA1",
  integrate: "\u96C6\u6210",
  prepare: "\u51C6\u5907"
});
var SUBJECTS = Object.freeze({
  "account settings panel": "\u8D26\u6237\u8BBE\u7F6E\u9762\u677F",
  "responsive navigation": "\u54CD\u5E94\u5F0F\u5BFC\u822A",
  "customer requirements": "\u7528\u6237\u9700\u6C42",
  "progress module": "\u8FDB\u5EA6\u6A21\u5757",
  "deployment config": "\u90E8\u7F72\u914D\u7F6E",
  "source code": "\u6E90\u4EE3\u7801",
  "regression tests": "\u56DE\u5F52\u6D4B\u8BD5",
  "native navigation": "\u539F\u751F\u5BFC\u822A",
  "user data": "\u7528\u6237\u6570\u636E",
  "final response": "\u6700\u7EC8\u56DE\u590D",
  "configuration": "\u914D\u7F6E",
  "requirements": "\u9700\u6C42",
  "navigation": "\u5BFC\u822A",
  "responsive": "\u54CD\u5E94\u5F0F",
  "implementation": "\u5B9E\u73B0",
  "deployment": "\u90E8\u7F72",
  "settings": "\u8BBE\u7F6E",
  "progress": "\u8FDB\u5EA6",
  "interface": "\u754C\u9762",
  "layout": "\u5E03\u5C40",
  "backend": "\u540E\u7AEF",
  "frontend": "\u524D\u7AEF",
  "customer": "\u7528\u6237",
  "account": "\u8D26\u6237",
  "panel": "\u9762\u677F",
  "module": "\u6A21\u5757",
  "changes": "\u6539\u52A8",
  "change": "\u6539\u52A8",
  "files": "\u6587\u4EF6",
  "file": "\u6587\u4EF6",
  "config": "\u914D\u7F6E",
  "results": "\u7ED3\u679C",
  "findings": "\u53D1\u73B0",
  "risks": "\u98CE\u9669",
  "tests": "\u6D4B\u8BD5",
  "code": "\u4EE3\u7801"
});
function localSubject(value) {
  const identifiers = [];
  let result = value.replace(
    /`[^`]+`|https?:\/\/\S+|(?:\.{0,2}\/)?[\w./-]+\.[A-Za-z0-9]{1,8}\b|(?:\/|\.\.?\/)[\w./-]+|\b[A-Z][A-Z0-9]{1,8}\b/g,
    (match) => `\0${identifiers.push(match.startsWith("`") ? match.slice(1, -1) : match) - 1}\0`
  );
  for (const [english, chinese] of Object.entries(SUBJECTS)) result = result.replace(new RegExp(`\\b${english}\\b`, "gi"), chinese);
  result = result.replace(/\b(?:the|a|an)\s+/gi, "").replace(/\s+and\s+/gi, "\u4E0E");
  return result.replace(/\u0000(\d+)\u0000/g, (_, index) => identifiers[Number(index)]).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu, "$1").trim();
}
function conciseTaskLabel(content, index = 0) {
  const original = conciseFileReferences(text2(content)).replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "");
  if (!original) return "\u672A\u547D\u540D\u4E8B\u9879";
  const forbidden = original.match(/^(?:do not|don['’]t|never|avoid)\s+(\w+)(.*)$/i);
  if (forbidden) {
    const verb2 = forbidden[1].toLowerCase().replace(/ing$/, "");
    const action3 = ACTIONS[verb2] ?? (verb2 === "deploy" ? "\u90E8\u7F72" : forbidden[1]);
    return clip2(`\u4E0D\u8981${action3}${localSubject(forbidden[2].replace(/^\s*[:：]\s*/, ""))}`);
  }
  if (/^implement\s+no\s+changes\b/i.test(original)) return "\u4E0D\u4F5C\u4FEE\u6539";
  const main = original.split(/\s+without\s+|[，,。；;\n]/i)[0].trim();
  if (/[\u3400-\u9fff]/u.test(original)) {
    if (!/[\u3400-\u9fff]/u.test(main)) return conciseTaskLabel(main, index);
    let withoutPrefix = original;
    const prefix = original.match(/^([A-Za-z][A-Za-z -]*)\s*[:：]\s*(?=[\u3400-\u9fff])/u);
    if (prefix) {
      const label = prefix[1].trim(), lower2 = label.toLowerCase();
      if (/^(?:recon|deep-dive(?:\s+\w+)?)$/.test(lower2)) withoutPrefix = original.slice(prefix[0].length);
      else if (ACTIONS[lower2]) withoutPrefix = `${ACTIONS[lower2]}\uFF1A${original.slice(prefix[0].length)}`;
      else if (lower2 === "read-only") withoutPrefix = `\u53EA\u8BFB\uFF1A${original.slice(prefix[0].length)}`;
      else if (!/^[A-Z][A-Z0-9]{1,7}$/.test(label)) withoutPrefix = `${clip2(label, 8)}\uFF1A${original.slice(prefix[0].length)}`;
    }
    const translatedLead = withoutPrefix.replace(/^([A-Za-z]+)\b/, (word) => ACTIONS[word.toLowerCase()] ?? word);
    const sentence = translatedLead.replace(/^(?:我会|我们将|接下来(?:会|将)?)[，,:：\s]*/, "");
    const clauses = sentence.split(/[，,。；;\n]/u).map(text2).filter(Boolean);
    const first = clauses[0] ?? sentence;
    return clip2(first, 24);
  }
  const lower = main.toLowerCase();
  if (/^(?:recon\s*:|identify\b|inspect\b|check\b)/.test(lower) && /\b(?:artifacts|deployed state|current state|existing implementation)\b/.test(lower)) return "\u6838\u5BF9\u73B0\u72B6";
  const task = lower.replace(/^deep-dive\s+\w+\s*:\s*/, "");
  if (/^(?:adversarial\s+)?(?:review|audit)\s+(?:of\s+)?(?:the\s+)?(?:layout|responsive|interface|ui)(?![\w.-])/.test(task)) return "\u5BA1\u67E5\u754C\u9762";
  if (/^(?:adversarial\s+)?(?:review|audit)\s+(?:of\s+)?(?:the\s+)?(?:progress|session boundaries)(?![\w.-])/.test(task)) return /progress module/.test(task) ? "\u5BA1\u67E5\u8FDB\u5EA6\u6A21\u5757" : "\u5BA1\u67E5\u8FDB\u5EA6";
  if (/^(?:validate|verify|test|check)\b/.test(lower) && /\b(?:failed|failure|cancelled|canceled|error|interruptions)\b/.test(lower)) return "\u68C0\u67E5\u5F02\u5E38";
  if (/^(?:run|verify|validate|test)\b/.test(lower) && /\bregression\b/.test(lower)) return "\u56DE\u5F52\u9A8C\u8BC1";
  if (/^summari[sz]e\b/.test(lower) && /\b(?:findings|results|changes|conclusions)\b/.test(lower)) return "\u603B\u7ED3\u7ED3\u8BBA";
  const verb = lower.match(/^([a-z]+)\b/)?.[1];
  const action2 = ACTIONS[verb];
  if (action2) {
    const subject = localSubject(main.replace(/^[a-z]+\s*[:：]?\s*(?:the\s+)?/i, ""));
    return clip2(`${action2}${subject ? `\uFF1A${subject}` : ""}`);
  }
  return clip2(`\u539F\u6587\uFF1A${localSubject(main)}`, 24);
}
function normalize(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = /* @__PURE__ */ new Set(), result = [];
  for (const item of raw) {
    const content = text2(item?.content);
    if (!object(item) || !content || !["pending", "in_progress", "completed"].includes(item.status) || seen.has(content)) return null;
    seen.add(content);
    result.push({ content, status: item.status });
  }
  return result;
}
function currentNodes(chat, turnId) {
  if (!Array.isArray(chat?.order) || typeof chat?.nodes?.get !== "function") return [];
  return chat.order.map((key) => chat.nodes.get(key)).filter((node) => node?.visibility !== "hidden" && ["turn", "step"].includes(node?.location?.kind) && node.location.turn?.turn === turnId);
}
function successfulPlans(nodes) {
  const found = [], seen = /* @__PURE__ */ new Set();
  const visit = (tool, depth = 0) => {
    if (!object(tool) || depth > 32 || !text2(tool.callId) || seen.has(tool.callId)) return;
    seen.add(tool.callId);
    if (tool.kind === "tool-result" && tool.call?.name === "todo_write" && tool.isError !== true && !tool.error) found.push(tool);
    for (const child of list(tool.subCalls)) visit(child, depth + 1);
  };
  for (const node of nodes) if (node.kind === "tool-call") visit(node.data?.root);
  return found.sort((a, b) => (finite(a.callTime) && finite(b.callTime) ? a.callTime - b.callTime : 0) || (finite(a.seq) ? a.seq : -1) - (finite(b.seq) ? b.seq : -1) || (finite(a.time) ? a.time : -1) - (finite(b.time) ? b.time : -1));
}
function readPlan(todos, allowProjection, nodes) {
  if (allowProjection && todos !== null && todos !== void 0) return { items: normalize(todos), source: "projection" };
  const receipt = successfulPlans(nodes).at(-1);
  if (!receipt) return { items: [], source: "none" };
  const raw = receipt.call?.argsRaw;
  if (typeof raw !== "string" || raw.length > 2e5) return { items: null, source: "receipt" };
  try {
    return { items: normalize(JSON.parse(raw)?.todos), source: "receipt" };
  } catch {
    return { items: null, source: "receipt" };
  }
}
function replyData(data) {
  const final = data?.finalNode;
  const blocks = list(data?.blocks ?? final?.blocks);
  return final?.kind === "assistant" && finite(final.seq) && final.interrupted !== true && blocks.some((block) => block?.kind === "text" && text2(block.text)) && !blocks.some((block) => block?.kind === "tool-call");
}
function hasFinalReply(turn, nodes) {
  const tail = turn?.data?.get?.("turn-tail");
  if (tail?.turn === turn.turn) return tail.branchUnavailable === false && replyData(tail.closing);
  const candidates = nodes.filter((node) => node.kind === "assistant-step" && replyData(node.data));
  const final = candidates.sort((a, b) => a.data.finalNode.seq - b.data.finalNode.seq).at(-1);
  if (!final) return false;
  const seq = final.data.finalNode.seq;
  return nodes.every((node) => {
    if (node.kind === "tool-call") return node.data?.root?.kind === "tool-result" && finite(node.data.root.seq) && node.data.root.seq < seq;
    return node.kind !== "assistant-step" || node === final || finite(node.data?.finalNode?.seq) && node.data.finalNode.seq <= seq;
  });
}
var planningTask = (content) => /^(?:制定|整理|拟定|明确|更新)?(?:任务|实施|执行|工作)?(?:计划|规划)(?:[：:\s]|$)/u.test(content) || /^(?:plan\b|(?:create|prepare|write|update)\s+(?:an?\s+)?(?:implementation\s+|task\s+)?plan\b)/i.test(content);
var summaryTask = (content) => /^(?:总结(?:回复|结论|结果)?|汇总(?:发现|结果|结论)|整理(?:结论|回复)|最终回复)(?:[：:，,\s]|$)/u.test(content) || /^summari[sz]e\s+(?:the\s+)?(?:findings|results|conclusions|final\s+(?:response|reply))\b|^(?:provide|write|deliver)\s+(?:a\s+)?final\s+(?:response|reply|summary)\b/i.test(content);
function requestOriginal(nodes) {
  const inputs = nodes.filter((node) => ["user", "steering"].includes(node.kind) && (!node.data?.source?.kind || node.data.source.kind === "user"));
  inputs.sort((a, b) => Number(a.kind === "steering") - Number(b.kind === "steering") || (a.data?.seq ?? 0) - (b.data?.seq ?? 0));
  for (const node of inputs) {
    const original = list(node.data?.content).filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("").trim();
    if (original && !/^(?:好[的啊]?|可以|继续|停止|暂停|谢谢|ok|yes|no)[。.!！\s]*$/i.test(original)) return original;
  }
  return "";
}
var CONTROL_TOOLS = /* @__PURE__ */ new Set(["todo_write", "ask_question", "ask_user_question", "submit_plan"]);
function activityGroups(tools, { closed, normal, stale, phaseStatus }) {
  const grouped = /* @__PURE__ */ new Map();
  const rows = list(tools).filter((row) => text2(row.id) && text2(row.name) && !CONTROL_TOOLS.has(row.name)).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  for (const row of rows) {
    const label = text2(row.actionLabel) || text2(row.label) || row.name;
    if (!grouped.has(label)) grouped.set(label, { id: row.id, label, rows: [], order: row.order ?? grouped.size });
    const group = grouped.get(label);
    group.rows.push(row);
    group.order = row.order ?? group.order;
  }
  return [...grouped.values()].map((group) => {
    const statuses = group.rows.map((row) => row.status === "done" ? "completed" : ["running", "preparing", "unknown"].includes(row.status) ? stale ? "unknown" : normal ? "completed" : closed ? phaseStatus : row.status === "unknown" ? "unknown" : "in_progress" : row.status);
    const status = ["in_progress", "waiting"].find((value) => statuses.includes(value)) ?? statuses.at(-1) ?? phaseStatus;
    const original = group.rows.map((row) => `${row.actionLabel || row.label || row.name} [${row.id}]`).join("\n");
    return {
      id: `activity:${group.id}`,
      source: "tool-activity",
      status,
      label: clip2(group.label, 32),
      original,
      order: group.order,
      callIds: group.rows.map((row) => row.id),
      returned: statuses.filter((value) => value === "completed").length,
      totalCalls: statuses.length
    };
  }).sort((a, b) => {
    const priority = (node) => ["in_progress", "waiting"].includes(node.status) ? 0 : ["error", "stopped"].includes(node.status) ? 1 : 2;
    return priority(a) - priority(b) || b.order - a.order;
  }).slice(0, 4).sort((a, b) => a.order - b.order);
}
function aggregate(items, fallback) {
  if (!items.length) return fallback;
  if (items.every((item) => item.status === "completed")) return "completed";
  for (const status of ["error", "stopped", "unknown", "waiting", "in_progress"]) if (items.some((item) => item.status === status)) return status;
  return "pending";
}
function phase(id, label, status, items = []) {
  const node = { id, label, status };
  if (items.length === 1 && id !== "execution") node.original = items[0].original;
  else if (items.length) node.children = items;
  if (items.length) {
    node.completed = items.filter((item) => item.status === "completed").length;
    node.total = items.length;
  }
  return node;
}
function deriveTimeline({ sessionId, turnId, state = {}, plan, tools = [], jobs = [], children = [], chat, session = {}, status, todos } = {}) {
  const empty = { nodes: [], completed: 0, total: 0, headline: state.label || "\u7B49\u5F85\u5F00\u59CB", tone: state.tone || "neutral", pendingCount: 0 };
  if (!sessionId || turnId === null || turnId === void 0 || session?.sessionId && session.sessionId !== sessionId || session?.removed) return empty;
  const turn = chat?.timeline?.turns?.get?.(turnId);
  if (!object(turn) || turn.turn !== turnId) return empty;
  const selected = currentNodes(chat, turnId);
  const latest = list(chat?.timeline?.turnOrder).at(-1) === turnId;
  if (!latest) return empty;
  const recovered = readPlan(todos, latest, selected);
  const items = recovered.items ?? [];
  const closed = turn.status === "closed", reason = turn.end?.data?.reason?.kind;
  const normal = closed && reason === "completed";
  const stopped = closed && ["aborted", "interrupted", "max-tokens", "blocked"].includes(reason);
  const failed = closed && reason === "error";
  const terminal = failed ? "error" : "stopped";
  const stale = state.stale === true || session.openState === "error" || Boolean(session.openError) || session.openState === "loading" || session.awaitingFirstTurn === true;
  const pending = status?.pendingInteraction;
  const waiting = !closed && (state.waiting === true || pending && (!pending.sessionId || pending.sessionId === sessionId));
  const live = list(tools).filter((row) => ["running", "preparing"].includes(row.status)).length;
  const background = [...list(jobs), ...list(children)].some((row) => ["running", "stopping", "waiting", "unknown"].includes(row.status));
  const active = !stale && !closed && (state.active === true || (status?.running ?? session.running) === true);
  const reply = normal && hasFinalReply(turn, selected);
  const phaseStatus = stale ? "unknown" : closed ? normal ? "completed" : terminal : waiting && live === 0 ? "waiting" : active ? "in_progress" : "pending";
  const planning = [], executing = [], summarizing = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const nodeStatus = item.status === "completed" ? "completed" : closed ? normal ? "completed" : item.status === "in_progress" ? terminal : "pending" : item.status === "in_progress" ? phaseStatus : "pending";
    const target = planningTask(item.content) ? planning : summaryTask(item.content) ? summarizing : executing;
    target.push({ id: `task:${index}`, label: conciseTaskLabel(item.content, index), status: nodeStatus, original: item.content, source: "plan" });
  }
  const groups = items.length ? [] : activityGroups(tools, { closed, normal, stale, phaseStatus });
  const toolEvidence = groups.length > 0 || selected.some((node) => {
    const root = node.kind === "tool-call" ? node.data?.root : null;
    const name2 = root?.call?.name ?? root?.name;
    return object(root) && !["ask_question", "ask_user_question", "submit_plan", "todo_write"].includes(name2);
  });
  const responseEvidence = selected.some((node) => node.kind === "assistant-step" && list(node.data?.blocks ?? node.data?.finalNode?.blocks).some((block) => block?.kind === "text" && text2(block.text)));
  const planningFallback = normal || items.length > 0 || toolEvidence || responseEvidence ? "completed" : phaseStatus;
  const planningStatus = normal ? "completed" : aggregate(planning, planningFallback);
  let executionStatus;
  if (items.length) executionStatus = aggregate(
    executing,
    planningStatus === "completed" && (reply || summarizing.length > 0 && summarizing.every((item) => item.status === "completed")) ? "completed" : phaseStatus
  );
  else {
    executionStatus = closed || stale ? phaseStatus : toolEvidence || responseEvidence ? phaseStatus : "pending";
    executing.push(...groups);
  }
  const liveWork = tools.some((row) => ["running", "preparing"].includes(row.status) && !CONTROL_TOOLS.has(row.name));
  if (active && liveWork && !planning.some((item) => item.status === "in_progress")) executionStatus = "in_progress";
  const readyForReply = items.length > 0 && planningStatus === "completed" && executionStatus === "completed";
  const summaryFallback = closed ? normal ? "completed" : terminal : active && !waiting && live === 0 && readyForReply ? "in_progress" : "pending";
  let summaryStatus = aggregate(summarizing, summaryFallback);
  if (summaryStatus === "completed") summaryStatus = closed ? normal ? "completed" : terminal : active && !waiting && live === 0 ? "in_progress" : "pending";
  const nodes = [
    phase("received", "\u63A5\u6536\u4EFB\u52A1", "completed"),
    phase("planning", "\u5206\u6790\u89C4\u5212", planningStatus, planning),
    phase("execution", "\u4EFB\u52A1\u6267\u884C", executionStatus, executing),
    phase("summary", "\u603B\u7ED3\u8FD4\u56DE", summaryStatus, summarizing)
  ];
  if (!items.length) {
    delete nodes[2].completed;
    delete nodes[2].total;
    const request = requestOriginal(selected);
    if (request) nodes[3].original = `\u7B54\u590D\u5BF9\u8C61\uFF1A${request}`;
  }
  const completed = nodes.filter((node) => node.status === "completed").length;
  const pendingCount = nodes.length - completed;
  const headline = stale ? state.label || "\u672A\u540C\u6B65" : failed ? "\u51FA\u9519" : stopped ? "\u5DF2\u505C\u6B62" : waiting ? ["\u7B49\u5F85\u56DE\u7B54", "\u7B49\u5F85\u5BA1\u6838", "\u7B49\u5F85\u5BA1\u6279"].includes(state.label) ? state.label : "\u7B49\u5F85\u5904\u7406" : closed ? background ? "\u540E\u53F0\u8FD0\u884C\u4E2D" : normal ? items.length ? "\u5DF2\u5B8C\u6210" : reply ? "\u5DF2\u7B54\u590D" : "\u5DF2\u7ED3\u675F" : "\u5DF2\u7ED3\u675F" : active ? "\u8FDB\u884C\u4E2D" : "\u7B49\u5F85\u5F00\u59CB";
  let tone = stale || stopped || waiting ? "warning" : failed ? "error" : active || background ? "active" : "neutral";
  if (failed && !stale) tone = "error";
  return { nodes, completed, total: nodes.length, headline, tone, pendingCount, evidenceMode: items.length ? "plan" : "activity" };
}

// lib/client/progress-state.mjs
var record2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var text3 = (value) => typeof value === "string" ? value.trim() : "";
var list2 = (value) => Array.isArray(value) ? value : [];
var finite2 = (value) => typeof value === "number" && Number.isFinite(value);
var turnNumber = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
var bound = (value, limit = 120) => {
  const chars = Array.from(text3(value).replace(/\s+/g, " "));
  return chars.length > limit ? `${chars.slice(0, limit - 1).join("")}\u2026` : chars.join("");
};
var TOOL_LABELS = Object.freeze({
  read: "\u8BFB\u53D6\u6587\u4EF6",
  write: "\u5199\u5165\u6587\u4EF6",
  edit: "\u7F16\u8F91\u6587\u4EF6",
  str_replace_editor: "\u7F16\u8F91\u6587\u4EF6",
  bash: "\u8FD0\u884C\u547D\u4EE4",
  exec: "\u8FD0\u884C\u811A\u672C",
  code: "\u8FD0\u884C\u4EE3\u7801",
  rg: "\u641C\u7D22\u5185\u5BB9",
  glob: "\u67E5\u627E\u6587\u4EF6",
  search: "\u641C\u7D22\u8D44\u6599",
  web_search: "\u641C\u7D22\u7F51\u9875",
  web_fetch: "\u8BFB\u53D6\u7F51\u9875",
  todo_write: "\u66F4\u65B0\u8BA1\u5212",
  ask_user_question: "\u7B49\u5F85\u56DE\u7B54",
  ask_question: "\u7B49\u5F85\u56DE\u7B54",
  submit_plan: "\u63D0\u4EA4\u65B9\u6848",
  present: "\u4EA4\u4ED8\u6587\u4EF6",
  spawn: "\u542F\u52A8\u5B50\u4EFB\u52A1",
  subagent: "\u542F\u52A8\u5B50\u4EFB\u52A1",
  job_list: "\u67E5\u770B\u540E\u53F0\u4EFB\u52A1",
  job_read: "\u8BFB\u53D6\u4EFB\u52A1\u8F93\u51FA",
  job_kill: "\u505C\u6B62\u540E\u53F0\u4EFB\u52A1"
});
function toolLabel(name2) {
  return TOOL_LABELS[name2] ?? (bound(name2, 60) || "\u5DE5\u5177\u8C03\u7528");
}
function toolDetail(tool, name2) {
  const raw = tool.kind === "tool-result" ? tool.call?.argsRaw : tool.argsRaw;
  return describeToolAction(name2, raw, toolLabel(name2));
}
function nodeTurn(node) {
  const location = node?.location;
  return location?.kind === "turn" || location?.kind === "step" ? turnNumber(location.turn?.turn) : null;
}
function readChatNodes(chat) {
  if (!Array.isArray(chat?.order) || typeof chat?.nodes?.get !== "function") return [];
  return chat.order.flatMap((key) => {
    const node = chat.nodes.get(key);
    return record2(node) && node.visibility !== "hidden" ? [node] : [];
  });
}
function currentTurnOf(chat) {
  const id = turnNumber(list2(chat?.timeline?.turnOrder).at(-1));
  const turn = id === null ? null : chat.timeline?.turns?.get?.(id);
  return record2(turn) && turn.turn === id ? turn : null;
}
function normalizeTodos(raw) {
  return list2(raw).flatMap((item, index) => {
    if (!record2(item) || !text3(item.content) || !["pending", "in_progress", "completed"].includes(item.status)) return [];
    return [{ key: `${index}:${item.content}`, content: item.content, status: item.status }];
  });
}
function toolRows(nodes, active) {
  const rows = [], seen = /* @__PURE__ */ new Set();
  const visit = (tool, parentId, depth = 0) => {
    if (!record2(tool) || depth > 32 || !text3(tool.callId) || seen.has(tool.callId)) return;
    seen.add(tool.callId);
    const settled = tool.kind === "tool-result";
    const name2 = settled ? tool.call?.name : tool.name;
    const stopped = settled && tool.error?.code === "interrupted";
    const status = settled ? stopped ? "stopped" : tool.isError === true || tool.error ? "error" : "done" : active ? tool.phase === "preparing" ? "preparing" : "running" : "unknown";
    rows.push({
      id: tool.callId,
      parentId,
      order: rows.length,
      name: text3(name2),
      label: toolLabel(text3(name2)),
      ...toolDetail(tool, text3(name2)),
      status,
      time: finite2(tool.time) ? tool.time : null,
      seq: finite2(tool.seq) ? tool.seq : null,
      nested: parentId !== void 0
    });
    for (const child of list2(tool.subCalls)) visit(child, tool.callId, depth + 1);
  };
  for (const node of nodes) if (node.kind === "tool-call") visit(node.data?.root);
  return rows;
}
function selectedPending(sessionId, status) {
  const pending = status?.pendingInteraction;
  return pending && (!pending.sessionId || pending.sessionId === sessionId) ? pending : void 0;
}
function markWaitingTool(tools, pending) {
  if (!pending) return tools;
  const live = tools.filter((row) => ["running", "preparing"].includes(row.status));
  const callId = text3(pending.callId);
  const names = text3(pending.toolName) ? [pending.toolName] : pending.kind === "question" ? ["ask_user_question", "ask_question"] : pending.kind === "plan-review" ? ["submit_plan", "ask_user_question", "ask_question"] : [];
  const candidates = live.filter((row) => callId ? row.id === callId : names.includes(row.name));
  if (candidates.length !== 1) return tools;
  return tools.map((row) => row === candidates[0] ? { ...row, status: "waiting" } : row);
}
function providedFiles(nodes) {
  const result = [];
  for (const node of nodes) {
    if (!["user", "steering"].includes(node.kind)) continue;
    for (const block of list2(node.data?.content)) {
      if (!["file", "image"].includes(block?.type) || !record2(block.attachment)) continue;
      const attachment = block.attachment;
      const id = text3(attachment.attachmentId);
      if (!id) continue;
      const label = text3(attachment.name) || text3(attachment.filename) || (block.type === "image" ? "\u56FE\u7247\u9644\u4EF6" : "\u6587\u4EF6\u9644\u4EF6");
      result.push({ id: `provided:${id}`, label, path: "", category: "provided" });
    }
  }
  return result;
}
function materialRows(turn, nodes, deliverables) {
  const rows = providedFiles(nodes);
  const data = deliverables ?? turn?.data?.get?.("deliverables");
  for (const item of list2(data?.produced)) {
    if (!text3(item?.path) || !finite2(item.seq)) continue;
    rows.push({
      id: `modified:${item.path}`,
      label: item.path.replaceAll("\\", "/").split("/").at(-1),
      path: item.path,
      category: "modified",
      seq: item.seq
    });
  }
  for (const item of list2(data?.presented)) {
    if (!text3(item?.path) || !finite2(item.seq)) continue;
    rows.push({
      id: `delivered:${item.path}`,
      label: item.path.replaceAll("\\", "/").split("/").at(-1),
      path: item.path,
      category: "delivered",
      seq: item.seq,
      index: item.index
    });
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
function statusOf({ sessionId, session, status, connection, turn, liveTools, activity, backgroundCount }) {
  const common = { tone: "neutral", active: false, detail: "" };
  if (!sessionId) return { ...common, label: "\u9009\u62E9\u804A\u5929" };
  if (connection !== "connected") return { ...common, tone: "warning", label: connection === "connecting" ? "\u8FDE\u63A5\u4E2D" : "\u8FDE\u63A5\u65AD\u5F00", stale: true };
  if (session?.removed) return { ...common, label: "\u804A\u5929\u5DF2\u79FB\u9664" };
  if (session?.sessionId && session.sessionId !== sessionId) return { ...common, label: "\u5207\u6362\u4E2D", stale: true };
  if (session?.openState === "error" || session?.openError) return { ...common, tone: "warning", label: "\u8BB0\u5F55\u672A\u540C\u6B65", stale: true };
  if (session?.openState === "loading" || session?.awaitingFirstTurn || (status?.running ?? session?.running) === true && turn === null) return { ...common, tone: "active", label: "\u540C\u6B65\u4E2D" };
  const pending = selectedPending(sessionId, status);
  if (pending) {
    const label = pending.kind === "plan-review" ? "\u7B49\u5F85\u5BA1\u6838" : pending.kind === "question" ? "\u7B49\u5F85\u56DE\u7B54" : pending.kind === "approval" ? "\u7B49\u5F85\u5BA1\u6279" : "\u7B49\u5F85\u5904\u7406";
    return { ...common, tone: "warning", label, detail: liveTools > 0 ? `${liveTools} \u9879\u4ECD\u5728\u8FD0\u884C` : "", waiting: true };
  }
  const running = status?.running ?? session?.running;
  if (running === true) return {
    ...common,
    tone: "active",
    active: true,
    label: activity ? `\u6B63\u5728${activity.label}${liveTools > 1 ? ` \xB7 +${liveTools - 1}` : ""}` : "\u5904\u7406\u4E2D",
    detail: activity?.detail || ""
  };
  if (turn?.status === "closed") {
    const reason = turn.end?.data?.reason?.kind;
    if (reason === "error") return { ...common, tone: "error", label: "\u51FA\u9519", detail: "\u67E5\u770B\u5BF9\u8BDD\u4E2D\u7684\u9519\u8BEF" };
    if (["aborted", "interrupted"].includes(reason)) return { ...common, tone: "warning", label: "\u5DF2\u505C\u6B62" };
    if (reason === "max-tokens") return { ...common, tone: "warning", label: "\u8FBE\u5230\u8F93\u51FA\u9650\u5236" };
    if (reason === "blocked") return { ...common, tone: "warning", label: "\u65E0\u6CD5\u7EE7\u7EED" };
    return { ...common, label: "\u5DF2\u7ED3\u675F", detail: backgroundCount > 0 ? `\u540E\u53F0 ${backgroundCount} \u9879\u8FD0\u884C\u4E2D` : "" };
  }
  if (session?.blank === true) return { ...common, label: "\u7B49\u5F85\u5F00\u59CB" };
  return { ...common, label: turn?.status === "open" ? "\u72B6\u6001\u672A\u540C\u6B65" : "\u6682\u65E0\u6D3B\u52A8" };
}
function deriveProgress({
  sessionId,
  session = {},
  status,
  connection = "connected",
  chat,
  todos,
  catalog,
  sessions,
  statuses,
  jobs = [],
  deliverables
} = {}) {
  const ownerMatches = !session?.sessionId || session.sessionId === sessionId;
  const loadedTurn = ownerMatches ? currentTurnOf(chat) : null;
  const waitingForNewTurn = connection === "connected" && (status?.running ?? session?.running) === true && loadedTurn?.status === "closed";
  const turn = waitingForNewTurn ? null : loadedTurn;
  const turnId = turn?.turn ?? null;
  const nodes = turnId === null ? [] : readChatNodes(chat).filter((node) => nodeTurn(node) === turnId);
  const recordsReady = connection === "connected" && ownerMatches && !session?.removed && !session?.openError && !["loading", "error"].includes(session?.openState) && !session?.awaitingFirstTurn;
  const rawActive = recordsReady && turn?.status === "open" && (status?.running ?? session?.running) === true;
  const tools = markWaitingTool(toolRows(nodes, rawActive), selectedPending(sessionId, status));
  const liveTools = tools.filter((row) => ["running", "preparing"].includes(row.status));
  const waitingTools = tools.filter((row) => row.status === "waiting");
  const activeJobs = ownerMatches ? list2(jobs).filter((job) => ["running", "stopping"].includes(job?.status) && (!job.sessionId || job.sessionId === sessionId)).map((job) => ({
    id: String(job.id),
    label: bound(text3(job.label) || text3(job.title) || text3(job.name) || text3(job.command) || "\u540E\u53F0\u4EFB\u52A1"),
    detail: bound(job.progress || job.detail),
    status: connection === "connected" ? job.status : "unknown"
  })) : [];
  const children = ownerMatches ? list2(catalog).flatMap((child) => {
    if (!text3(child?.id)) return [];
    const childStatus = statuses?.get?.(child.id);
    const running = (childStatus?.running ?? sessions?.byId?.[child.id]?.running) === true;
    if (!running && !childStatus?.pendingInteraction) return [];
    return [{
      id: child.id,
      label: bound(child.title || child.name || sessions?.byId?.[child.id]?.title || "\u5B50\u4EFB\u52A1"),
      status: connection !== "connected" ? "unknown" : childStatus?.pendingInteraction ? "waiting" : "running"
    }];
  }) : [];
  const normalizedTodos = ownerMatches ? normalizeTodos(todos) : [];
  const currentPlan = ownerMatches && turn !== null && Array.isArray(todos) || tools.some((row) => row.name === "todo_write" && row.status === "done");
  const plan = {
    title: currentPlan ? "\u672C\u8F6E\u8BA1\u5212" : "\u4F1A\u8BDD\u8BA1\u5212",
    items: normalizedTodos,
    inherited: normalizedTodos.length > 0 && !currentPlan,
    completed: normalizedTodos.filter((item) => item.status === "completed").length,
    active: normalizedTodos.filter((item) => item.status === "in_progress").length,
    total: normalizedTodos.length
  };
  const state = statusOf({
    sessionId,
    session,
    status,
    connection,
    turn,
    liveTools: liveTools.length,
    activity: liveTools[0],
    backgroundCount: activeJobs.length + children.length
  });
  const currentSteps = currentPlan ? plan.items.filter((item) => item.status === "in_progress") : [];
  if (state.active && currentSteps.length) {
    state.label = bound(currentSteps[0].content, 60) + (currentSteps.length > 1 ? ` \xB7 +${currentSteps.length - 1}` : "");
    state.detail = liveTools[0]?.label || "";
  }
  const materials = materialRows(turn, nodes, turn === null ? void 0 : deliverables);
  const recent = tools.filter((row) => !["running", "preparing", "waiting"].includes(row.status)).sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity) || (b.seq ?? -Infinity) - (a.seq ?? -Infinity));
  const model = {
    sessionId,
    turnId,
    state,
    plan,
    tools: [...liveTools, ...waitingTools, ...recent],
    liveTools: liveTools.length,
    jobs: activeJobs,
    children,
    materials,
    materialCounts: {
      provided: materials.filter((row) => row.category === "provided").length,
      modified: materials.filter((row) => row.category === "modified").length,
      delivered: materials.filter((row) => row.category === "delivered").length
    }
  };
  return { ...model, timeline: deriveTimeline({ ...model, chat, session, status, todos }) };
}

// lib/client/progress.mjs
var h = import_react2.default.createElement;
var EMPTY = Object.freeze([]);
var ABSENT_SOURCE = Object.freeze({ subscribe: () => () => {
}, getSnapshot: () => void 0 });
var STATUS = Object.freeze({
  pending: "\u5F85\u5904\u7406",
  in_progress: "\u8FDB\u884C\u4E2D",
  completed: "\u5B8C\u6210",
  preparing: "\u51C6\u5907\u4E2D",
  running: "\u8FDB\u884C\u4E2D",
  done: "\u5DF2\u8FD4\u56DE",
  error: "\u5931\u8D25",
  stopped: "\u5DF2\u505C\u6B62",
  stopping: "\u505C\u6B62\u4E2D",
  waiting: "\u7B49\u5F85\u5904\u7406",
  unknown: "\u540C\u6B65\u4E2D"
});
var NODE_STATUS = Object.freeze({
  completed: "\u5DF2\u5B8C\u6210",
  in_progress: "\u8FDB\u884C\u4E2D",
  pending: "\u5F85\u505A",
  waiting: "\u7B49\u5F85",
  error: "\u51FA\u9519",
  stopped: "\u5DF2\u505C\u6B62",
  unknown: "\u540C\u6B65\u4E2D"
});
var NODE_MARK = Object.freeze({ error: "!", stopped: "\u2212" });
function Dot({ status }) {
  return h("span", { className: "dsw-progress-dot", "data-status": status, "aria-hidden": true });
}
function Row({ row, inspect }) {
  const interactive = typeof inspect === "function" && row.id && !row.nested;
  const props = { className: "dsw-progress-activity", "data-state": row.status, key: row.id };
  const content = [
    h(Dot, { status: row.status, key: "dot" }),
    h(
      "span",
      { className: "dsw-progress-row-body", key: "body" },
      h("span", { className: "dsw-progress-row-title" }, row.actionLabel || row.label),
      !row.actionLabel && row.detail && h("span", { className: "dsw-progress-row-detail", title: row.detail }, row.detail)
    ),
    h("span", { className: "dsw-progress-row-status", key: "status" }, STATUS[row.status] || row.status)
  ];
  return h("li", props, interactive ? h("button", {
    type: "button",
    className: "dsw-progress-row-button",
    title: "\u67E5\u770B\u539F\u5DE5\u5177\u8BB0\u5F55",
    onClick: () => inspect(row.id)
  }, ...content) : h("div", { className: "dsw-progress-row-button" }, ...content));
}
function TimelineNode({ node, child = false }) {
  const status = NODE_STATUS[node.status] ? node.status : "unknown";
  const statusLabel = NODE_STATUS[status];
  const visibleStatus = !["completed", "pending", "in_progress"].includes(status);
  const children = Array.isArray(node.children) ? node.children : EMPTY;
  const hasCount = children.length > 0 && Number.isFinite(node.completed) && Number.isFinite(node.total);
  return h(
    "li",
    {
      className: `dsw-progress-node ${child ? "dsw-progress-subtask" : "dsw-progress-stage"}`,
      "data-status": status,
      "data-node-id": node.id,
      "aria-current": status === "in_progress" ? "step" : void 0
    },
    h(
      "div",
      { className: "dsw-progress-node-row", "data-has-meta": visibleStatus || hasCount ? "true" : void 0 },
      h("span", { className: "dsw-progress-marker", "aria-hidden": true }, NODE_MARK[status] || ""),
      h("span", {
        className: "dsw-progress-node-label",
        title: node.original || node.label,
        "aria-label": node.original || node.label
      }, node.label),
      visibleStatus ? h("span", { className: "dsw-progress-node-status" }, statusLabel) : h(
        import_react2.default.Fragment,
        null,
        h("span", { className: "dsw-progress-sr" }, statusLabel),
        hasCount && h("span", {
          className: "dsw-progress-node-count",
          "aria-label": `\u5B50\u4EFB\u52A1\u5DF2\u5B8C\u6210 ${node.completed} \u9879\uFF0C\u5171 ${node.total} \u9879`
        }, `${node.completed}/${node.total}`)
      )
    ),
    children.length > 0 && h(
      "ol",
      { className: "dsw-progress-subtasks", "aria-label": `${node.label}\u5B50\u4EFB\u52A1` },
      ...children.map((item) => h(TimelineNode, { key: item.id, node: item, child: true }))
    )
  );
}
function Timeline({ timeline }) {
  return h(
    "ol",
    { className: "dsw-progress-timeline", "aria-label": "\u4EFB\u52A1\u65F6\u95F4\u7EBF" },
    ...timeline.nodes.map((node) => h(TimelineNode, { key: node.id, node }))
  );
}
function Materials({ model, openMaterial }) {
  const names = { provided: "\u5DF2\u63D0\u4F9B", modified: "\u5DF2\u4FEE\u6539", delivered: "\u5DF2\u4EA4\u4ED8" };
  return h(
    "details",
    { className: "dsw-progress-files", "aria-label": "\u672C\u8F6E\u6587\u4EF6" },
    h("summary", null, `\u6587\u4EF6 ${model.materials.length}`),
    h("ul", { className: "dsw-progress-materials" }, ...model.materials.map((row) => {
      const canOpen = typeof openMaterial === "function" && row.path;
      const props = { className: "dsw-progress-material", key: row.id, title: row.path || row.label };
      const body = [
        h("span", { className: "dsw-progress-file-icon", key: "icon", "aria-hidden": true }, "\u25A4"),
        h("span", { className: "dsw-progress-file-label", key: "label" }, row.label),
        h("span", { className: "dsw-progress-file-category", key: "category" }, names[row.category])
      ];
      return h("li", props, canOpen ? h("button", {
        type: "button",
        className: "dsw-progress-file-button",
        onClick: () => openMaterial(row),
        title: `\u67E5\u770B${row.label}`
      }, ...body) : h("div", { className: "dsw-progress-file-button" }, ...body));
    }))
  );
}
function Details({ model, openCall }) {
  const background = [...model.jobs, ...model.children.map((row) => ({ ...row, detail: "\u5B50\u4EFB\u52A1" }))];
  const authored = model.timeline?.nodes.flatMap((node) => node.children ?? (node.original ? [node] : [])).filter((node) => node.source === "plan" || node.original && ["planning", "summary"].includes(node.id)) ?? EMPTY;
  if (!model.tools.length && !background.length && !model.state.detail && !authored.length) return null;
  return h(
    "details",
    { className: "dsw-progress-details", "aria-label": "\u6D3B\u52A8\u8BE6\u60C5" },
    h("summary", null, "\u8BE6\u60C5"),
    model.state.detail && h("p", { className: "dsw-progress-note" }, model.state.detail),
    authored.length > 0 && h(
      "section",
      { className: "dsw-progress-detail-section", "aria-label": "\u5B8C\u6574\u539F\u6587" },
      h("h3", null, "\u539F\u6587"),
      h("ul", { className: "dsw-progress-activities" }, ...authored.map((node) => h("li", {
        key: node.id,
        className: "dsw-progress-note"
      }, node.original || node.label)))
    ),
    model.tools.length > 0 && h(
      "section",
      { className: "dsw-progress-detail-section", "aria-label": "\u672C\u8F6E\u5DE5\u5177\u6D3B\u52A8" },
      h("h3", null, "\u6D3B\u52A8"),
      h("ul", { className: "dsw-progress-activities" }, ...model.tools.map((row) => h(Row, { row, inspect: openCall, key: row.id })))
    ),
    background.length > 0 && h(
      "section",
      { className: "dsw-progress-detail-section", "aria-label": "\u4F1A\u8BDD\u540E\u53F0\u6D3B\u52A8" },
      h("h3", null, "\u540E\u53F0"),
      h("ul", { className: "dsw-progress-activities" }, ...background.map((row) => h(Row, { row, key: row.id })))
    )
  );
}
function ProgressView({ model, openCall, openMaterial }) {
  const timeline = model.timeline || { nodes: [], completed: 0, total: 0, headline: "\u540C\u6B65\u4E2D", tone: model.state.tone };
  return h(
    "div",
    { className: "dsw-progress", "data-connection-stale": model.state.stale ? "true" : void 0 },
    h(
      "div",
      {
        className: "dsw-progress-overview",
        "data-tone": timeline.tone,
        "aria-label": "\u5F53\u524D\u72B6\u6001",
        role: "status",
        "aria-live": "polite",
        "aria-atomic": true
      },
      h("span", { className: "dsw-progress-headline" }, timeline.headline),
      timeline.total > 0 && timeline.evidenceMode === "plan" && h("span", {
        className: "dsw-progress-count",
        "aria-label": `\u5DF2\u5B8C\u6210 ${timeline.completed} \u4E2A\u9636\u6BB5\uFF0C\u5171 ${timeline.total} \u4E2A\u9636\u6BB5`
      }, `${timeline.completed}/${timeline.total}`)
    ),
    timeline.nodes.length > 0 && h(Timeline, { timeline }),
    h(Details, { model, openCall }),
    model.materials.length > 0 && h(Materials, { model, openMaterial })
  );
}
function ProgressPanel({
  sessionId,
  useSession,
  useSessionStatus,
  useProjection,
  useSessions,
  useChat,
  useConnection,
  useJobs,
  watchJobs,
  openCall,
  openMaterial
}) {
  const session = useSession((value) => value);
  const statuses = useSessionStatus((value) => value);
  const summaries = useSessions((value) => value);
  const chat = useChat ? useChat((value) => value) : void 0;
  const connection = useConnection((value) => value);
  const todos = useProjection("todos");
  const catalog = useProjection("subagentCatalog");
  const jobs = useJobs ? useJobs((value) => value.rows[sessionId]) ?? EMPTY : EMPTY;
  const deliverableSource = (0, import_react2.useMemo)(() => currentTurnOf(chat)?.data?.source?.("deliverables") ?? ABSENT_SOURCE, [chat]);
  const deliverables = (0, import_react2.useSyncExternalStore)(deliverableSource.subscribe, deliverableSource.getSnapshot, deliverableSource.getSnapshot);
  (0, import_react2.useEffect)(() => sessionId && typeof watchJobs === "function" ? watchJobs(sessionId) : void 0, [sessionId, watchJobs]);
  const model = (0, import_react2.useMemo)(
    () => deriveProgress({
      sessionId,
      session,
      status: statuses?.get?.(sessionId),
      statuses,
      connection,
      chat,
      todos,
      catalog,
      sessions: summaries,
      jobs,
      deliverables
    }),
    [sessionId, session, statuses, connection, chat, todos, catalog, summaries, jobs, deliverables]
  );
  return h(ProgressView, { model, openCall, openMaterial, key: `${sessionId}:${model.turnId}` });
}

// lib/client/styles.mjs
var PROGRESS_CSS = String.raw`
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
`;

// lib/client/layout-style.mjs
var LAYOUT_CSS = `
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
function installLayoutStyle(doc) {
  const style = doc.createElement("style");
  style.dataset.dshWorkspaceLayoutStyle = "";
  style.textContent = LAYOUT_CSS;
  doc.head.appendChild(style);
  return () => style.remove();
}

// lib/client/layout.mjs
var MIN_READING_COLUMN = 560;
var MIN_READING_HEIGHT = 120;
var MIN_EXPANDED_HEIGHT = 120;
var PET_SIZE = 144;
var PET_SPACE = PET_SIZE + 20;
function compactWorkspaceBudget({ height, headerHeight, composerHeight }) {
  const maxExpandedHeight = Math.max(0, Math.floor(Math.min(
    340,
    height * 0.4,
    height - headerHeight - composerHeight - MIN_READING_HEIGHT - 16
  )));
  return { maxExpandedHeight, canExpand: maxExpandedHeight >= MIN_EXPANDED_HEIGHT };
}
function workspacePetPlacement(area, blocked = [], size = PET_SIZE) {
  if (!area || area.right - area.left < size || area.bottom - area.top < size) return null;
  const left = area.right - size;
  const tops = [area.bottom - size, area.top, ...blocked.map((rect) => rect.top - size - 8)];
  for (const top of tops.sort((a, b) => b - a)) {
    const rect = { left, top, right: left + size, bottom: top + size };
    if (top < area.top || rect.bottom > area.bottom) continue;
    if (blocked.some((other) => other.right > rect.left - 8 && other.left < rect.right + 8 && other.bottom > rect.top - 8 && other.top < rect.bottom + 8)) continue;
    return rect;
  }
  return null;
}
function inlineWorkspaceGeometry(columnWidth) {
  const width = columnWidth >= 1200 ? 258 : columnWidth >= 1032 ? 244 : 230;
  const compact = columnWidth < MIN_READING_COLUMN + width + 32;
  return { width, compact, readingWidth: compact ? columnWidth : columnWidth - width - 32 };
}
function attachInlineWorkspace(anchor, { sessionId } = {}) {
  const body = anchor?.closest?.("[data-conversation-content]");
  const owner = body?.parentElement;
  const doc = owner?.ownerDocument;
  if (!body || !owner || !doc?.defaultView || sessionId !== void 0 && body.dataset.conversationSession !== sessionId) return null;
  const held = owner.querySelector(":scope > [data-dsh-workspace-inline-host]");
  if (held) return null;
  const win = doc.defaultView;
  const element = doc.createElement("aside");
  element.dataset.dshWorkspaceInlineHost = "";
  element.setAttribute("aria-label", "\u672C\u8F6E\u8FDB\u5EA6\u4E0E\u63D2\u4EF6");
  owner.dataset.dshWorkspaceInlineRoot = "";
  body.dataset.dshWorkspaceInlineBody = "";
  owner.insertBefore(element, body);
  const listeners = /* @__PURE__ */ new Set();
  let snapshot = Object.freeze({ width: 244, compact: false, readingWidth: 720, maxExpandedHeight: 340, canExpand: true });
  let disposed = false, pending = null;
  const names = ["--dsh-inline-workspace-width", "--dsh-inline-workspace-top", "--dsh-inline-workspace-pet-space", "--dsh-inline-workspace-expanded-height"];
  const oldVars = names.map((name2) => [name2, owner.style.getPropertyValue(name2), owner.style.getPropertyPriority(name2)]);
  const observed = /* @__PURE__ */ new Set();
  const schedule = () => {
    if (!disposed && pending === null) pending = win.requestAnimationFrame(() => {
      pending = null;
      sync();
    });
  };
  const resize = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(schedule) : null;
  const sync = () => {
    if (disposed || !owner.isConnected) return;
    const rootRect = owner.getBoundingClientRect();
    if (rootRect.width <= 0) return;
    const before = [];
    for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) before.push(sibling);
    const seat = body.querySelector("[data-composer-seat]");
    const targets = /* @__PURE__ */ new Set([owner, body, element, ...before, ...seat ? [seat] : []]);
    for (const target of observed) if (!targets.has(target)) {
      resize?.unobserve(target);
      observed.delete(target);
    }
    for (const target of targets) if (!observed.has(target)) {
      resize?.observe(target);
      observed.add(target);
    }
    const headerHeight = Math.max(0, ...before.map((node) => node.getBoundingClientRect().bottom - rootRect.top));
    const next = { ...inlineWorkspaceGeometry(rootRect.width), ...compactWorkspaceBudget({
      height: rootRect.height,
      headerHeight,
      composerHeight: seat?.getBoundingClientRect().height || 0
    }) };
    owner.toggleAttribute("data-inline-compact", next.compact);
    element.toggleAttribute("data-inline-compact", next.compact);
    const top = Math.max(60, Math.ceil(headerHeight) + 12);
    const widthValue = next.width + "px", topValue = top + "px";
    if (owner.style.getPropertyValue("--dsh-inline-workspace-width") !== widthValue) owner.style.setProperty("--dsh-inline-workspace-width", widthValue);
    if (owner.style.getPropertyValue("--dsh-inline-workspace-top") !== topValue) owner.style.setProperty("--dsh-inline-workspace-top", topValue);
    const heightValue = next.maxExpandedHeight + "px";
    if (owner.style.getPropertyValue("--dsh-inline-workspace-expanded-height") !== heightValue) owner.style.setProperty("--dsh-inline-workspace-expanded-height", heightValue);
    if (Object.keys(next).some((key) => snapshot[key] !== next[key])) {
      snapshot = Object.freeze(next);
      for (const listener of listeners) listener();
    }
  };
  const observer = new win.MutationObserver((records) => {
    if (records.some((record3) => record3.target === owner || [...record3.addedNodes, ...record3.removedNodes].some((node) => node.nodeType === 1 && (node.matches?.("[data-composer-seat]") || node.querySelector?.("[data-composer-seat]"))))) schedule();
  });
  observer.observe(owner, { childList: true, subtree: true });
  win.addEventListener("resize", schedule);
  sync();
  return {
    element,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pending !== null) win.cancelAnimationFrame(pending);
      observer.disconnect();
      resize?.disconnect();
      win.removeEventListener("resize", schedule);
      listeners.clear();
      element.remove();
      owner.removeAttribute("data-dsh-workspace-inline-root");
      owner.removeAttribute("data-inline-compact");
      owner.removeAttribute("data-inline-collapsed");
      body.removeAttribute("data-dsh-workspace-inline-body");
      for (const [name2, value, priority] of oldVars) {
        if (value) owner.style.setProperty(name2, value, priority);
        else owner.style.removeProperty(name2);
      }
    }
  };
}
function visible(element) {
  return Boolean(element && element.getAttribute("data-workspace-visible") !== "false" && !element.closest('[hidden],[aria-hidden="true"]') && element.getClientRects().length && element.ownerDocument.defaultView.getComputedStyle(element).visibility !== "hidden");
}
function opaqueThemeFill(doc) {
  const win = doc.defaultView;
  const root = doc.documentElement;
  const fallback = doc.body?.hasAttribute("data-ds-dark-theme") ? "#101a2a" : "#f8f9fb";
  try {
    const canvas = doc.createElement("canvas");
    canvas.width = canvas.height = 1;
    const paint = canvas.getContext("2d", { willReadFrequently: true });
    if (!paint) return fallback;
    paint.fillStyle = fallback;
    paint.fillRect(0, 0, 1, 1);
    paint.fillStyle = win.getComputedStyle(root).backgroundColor;
    paint.fillRect(0, 0, 1, 1);
    paint.fillStyle = win.getComputedStyle(doc.body).getPropertyValue("--dsw-alias-bg-base").trim() || fallback;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b] = paint.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return fallback;
  }
}
function installWorkspaceLayout(ctx, { panelSelector = "[data-dsh-workspace-panel]", document: doc = globalThis.document } = {}) {
  if (!doc?.body || !doc.defaultView) return () => {
  };
  const win = doc.defaultView, root = doc.documentElement;
  if (root.hasAttribute("data-dsh-workspace-layout")) return () => {
  };
  root.setAttribute("data-dsh-workspace-layout", "");
  const removeStyle = installLayoutStyle(doc);
  root.setAttribute("data-dsh-workspace-inline", "");
  let disposed = false, scheduled = null, lastColor = "", lastColorSource = "";
  const seats = /* @__PURE__ */ new Map();
  const vars = ["--dsh-workspace-curtain-color", "--dsh-workspace-pet-right", "--dsh-workspace-pet-bottom"];
  const oldVars = new Map(vars.map((name2) => [name2, root.style.getPropertyValue(name2)]));
  const oldPetHidden = root.getAttribute("data-dsh-workspace-pet-hidden");
  const setVar = (name2, value) => {
    if (root.style.getPropertyValue(name2) !== value) root.style.setProperty(name2, value);
  };
  const schedule = () => {
    if (!disposed && scheduled === null) scheduled = win.requestAnimationFrame(() => {
      scheduled = null;
      sync();
    });
  };
  const resize = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(schedule) : null;
  function syncSeats() {
    for (const [seat, curtain] of seats) {
      if (!seat.isConnected) {
        resize?.unobserve(seat);
        curtain.remove();
        seats.delete(seat);
      }
    }
    for (const seat of doc.querySelectorAll("[data-conversation-content] > [data-conversation-scroll] > [data-composer-seat]")) {
      if (!seats.has(seat)) {
        const curtain = doc.createElement("div");
        curtain.dataset.dshWorkspaceCurtain = "";
        curtain.setAttribute("aria-hidden", "true");
        seat.appendChild(curtain);
        seats.set(seat, curtain);
        resize?.observe(seat);
      }
      const body = seat.closest("[data-conversation-content]");
      const active = body?.dataset.contentPhase === "active" && !body.querySelector("[data-conversation-composer-overlay]");
      if (seat.hasAttribute("data-dsh-workspace-fade") !== active) seat.toggleAttribute("data-dsh-workspace-fade", active);
    }
  }
  function sync() {
    if (disposed) return;
    syncSeats();
    const colorSource = win.getComputedStyle(doc.body).getPropertyValue("--dsw-alias-bg-base") + win.getComputedStyle(root).backgroundColor;
    if (colorSource !== lastColorSource) {
      const color = opaqueThemeFill(doc);
      if (color !== lastColor) {
        setVar("--dsh-workspace-curtain-color", color);
        lastColor = color;
      }
      lastColorSource = colorSource;
    }
    const mountedHosts = [...doc.querySelectorAll("[data-dsh-workspace-inline-host]")];
    const panels = [...doc.querySelectorAll(panelSelector)].filter((element) => visible(element) && element.closest("[data-dsh-workspace-inline-host]"));
    const panel = panels.find((element) => element.closest('[data-dockkit-pane-active="true"],[data-dockkit-float-active="true"]')) || panels.find((element) => element.closest("[data-dsh-workspace-inline-root]")?.contains(doc.activeElement)) || panels[0];
    const host = panel?.closest("[data-dsh-workspace-inline-host]");
    const enabled = panel?.getAttribute("data-workspace-pet-active") === "true";
    const owner = host?.parentElement;
    const ownerRect = owner?.getBoundingClientRect();
    const top = Number.parseFloat(owner?.style.getPropertyValue("--dsh-inline-workspace-top")) || 60;
    const petReserved = Boolean(enabled && !host.hasAttribute("data-inline-compact") && !host.hasAttribute("data-inline-collapsed") && ownerRect.height - top - 16 >= MIN_EXPANDED_HEIGHT + PET_SPACE);
    for (const owner2 of doc.querySelectorAll("[data-dsh-workspace-inline-root]")) {
      const space = petReserved && owner2 === host.parentElement ? PET_SPACE + "px" : "0px";
      if (owner2.style.getPropertyValue("--dsh-inline-workspace-pet-space") !== space) owner2.style.setProperty("--dsh-inline-workspace-pet-space", space);
    }
    const rect = host?.getBoundingClientRect();
    const blocked = [...doc.querySelectorAll("[data-conversation-content],[data-composer-seat],[data-forecast-root],[data-forecast-suggestion],[data-sidebar-right-panel],[data-dsh-workspace-inline-host],[data-dsh-workspace-inline-root],[data-dockkit-pane],[data-dockkit-float]")].filter((element) => visible(element) && element !== owner && !element.contains(owner)).map((element) => element.getBoundingClientRect()).filter((rect2) => rect2.width > 0 && rect2.height > 0);
    const placement = petReserved ? workspacePetPlacement({
      left: rect.left,
      right: Math.min(rect.right - 18, win.innerWidth - 18),
      top: rect.bottom + 12,
      bottom: Math.min(ownerRect.bottom, win.innerHeight) - 24
    }, blocked) : null;
    root.toggleAttribute("data-dsh-workspace-pet-hidden", Boolean(mountedHosts.length && (!panel || enabled && !placement)));
    setVar("--dsh-workspace-pet-right", placement ? `${Math.ceil(win.innerWidth - placement.right)}px` : "18px");
    setVar("--dsh-workspace-pet-bottom", placement ? `${Math.ceil(win.innerHeight - placement.bottom)}px` : "72px");
  }
  const onFocus = (event) => {
    const element = event.target;
    if (!element?.getBoundingClientRect || element.closest("[data-composer-seat]")) return;
    const scrollport = element.closest("[data-conversation-scroll]");
    const seat = scrollport?.querySelector(":scope > [data-composer-seat][data-dsh-workspace-fade]");
    if (!seat) return;
    const hidden = element.getBoundingClientRect().bottom - seat.getBoundingClientRect().top + 8;
    if (hidden > 0) scrollport.scrollBy({ top: hidden, behavior: "instant" });
  };
  const observer = new win.MutationObserver((records) => {
    if (records.some((record3) => record3.type === "attributes" || [...record3.addedNodes, ...record3.removedNodes].some((node) => node.nodeType === 1 && (node.matches?.("[data-composer-seat],[data-sidebar-right-panel],[data-conversation-content],[data-dockkit-pane],[data-dockkit-float]") || node.querySelector?.("[data-composer-seat],[data-sidebar-right-panel],[data-dockkit-pane],[data-dockkit-float]") || node.matches?.(panelSelector) || node.querySelector?.(panelSelector))))) schedule();
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "style", "data-sidebar-right-open", "data-sidebar-right-panel", "data-content-phase", "data-dockkit-pane-active", "data-dockkit-float-active", "data-ds-dark-theme", "data-workspace-pet-active", "data-workspace-visible", "data-inline-compact", "data-inline-expanded", "data-inline-collapsed"]
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-dsh-skin", "style"] });
  win.addEventListener("resize", schedule);
  doc.addEventListener("focusin", onFocus);
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    if (scheduled !== null) win.cancelAnimationFrame(scheduled);
    observer.disconnect();
    resize?.disconnect();
    win.removeEventListener("resize", schedule);
    doc.removeEventListener("focusin", onFocus);
    for (const [seat, curtain] of seats) {
      seat.removeAttribute("data-dsh-workspace-fade");
      curtain.remove();
    }
    for (const [name2, value] of oldVars) {
      if (value) root.style.setProperty(name2, value);
      else root.style.removeProperty(name2);
    }
    root.removeAttribute("data-dsh-workspace-layout");
    root.removeAttribute("data-dsh-workspace-inline");
    if (oldPetHidden === null) root.removeAttribute("data-dsh-workspace-pet-hidden");
    else root.setAttribute("data-dsh-workspace-pet-hidden", oldPetHidden);
    removeStyle();
  };
}

// lib/client/left-sidebar.mjs
function resolveLeftSidebarAdapter(ctx) {
  try {
    const layout = (typeof ctx.get === "function" ? ctx.get("layout") : void 0) ?? ctx.layout;
    const slots = ctx.slots ?? (typeof ctx.get === "function" ? ctx.get("slots") : void 0);
    if (!layout || typeof layout.panels?.setSidebar !== "function" || typeof slots?.entries !== "function") return null;
    for (const entry of slots.entries("root")) {
      if (!entry.children?.sidebar || !entry.children?.main || !entry.children?.rightbar || typeof entry.store?.create !== "function") continue;
      const instance = entry.store.create();
      if (instance?.actions !== layout.panels || typeof instance.getSnapshot !== "function" || typeof instance.subscribe !== "function") continue;
      const info = instance.getSnapshot()?.layoutInfo;
      if (!info || !Number.isFinite(info.sidebar) || !Number.isFinite(info.viewportWidth) || typeof info.narrowExpanded !== "boolean") continue;
      return { instance, actions: layout.panels, entry, slots };
    }
  } catch {
  }
  return null;
}
function leftSidebarCollapsed(info) {
  return info.viewportWidth < 1024 ? !info.narrowExpanded : info.sidebar === 0;
}
var clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
function leftPresentationGeometry(info, { presentationWidth = 216, collapsedWidth = 0 } = {}) {
  const scale = presentationWidth / 264;
  const collapsed = leftSidebarCollapsed(info);
  const logical = collapsed ? 0 : info.sidebar === 0 ? 264 : clamp(info.sidebar, 264, 420);
  const preference = logical === 0 ? 0 : Math.round(logical * scale);
  const viewport = info.viewportWidth;
  const rightPreference = info.rightbar ?? viewport * 0.45;
  const solve = (side, right) => {
    const sidebar = side === 0 ? collapsedWidth : side;
    const available = viewport - sidebar - 400;
    const rightbar = right === 0 || available < 300 ? 0 : Math.min(available, clamp(right, 300, viewport * 0.7));
    return { sidebar, center: Math.max(0, viewport - sidebar - rightbar), rightbar };
  };
  const normalSide = !info.rightbarShown && viewport < 1024 ? 0 : preference;
  const nativePreference = collapsed ? 0 : info.sidebar === 0 ? 280 : clamp(info.sidebar, 264, 420);
  const nativeNormalSide = !info.rightbarShown && viewport < 1024 ? 0 : nativePreference;
  const nativeNormal = solve(nativeNormalSide, rightPreference);
  const nativeColumns = solve(nativePreference, info.rightbarTrack ? rightPreference : 0);
  const normal = solve(normalSide, nativeNormal.rightbar === 0 ? 0 : rightPreference);
  const columns = solve(preference, nativeColumns.rightbar === 0 ? 0 : rightPreference);
  return { scale, logical, collapsed, viewport, normal, columns, rightMax: columns.rightbar === 0 ? 0 : clamp(rightPreference, 300, viewport * 0.7) };
}
var cloneProps = (element, patch) => ({ ...element, props: { ...element.props, ...patch } });
var isElement = (value) => Boolean(value && typeof value === "object" && value.$$typeof && value.props);
function notifyRoot(slots) {
  const entries = slots.entries("root");
  const priority = Math.max(0, ...entries.map((entry) => entry.options?.priority ?? 0)) + 1;
  const stop = slots.register({ name: "root", priority }, () => null);
  if (typeof stop === "function") stop();
  else stop?.dispose?.();
}
function installLeftPresentation(resolved, { presentationWidth = 216, document: doc = globalThis.document } = {}) {
  const { entry, slots, instance, actions } = resolved;
  const original = entry?.component;
  if (typeof original !== "function" || typeof slots?.register !== "function") return () => {
  };
  const source = Function.prototype.toString.call(original);
  if (original.name !== "AppFrame" || !source.includes("gridTemplateColumns") || !source.includes("rightbarPreference") || !source.includes("onSidebarStart") || !source.includes("onRightbarStart") || !source.includes("renderSlot")) return () => {
  };
  const descriptor = Object.getOwnPropertyDescriptor(entry, "component");
  if (descriptor?.writable === false) return () => {
  };
  const root = doc?.documentElement;
  let leftOrigin = 264, rightOrigin = 300, disposed = false;
  function LeftPresentationFrame(props) {
    const info = props.useStore((state) => state.layoutInfo);
    const platform = doc?.documentElement?.dataset.platform;
    const closed = platform === "darwin" || root?.hasAttribute("data-windows-titlebar") ? 0 : 56;
    const geometry = leftPresentationGeometry(info, { presentationWidth, collapsedWidth: closed });
    const renderSlot = (name2, owner, options) => props.renderSlot(
      name2,
      name2 === "sidebar" ? { ...owner, width: geometry.columns.sidebar, collapsed: geometry.collapsed } : name2 === "rightbar" ? { ...owner, width: geometry.normal.rightbar, viewportWidth: geometry.viewport, canShow: geometry.normal.rightbar > 0 } : owner,
      options
    );
    const base = original({ ...props, renderSlot });
    if (!isElement(base) || typeof base.props.style?.gridTemplateColumns !== "string") return base;
    const rewrite = (value) => {
      if (Array.isArray(value)) return value.map(rewrite);
      if (!isElement(value)) return value;
      if (value.props.side === "sidebar") return cloneProps(value, {
        left: geometry.columns.sidebar,
        onStart: () => {
          leftOrigin = geometry.logical;
          value.props.onStart();
        },
        onDrag: (dx) => actions.setSidebar(leftOrigin + dx / geometry.scale)
      });
      if (value.props.side === "rightbar") return cloneProps(value, {
        left: geometry.viewport - geometry.normal.rightbar,
        onStart: () => {
          rightOrigin = geometry.normal.rightbar;
          value.props.onStart();
        },
        onDrag: (dx) => actions.setRightbar(rightOrigin - dx)
      });
      if (typeof value.props.className === "string" && value.props.className.includes("_sidebarCol")) return cloneProps(value, { "data-dsh-left-sidebar-column": "", "data-dsh-left-sidebar-width": geometry.columns.sidebar });
      if (value.type === /* @__PURE__ */ Symbol.for("react.fragment")) return cloneProps(value, { children: rewrite(value.props.children) });
      return value;
    };
    return cloneProps(base, {
      style: {
        ...base.props.style,
        ...root?.hasAttribute("data-windows-titlebar") ? { "--dsh-windows-sidebar-width": `${geometry.columns.sidebar}px` } : {},
        gridTemplateColumns: `${geometry.columns.sidebar}px minmax(${geometry.columns.rightbar === 0 ? 0 : 400}px, 1fr) minmax(0px, ${geometry.rightMax}px)`
      },
      "data-dsh-left-presentation": "",
      "data-rightbar-collapsed": geometry.columns.rightbar === 0 || void 0,
      children: rewrite(base.props.children)
    });
  }
  try {
    entry.component = LeftPresentationFrame;
    notifyRoot(slots);
  } catch {
    entry.component = original;
    return () => {
    };
  }
  ;
  return () => {
    if (disposed) return;
    disposed = true;
    if (entry.component === LeftPresentationFrame) {
      entry.component = original;
      try {
        notifyRoot(slots);
      } catch {
      }
    }
  };
}
function installNarrowLeftSidebar(ctx, { width = 264, presentationWidth = 216, document: doc = globalThis.document } = {}) {
  const resolved = resolveLeftSidebarAdapter(ctx);
  if (!resolved) return () => {
  };
  const { instance, actions } = resolved;
  const target = Math.min(420, Math.max(264, Math.round(Number(width) || 264)));
  const initial = instance.getSnapshot().layoutInfo;
  const restoreWidth = initial.sidebar > 0 ? initial.sidebar : 280;
  const root = doc?.documentElement;
  const attrs = ["data-dsh-workspace-left-adapter", "data-dsh-workspace-left-expanded"];
  const oldAttrs = new Map(attrs.map((name2) => [name2, root?.getAttribute(name2) ?? null]));
  const oldWidth = root?.style.getPropertyValue("--dsh-workspace-left-width") ?? "";
  const stopPresentation = installLeftPresentation(resolved, { presentationWidth, document: doc });
  let collapsed = leftSidebarCollapsed(initial), disposed = false, writing = false, wrote = false;
  root?.setAttribute("data-dsh-workspace-left-adapter", "");
  function reflect(info) {
    const expanded = !leftSidebarCollapsed(info);
    root?.toggleAttribute("data-dsh-workspace-left-expanded", expanded);
    const projected = resolved.entry.component?.name === "LeftPresentationFrame";
    const geometry = leftPresentationGeometry(info, { presentationWidth });
    const value = `${expanded ? projected ? geometry.columns.sidebar : info.sidebar || 280 : 0}px`;
    if (root && root.style.getPropertyValue("--dsh-workspace-left-width") !== value) root.style.setProperty("--dsh-workspace-left-width", value);
  }
  function setDefault() {
    if (disposed || writing) return;
    writing = true;
    try {
      actions.setSidebar(target);
      wrote = true;
    } catch {
    } finally {
      writing = false;
    }
  }
  function sync() {
    if (disposed) return;
    const info = instance.getSnapshot().layoutInfo;
    const nextCollapsed = leftSidebarCollapsed(info);
    const reopened = collapsed && !nextCollapsed;
    collapsed = nextCollapsed;
    reflect(info);
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
      try {
        actions.setSidebar(restoreWidth);
      } catch {
      }
    }
    for (const [name2, value] of oldAttrs) {
      if (value === null) root?.removeAttribute(name2);
      else root?.setAttribute(name2, value);
    }
    if (root) {
      if (oldWidth) root.style.setProperty("--dsh-workspace-left-width", oldWidth);
      else root.style.removeProperty("--dsh-workspace-left-width");
    }
  };
}

// lib/client/context-layout.mjs
var CONTEXT_LAYOUT_CSS = `
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail){grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);column-gap:6px;padding:5px}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-context{gap:6px}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-copy{min-width:0}
.lc-sidebar-footer .lc-sidebar-status:not(.lc-sidebar-status-rail) .lc-sidebar-status-label{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
function installContextLayout(doc = globalThis.document) {
  if (!doc?.head) return () => {
  };
  const style = doc.createElement("style");
  style.dataset.dshWorkspaceContextLayout = "";
  style.textContent = CONTEXT_LAYOUT_CSS;
  doc.head.appendChild(style);
  return () => style.remove();
}

// lib/client/navigation.mjs
var ABSENT = Object.freeze({ getSnapshot: () => void 0, subscribe: () => () => {
} });
var UNAVAILABLE = Object.freeze({ inspectCallSource: ABSENT, openMaterial: void 0 });
var cache = /* @__PURE__ */ new WeakMap();
var sourceLike = (source) => typeof source?.getSnapshot === "function" && typeof source?.subscribe === "function";
var nonempty = (value) => typeof value === "string" && value.trim().length > 0;
function resolveProgressNavigation(ctx, sessionId) {
  if (!nonempty(sessionId)) return UNAVAILABLE;
  try {
    const slots = ctx.slots;
    const host = slots?.hostFace?.();
    const binding = ctx.sessions?.binding?.(sessionId);
    if (!host || !binding?.ctx || !["storeOf", "entriesOfSlot", "isLive", "subscribe"].every((key) => typeof host[key] === "function")) return UNAVAILABLE;
    const sessionEntry = host.entriesOfSlot("conversation.session")[0];
    const chatEntry = host.entriesOfSlot("conversation.view").find((entry) => entry.options?.id === "chat");
    let byBinding = cache.get(slots);
    if (!byBinding) cache.set(slots, byBinding = /* @__PURE__ */ new WeakMap());
    const prior = byBinding.get(binding);
    if (prior && prior.sessionEntry === sessionEntry && prior.chatEntry === chatEntry) return prior.navigation;
    const sameSession = () => ctx.sessions.binding(sessionId) === binding && binding.session?.getSnapshot?.()?.removed !== true;
    const currentEntry = (key, entry) => sameSession() && entry !== void 0 && host.isLive(entry) && host.entriesOfSlot(key).includes(entry);
    const sessionCurrent = () => currentEntry("conversation.session", sessionEntry);
    const chatCurrent = () => currentEntry("conversation.view", chatEntry);
    let nativeInspect;
    let nativeOpenFile;
    if (sessionEntry?.store && typeof sessionEntry.inject === "function") {
      const instance = host.storeOf(sessionEntry, { key: sessionId, ctx: binding.ctx });
      if (typeof instance?.actions?.openView === "function") nativeInspect = sessionEntry.inject(sessionId, instance.actions)?.hooks?.inspectCall;
    }
    if (typeof chatEntry?.inject === "function") nativeOpenFile = chatEntry.inject(sessionId)?.openFile;
    const inspect = (callId) => {
      if (!nonempty(callId) || !sessionCurrent()) return false;
      const open = nativeInspect.getSnapshot();
      if (typeof open !== "function") return false;
      open(callId);
      return true;
    };
    const inspectCallSource = sourceLike(nativeInspect) ? {
      getSnapshot: () => sessionCurrent() && typeof nativeInspect.getSnapshot() === "function" ? inspect : void 0,
      subscribe: (listener) => {
        const disposers = [
          nativeInspect.subscribe(listener),
          host.subscribe("conversation.session", listener),
          host.subscribe("conversation.view", listener)
        ];
        if (sourceLike(binding.session)) disposers.push(binding.session.subscribe(listener));
        if (sourceLike(ctx.sessions.list)) disposers.push(ctx.sessions.list.subscribe(listener));
        return () => {
          for (const dispose of disposers) dispose();
        };
      }
    } : ABSENT;
    const openMaterial = typeof nativeOpenFile === "function" ? (row) => {
      if (!chatCurrent() || !["modified", "delivered"].includes(row?.category) || !nonempty(row?.path)) return false;
      const sidebar = (typeof ctx.get === "function" ? ctx.get("sidebarRight") : void 0) ?? ctx.sidebarRight;
      if (typeof sidebar?.mounted?.getSnapshot !== "function" || sidebar.mounted.getSnapshot() !== sessionId) return false;
      return nativeOpenFile(row.path);
    } : void 0;
    const navigation = Object.freeze({ inspectCallSource, openMaterial });
    byBinding.set(binding, { sessionEntry, chatEntry, navigation });
    return navigation;
  } catch {
    return UNAVAILABLE;
  }
}

// lib/client/index.mjs
var name = "dsh-workspace";
var inject = ["slots", "sessions", "uiConversation", "connection", "jobs", "layout"];
var PROGRESS_KIND = "dsh-workspace.progress";
var PLUGINS_KIND = "dsh-workspace.plugins";
var el2 = import_react3.default.createElement;
var EMPTY_GEOMETRY = Object.freeze({ width: 244, compact: false, readingWidth: 720, maxExpandedHeight: 340, canExpand: true });
var ABSENT2 = Object.freeze({ subscribe: () => () => {
}, getSnapshot: () => EMPTY_GEOMETRY });
var ViewBoundary = class extends import_react3.default.Component {
  constructor() {
    super(...arguments);
    __publicField(this, "state", { failed: false });
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? el2("p", { role: "status" }, "\u5DE5\u4F5C\u533A\u89C6\u56FE\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u6536\u8D77\u540E\u91CD\u65B0\u6253\u5F00\u3002") : this.props.children;
  }
};
function InlineWorkspace(props) {
  const inspectSource = props.inspectCallSource;
  const openCall = import_react3.default.useSyncExternalStore(inspectSource.subscribe, inspectSource.getSnapshot, inspectSource.getSnapshot);
  const anchor = import_react3.default.useRef(null);
  const [attached, setAttached] = import_react3.default.useState(null);
  const [page, setPage] = import_react3.default.useState(PROGRESS_KIND);
  const [actionId, setActionId] = import_react3.default.useState(null);
  const [collapsed, setCollapsed] = import_react3.default.useState(false);
  const [expanded, setExpanded] = import_react3.default.useState(false);
  const [spaceNotice, setSpaceNotice] = import_react3.default.useState(false);
  const reopen = import_react3.default.useRef(null);
  const cardFocused = import_react3.default.useRef(false);
  const source = attached || ABSENT2;
  const geometry = import_react3.default.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  import_react3.default.useEffect(() => {
    if (geometry.compact) setExpanded(false);
  }, [geometry.compact]);
  const heightLimited = geometry.compact && !geometry.canExpand;
  import_react3.default.useLayoutEffect(() => {
    if (heightLimited) {
      setExpanded(false);
      setSpaceNotice(true);
    } else setSpaceNotice(false);
  }, [heightLimited]);
  const actions = useActions(props.registry);
  const companion = actions.find((action2) => action2.id === "whale-girl.assistant");
  const companionState = useActionState(companion);
  import_react3.default.useLayoutEffect(() => {
    const host = attachInlineWorkspace(anchor.current, { sessionId: props.sessionId });
    setAttached(host);
    if (!host) return;
    const release = props.registry.claimHost(host);
    return () => {
      release();
      host.dispose();
    };
  }, [props.sessionId, props.registry]);
  import_react3.default.useLayoutEffect(() => {
    if (!attached) return;
    attached.element.toggleAttribute("data-inline-expanded", geometry.compact && expanded && !heightLimited);
    attached.element.toggleAttribute("data-inline-collapsed", !geometry.compact && collapsed);
    attached.element.parentElement?.toggleAttribute("data-inline-collapsed", !geometry.compact && collapsed);
  }, [attached, geometry.compact, expanded, collapsed, heightLimited]);
  const openAction = (next) => {
    setPage(PLUGINS_KIND);
    setActionId(next);
    setCollapsed(false);
    setExpanded(geometry.compact && !heightLimited);
  };
  import_react3.default.useEffect(() => {
    const open = (event) => {
      if (!attached || !attached.element.isConnected || !attached.element.getClientRects().length) return;
      openAction(event.detail?.id || null);
    };
    document.addEventListener("dsh-workspace:select-action", open);
    return () => document.removeEventListener("dsh-workspace:select-action", open);
  }, [attached, geometry.compact, heightLimited]);
  const compact = geometry.compact && (!expanded || heightLimited);
  const closed = compact || collapsed;
  import_react3.default.useLayoutEffect(() => {
    if (closed && cardFocused.current && document.activeElement === document.body) reopen.current?.focus();
  }, [closed]);
  const plugins = page === PLUGINS_KIND;
  const card = el2(
    "section",
    {
      "data-dsh-workspace-panel": "",
      "data-workspace-visible": true,
      "data-workspace-pet-active": companionState.enabled === true,
      "data-workspace-kind": page,
      "aria-label": "\u8FDB\u5EA6\u4E0E\u63D2\u4EF6\u5361\u7247",
      onFocusCapture: () => {
        cardFocused.current = true;
      },
      onBlurCapture: (event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) cardFocused.current = false;
      }
    },
    el2(
      "div",
      { className: "dw-card-header" },
      closed ? el2("button", {
        ref: reopen,
        type: "button",
        className: "dw-card-reopen",
        title: heightLimited ? "\u7F29\u77ED\u8F93\u5165\u5185\u5BB9\u6216\u589E\u9AD8\u7A97\u53E3\u540E\u53EF\u5C55\u5F00\uFF1B\u52A9\u624B\u5F00\u5173\u4ECD\u53EF\u7528" : "\u5C55\u5F00\u8FDB\u5EA6\u4E0E\u63D2\u4EF6",
        "aria-disabled": heightLimited || void 0,
        onClick: () => {
          if (heightLimited) {
            setSpaceNotice(true);
            return;
          }
          setCollapsed(false);
          setExpanded(geometry.compact);
        }
      }, spaceNotice ? "\u7A7A\u95F4\u4E0D\u8DB3\uFF0C\u6682\u5DF2\u6536\u8D77" : "\u8FDB\u5EA6\u4E0E\u63D2\u4EF6") : el2(
        "div",
        { className: "dw-card-tabs", "aria-label": "\u5361\u7247\u5185\u5BB9" },
        el2("button", { type: "button", "aria-pressed": !plugins, onClick: () => {
          setPage(PROGRESS_KIND);
          setActionId(null);
        } }, "\u8FDB\u5EA6"),
        el2("button", { type: "button", "aria-pressed": plugins, onClick: () => {
          setPage(PLUGINS_KIND);
          setActionId(null);
        } }, "\u63D2\u4EF6")
      ),
      closed && heightLimited && companion && el2("div", { className: "dw-closed-assistant", title: "\u9CA8\u9CA8\u52A9\u624B" }, el2(ActionButton, { action: companion, openAction, compact: true })),
      !closed && el2("button", { type: "button", className: "dw-card-collapse", "aria-label": "\u6536\u8D77\u8FDB\u5EA6\u5361\u7247", onClick: () => geometry.compact ? setExpanded(false) : setCollapsed(true) }, "\u2212")
    ),
    !closed && el2(
      "div",
      { className: "dw-content" },
      el2(ViewBoundary, { key: props.sessionId + ":" + page }, plugins ? el2(PluginPanel, { registry: props.registry, openAction, actionId }) : el2(ProgressPanel, { ...props, openCall }))
    ),
    !closed && !plugins && el2("div", { className: "dw-controls" }, el2(QuickActions, { registry: props.registry, openAction }))
  );
  return el2(
    import_react3.default.Fragment,
    null,
    el2("span", { ref: anchor, "data-workspace-anchor": "", style: { display: "none" }, "aria-hidden": true }),
    attached && (0, import_react_dom.createPortal)(card, attached.element)
  );
}
function apply(ctx) {
  const registry = new ActionRegistry((error) => console.warn("dsh-workspace provider lifecycle", error?.name || "Error"), false);
  const disposers = [];
  const style = document.createElement("style");
  style.dataset.dshWorkspaceStyle = "";
  style.textContent = PLUGIN_CSS + "\n" + PROGRESS_CSS + `

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
  `;
  document.head.appendChild(style);
  disposers.push(() => style.remove());
  disposers.push(installWorkspaceLayout(ctx));
  disposers.push(installNarrowLeftSidebar(ctx));
  disposers.push(installContextLayout());
  disposers.push(ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: name,
    order: 100,
    inject: (sessionId) => {
      const binding = sessionId ? ctx.sessions.binding(sessionId) : void 0;
      const chat = binding ? ctx.uiConversation.binding(binding).target("chat") : void 0;
      return {
        registry,
        ...resolveProgressNavigation(ctx, sessionId),
        hooks: { ...chat ? { chat } : {}, connection: ctx.connection.state, jobs: ctx.jobs.state },
        watchJobs: (id) => ctx.jobs.watchRows(id)
      };
    }
  }, InlineWorkspace)));
  disposers.push(connectProviders(document, registry, (id) => document.dispatchEvent(new CustomEvent("dsh-workspace:select-action", { detail: { id } }))));
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const dispose of disposers.reverse()) dispose?.();
  };
}

return module.exports;}});
