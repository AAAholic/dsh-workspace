// Read-only presentation of tool arguments. This is deliberately not a shell
// evaluator: substitutions, output, and arbitrary argument values stay private.
const text = value => typeof value === 'string' ? value.trim() : ''
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const clip = (value, limit = 64) => {
  const chars = Array.from(text(value).replace(/\s+/g, ' '))
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('')
}

export function shortFileName(value) {
  const path = text(value).replace(/^['"]|['"]$/g, '')
  if (!path || /[\r\n\x00-\x1f`$]/.test(path) || /^\w+:\/\//.test(path)) return ''
  return clip(path.replaceAll('\\', '/').replace(/\/+$/, '').split('/').at(-1), 40)
}

/** Shorten file references in authored text without changing ordinary prose. */
export function conciseFileReferences(value) {
  const fileReference = path => !/^\w+:\/\//.test(path) && (
    /^(?:[A-Za-z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])/.test(path) ||
    /^[A-Za-z\d_@.-]+[\\/]/.test(path) && (
      /[\\/][^\\/]+\.[A-Za-z\d]{1,12}(?::\d+(?::\d+)?)?$/.test(path) ||
      /[\\/](?:README|LICENSE|Dockerfile|Makefile)(?:\.[A-Za-z\d]+)?$/i.test(path)))
  const shorten = path => fileReference(path) ? shortFileName(path) || path : path
  return text(value)
    .replace(/(["'`])([^"'`\n]*[\\/][^"'`\n]*)\1/g, (whole, quote, path) => `${quote}${shorten(path)}${quote}`)
    .replace(/https?:\/\/[^\s<>"'`]+|(?<![\p{L}\p{N}_])(?:[A-Za-z]:[\\/]|(?:~|\.{1,2})?[\\/]|[\p{L}\p{N}_@.-]+[\\/])[^\s<>"'`，。；：、（）()\[\]{}]+/gu,
      path => shorten(path))
}

function action(verb, paths = [], fallback = '文件') {
  const names = [...new Set(paths.map(shortFileName).filter(Boolean))]
  const target = names.slice(0, 2).join('、') + (names.length > 2 ? ` 等${names.length}个文件` : '')
  const result = { actionLabel: clip(`${verb}${target ? ` ${target}` : fallback}`), detail: target, detailKind: target ? 'file_name' : null }
  if (target) {
    // Display only names, but keep distinct paths distinct when deduplicating.
    // The fingerprint is presentation metadata, not a stored command argument.
    const references = paths.filter(value => shortFileName(value)).map(value => text(value).replaceAll('\\', '/'))
    const identity = (['复制', '移动'].includes(verb) ? references : [...new Set(references)].sort()).join('\0')
    let hash = 2166136261
    for (const char of identity) hash = Math.imul(hash ^ char.codePointAt(0), 16777619)
    const inspect = ['检查', '查找'].includes(verb)
    result.actionGroupKey = `${inspect ? 'inspect' : verb}:${(hash >>> 0).toString(36)}`
    if (inspect) result.actionGroupLabel = clip(`检查 ${target}`)
  }
  return result
}

// Quotes and escapes are respected so a filename with spaces remains one token.
// The lexer only extracts arguments; it never expands variables or substitutions.
function shellParts(command) {
  const parts = [], tokens = []
  let value = '', quote = '', started = false, heredoc = false
  const token = () => { if (started) tokens.push(value); value = ''; started = false }
  const part = () => { token(); if (tokens.length) parts.push(tokens.splice(0)) }
  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    if (quote) {
      if (char === quote) quote = ''
      else if (char === '\\' && quote === '"' && /["\\$`\n]/.test(command[i + 1] || '')) value += command[++i] || ''
      else value += char
      continue
    }
    if (char === '"' || char === "'") { quote = char; started = true }
    else if (char === '\\') { value += command[++i] || ''; started = true }
    else if (char === '#' && !started) { while (i < command.length && command[i] !== '\n') i++; part() }
    else if (';|&\n'.includes(char)) {
      part()
      // Finish lexing the header before ignoring every byte of the heredoc body.
      if (char === '\n' && heredoc) return parts
      if (command[i + 1] === char) i++
    }
    else if (/\s/.test(char)) token()
    else if (char === '<' || char === '>') {
      const fd = /^\d+$/.test(value) ? value : ''
      if (fd) { value = ''; started = false } else token()
      let operator = char
      if (command[i + 1] === char) operator += command[++i]
      if (operator === '<<') { heredoc = true; if (command[i + 1] === '-') operator += command[++i] }
      else if (command[i + 1] === '&') operator += command[++i]
      tokens.push(fd + operator)
    } else { value += char; started = true }
  }
  part()
  return parts
}

function operands(tokens, valueOptions = new Set()) {
  const values = []
  let literal = false
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (/^\d*(?:[<>]{1,2}-?|[<>]&)$/.test(token)) { i++; continue }
    if (!literal && token === '--') { literal = true; continue }
    if (!literal && token.startsWith('-')) {
      if (valueOptions.has(token)) i++
      continue
    }
    values.push(token)
  }
  return values
}

const FILE_OPTIONS = new Set(['-n', '-c', '--lines', '--bytes', '-s', '--suffix'])
const SEARCH_OPTIONS = new Set(['-e', '--regexp', '-f', '--file', '-g', '--glob', '--iglob', '-t', '--type', '-T', '--type-not',
  '-m', '--max-count', '-A', '-B', '-C', '--after-context', '--before-context', '--context', '--max-depth', '--encoding', '--color', '--sort', '--sortr',
  '--include', '--exclude', '--exclude-dir', '--exclude-from', '--type-add', '--type-clear', '--ignore-file', '--pre', '--pre-glob',
  '--path-separator', '--replace', '-r', '--field-match-separator', '--field-context-separator', '--max-filesize', '-j', '--threads'])
const GREP_OPTIONS = new Set(['-e', '--regexp', '-f', '--file', '-m', '--max-count', '-A', '-B', '-C',
  '--after-context', '--before-context', '--context', '--include', '--exclude', '--exclude-dir', '--exclude-from',
  '-D', '--devices', '-d', '--directories', '--binary-files', '--label'])

function findTargets(tokens) {
  const start = tokens[0] === '-H' || tokens[0] === '-L' || tokens[0] === '-P' ? 1 : 0
  const end = tokens.findIndex((token, index) => index >= start && (token.startsWith('-') || ['!', '(', ')'].includes(token) || /^\d*[<>]/.test(token)))
  return tokens.slice(start, end === -1 ? tokens.length : end).filter(token => token !== '.')
}

function commandAction(original, depth = 0) {
  const tokens = [...original]
  while (tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]) || ['env', 'command', 'sudo'].includes(tokens[0]))) tokens.shift()
  const executable = shortFileName(tokens.shift()) || ''
  const program = executable.toLowerCase()
  if (!program) return null
  if (['bash', 'sh', 'zsh', 'fish'].includes(program)) {
    const index = tokens.findIndex(token => /^-[a-z]*c[a-z]*$/i.test(token))
    if (index !== -1 && tokens[index + 1] && depth < 2) return summarizeCommand(tokens[index + 1], depth + 1)
  }
  // Redirected logs do not replace a real file-removal action with “write log”.
  if (['rm', 'rmdir', 'unlink'].includes(program)) return action('删除', operands(tokens, new Set(['--interactive', '--preserve-root'])))
  if (program === 'xargs' && tokens.some(token => ['rm', 'rmdir', 'unlink'].includes(token))) return action('删除')
  if (program === 'find' && (tokens.includes('-delete') || tokens.some((token, index) => ['-exec', '-execdir'].includes(token) &&
    ['rm', 'rmdir', 'unlink'].includes(shortFileName(tokens[index + 1]))))) return action('清理', findTargets(tokens))
  const redirect = tokens.findIndex((token, index) => /^\d*>{1,2}$/.test(token) && tokens[index + 1] &&
    !/^(?:\/dev\/(?:null|stdout|stderr|stdin|fd\/\d+)|\d+|-)$/.test(tokens[index + 1]))
  if (redirect !== -1 && tokens[redirect + 1]) return action('编写', [tokens[redirect + 1]])
  if (['cd', 'pwd', 'echo', 'printf', 'true', 'sleep', 'export', 'set'].includes(program)) return { setup: true,
    actionLabel: program === 'cd' ? '切换工作目录' : '准备工作环境', detail: '', detailKind: null }
  if (['cat', 'head', 'tail', 'less', 'more'].includes(program)) {
    const result = action('打开', operands(tokens, FILE_OPTIONS))
    return result.detail ? result : { ...result, auxiliary: true }
  }
  if (['sed', 'awk'].includes(program)) {
    const inlineScript = tokens.some(token => ['-e', '-f', '--expression', '--file'].includes(token))
    const files = operands(tokens, new Set(['-e', '-f', '--expression', '--file']))
    if (tokens.includes('-i') && files[0] === '') files.shift()
    if (!inlineScript) files.shift()
    const result = action(tokens.some(token => token === '-i' || token.startsWith('-i.')) ? '编辑' : '打开', files)
    return result.detail ? result : { ...result, auxiliary: true }
  }
  if (['rg', 'grep', 'ag'].includes(program)) {
    const files = operands(tokens, program === 'grep' ? GREP_OPTIONS : SEARCH_OPTIONS)
    const explicitPattern = tokens.some(token => ['-e', '--regexp', '-f', '--file'].includes(token) || /^--regexp=/.test(token))
    if (!tokens.includes('--files') && !explicitPattern) files.shift()
    return action(tokens.includes('--files') ? '查找' : '检查', files, tokens.includes('--files') ? '文件' : '代码内容')
  }
  if (program === 'git') {
    while (tokens.length && tokens[0].startsWith('-')) {
      const option = tokens.shift()
      if (['-C', '-c', '--git-dir', '--work-tree'].includes(option)) tokens.shift()
    }
    const subcommand = tokens.shift()
    const divider = tokens.indexOf('--')
    const files = divider === -1 ? operands(tokens).filter(token => /[\\/]|\.[A-Za-z\d]+$/.test(token) && !token.includes('..')) : tokens.slice(divider + 1)
    if (['diff', 'show'].includes(subcommand)) return action('检查', files, '文件改动')
    if (['status', 'log', 'branch', 'rev-parse', 'ls-files'].includes(subcommand)) return { actionLabel: ({ status: '检查仓库状态', log: '查看提交记录', branch: '查看分支', 'rev-parse': '检查仓库信息', 'ls-files': '查找仓库文件' })[subcommand], detail: '', detailKind: null }
    return { actionLabel: ({ add: '整理文件改动', commit: '提交代码', push: '上传代码', pull: '同步代码', fetch: '获取远程更新', checkout: '切换代码版本', switch: '切换分支' })[subcommand] || '检查 Git 仓库', detail: '', detailKind: null }
  }
  if (['node', 'nodejs', 'python', 'python3', 'ruby', 'perl', 'bash', 'sh', 'zsh'].includes(program)) {
    if (tokens.includes('--test') || tokens.some(token => /^(?:pytest|unittest)$/.test(token))) return action('测试', operands(tokens, new Set(['-m'])), '代码')
    if (tokens.some(token => ['-e', '-c', '--eval', '-'].includes(token))) return { actionLabel: '运行脚本', detail: '', detailKind: null }
    return action('运行', operands(tokens).slice(0, 1), '脚本')
  }
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(program)) {
    const task = tokens[0] === 'run' ? tokens[1] : tokens[0]
    return { actionLabel: ({ test: '运行测试', build: '构建项目', check: '检查项目', lint: '检查代码格式', install: '安装依赖', ci: '安装依赖', dev: '启动预览', start: '启动应用' })[task] || `运行 ${executable}`, detail: '', detailKind: null }
  }
  if (['sort', 'uniq', 'cut', 'column'].includes(program)) {
    const files = operands(tokens, new Set(['-k', '--key', '-t', '--field-separator', '-S', '--buffer-size', '-T', '--temporary-directory',
      '-f', '--skip-fields', '-s', '--skip-chars', '-w', '--check-chars', '-b', '--bytes', '-c', '--characters', '-d', '--delimiter', '--fields']))
    const result = action('整理', files.filter(token => token !== '-'), '内容')
    return result.detail ? result : { ...result, auxiliary: true }
  }
  if (['tr', 'nl'].includes(program)) return { actionLabel: '整理内容', detail: '', detailKind: null, auxiliary: true }
  if (program === 'tee') return action('编写', operands(tokens).filter(token => token !== '-'))
  if (program === 'find') return action('查找', findTargets(tokens))
  if (['ls', 'stat', 'wc', 'file', 'du'].includes(program)) {
    const result = action('检查', operands(tokens).filter(token => !['.', '-'].includes(token)), '文件')
    return program === 'wc' && !result.detail ? { ...result, auxiliary: true } : result
  }
  if (['touch', 'mkdir'].includes(program)) return action('创建', operands(tokens), program === 'mkdir' ? '目录' : '文件')
  if (['cp', 'mv'].includes(program)) return action(program === 'cp' ? '复制' : '移动', operands(tokens))
  if (program === 'apply_patch') return action('编辑')
  return { actionLabel: /^[\p{L}\p{N}_.+-]+$/u.test(executable) ? clip(`运行 ${executable}`) : '运行脚本', detail: '', detailKind: null, generic: true }
}

export function summarizeCommand(command, depth = 0) {
  if (!text(command) || command.length > 100000) return { actionLabel: '运行脚本', detail: '', detailKind: null }
  const patchFiles = [...command.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)].map(match => match[1])
  if (patchFiles.length && /\bapply_patch\b/.test(command)) return action('编辑', patchFiles)
  const parsed = shellParts(command).map(tokens => commandAction(tokens, depth)).filter(Boolean)
  const useful = parsed.filter(item => !item.setup && !item.auxiliary)
  const selected = useful.length ? useful : parsed
  const grouped = new Map()
  for (const item of selected) {
    const key = item.actionGroupKey || item.actionLabel
    const previous = grouped.get(key)
    grouped.set(key, previous && previous.actionLabel !== item.actionLabel && item.actionGroupLabel
      ? { ...item, actionLabel: item.actionGroupLabel } : item)
  }
  const unique = [...grouped.values()]
  if (!unique.length) return { actionLabel: '运行脚本', detail: '', detailKind: null }
  // One short activity per call. Prefer substantial work over setup, readers,
  // and output formatting; use the last equally useful action in a sequence.
  const priority = item => item.setup || item.auxiliary ? -1 : item.generic ? 0
    : /^(?:编写|编辑|创建|复制|移动|删除|清理|测试|运行测试|构建|上传|提交|安装|同步|启动)/.test(item.actionLabel) ? 3 : item.detail ? 2 : 1
  const best = unique.reduce((chosen, item) => priority(item) >= priority(chosen) ? item : chosen)
  const { setup, auxiliary, generic, ...result } = best
  return result
}

export function describeToolAction(name, raw, fallback = '处理任务') {
  let args
  if (typeof raw === 'string' && raw.length <= 100000) {
    try { args = JSON.parse(raw) } catch { /* incomplete streaming arguments */ }
  }
  const empty = { actionLabel: fallback, detail: '', detailKind: null }
  if (!record(args)) return empty
  const tool = text(name).split(/__|[.:]/).at(-1)
  if (['bash', 'exec', 'exec_command', 'shell', 'run_command'].includes(tool)) return summarizeCommand(args.command || args.cmd || args.script)
  const paths = [args.file_path, args.path, args.filename, args.file, args.target_file].filter(value => typeof value === 'string')
  if (['read', 'read_file', 'open_file'].includes(tool)) return action('打开', paths)
  if (['write', 'write_file', 'create_file'].includes(tool)) return action('编写', paths)
  if (['edit', 'edit_file', 'str_replace_editor', 'apply_patch'].includes(tool)) {
    const patchFiles = [...text(args.patch || args.input).matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)].map(match => match[1])
    return action('编辑', paths.length ? paths : patchFiles)
  }
  if (['rg', 'grep', 'search_files'].includes(tool)) return action('检查', paths, '代码内容')
  if (['glob', 'list_files'].includes(tool)) return action('查找', paths)
  if (['web_fetch', 'fetch', 'open_url'].includes(tool) && text(args.url)) {
    try { const host = new URL(args.url).hostname; return { actionLabel: `查看 ${host}`, detail: host, detailKind: 'hostname' } } catch { return empty }
  }
  // Keep unknown-tool parameters out of the card: raw queries and commands can
  // include secrets, source text, or lengthy paths unrelated to a useful label.
  return { ...empty, detail: paths.map(shortFileName).filter(Boolean).slice(0, 2).join('、'), detailKind: paths.length ? 'file_name' : null }
}
