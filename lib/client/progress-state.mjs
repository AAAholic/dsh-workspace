import { deriveTimeline } from './progress-timeline.mjs'
import { describeToolAction } from './action-labels.mjs'

// Presentation-only adapter over the already-authorized Session/Conversation sources.
// Never fetch logs, infer steps from prose, or equate a tool receipt with acceptance.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' ? value.trim() : ''
const list = value => Array.isArray(value) ? value : []
const finite = value => typeof value === 'number' && Number.isFinite(value)
const turnNumber = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const bound = (value, limit = 120) => {
  const chars = Array.from(text(value).replace(/\s+/g, ' '))
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('')
}

export const TOOL_LABELS = Object.freeze({
  read: '读取文件', write: '写入文件', edit: '编辑文件', str_replace_editor: '编辑文件',
  bash: '运行命令', exec: '运行脚本', code: '运行代码', rg: '搜索内容', glob: '查找文件',
  search: '搜索资料', web_search: '搜索网页', web_fetch: '读取网页', todo_write: '更新计划',
  ask_user_question: '等待回答', ask_question: '等待回答', submit_plan: '提交方案',
  present: '交付文件', spawn: '启动子任务', subagent: '启动子任务',
  job_list: '查看后台任务', job_read: '读取任务输出', job_kill: '停止后台任务',
})

export function toolLabel(name) {
  return TOOL_LABELS[name] ?? (bound(name, 60) || '工具调用')
}

function toolDetail(tool, name) {
  const raw = tool.kind === 'tool-result' ? tool.call?.argsRaw : tool.argsRaw
  return describeToolAction(name, raw, toolLabel(name))
}

function nodeTurn(node) {
  const location = node?.location
  return location?.kind === 'turn' || location?.kind === 'step' ? turnNumber(location.turn?.turn) : null
}

export function readChatNodes(chat) {
  if (!Array.isArray(chat?.order) || typeof chat?.nodes?.get !== 'function') return []
  return chat.order.flatMap(key => {
    const node = chat.nodes.get(key)
    return record(node) && node.visibility !== 'hidden' ? [node] : []
  })
}

export function currentTurnOf(chat) {
  const id = turnNumber(list(chat?.timeline?.turnOrder).at(-1))
  const turn = id === null ? null : chat.timeline?.turns?.get?.(id)
  return record(turn) && turn.turn === id ? turn : null
}

export function normalizeTodos(raw) {
  return list(raw).flatMap((item, index) => {
    if (!record(item) || !text(item.content) || !['pending', 'in_progress', 'completed'].includes(item.status)) return []
    return [{ key: `${index}:${item.content}`, content: item.content, status: item.status }]
  })
}

function toolRows(nodes, active) {
  const rows = [], seen = new Set()
  const visit = (tool, parentId, depth = 0) => {
    if (!record(tool) || depth > 32 || !text(tool.callId) || seen.has(tool.callId)) return
    seen.add(tool.callId)
    const settled = tool.kind === 'tool-result'
    const name = settled ? tool.call?.name : tool.name
    const stopped = settled && tool.error?.code === 'interrupted'
    const status = settled ? stopped ? 'stopped' : tool.isError === true || tool.error ? 'error' : 'done'
      : active ? tool.phase === 'preparing' ? 'preparing' : 'running' : 'unknown'
    rows.push({ id: tool.callId, parentId, order: rows.length, name: text(name), label: toolLabel(text(name)),
      ...toolDetail(tool, text(name)), status, time: finite(tool.time) ? tool.time : null,
      seq: finite(tool.seq) ? tool.seq : null, nested: parentId !== undefined })
    for (const child of list(tool.subCalls)) visit(child, tool.callId, depth + 1)
  }
  for (const node of nodes) if (node.kind === 'tool-call') visit(node.data?.root)
  return rows
}

function selectedPending(sessionId, status) {
  const pending = status?.pendingInteraction
  return pending && (!pending.sessionId || pending.sessionId === sessionId) ? pending : undefined
}

function markWaitingTool(tools, pending) {
  if (!pending) return tools
  const live = tools.filter(row => ['running', 'preparing'].includes(row.status))
  const callId = text(pending.callId)
  // The host normally provides callId. An unnamed blocking request can still
  // identify one unresolved tool by its explicit domain; never guess among peers.
  const names = text(pending.toolName) ? [pending.toolName]
    : pending.kind === 'question' ? ['ask_user_question', 'ask_question']
    : pending.kind === 'plan-review' ? ['submit_plan', 'ask_user_question', 'ask_question'] : []
  const candidates = live.filter(row => callId ? row.id === callId : names.includes(row.name))
  if (candidates.length !== 1) return tools
  return tools.map(row => row === candidates[0] ? { ...row, status: 'waiting' } : row)
}

function providedFiles(nodes) {
  const result = []
  for (const node of nodes) {
    if (!['user', 'steering'].includes(node.kind)) continue
    for (const block of list(node.data?.content)) {
      if (!['file', 'image'].includes(block?.type) || !record(block.attachment)) continue
      const attachment = block.attachment
      const id = text(attachment.attachmentId)
      if (!id) continue
      const label = text(attachment.name) || text(attachment.filename) || (block.type === 'image' ? '图片附件' : '文件附件')
      result.push({ id: `provided:${id}`, label, path: '', category: 'provided' })
    }
  }
  return result
}

function materialRows(turn, nodes, deliverables) {
  const rows = providedFiles(nodes)
  const data = deliverables ?? turn?.data?.get?.('deliverables')
  for (const item of list(data?.produced)) {
    if (!text(item?.path) || !finite(item.seq)) continue
    rows.push({ id: `modified:${item.path}`, label: item.path.replaceAll('\\', '/').split('/').at(-1),
      path: item.path, category: 'modified', seq: item.seq })
  }
  for (const item of list(data?.presented)) {
    if (!text(item?.path) || !finite(item.seq)) continue
    rows.push({ id: `delivered:${item.path}`, label: item.path.replaceAll('\\', '/').split('/').at(-1),
      path: item.path, category: 'delivered', seq: item.seq, index: item.index })
  }
  return [...new Map(rows.map(row => [row.id, row])).values()]
}

function statusOf({ sessionId, session, status, connection, turn, liveTools, activity, backgroundCount }) {
  const common = { tone: 'neutral', active: false, detail: '' }
  if (!sessionId) return { ...common, label: '选择聊天' }
  if (connection !== 'connected') return { ...common, tone: 'warning', label: connection === 'connecting' ? '连接中' : '连接断开', stale: true }
  if (session?.removed) return { ...common, label: '聊天已移除' }
  if (session?.sessionId && session.sessionId !== sessionId) return { ...common, label: '切换中', stale: true }
  if (session?.openState === 'error' || session?.openError) return { ...common, tone: 'warning', label: '记录未同步', stale: true }
  if (session?.openState === 'loading' || session?.awaitingFirstTurn || ((status?.running ?? session?.running) === true && turn === null)) return { ...common, tone: 'active', label: '同步中' }
  const pending = selectedPending(sessionId, status)
  if (pending) {
    const label = pending.kind === 'plan-review' ? '等待审核' : pending.kind === 'question' ? '等待回答' : pending.kind === 'approval' ? '等待审批' : '等待处理'
    return { ...common, tone: 'warning', label, detail: liveTools > 0 ? `${liveTools} 项仍在运行` : '', waiting: true }
  }
  const running = status?.running ?? session?.running
  if (running === true) return { ...common, tone: 'active', active: true,
    label: activity ? `正在${activity.label}${liveTools > 1 ? ` · +${liveTools - 1}` : ''}` : '处理中',
    detail: activity?.detail || '' }
  if (turn?.status === 'closed') {
    const reason = turn.end?.data?.reason?.kind
    if (reason === 'error') return { ...common, tone: 'error', label: '出错', detail: '查看对话中的错误' }
    if (['aborted', 'interrupted'].includes(reason)) return { ...common, tone: 'warning', label: '已停止' }
    if (reason === 'max-tokens') return { ...common, tone: 'warning', label: '达到输出限制' }
    if (reason === 'blocked') return { ...common, tone: 'warning', label: '无法继续' }
    return { ...common, label: '已结束', detail: backgroundCount > 0 ? `后台 ${backgroundCount} 项运行中` : '' }
  }
  if (session?.blank === true) return { ...common, label: '等待开始' }
  return { ...common, label: turn?.status === 'open' ? '状态未同步' : '暂无活动' }
}

/** Pure derivation; only this selected session's Chat snapshot is admitted. */
export function deriveProgress({ sessionId, session = {}, status, connection = 'connected', chat,
  todos, catalog, sessions, statuses, jobs = [], deliverables } = {}) {
  const ownerMatches = !session?.sessionId || session.sessionId === sessionId
  const loadedTurn = ownerMatches ? currentTurnOf(chat) : null
  // A new running-bit may arrive before its turn/start. Do not relabel the
  // previous turn's finished tools/files as activity in the new round.
  const waitingForNewTurn = connection === 'connected' && (status?.running ?? session?.running) === true && loadedTurn?.status === 'closed'
  const turn = waitingForNewTurn ? null : loadedTurn
  const turnId = turn?.turn ?? null
  const nodes = turnId === null ? [] : readChatNodes(chat).filter(node => nodeTurn(node) === turnId)
  const recordsReady = connection === 'connected' && ownerMatches && !session?.removed &&
    !session?.openError && !['loading', 'error'].includes(session?.openState) && !session?.awaitingFirstTurn
  const rawActive = recordsReady && turn?.status === 'open' && (status?.running ?? session?.running) === true
  const tools = markWaitingTool(toolRows(nodes, rawActive), selectedPending(sessionId, status))
  const liveTools = tools.filter(row => ['running', 'preparing'].includes(row.status))
  const waitingTools = tools.filter(row => row.status === 'waiting')
  const activeJobs = ownerMatches ? list(jobs).filter(job => ['running', 'stopping'].includes(job?.status) && (!job.sessionId || job.sessionId === sessionId)).map(job => ({
    id: String(job.id), label: bound(text(job.label) || text(job.title) || text(job.name) || text(job.command) || '后台任务'),
    detail: bound(job.progress || job.detail), status: connection === 'connected' ? job.status : 'unknown',
  })) : []
  const children = ownerMatches ? list(catalog).flatMap(child => {
    if (!text(child?.id)) return []
    const childStatus = statuses?.get?.(child.id)
    const running = (childStatus?.running ?? sessions?.byId?.[child.id]?.running) === true
    if (!running && !childStatus?.pendingInteraction) return []
    return [{ id: child.id, label: bound(child.title || child.name || sessions?.byId?.[child.id]?.title || '子任务'),
      status: connection !== 'connected' ? 'unknown' : childStatus?.pendingInteraction ? 'waiting' : 'running' }]
  }) : []
  const normalizedTodos = ownerMatches ? normalizeTodos(todos) : []
  // DSH 0.2.1 resets the official todos projection on turn/start. A non-null
  // projection owns this turn even when its tool receipt is not loaded yet or
  // its renderer failed after the durable todo/write was committed.
  const currentPlan = ownerMatches && turn !== null && Array.isArray(todos) ||
    tools.some(row => row.name === 'todo_write' && row.status === 'done')
  const plan = { title: currentPlan ? '本轮计划' : '会话计划', items: normalizedTodos,
    inherited: normalizedTodos.length > 0 && !currentPlan,
    completed: normalizedTodos.filter(item => item.status === 'completed').length,
    active: normalizedTodos.filter(item => item.status === 'in_progress').length,
    total: normalizedTodos.length }
  const state = statusOf({ sessionId, session, status, connection, turn, liveTools: liveTools.length, activity: liveTools[0],
    backgroundCount: activeJobs.length + children.length })
  // Only a plan touched in THIS turn can name its current activity. Inherited
  // session plans never replace actual live tool, waiting or stale states.
  const currentSteps = currentPlan ? plan.items.filter(item => item.status === 'in_progress') : []
  if (state.active && currentSteps.length) {
    state.label = bound(currentSteps[0].content, 60) + (currentSteps.length > 1 ? ` · +${currentSteps.length - 1}` : '')
    state.detail = liveTools[0]?.label || ''
  }
  const materials = materialRows(turn, nodes, turn === null ? undefined : deliverables)
  // Keep every loaded current-turn record, including earlier failures. The view
  // folds the activity section without deleting those records.
  const recent = tools.filter(row => !['running', 'preparing', 'waiting'].includes(row.status)).sort((a, b) =>
    (b.time ?? -Infinity) - (a.time ?? -Infinity) || (b.seq ?? -Infinity) - (a.seq ?? -Infinity))
  const model = { sessionId, turnId, state, plan, tools: [...liveTools, ...waitingTools, ...recent],
    liveTools: liveTools.length, jobs: activeJobs, children, materials,
    materialCounts: { provided: materials.filter(row => row.category === 'provided').length,
      modified: materials.filter(row => row.category === 'modified').length,
      delivered: materials.filter(row => row.category === 'delivered').length } }
  return { ...model, timeline: deriveTimeline({ ...model, chat, session, status, todos }) }
}
