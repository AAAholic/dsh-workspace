import { conciseFileReferences } from './action-labels.mjs'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const list = value => Array.isArray(value) ? value : []
const text = value => typeof value === 'string' ? value.trim() : ''
const finite = value => typeof value === 'number' && Number.isFinite(value)
const clip = (value, limit = 24) => {
  const chars = Array.from(text(value).replace(/\s+/g, ' '))
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : chars.join('')
}

const ACTIONS = Object.freeze({ inspect: '检查', review: '审查', audit: '审核', check: '检查',
  research: '调研', investigate: '排查', explore: '梳理', analyze: '分析', analyse: '分析',
  implement: '实现', develop: '开发', build: '构建', create: '创建', add: '添加', update: '更新',
  refactor: '重构', fix: '修复', test: '测试', validate: '验证', verify: '验证', run: '运行',
  compare: '对比', document: '记录', summarize: '总结', write: '编写', read: '读取', search: '搜索',
  remove: '删除', simplify: '简化', optimize: '优化', migrate: '迁移', deploy: '部署',
  package: '打包', plan: '规划', design: '设计', integrate: '集成', prepare: '准备' })

// Deterministic vocabulary only. Unknown names remain bounded verbatim rather
// than being guessed, discarded, or replaced with an uninformative task number.
const SUBJECTS = Object.freeze({
  'account settings panel': '账户设置面板', 'responsive navigation': '响应式导航',
  'customer requirements': '用户需求', 'progress module': '进度模块',
  'deployment config': '部署配置', 'source code': '源代码', 'regression tests': '回归测试',
  'native navigation': '原生导航', 'user data': '用户数据', 'final response': '最终回复',
  'configuration': '配置', 'requirements': '需求', 'navigation': '导航', 'responsive': '响应式',
  'implementation': '实现', 'deployment': '部署', 'settings': '设置', 'progress': '进度',
  'interface': '界面', 'layout': '布局', 'backend': '后端', 'frontend': '前端',
  'customer': '用户', 'account': '账户', 'panel': '面板', 'module': '模块',
  'changes': '改动', 'change': '改动', 'files': '文件', 'file': '文件', 'config': '配置',
  'results': '结果', 'findings': '发现', 'risks': '风险', 'tests': '测试', 'code': '代码',
})
function localSubject(value) {
  // Quoted identifiers are exact source references, not prose to translate.
  const identifiers = []
  let result = value.replace(/`[^`]+`|https?:\/\/\S+|(?:\.{0,2}\/)?[\w./-]+\.[A-Za-z0-9]{1,8}\b|(?:\/|\.\.?\/)[\w./-]+|\b[A-Z][A-Z0-9]{1,8}\b/g,
    match => `\u0000${identifiers.push(match.startsWith('`') ? match.slice(1, -1) : match) - 1}\u0000`)
  for (const [english, chinese] of Object.entries(SUBJECTS)) result = result.replace(new RegExp(`\\b${english}\\b`, 'gi'), chinese)
  result = result.replace(/\b(?:the|a|an)\s+/gi, '').replace(/\s+and\s+/gi, '与')
  return result.replace(/\u0000(\d+)\u0000/g, (_, index) => identifiers[Number(index)]).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu, '$1').trim()
}

function taskContent(content) {
  let original = text(content).replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '')
  // Stage headings already appear beside the task. Strip only those wrappers;
  // a real action or constraint such as “审查” or “只读” keeps its meaning.
  const wrapper = /^(?:(?:阶段|步骤)\s*[一二三四五六七八九十\d]+\s*[:：、.-]\s*)?(?:分析规划|分析与规划|任务执行|执行阶段|总结返回|实施步骤|工作计划|计划步骤|当前步骤|当前任务)\s*[:：]\s*(?=\S)/u
  while (wrapper.test(original)) original = original.replace(wrapper, '')
  return original
}

/** Bounded labels only; the complete authored sentence stays on node.original. */
export function conciseTaskLabel(content, index = 0) {
  const original = conciseFileReferences(taskContent(content))
  if (!original) return '未命名事项'
  // A negative leading action remains negative. A trailing constraint does not
  // erase an otherwise concrete task; the full constraint stays in original.
  const forbidden = original.match(/^(?:do not|don['’]t|never|avoid)\s+(\w+)(.*)$/i)
  if (forbidden) {
    const verb = forbidden[1].toLowerCase().replace(/ing$/, '')
    const action = ACTIONS[verb] ?? (verb === 'deploy' ? '部署' : forbidden[1])
    return clip(`不要${action}${localSubject(forbidden[2].replace(/^\s*[:：]\s*/, ''))}`)
  }
  if (/^implement\s+no\s+changes\b/i.test(original)) return '不作修改'
  const main = original.split(/\s+without\s+|[，,。；;\n]/i)[0].trim()
  if (/[\u3400-\u9fff]/u.test(original)) {
    if (!/[\u3400-\u9fff]/u.test(main)) return conciseTaskLabel(main, index)
    let withoutPrefix = original
    const prefix = original.match(/^([A-Za-z][A-Za-z -]*)\s*[:：]\s*(?=[\u3400-\u9fff])/u)
    if (prefix) {
      const label = prefix[1].trim(), lower = label.toLowerCase()
      if (/^(?:recon|deep-dive(?:\s+\w+)?)$/.test(lower)) withoutPrefix = original.slice(prefix[0].length)
      else if (ACTIONS[lower]) withoutPrefix = `${ACTIONS[lower]}：${original.slice(prefix[0].length)}`
      else if (lower === 'read-only') withoutPrefix = `只读：${original.slice(prefix[0].length)}`
      else if (!/^[A-Z][A-Z0-9]{1,7}$/.test(label)) withoutPrefix = `${clip(label, 8)}：${original.slice(prefix[0].length)}`
    }
    const translatedLead = withoutPrefix.replace(/^([A-Za-z]+)\b/, word => ACTIONS[word.toLowerCase()] ?? word)
    const sentence = translatedLead.replace(/^(?:我会|我们将|接下来(?:会|将)?)[，,:：\s]*/, '')
    const clauses = sentence.split(/[，,。；;\n]/u).map(text).filter(Boolean)
    // Keep the first task clause, including its leading negation. Later
    // constraints and the complete authored sentence remain in original.
    const first = clauses[0] ?? sentence
    return clip(first, 24)
  }
  const lower = main.toLowerCase()
  // Recognize explicit common task formulations, never arbitrary prose or logs.
  if (/^(?:recon\s*:|identify\b|inspect\b|check\b)/.test(lower) && /\b(?:artifacts|deployed state|current state|existing implementation)\b/.test(lower)) return '核对现状'
  const task = lower.replace(/^deep-dive\s+\w+\s*:\s*/, '')
  if (/^(?:adversarial\s+)?(?:review|audit)\s+(?:of\s+)?(?:the\s+)?(?:layout|responsive|interface|ui)(?![\w.-])/.test(task)) return '审查界面'
  if (/^(?:adversarial\s+)?(?:review|audit)\s+(?:of\s+)?(?:the\s+)?(?:progress|session boundaries)(?![\w.-])/.test(task)) return /progress module/.test(task) ? '审查进度模块' : '审查进度'
  if (/^(?:validate|verify|test|check)\b/.test(lower) && /\b(?:failed|failure|cancelled|canceled|error|interruptions)\b/.test(lower)) return '检查异常'
  if (/^(?:run|verify|validate|test)\b/.test(lower) && /\bregression\b/.test(lower)) return '回归验证'
  if (/^summari[sz]e\b/.test(lower) && /\b(?:findings|results|changes|conclusions)\b/.test(lower)) return '总结结论'
  const verb = lower.match(/^([a-z]+)\b/)?.[1]
  const action = ACTIONS[verb]
  if (action) {
    const subject = localSubject(main.replace(/^[a-z]+\s*[:：]?\s*(?:the\s+)?/i, ''))
    return clip(`${action}${subject ? `：${subject}` : ''}`)
  }
  return clip(localSubject(main), 24)
}

function normalize(raw) {
  if (!Array.isArray(raw)) return null
  const result = []
  for (const item of raw) {
    const content = text(item?.content)
    if (!object(item) || !content || !['pending', 'in_progress', 'completed'].includes(item.status)) return null
    result.push({ content, status: item.status })
  }
  return result
}

function currentNodes(chat, turnId) {
  if (!Array.isArray(chat?.order) || typeof chat?.nodes?.get !== 'function') return []
  return chat.order.map(key => chat.nodes.get(key)).filter(node => node?.visibility !== 'hidden' &&
    ['turn', 'step'].includes(node?.location?.kind) && node.location.turn?.turn === turnId)
}

function successfulPlans(nodes) {
  const found = [], seen = new Set()
  const visit = (tool, depth = 0) => {
    if (!object(tool) || depth > 32 || !text(tool.callId) || seen.has(tool.callId)) return
    seen.add(tool.callId)
    if (tool.kind === 'tool-result' && tool.call?.name === 'todo_write' && tool.isError !== true && !tool.error) found.push(tool)
    for (const child of list(tool.subCalls)) visit(child, depth + 1)
  }
  for (const node of nodes) if (node.kind === 'tool-call') visit(node.data?.root)
  // This is a receipt fallback, not a claim to reconstruct concurrent application
  // order. The official projection below is authoritative whenever available.
  return found.sort((a, b) => (finite(a.callTime) && finite(b.callTime) ? a.callTime - b.callTime : 0) ||
    (finite(a.seq) ? a.seq : -1) - (finite(b.seq) ? b.seq : -1) ||
    (finite(a.time) ? a.time : -1) - (finite(b.time) ? b.time : -1))
}

function readPlan(todos, allowProjection, nodes) {
  if (allowProjection && todos !== null && todos !== undefined) return { items: normalize(todos), source: 'projection' }
  const receipt = successfulPlans(nodes).at(-1)
  if (!receipt) return { items: [], source: 'none' }
  const raw = receipt.call?.argsRaw
  // Select first, parse second: malformed latest data must not revive an old list.
  if (typeof raw !== 'string' || raw.length > 200000) return { items: null, source: 'receipt' }
  try { return { items: normalize(JSON.parse(raw)?.todos), source: 'receipt' } }
  catch { return { items: null, source: 'receipt' } }
}

function replyData(data) {
  const final = data?.finalNode
  const blocks = list(data?.blocks ?? final?.blocks)
  return final?.kind === 'assistant' && finite(final.seq) && final.interrupted !== true &&
    blocks.some(block => block?.kind === 'text' && text(block.text)) && !blocks.some(block => block?.kind === 'tool-call')
}

function hasFinalReply(turn, nodes) {
  const tail = turn?.data?.get?.('turn-tail')
  if (tail?.turn === turn.turn) return tail.branchUnavailable === false && replyData(tail.closing)
  const candidates = nodes.filter(node => node.kind === 'assistant-step' && replyData(node.data))
  const final = candidates.sort((a, b) => a.data.finalNode.seq - b.data.finalNode.seq).at(-1)
  if (!final) return false
  const seq = final.data.finalNode.seq
  return nodes.every(node => {
    if (node.kind === 'tool-call') return node.data?.root?.kind === 'tool-result' && finite(node.data.root.seq) && node.data.root.seq < seq
    return node.kind !== 'assistant-step' || node === final || finite(node.data?.finalNode?.seq) && node.data.finalNode.seq <= seq
  })
}

const planningTask = content => /^(?:分析规划|分析与规划)[：:]/u.test(content) || /^(?:制定|整理|拟定|明确|更新)?(?:任务|实施|执行|工作)?(?:计划|规划)(?:[：:\s]|$)/u.test(content) || /^(?:plan\b|(?:create|prepare|write|update)\s+(?:an?\s+)?(?:implementation\s+|task\s+)?plan\b)/i.test(content)
const summaryTask = content => /^(?:总结(?:回复|返回|结论|结果)?|汇总(?:发现|结果|结论)|整理(?:结论|回复)|最终回复)(?:[：:，,\s]|$)/u.test(content) || /^summari[sz]e\s+(?:the\s+)?(?:findings|results|conclusions|final\s+(?:response|reply))\b|^(?:provide|write|deliver)\s+(?:a\s+)?final\s+(?:response|reply|summary)\b/i.test(content)

function requestOriginal(nodes) {
  const inputs = nodes.filter(node => ['user', 'steering'].includes(node.kind) &&
    (!node.data?.source?.kind || node.data.source.kind === 'user'))
  inputs.sort((a, b) => Number(a.kind === 'steering') - Number(b.kind === 'steering') ||
    (a.data?.seq ?? 0) - (b.data?.seq ?? 0))
  for (const node of inputs) {
    const original = list(node.data?.content).filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('').trim()
    if (original && !/^(?:好[的啊]?|可以|继续|停止|暂停|谢谢|ok|yes|no)[。.!！\s]*$/i.test(original)) return original
  }
  return ''
}

const CONTROL_TOOLS = new Set(['todo_write', 'ask_question', 'ask_user_question', 'submit_plan'])
function activityGroups(tools, { closed, normal, stale, phaseStatus }) {
  const grouped = new Map()
  const rows = list(tools).filter(row => text(row.id) && text(row.name) && !CONTROL_TOOLS.has(row.name))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  for (const row of rows) {
    const label = text(row.actionLabel) || text(row.label) || row.name
    const key = text(row.actionGroupKey) || label
    if (!grouped.has(key)) grouped.set(key, { id: row.id, label, rows: [], order: row.order ?? grouped.size })
    const group = grouped.get(key)
    if (group.label !== label && text(row.actionGroupLabel)) group.label = row.actionGroupLabel
    group.rows.push(row)
    group.order = row.order ?? group.order
  }
  return [...grouped.values()].map(group => {
    const statuses = group.rows.map(row => row.status === 'done' ? 'completed'
      : ['running', 'preparing', 'unknown'].includes(row.status) ? stale ? 'unknown' : normal ? 'completed' : closed ? phaseStatus : row.status === 'unknown' ? 'unknown' : 'in_progress' : row.status)
    const status = ['in_progress', 'waiting'].find(value => statuses.includes(value))
      ?? statuses.at(-1) ?? phaseStatus
    const original = group.rows.map(row => `${row.actionLabel || row.label || row.name} [${row.id}]`).join('\n')
    return { id: `activity:${group.id}`, source: 'tool-activity', status,
      label: clip(group.label, 32), original, order: group.order,
      callIds: group.rows.map(row => row.id), returned: statuses.filter(value => value === 'completed').length, totalCalls: statuses.length }
  }).sort((a, b) => {
    const priority = node => ['in_progress', 'waiting'].includes(node.status) ? 0
      : ['error', 'stopped'].includes(node.status) ? 1 : 2
    return priority(a) - priority(b) || b.order - a.order
  }).slice(0, 4).sort((a, b) => a.order - b.order)
}

function aggregate(items, fallback) {
  if (!items.length) return fallback
  if (items.every(item => item.status === 'completed')) return 'completed'
  for (const status of ['error', 'stopped', 'unknown', 'waiting', 'in_progress']) if (items.some(item => item.status === status)) return status
  return 'pending'
}

function phase(id, label, status, items = []) {
  const node = { id, label, status }
  if (items.length === 1 && id !== 'execution') node.original = items[0].original
  else if (items.length) node.children = items
  if (items.length) {
    node.completed = items.filter(item => item.status === 'completed').length
    node.total = items.length
  }
  return node
}

/** A lightweight view of turn progress, not a deliverable acceptance checklist. */
export function deriveTimeline({ sessionId, turnId, state = {}, plan, tools = [], jobs = [], children = [], chat, session = {}, status, todos } = {}) {
  const empty = { nodes: [], completed: 0, total: 0, headline: state.label || '等待开始', tone: state.tone || 'neutral', pendingCount: 0 }
  if (!sessionId || turnId === null || turnId === undefined || session?.sessionId && session.sessionId !== sessionId || session?.removed) return empty
  const turn = chat?.timeline?.turns?.get?.(turnId)
  if (!object(turn) || turn.turn !== turnId) return empty
  const selected = currentNodes(chat, turnId)
  const latest = list(chat?.timeline?.turnOrder).at(-1) === turnId
  if (!latest) return empty
  const recovered = readPlan(todos, latest, selected)
  const items = recovered.items ?? []
  const closed = turn.status === 'closed', reason = turn.end?.data?.reason?.kind
  const normal = closed && reason === 'completed'
  const stopped = closed && ['aborted', 'interrupted', 'max-tokens', 'blocked'].includes(reason)
  const failed = closed && reason === 'error'
  const terminal = failed ? 'error' : 'stopped'
  const stale = state.stale === true || session.openState === 'error' || Boolean(session.openError) || session.openState === 'loading' || session.awaitingFirstTurn === true
  const pending = status?.pendingInteraction
  const waiting = !closed && (state.waiting === true || pending && (!pending.sessionId || pending.sessionId === sessionId))
  const live = list(tools).filter(row => ['running', 'preparing'].includes(row.status)).length
  const background = [...list(jobs), ...list(children)].some(row => ['running', 'stopping', 'waiting', 'unknown'].includes(row.status))
  const active = !stale && !closed && (state.active === true || (status?.running ?? session.running) === true)
  const reply = normal && hasFinalReply(turn, selected)
  const phaseStatus = stale ? 'unknown' : closed ? normal ? 'completed' : terminal : waiting && live === 0 ? 'waiting' : active ? 'in_progress' : 'pending'
  const planning = [], executing = [], summarizing = []
  const taskGroups = new Map()
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const nodeStatus = item.status === 'completed' ? 'completed' : closed ? normal ? 'completed' : item.status === 'in_progress' ? terminal : 'pending'
      : item.status === 'in_progress' ? phaseStatus : 'pending'
    const target = planningTask(item.content) ? planning : summaryTask(item.content) ? summarizing : executing
    // Dedupe only the complete same content inside the same phase. Do not use
    // clipped labels: different paths or trailing constraints can look alike.
    const identity = `${target === planning ? 'planning' : target === summarizing ? 'summary' : 'execution'}:${taskContent(item.content).replace(/\s+/g, ' ')}`
    const duplicate = taskGroups.get(identity)
    if (duplicate) {
      duplicate.originals.push(item.content)
      duplicate.taskIds.push(`task:${index}`)
      duplicate.original = duplicate.originals.join('\n')
      duplicate.status = ['in_progress', 'waiting'].find(value => [duplicate.status, nodeStatus].includes(value)) ?? nodeStatus
    } else {
      const node = { id: `task:${index}`, label: conciseTaskLabel(item.content, index), status: nodeStatus, original: item.content,
        originals: [item.content], taskIds: [`task:${index}`], source: 'plan' }
      target.push(node)
      taskGroups.set(identity, node)
    }
  }
  const groups = items.length ? [] : activityGroups(tools, { closed, normal, stale, phaseStatus })
  const toolEvidence = groups.length > 0 || selected.some(node => {
    const root = node.kind === 'tool-call' ? node.data?.root : null
    const name = root?.call?.name ?? root?.name
    return object(root) && !['ask_question', 'ask_user_question', 'submit_plan', 'todo_write'].includes(name)
  })
  const responseEvidence = selected.some(node => node.kind === 'assistant-step' &&
    list(node.data?.blocks ?? node.data?.finalNode?.blocks).some(block => block?.kind === 'text' && text(block.text)))
  // Moving on to work or a reply advances the earlier phase even without a todo
  // receipt. A normal close finishes the flow, including unrefreshed plan rows.
  const planningFallback = normal || items.length > 0 || toolEvidence || responseEvidence ? 'completed' : phaseStatus
  const planningStatus = normal ? 'completed' : aggregate(planning, planningFallback)
  let executionStatus
  if (items.length) executionStatus = aggregate(executing,
    planningStatus === 'completed' && (reply || summarizing.length > 0 && summarizing.every(item => item.status === 'completed')) ? 'completed' : phaseStatus)
  else {
    executionStatus = closed || stale ? phaseStatus : toolEvidence || responseEvidence ? phaseStatus : 'pending'
    executing.push(...groups)
  }
  // A plan can lag actual execution. Live work keeps its phase current even
  // when the assistant has not updated pending/completed plan entries yet.
  const liveWork = tools.some(row => ['running', 'preparing'].includes(row.status) && !CONTROL_TOOLS.has(row.name))
  if (active && liveWork && !planning.some(item => item.status === 'in_progress')) executionStatus = 'in_progress'
  const readyForReply = items.length > 0 && planningStatus === 'completed' && executionStatus === 'completed'
  const summaryFallback = closed ? normal ? 'completed' : terminal
    : active && !waiting && live === 0 && readyForReply ? 'in_progress' : 'pending'
  let summaryStatus = aggregate(summarizing, summaryFallback)
  if (summaryStatus === 'completed') summaryStatus = closed ? normal ? 'completed' : terminal
    : active && !waiting && live === 0 ? 'in_progress' : 'pending'
  const nodes = [phase('received', '接收任务', 'completed'), phase('planning', '分析规划', planningStatus, planning),
    phase('execution', '任务执行', executionStatus, executing), phase('summary', '总结返回', summaryStatus, summarizing)]
  if (!items.length) {
    // Keep the overview light; detailed action counts live in the activity list.
    delete nodes[2].completed
    delete nodes[2].total
    const request = requestOriginal(selected)
    if (request) nodes[3].original = `答复对象：${request}`
  }
  const completed = nodes.filter(node => node.status === 'completed').length
  const pendingCount = nodes.length - completed
  const headline = stale ? state.label || '未同步' : failed ? '出错' : stopped ? '已停止'
    : waiting ? ['等待回答', '等待审核', '等待审批'].includes(state.label) ? state.label : '等待处理'
    : closed ? background ? '后台运行中' : normal ? items.length ? '已完成' : reply ? '已答复' : '已结束' : '已结束'
    : active ? '进行中' : '等待开始'
  let tone = stale || stopped || waiting ? 'warning' : failed ? 'error' : active || background ? 'active' : 'neutral'
  if (failed && !stale) tone = 'error'
  return { nodes, completed, total: nodes.length, headline, tone, pendingCount, evidenceMode: items.length ? 'plan' : 'activity' }
}
