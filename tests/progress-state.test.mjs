import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveProgress, normalizeTodos, readChatNodes } from '../lib/client/progress-state.mjs'

const now = 1720000000000
const turn = (id = 2, status = 'open', reason) => ({ turn: id, status, start: { seq: 5, time: now },
  ...(reason ? { end: { seq: 20, time: now + 2000, data: { reason: { kind: reason } } } } : {}),
  data: new Map() })
const tool = (id, { name = 'read', state = 'running', time = now, path = '/workspace/readme.md', subCalls = [] } = {}) =>
  state === 'running' || state === 'preparing' ? { phase: state === 'preparing' ? state : 'start', callId: id,
    name, time, argsRaw: JSON.stringify({ path }), subCalls } :
    { kind: 'tool-result', callId: id, time, seq: 10, call: { name, argsRaw: JSON.stringify({ path }) },
      isError: state === 'error' || state === 'stopped', ...(state === 'stopped' ? { error: { code: 'interrupted' } } : {}), subCalls }
const node = (root, owner = 2) => ({ key: root.callId, kind: 'tool-call', data: { root },
  location: { kind: 'step', turn: { turn: owner } }, visibility: 'visible' })
const chat = (current, nodes = []) => ({ order: nodes.map(row => row.key), nodes: new Map(nodes.map(row => [row.key, row])),
  timeline: { turnOrder: [current.turn], turns: new Map([[current.turn, current]]) } })
const derive = (extra = {}) => deriveProgress({ sessionId: 'chosen', session: { sessionId: 'chosen', running: true, openState: 'open' },
  connection: 'connected', chat: chat(turn(), []), ...extra })

test('no explicit plan remains an honest no-plan state', () => {
  const model = derive()
  assert.equal(model.plan.total, 0)
  assert.equal(model.state.label, '处理中')
  assert.equal(model.state.detail, '')
  assert.equal(model.turnId, 2)
  assert.equal('percent' in model, false)
})

test('parallel tools remain multiple real live activities', () => {
  const model = derive({ chat: chat(turn(), [node(tool('a')), node(tool('b'))]) })
  assert.equal(model.liveTools, 2)
  assert.equal(model.state.label, '正在读取文件 · +1')
  assert.deepEqual(model.tools.map(row => row.id), ['a', 'b'])
})

test('recursive PTC children are admitted once and preserve relationship', () => {
  const child = tool('child')
  const root = tool('root', { subCalls: [child, child] })
  root.subCalls.push(root)
  const model = derive({ chat: chat(turn(), [node(root)]) })
  assert.equal(model.liveTools, 2)
  assert.equal(model.tools[1].parentId, 'root')
  assert.equal(model.tools[1].nested, true)
})

test('a waiting interaction outranks running and keeps parallel work explicit', () => {
  const model = derive({ status: { running: true, pendingInteraction: { kind: 'plan-review', sessionId: 'chosen' } },
    chat: chat(turn(), [node(tool('a'))]) })
  assert.equal(model.state.label, '等待审核')
  assert.equal(model.liveTools, 1)
  assert.match(model.state.detail, /1 项/)
})

test('foreign pending interactions are rejected', () => {
  const model = derive({ status: { running: true, pendingInteraction: { kind: 'approval', sessionId: 'other' } } })
  assert.equal(model.state.label, '处理中')
  assert.equal(model.state.waiting, undefined)
})

test('turn and session boundaries reject old and foreign activity', () => {
  const model = derive({ chat: chat(turn(), [node(tool('old'), 1), node(tool('new'), 2)]) })
  assert.deepEqual(model.tools.map(row => row.id), ['new'])
  const foreign = derive({ session: { sessionId: 'other', running: true }, chat: chat(turn(), [node(tool('wrong'))]),
    todos: [{ content: 'foreign', status: 'in_progress' }] })
  assert.equal(foreign.tools.length, 0)
  assert.equal(foreign.plan.total, 0)
  assert.equal(foreign.materials.length, 0)
})

test('the official current-turn todos projection is authoritative without a loaded receipt', () => {
  const model = derive({ todos: [{ content: 'new', status: 'completed' }] })
  assert.equal(model.plan.title, '本轮计划')
  assert.equal(model.plan.inherited, false)
  const current = derive({ todos: [{ content: 'new', status: 'in_progress' }],
    chat: chat(turn(), [node(tool('todos', { name: 'todo_write', state: 'done' }))]) })
  assert.equal(current.plan.title, '本轮计划')
  assert.equal(current.plan.inherited, false)
})

test('all todos completed do not manufacture successful acceptance', () => {
  const model = derive({ session: { sessionId: 'chosen', running: false }, chat: chat(turn(2, 'closed', 'error')),
    todos: [{ content: 'test', status: 'completed' }] })
  assert.equal(model.plan.completed, 1)
  assert.equal(model.state.label, '出错')
  assert.equal(model.state.active, false)
  assert.equal('accepted' in model, false)
})

test('cancel and output limits are not ordinary successful completion', () => {
  for (const [reason, label] of [['aborted', '已停止'], ['max-tokens', '达到输出限制'], ['blocked', '无法继续']]) {
    const model = derive({ session: { sessionId: 'chosen', running: false }, chat: chat(turn(2, 'closed', reason)) })
    assert.equal(model.state.label, label)
  }
  const normal = derive({ session: { sessionId: 'chosen', running: false }, chat: chat(turn(2, 'closed', 'completed')) })
  assert.equal(normal.state.label, '已结束')
  assert.equal(normal.state.detail, '')
})

test('disconnect overrides stale live status and preserves records as unknown', () => {
  const model = derive({ connection: 'disconnected', chat: chat(turn(), [node(tool('a'))]),
    status: { running: true, pendingInteraction: { kind: 'approval' } } })
  assert.equal(model.state.label, '连接断开')
  assert.equal(model.state.stale, true)
  assert.equal(model.liveTools, 0)
  assert.equal(model.tools[0].status, 'unknown')
})

test('new running bit before turn/start never revives previous files or tools', () => {
  const previous = turn(2, 'closed', 'completed')
  previous.data.set('deliverables', { produced: [{ path: '/workspace/old.txt', seq: 10 }] })
  const model = derive({ chat: chat(previous, [node(tool('old', { state: 'done' }))]) })
  assert.equal(model.state.label, '同步中')
  assert.equal(model.turnId, null)
  assert.equal(model.materials.length, 0)
  assert.equal(model.tools.length, 0)
})

test('tools are newest first after settlement, with a clear interruption state', () => {
  const model = derive({ chat: chat(turn(), [node(tool('early', { state: 'done', time: now })),
    node(tool('late', { state: 'stopped', time: now + 50 }))]) })
  assert.deepEqual(model.tools.map(row => row.id), ['late', 'early'])
  assert.equal(model.tools[0].status, 'stopped')
})

test('materials require durable attachments and official turn deliverables', () => {
  const t = turn()
  t.data.set('deliverables', { produced: [{ path: '/workspace/new.md', seq: 12 }, { path: '/workspace/new.md', seq: 13 }],
    presented: [{ path: '/workspace/new.md', seq: 14, index: 0 }] })
  const input = { key: 'input', kind: 'user', location: { kind: 'turn', turn: { turn: 2 } },
    data: { content: [{ type: 'file', attachment: { attachmentId: 'doc', name: 'given.pdf' } },
      { type: 'text', text: 'I used secret-path.md' }] } }
  const model = derive({ chat: chat(t, [input, node(tool('read', { state: 'done' }))]) })
  assert.deepEqual(model.materialCounts, { provided: 1, modified: 1, delivered: 1 })
  assert.equal(model.materials.some(row => row.path === 'secret-path.md'), false)
  assert.equal(model.materials.some(row => row.category === 'read'), false)
})

test('a keyed deliverables update is read immediately without a node change', () => {
  const model = derive({ deliverables: { presented: [{ path: '/workspace/final.pdf', seq: 15, index: 1 }] } })
  assert.equal(model.materialCounts.delivered, 1)
  assert.equal(model.materials[0].index, 1)
})

test('only current session live jobs and children are shown in the separate background group', () => {
  const model = derive({ jobs: [{ id: 'live', sessionId: 'chosen', status: 'running', title: 'watch' },
    { id: 'foreign', sessionId: 'other', status: 'running' }, { id: 'done', status: 'completed' }],
    catalog: [{ id: 'child', title: 'review' }, { id: 'idle' }],
    statuses: new Map([['child', { running: true }], ['idle', { running: false }]]) })
  assert.deepEqual(model.jobs.map(row => row.id), ['live'])
  assert.deepEqual(model.children.map(row => row.id), ['child'])
})

test('malformed todo and chat node input remains bounded and inert', () => {
  assert.deepEqual(normalizeTodos([{ content: 'x', status: 'unknown' }, null, { content: '', status: 'completed' }]), [])
  assert.deepEqual(readChatNodes({ order: ['unknown'], nodes: new Map() }), [])
  assert.deepEqual(readChatNodes({ nodes: [] }), [])
  const model = derive({ chat: chat(turn(), [node({ ...tool('large'), argsRaw: '{' })]) })
  assert.equal(model.tools[0].detail, '')
})

test('only a current-round plan can override the live-tool headline', () => {
  const todos = [{ content: '核对布局', status: 'in_progress' }, { content: '验证并发', status: 'in_progress' }]
  const current = derive({ todos, chat: chat(turn(), [node(tool('plan', { name: 'todo_write', state: 'done' })),
    node(tool('read')), node(tool('search', { name: 'web_search' })), node(tool('exec', { name: 'bash' }))]) })
  assert.equal(current.state.label, '核对布局 · +1', 'step count never mixes in the three live tools')
  assert.equal(current.state.detail, '读取文件')
  const projection = derive({ todos, chat: chat(turn(), [node(tool('read'))]) })
  assert.equal(projection.plan.title, '本轮计划')
  assert.equal(projection.state.label, '核对布局 · +1')
  assert.equal(projection.state.detail, '读取文件')
})

test('waiting and stale states outrank even a current active plan', () => {
  const base = { todos: [{ content: '正在部署', status: 'in_progress' }],
    chat: chat(turn(), [node(tool('plan', { name: 'todo_write', state: 'done' })), node(tool('read'))]) }
  for (const [kind, label] of [['plan-review', '等待审核'], ['question', '等待回答'], ['approval', '等待审批']]) {
    const model = derive({ ...base, status: { running: true, pendingInteraction: { kind, sessionId: 'chosen' } } })
    assert.equal(model.state.label, label)
    assert.equal(model.state.active, false)
  }
  for (const [connection, label] of [['connecting', '连接中'], ['disconnected', '连接断开']]) {
    const model = derive({ ...base, connection })
    assert.equal(model.state.label, label)
    assert.equal(model.state.active, false)
    assert.equal(model.state.stale, true)
  }
})

test('error and cancellation cannot be renamed by a retained in-progress step', () => {
  for (const [reason, label] of [['error', '出错'], ['aborted', '已停止'], ['blocked', '无法继续']]) {
    const model = derive({ todos: [{ content: '测试通过', status: 'in_progress' }],
      session: { sessionId: 'chosen', running: false },
      chat: chat(turn(2, 'closed', reason), [node(tool('plan', { name: 'todo_write', state: 'done' }))]) })
    assert.equal(model.state.label, label)
    assert.equal(model.state.active, false)
  }
})

test('settled tools do not become the current action while the session is generating', () => {
  const model = derive({ chat: chat(turn(), [node(tool('old', { name: 'write', state: 'done' }))]) })
  assert.equal(model.state.label, '处理中')
  assert.equal(model.state.detail, '')
})

test('long current-plan headlines are bounded without truncating the plan itself', () => {
  const content = '审核'.repeat(100)
  const model = derive({ todos: [{ content, status: 'in_progress' }],
    chat: chat(turn(), [node(tool('plan', { name: 'todo_write', state: 'done' }))]) })
  assert.equal(Array.from(model.state.label).length, 60)
  assert.equal(model.plan.items[0].content, content)
})

test('record loading failures outrank a cached running bit while the chat is unavailable', () => {
  const model = derive({ session: { sessionId: 'chosen', running: true, openState: 'error', openError: {} }, chat: undefined })
  assert.equal(model.state.label, '记录未同步')
  assert.equal(model.state.stale, true)
  assert.equal(model.state.active, false)
})

test('long turns retain earlier failed tools beyond the compact preview', () => {
  const records = Array.from({ length: 12 }, (_, index) => node(tool(`settled-${index}`, {
    state: index === 0 ? 'error' : 'done', time: now + index,
  })))
  const model = derive({ chat: chat(turn(), [...records, node(tool('live'))]) })
  assert.equal(model.tools.length, 13, 'the full count must include every current-turn tool')
  assert.deepEqual(model.tools.slice(0, 4).map(row => row.id), ['live', 'settled-11', 'settled-10', 'settled-9'])
  assert.equal(model.tools.at(-1).id, 'settled-0')
  assert.equal(model.tools.at(-1).status, 'error', 'expanding all activities must recover the earlier failure')
  assert.equal(new Set(model.tools.map(row => row.id)).size, 13)
})

test('background rows use the host JobRow label and preserve legacy fallbacks', () => {
  const model = derive({ jobs: [
    { id: 'build', status: 'running', label: '构建应用', title: '旧标题', kind: 'process', output: { total: 0 } },
    { id: 'server', status: 'running', label: '预览服务器', kind: 'process', output: { total: 0 } },
    { id: 'legacy', status: 'running', label: '  ', title: '旧版任务' },
  ] })
  assert.deepEqual(model.jobs.map(row => row.label), ['构建应用', '预览服务器', '旧版任务'])
})

test('a pending question is waiting rather than parallel running work', () => {
  const model = derive({ chat: chat(turn(), [node(tool('question', { name: 'ask_user_question' }))]),
    status: { running: true, pendingInteraction: { kind: 'question', sessionId: 'chosen', callId: 'question' } } })
  assert.equal(model.state.label, '等待回答')
  assert.equal(model.state.detail, '')
  assert.equal(model.liveTools, 0)
  assert.equal(model.tools[0].status, 'waiting')
})

test('unnamed waiting requests only exclude one matching tool and retain real parallel work', () => {
  const model = derive({ chat: chat(turn(), [node(tool('question', { name: 'ask_user_question' })), node(tool('read'))]),
    status: { running: true, pendingInteraction: { kind: 'question', sessionId: 'chosen' } } })
  assert.equal(model.state.detail, '1 项仍在运行')
  assert.equal(model.liveTools, 1)
  assert.deepEqual(model.tools.map(row => [row.id, row.status]), [['read', 'running'], ['question', 'waiting']])
})

test('approval correlation preserves same-name parallel tools and rejects foreign interactions', () => {
  const input = { chat: chat(turn(), [node(tool('first', { name: 'bash' })), node(tool('second', { name: 'bash' }))]) }
  const pendingInteraction = { kind: 'approval', sessionId: 'chosen', callId: 'first', toolName: 'bash' }
  const model = derive({ ...input, status: { running: true, pendingInteraction } })
  assert.equal(model.liveTools, 1)
  assert.deepEqual(model.tools.map(row => [row.id, row.status]), [['second', 'running'], ['first', 'waiting']])
  const foreign = derive({ ...input, status: { running: true, pendingInteraction: { ...pendingInteraction, sessionId: 'other' } } })
  assert.equal(foreign.liveTools, 2)
  assert.equal(foreign.tools.some(row => row.status === 'waiting'), false)
  const ambiguous = derive({ ...input, status: { running: true, pendingInteraction: { ...pendingInteraction, callId: undefined } } })
  assert.equal(ambiguous.liveTools, 2, 'an unnamed approval cannot identify one of two same-name calls')
})

test('unsynchronized cached records cannot show live tools and recover after synchronization', () => {
  const input = { chat: chat(turn(), [node(tool('read')), node(tool('settled', { state: 'done' }))]) }
  for (const extra of [{ openState: 'error' }, { openError: {} }, { openState: 'loading' }, { awaitingFirstTurn: true }]) {
    const model = derive({ ...input, session: { sessionId: 'chosen', running: true, openState: 'open', ...extra } })
    assert.equal(model.liveTools, 0)
    assert.equal(model.tools.find(row => row.id === 'read').status, 'unknown')
    assert.equal(model.tools.find(row => row.id === 'settled').status, 'done', 'durable receipts remain readable')
    assert.equal(model.state.active, false)
  }
  const recovered = derive(input)
  assert.equal(recovered.liveTools, 1)
  assert.equal(recovered.tools.find(row => row.id === 'read').status, 'running')
  assert.equal(recovered.state.label, '正在读取文件')
})
