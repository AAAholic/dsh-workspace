import React, { useEffect, useMemo, useSyncExternalStore } from 'react'
import { currentTurnOf, deriveProgress } from './progress-state.mjs'

const h = React.createElement
const EMPTY = Object.freeze([])
const ABSENT_SOURCE = Object.freeze({ subscribe: () => () => {}, getSnapshot: () => undefined })
const STATUS = Object.freeze({ pending: '待处理', in_progress: '进行中', completed: '完成',
  preparing: '准备中', running: '进行中', done: '已返回', error: '失败', stopped: '已停止',
  stopping: '停止中', waiting: '等待处理', unknown: '同步中' })
const NODE_STATUS = Object.freeze({ completed: '已完成', in_progress: '进行中', pending: '待做',
  waiting: '等待', error: '出错', stopped: '已停止', unknown: '同步中' })
const NODE_MARK = Object.freeze({ error: '!', stopped: '−' })

function Dot({ status }) { return h('span', { className: 'dsw-progress-dot', 'data-status': status, 'aria-hidden': true }) }

function Row({ row, inspect }) {
  const interactive = typeof inspect === 'function' && row.id && !row.nested
  const props = { className: 'dsw-progress-activity', 'data-state': row.status, key: row.id }
  const content = [h(Dot, { status: row.status, key: 'dot' }),
    h('span', { className: 'dsw-progress-row-body', key: 'body' },
      h('span', { className: 'dsw-progress-row-title' }, row.actionLabel || row.label),
      !row.actionLabel && row.detail && h('span', { className: 'dsw-progress-row-detail', title: row.detail }, row.detail)),
    h('span', { className: 'dsw-progress-row-status', key: 'status' }, STATUS[row.status] || row.status)]
  return h('li', props, interactive ? h('button', { type: 'button', className: 'dsw-progress-row-button',
    title: '查看原工具记录', onClick: () => inspect(row.id) }, ...content) : h('div', { className: 'dsw-progress-row-button' }, ...content))
}

function TimelineNode({ node, child = false }) {
  const status = NODE_STATUS[node.status] ? node.status : 'unknown'
  const statusLabel = NODE_STATUS[status]
  const visibleStatus = !['completed', 'pending', 'in_progress'].includes(status)
  const children = Array.isArray(node.children) ? node.children : EMPTY
  const hasCount = children.length > 0 && Number.isFinite(node.completed) && Number.isFinite(node.total)
  return h('li', { className: `dsw-progress-node ${child ? 'dsw-progress-subtask' : 'dsw-progress-stage'}`,
    'data-status': status, 'data-node-id': node.id,
    'aria-current': status === 'in_progress' ? 'step' : undefined },
    h('div', { className: 'dsw-progress-node-row', 'data-has-meta': visibleStatus || hasCount ? 'true' : undefined },
      h('span', { className: 'dsw-progress-marker', 'aria-hidden': true }, NODE_MARK[status] || ''),
      h('span', { className: 'dsw-progress-node-label', title: node.original || node.label,
        'aria-label': node.original || node.label }, node.label),
      visibleStatus ? h('span', { className: 'dsw-progress-node-status' }, statusLabel) :
        h(React.Fragment, null,
          h('span', { className: 'dsw-progress-sr' }, statusLabel),
          hasCount && h('span', { className: 'dsw-progress-node-count',
            'aria-label': `子任务已完成 ${node.completed} 项，共 ${node.total} 项` }, `${node.completed}/${node.total}`))),
    children.length > 0 && h('ol', { className: 'dsw-progress-subtasks', 'aria-label': `${node.label}子任务` },
      ...children.map(item => h(TimelineNode, { key: item.id, node: item, child: true }))))
}

function Timeline({ timeline }) {
  return h('ol', { className: 'dsw-progress-timeline', 'aria-label': '任务时间线' },
    ...timeline.nodes.map(node => h(TimelineNode, { key: node.id, node })))
}

function Materials({ model, openMaterial }) {
  const names = { provided: '已提供', modified: '已修改', delivered: '已交付' }
  return h('details', { className: 'dsw-progress-files', 'aria-label': '本轮文件' },
    h('summary', null, `文件 ${model.materials.length}`),
    h('ul', { className: 'dsw-progress-materials' }, ...model.materials.map(row => {
      const canOpen = typeof openMaterial === 'function' && row.path
      const props = { className: 'dsw-progress-material', key: row.id, title: row.path || row.label }
      const body = [h('span', { className: 'dsw-progress-file-icon', key: 'icon', 'aria-hidden': true }, '▤'),
        h('span', { className: 'dsw-progress-file-label', key: 'label' }, row.label),
        h('span', { className: 'dsw-progress-file-category', key: 'category' }, names[row.category])]
      return h('li', props, canOpen ? h('button', { type: 'button', className: 'dsw-progress-file-button',
        onClick: () => openMaterial(row), title: `查看${row.label}` }, ...body) : h('div', { className: 'dsw-progress-file-button' }, ...body))
    })))
}

function Details({ model, openCall }) {
  const background = [...model.jobs, ...model.children.map(row => ({ ...row, detail: '子任务' }))]
  const authored = model.timeline?.nodes.flatMap(node => node.children ?? (node.original ? [node] : []))
    .filter(node => node.source === 'plan' || node.original && ['planning', 'summary'].includes(node.id)) ?? EMPTY
  if (!model.tools.length && !background.length && !model.state.detail && !authored.length) return null
  return h('details', { className: 'dsw-progress-details', 'aria-label': '活动详情' },
    h('summary', null, '详情'),
    model.state.detail && h('p', { className: 'dsw-progress-note' }, model.state.detail),
    authored.length > 0 && h('section', { className: 'dsw-progress-detail-section', 'aria-label': '完整原文' },
      h('h3', null, '原文'),
      h('ul', { className: 'dsw-progress-activities' }, ...authored.map(node => h('li', { key: node.id,
        className: 'dsw-progress-note' }, node.original || node.label)))),
    model.tools.length > 0 && h('section', { className: 'dsw-progress-detail-section', 'aria-label': '本轮工具活动' },
      h('h3', null, '活动'),
      h('ul', { className: 'dsw-progress-activities' }, ...model.tools.map(row => h(Row, { row, inspect: openCall, key: row.id })))),
    background.length > 0 && h('section', { className: 'dsw-progress-detail-section', 'aria-label': '会话后台活动' },
      h('h3', null, '后台'),
      h('ul', { className: 'dsw-progress-activities' }, ...background.map(row => h(Row, { row, key: row.id })))))
}

/** Stateless host-fixture seat. Key this view by sessionId/turnId to reset disclosure. */
export function ProgressView({ model, openCall, openMaterial }) {
  const timeline = model.timeline || { nodes: [], completed: 0, total: 0, headline: '同步中', tone: model.state.tone }
  return h('div', { className: 'dsw-progress', 'data-connection-stale': model.state.stale ? 'true' : undefined },
    h('div', { className: 'dsw-progress-overview', 'data-tone': timeline.tone, 'aria-label': '当前状态',
      role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
      h('span', { className: 'dsw-progress-headline' }, timeline.headline),
      timeline.total > 0 && timeline.evidenceMode === 'plan' && h('span', { className: 'dsw-progress-count',
        'aria-label': `已完成 ${timeline.completed} 个阶段，共 ${timeline.total} 个阶段` }, `${timeline.completed}/${timeline.total}`)),
    timeline.nodes.length > 0 && h(Timeline, { timeline }),
    h(Details, { model, openCall }),
    model.materials.length>0 && h(Materials, { model, openMaterial }))
}

/**
 * Host contract: Session scope supplies useSession/useSessionStatus/useProjection/useSessions.
 * Slot inject supplies hooks:{chat: uiConversation.binding(binding).target('chat'),
 * connection: connection.state, jobs: jobs.state}, plus watchJobs (roster only; no outputs).
 * Only the official job roster observation is opened while this panel is mounted.
 * Only loaded current-turn request text is summarized; no output observation,
 * retained history fetch, or model call is made here.
 */
export function ProgressPanel({ sessionId, useSession, useSessionStatus, useProjection, useSessions,
  useChat, useConnection, useJobs, watchJobs, openCall, openMaterial }) {
  const session = useSession(value => value)
  const statuses = useSessionStatus(value => value)
  const summaries = useSessions(value => value)
  const chat = useChat ? useChat(value => value) : undefined
  const connection = useConnection(value => value)
  const todos = useProjection('todos')
  const catalog = useProjection('subagentCatalog')
  const jobs = useJobs ? useJobs(value => value.rows[sessionId]) ?? EMPTY : EMPTY
  // Deliverables may update without changing the Chat node/order reference.
  // Read their keyed source rather than waiting for a later transcript render.
  const deliverableSource = useMemo(() => currentTurnOf(chat)?.data?.source?.('deliverables') ?? ABSENT_SOURCE, [chat])
  const deliverables = useSyncExternalStore(deliverableSource.subscribe, deliverableSource.getSnapshot, deliverableSource.getSnapshot)
  useEffect(() => sessionId && typeof watchJobs === 'function' ? watchJobs(sessionId) : undefined, [sessionId, watchJobs])
  const model = useMemo(() => deriveProgress({ sessionId, session, status: statuses?.get?.(sessionId),
    statuses, connection, chat, todos, catalog, sessions: summaries, jobs, deliverables }),
  [sessionId, session, statuses, connection, chat, todos, catalog, summaries, jobs, deliverables])
  return h(ProgressView, { model, openCall, openMaterial, key: `${sessionId}:${model.turnId}` })
}
