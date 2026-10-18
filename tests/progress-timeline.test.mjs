import test from 'node:test'
import assert from 'node:assert/strict'
import { conciseTaskLabel, deriveTimeline } from '../lib/client/progress-timeline.mjs'
import { deriveProgress } from '../lib/client/progress-state.mjs'

const now = 1720000000000
const turn = (id = 2, reason) => ({ turn: id, status: reason ? 'closed' : 'open',
  start: { seq: 1, time: now }, data: new Map(),
  ...(reason ? { end: { seq: 100, time: now + 2000, data: { reason: { kind: reason } } } } : {}) })
const node = (root, owner = 2) => ({ key: root.callId, kind: 'tool-call', data: { root },
  location: { kind: 'step', turn: { turn: owner } }, visibility: 'visible' })
const todo = (id, todos, extra = {}) => ({ kind: 'tool-result', callId: id, seq: 10, time: now + 100,
  callTime: now, call: { name: 'todo_write', argsRaw: JSON.stringify({ todos }) }, ...extra })
const reply = (seq = 30, owner = 2) => ({ key: `reply:${seq}`, kind: 'assistant-step',
  location: { kind: 'step', turn: { turn: owner } }, data: {
    finalNode: { kind: 'assistant', seq }, blocks: [{ kind: 'text', text: '这是本轮的最终答复。' }],
  } })
const chat = (current, nodes = [], previous = []) => ({ order: nodes.map(row => row.key),
  nodes: new Map(nodes.map(row => [row.key, row])),
  timeline: { turnOrder: [...previous.map(row => row.turn), current.turn],
    turns: new Map([...previous, current].map(row => [row.turn, row])) } })
const derive = (extra = {}) => deriveTimeline({ sessionId: 'chosen', turnId: 2,
  state: { active: true, label: '处理中' },
  session: { sessionId: 'chosen', running: true, openState: 'open' },
  chat: chat(turn()), ...extra })
const rows = (...items) => items.map(([content, status = 'pending']) => ({ content, status }))
const stage = (model, id) => model.nodes.find(node => node.id === id)
const taskNodes = model => (stage(model, 'execution')?.children ?? []).filter(node => node.source === 'plan')
const user = (content, { owner = 2, kind = 'user', seq = 2 } = {}) => ({ key: `input:${owner}:${seq}`, kind,
  location: { kind: 'step', turn: { turn: owner } }, data: { seq, source: { kind: 'user' },
    content: Array.isArray(content) ? content : [{ type: 'text', text: content }] } })
const finished = (todos, extra = {}) => derive({ todos,
  chat: chat(turn(2, 'completed'), [reply()]), session: { sessionId: 'chosen', running: false, openState: 'open' },
  state: { active: false, label: '已结束' }, ...extra })

test('all current turns use four fixed primary phases without inventing tool-derived tasks', () => {
  const model = derive()
  assert.deepEqual(model.nodes.map(node => [node.label, node.status]), [
    ['接收任务', 'completed'], ['分析规划', 'in_progress'], ['任务执行', 'pending'], ['总结返回', 'pending'],
  ])
  assert.equal(model.total, 4)
  assert.equal(stage(model, 'execution').children, undefined)
  assert.equal(model.headline, '进行中')
})

test('explicit projection owns task order and completes only its authored completed nodes', () => {
  const todos = rows(['检查布局', 'completed'], ['验证进度', 'in_progress'], ['执行回归'])
  const model = derive({ todos })
  assert.deepEqual(taskNodes(model).map(node => [node.original, node.status]), todos.map(item => [item.content, item.status]))
  assert.deepEqual(model.nodes.map(node => node.id), ['received', 'planning', 'execution', 'summary'])
  assert.equal(model.completed, 2)
  assert.equal(model.total, 4)
  assert.equal(stage(model, 'execution').completed, 1)
  assert.equal(stage(model, 'execution').total, 3)
})

test('official projection wins over successful receipt, missing call and post-execute error', () => {
  const current = rows(['投影里的当前计划', 'in_progress'])
  const old = rows(['回执里的旧计划', 'completed'])
  for (const latest of [todo('old', old), { ...todo('missing', old), call: null }, todo('post-error', old, { isError: true })]) {
    const model = derive({ todos: current, chat: chat(turn(), [node(latest)]) })
    assert.equal(taskNodes(model)[0].original, current[0].content)
  }
})

test('explicit empty projection clears a previous nonempty successful receipt', () => {
  const model = derive({ todos: [], chat: chat(turn(), [node(todo('old', rows(['旧计划', 'completed'])))]) })
  assert.equal(taskNodes(model).length, 0)
  assert.equal(stage(model, 'execution').children, undefined)
})

test('receipt fallback takes the latest current-turn successful complete list', () => {
  const nodes = [node(todo('other-turn', rows(['跨轮旧任务', 'completed']), { callTime: now + 900 }), 1),
    node(todo('old', rows(['旧任务', 'completed']))),
    node(todo('new', rows(['新任务', 'in_progress']), { callTime: now + 200, seq: 20 })),
    node(todo('failed', rows(['失败的写入']), { callTime: now + 300, seq: 21, isError: true }))]
  for (const todos of [null, undefined]) {
    const model = derive({ todos, chat: chat(turn(), nodes) })
    assert.deepEqual(taskNodes(model).map(node => node.original), ['新任务'])
  }
})

test('fallback ordering prefers execution time and does not claim result arrival order', () => {
  const model = derive({ chat: chat(turn(), [
    node(todo('applied-earlier', rows(['较早任务']), { callTime: now, seq: 50 })),
    node(todo('applied-later', rows(['较晚任务']), { callTime: now + 100, seq: 20 })),
  ]) })
  assert.equal(taskNodes(model)[0].original, '较晚任务')
})

test('latest successful empty receipt clears while malformed latest receipt does not revive older tasks', () => {
  const prior = node(todo('prior', rows(['旧任务', 'completed'])))
  const cleared = derive({ chat: chat(turn(), [prior, node(todo('last', [], { callTime: now + 100 }))]) })
  assert.equal(taskNodes(cleared).length, 0)
  assert.equal(stage(cleared, 'execution').children, undefined)
  for (const argsRaw of ['{', '{}', 'x'.repeat(200001), JSON.stringify({ todos: [{ content: 'x', status: 'invented' }] })]) {
    const latest = todo('last', [], { callTime: now + 100, call: { name: 'todo_write', argsRaw } })
    const model = derive({ chat: chat(turn(), [prior, node(latest)]) })
    assert.equal(taskNodes(model).length, 0)
    assert.equal(model.nodes.find(node => node.id === 'planning').status, 'in_progress')
  }
})

test('unknown call cannot manufacture a todo fallback', () => {
  const model = derive({ chat: chat(turn(), [node({ ...todo('trimmed', []), call: null })]) })
  assert.equal(taskNodes(model).length, 0)
})

test('session and latest-turn guards reject foreign and previous task timelines', () => {
  const input = { todos: rows(['不应出现', 'completed']), chat: chat(turn(3), [], [turn(2, 'completed')]) }
  assert.deepEqual(derive(input).nodes, [])
  assert.deepEqual(derive({ ...input, turnId: 3, session: { sessionId: 'other' } }).nodes, [])
  assert.deepEqual(derive({ ...input, turnId: null }).nodes, [])
  const fresh = derive({ ...input, todos: null, turnId: 3 })
  assert.equal(taskNodes(fresh).length, 0)
})

test('completed reentry recreates the complete ordered list without local storage', () => {
  const todos = rows(['读取代码', 'completed'], ['检查错误', 'completed'], ['执行回归', 'completed'])
  const first = finished(todos)
  const restored = finished(undefined, { chat: chat(turn(2, 'completed'), [node(todo('last', todos)), reply()]) })
  assert.deepEqual(restored, first)
  assert.equal(first.headline, '已完成')
  assert.equal(first.completed, first.total)
  assert.equal(taskNodes(restored).length, 3)
})

test('normal ending completes the overview even when plan items were not explicitly closed', () => {
  const model = finished(rows(['已处理', 'completed'], ['尚在处理', 'in_progress'], ['仍待处理', 'pending']))
  assert.deepEqual(taskNodes(model).map(node => node.status), ['completed', 'completed', 'completed'])
  assert.ok(model.nodes.every(node => node.status === 'completed'))
  assert.equal(model.completed, 4)
  assert.equal(model.headline, '已完成')
})

test('failed and stopped rounds retain completed tasks without promoting pending tasks', () => {
  for (const reason of ['error', 'aborted', 'interrupted', 'blocked', 'max-tokens']) {
    const model = finished(rows(['已完成', 'completed'], ['未完成', 'in_progress'], ['未开始']), { chat: chat(turn(2, reason)) })
    assert.equal(taskNodes(model)[0].status, 'completed')
    assert.equal(taskNodes(model)[1].status, reason === 'error' ? 'error' : 'stopped')
    assert.equal(taskNodes(model)[2].status, 'pending')
    assert.notEqual(model.completed, model.total)
    assert.equal(model.headline, reason === 'error' ? '出错' : '已停止')
  }
})

test('unknown end reasons leave the overview stopped even when the authored summary is complete', () => {
  for (const reason of ['forked', 'custom-reason', undefined]) {
    const current = turn(2, reason)
    current.status = 'closed'
    const model = finished(rows(['总结结论', 'completed']), { chat: chat(current) })
    assert.equal(stage(model, 'summary').original, '总结结论')
    assert.equal(stage(model, 'summary').completed, 1)
    assert.equal(model.nodes.at(-1).id, 'summary')
    assert.equal(model.nodes.at(-1).status, 'stopped')
    assert.notEqual(model.completed, model.total)
  }
})

test('disconnect and loading stop active node animation while preserving confirmed completion', () => {
  const todos = rows(['已完成', 'completed'], ['当前任务', 'in_progress'])
  for (const session of [{ openState: 'loading' }, { openState: 'error', openError: new Error('offline') }]) {
    const model = derive({ todos, session: { sessionId: 'chosen', running: true, ...session } })
    assert.deepEqual(taskNodes(model).map(node => node.status), ['completed', 'unknown'])
  }
  const disconnected = derive({ todos, state: { stale: true, label: '连接断开' } })
  assert.equal(disconnected.headline, '连接断开')
  assert.equal(taskNodes(disconnected)[1].status, 'unknown')
})

test('waiting only suspends active work when no parallel tool is still running', () => {
  const input = { todos: rows(['处理任务', 'in_progress']), state: { active: true, waiting: true, label: '等待回答' } }
  assert.equal(taskNodes(derive(input))[0].status, 'waiting')
  assert.equal(taskNodes(derive({ ...input, tools: [{ status: 'running' }] }))[0].status, 'in_progress')
  assert.equal(derive(input).headline, '等待回答')
  assert.equal(finished(rows(['处理任务', 'completed']), { status: { pendingInteraction: { kind: 'approval' } } }).headline, '已完成')
})

test('background jobs remain outside the sequence and prevent a global completion headline', () => {
  for (const extra of [{ jobs: [{ status: 'running' }] }, { children: [{ status: 'waiting' }] }]) {
    const model = finished(rows(['任务', 'completed']), extra)
    assert.equal(model.completed, model.total)
    assert.equal(model.headline, '后台运行中')
    assert.equal(model.nodes.some(node => /后台/.test(node.label)), false)
  }
})

test('normal endings complete all phases and use the neutral ended title when no final reply is available', () => {
  const model = finished([], { chat: chat(turn(2, 'completed')) })
  assert.ok(model.nodes.every(node => node.status === 'completed'))
  assert.equal(model.headline, '已结束')
  const earlyReply = finished([], { chat: chat(turn(2, 'completed'), [reply(5), node(todo('later-tool', [], { seq: 20 }))]) })
  assert.equal(earlyReply.nodes.find(node => node.id === 'summary').status, 'completed')
  assert.equal(earlyReply.headline, '已结束')
})

test('turn-tail availability chooses the reply title without making a normal ending uncertain', () => {
  const current = turn(2, 'completed')
  current.data.set('turn-tail', { turn: 2, branchUnavailable: true, closing: reply().data })
  const unavailable = finished([], { chat: chat(current, [reply()]) })
  assert.equal(unavailable.nodes.at(-1).status, 'completed')
  assert.equal(unavailable.headline, '已结束')
  current.data.set('turn-tail', { turn: 2, branchUnavailable: false, closing: reply().data })
  const available = finished([], { chat: chat(current) })
  assert.equal(available.nodes.at(-1).status, 'completed')
  assert.equal(available.headline, '已答复')
})

test('a recovered failed tool does not block a later confirmed successful ending', () => {
  const model = finished(rows(['已修复', 'completed']), { chat: chat(turn(2, 'completed'), [
    node({ ...todo('old-error', [], { seq: 10, isError: true }), call: { name: 'read', argsRaw: '{}' } }), reply(30),
  ]) })
  assert.equal(model.headline, '已完成')
})

test('explicit planning and summary tasks avoid duplicate generic stages and retain real statuses', () => {
  const model = derive({ todos: rows(['制定任务计划', 'completed'], ['执行检查', 'in_progress'], ['总结结论', 'pending']) })
  assert.deepEqual(taskNodes(model).map(node => node.original), ['执行检查'])
  assert.deepEqual(model.nodes.map(node => node.status), ['completed', 'completed', 'in_progress', 'pending'])
  assert.equal(stage(model, 'planning').original, '制定任务计划')
  assert.equal(stage(model, 'summary').original, '总结结论')
})

test('after all plan work completes only the generic reply phase becomes active', () => {
  const todos = rows(['检查代码', 'completed'])
  assert.equal(derive({ todos }).nodes.at(-1).status, 'in_progress')
  assert.equal(derive({ todos, tools: [{ status: 'running' }] }).nodes.at(-1).status, 'pending')
  assert.equal(derive().nodes.at(-1).status, 'pending', 'no plan does not infer a final reply from generic processing')
})

test('normal ending completes content and reply summary stages without requiring a separate visible reply', () => {
  const architecture = finished(rows(['Summarize the source architecture', 'completed']), { chat: chat(turn(2, 'completed')) })
  assert.equal(architecture.nodes.find(node => node.id === 'summary').status, 'completed')
  assert.equal(architecture.headline, '已完成')
  for (const content of ['总结结论', 'Summarize findings and remaining risks', 'Write a final response']) {
    const authored = finished(rows([content, 'completed']), { chat: chat(turn(2, 'completed')) })
    assert.equal(stage(authored, 'summary').original, content)
    assert.equal(stage(authored, 'summary').completed, 1)
    assert.equal(authored.nodes.at(-1).id, 'summary')
    assert.equal(authored.nodes.at(-1).status, 'completed')
    assert.equal(authored.headline, '已完成')
    assert.equal(finished(rows([content, 'completed'])).headline, '已完成')
  }
})

test('six English audit tasks keep distinct concise Chinese meanings', () => {
  const tasks = [
    "Recon: identify yesterday's (Oct 14) interface overhaul artifacts and deployed state",
    'Deep-dive A: adversarial review of layout and responsive behavior',
    'Deep-dive B: audit progress state and session boundaries',
    'Validate failed and cancelled tasks',
    'Run regression tests and verify native navigation',
    'Summarize findings and remaining risks',
  ]
  assert.deepEqual(tasks.map(conciseTaskLabel), ['核对现状', '审查界面', '审查进度', '检查异常', '回归验证', '总结结论'])
  const model = derive({ todos: rows(...tasks.map(task => [task, 'pending'])) })
  assert.deepEqual(taskNodes(model).map(node => node.original), tasks.slice(0, -1))
  assert.equal(stage(model, 'summary').original, tasks.at(-1))
  assert.equal(model.nodes.length + taskNodes(model).length, 9)
})

test('Chinese and mixed titles preserve distinctions, negative constraints and required identifiers', () => {
  assert.equal(conciseTaskLabel('Recon: 核对昨日的界面部署状态'), '核对昨日的界面部署状态')
  assert.equal(conciseTaskLabel('Deep-dive A: 审核布局'), '审核布局')
  assert.match(conciseTaskLabel('Unfamiliar wording: 核对进度'), /核对进度/)
  assert.equal(conciseTaskLabel('API: 检查响应'), 'API: 检查响应')
  assert.match(conciseTaskLabel('不要修改配置，只检查当前状态'), /^不要修改配置/)
  assert.equal(conciseTaskLabel('检查当前状态，不要修改配置'), '检查当前状态')
  assert.notEqual(conciseTaskLabel('审查界面布局，确认响应式'), conciseTaskLabel('审查进度状态，确认会话隔离'))
  assert.ok(Array.from(conciseTaskLabel('检查当前界面布局和全部响应式断点以及窄屏状态')).length <= 24)
  assert.match(conciseTaskLabel('Frobnicate widgets', 2), /widgets/)
  assert.match(conciseTaskLabel('Inspect `progress.mjs`', 0), /progress\.mjs/)
  assert.equal(conciseTaskLabel('Review progress module without UI changes'), '审查进度模块')
  assert.equal(conciseTaskLabel('Review backend without modifying UI'), '审查：后端')
  assert.match(conciseTaskLabel('Do not deploy，只检查配置'), /^不要部署/)
  assert.equal(conciseTaskLabel('Implement no changes，审查配置'), '不作修改')
})

test('no-plan replies complete the four-stage overview with a simple reply title', () => {
  const original = '进度模块不够精简，需要微调一下；先给出方案，不要改代码。'
  const request = user(original)
  const live = derive({ chat: chat(turn(), [request, reply(20)]) })
  assert.equal(stage(live, 'execution').children, undefined)
  assert.equal(stage(live, 'execution').status, 'in_progress')
  assert.equal(stage(live, 'planning').status, 'completed')
  assert.equal(stage(live, 'summary').original, `答复对象：${original}`)
  const done = finished(null, { chat: chat(turn(2, 'completed'), [request, reply(30)]) })
  assert.equal(done.completed, 4)
  assert.equal(done.total, 4)
  assert.equal(done.evidenceMode, 'activity')
  assert.ok(done.nodes.every(node => node.status === 'completed'))
  assert.equal(done.headline, '已答复')
  assert.deepEqual(finished(undefined, { chat: chat(turn(2, 'completed'), [request, reply(30)]) }), done)
})

test('request context remains verbatim in reply details, not a manufactured execution task', () => {
  for (const original of ['我本人做了真实检验，大体上验收通过，只是进度模块不够精简，我认为只需要微调即可',
    '前面已经验收通过，不过不要修改布局，只需要解释当前进度', '这个项目近九天，哪些更新值得用？']) {
    const model = derive({ chat: chat(turn(), [user(original)]) })
    assert.equal(stage(model, 'summary').original, `答复对象：${original}`)
    assert.equal(stage(model, 'execution').children, undefined)
  }
})

test('reply context uses human text blocks exactly, retaining constraints and the initial objective', () => {
  const request = user([{ type: 'text', text: '不要' }, { type: 'text', text: '修改文件，只审查布局。' }])
  const model = derive({ chat: chat(turn(), [request, user('好的', { kind: 'steering', seq: 8 })]) })
  assert.equal(stage(model, 'summary').original, '答复对象：不要修改文件，只审查布局。')
  assert.equal(stage(model, 'execution').status, 'pending')
  const steerOnly = derive({ chat: chat(turn(), [user('请审查本轮进度状态', { kind: 'steering' })]) })
  assert.equal(stage(steerOnly, 'summary').original, '答复对象：请审查本轮进度状态')
})

test('no-plan extraction rejects other turns, injections, attachment names and bare acknowledgments', () => {
  for (const request of [user('上一轮的秘密任务', { owner: 1 }), user('伪造任务', { kind: 'context' }),
    user([{ type: 'file', attachment: { name: '删除全部文件.pdf' } }]), user('继续', { kind: 'steering' })]) {
    const model = derive({ chat: chat(turn(), [request]) })
    assert.equal(stage(model, 'execution').children, undefined)
    assert.equal(stage(model, 'summary').original, undefined)
    assert.equal(model.total, 4)
  }
})

test('normal ending completes merged planning and summary tasks while live plans retain their authored state', () => {
  const model = finished(rows(['制定任务计划', 'pending'], ['检查代码', 'completed'], ['总结结论', 'pending']))
  assert.ok(model.nodes.every(node => node.status === 'completed'))
  assert.equal(model.completed, 4)
  assert.equal(model.headline, '已完成')
  const multiple = derive({ todos: rows(['制定任务计划', 'completed'], ['更新任务计划', 'in_progress'], ['检查文件', 'pending']) })
  assert.deepEqual(stage(multiple, 'planning').children.map(node => node.original), ['制定任务计划', '更新任务计划'])
  assert.equal(stage(multiple, 'planning').status, 'in_progress')
})

test('normal endings close the process and errors or interruptions stay visible without a final reply', () => {
  for (const reason of ['completed', 'error', 'aborted', 'forked']) {
    const model = finished(null, { chat: chat(turn(2, reason), [user('给出部署方案，不要部署')]) })
    assert.equal(stage(model, 'execution').status === 'completed', reason === 'completed')
    assert.equal(model.headline, reason === 'completed' ? '已结束' : reason === 'error' ? '出错' : reason === 'aborted' ? '已停止' : '已结束')
    assert.equal(model.total, 4)
  }
  const ask = { ...todo('ask', []), call: { name: 'ask_question', argsRaw: '{}' } }
  const answer = finished(null, { chat: chat(turn(2, 'completed'), [user('给出部署方案，不要部署'), node(ask), reply()]) })
  assert.equal(stage(answer, 'summary').original, '答复对象：给出部署方案，不要部署')
  assert.equal(stage(answer, 'summary').status, 'completed')
  assert.equal(stage(answer, 'execution').status, 'completed')
  assert.equal(answer.headline, '已答复')
})

test('a pending clarifying question does not manufacture completed planning or execution', () => {
  for (const name of ['ask_question', 'ask_user_question', 'submit_plan', 'todo_write']) {
    const root = { callId: name, name, phase: 'start', time: now }
    const toolStep = { ...reply(8), data: { finalNode: { kind: 'assistant', seq: 8 },
      blocks: [{ kind: 'tool-call', callId: name, name }] } }
    const model = derive({ chat: chat(turn(), [user('请给出部署方案'), toolStep, node(root)]),
      state: { waiting: true, label: '等待回答' }, status: { running: true, pendingInteraction: { kind: 'question' } } })
    assert.equal(stage(model, 'planning').status, 'waiting')
    assert.equal(stage(model, 'execution').status, 'pending')
    assert.equal(model.completed, 1)
  }
})

test('English prefixes retain review and planning meaning rather than turning their object into an action', () => {
  assert.equal(conciseTaskLabel('Review: 部署配置'), '审查：部署配置')
  assert.equal(conciseTaskLabel('Audit: 删除用户数据的流程'), '审核：删除用户数据的流程')
  assert.equal(conciseTaskLabel('Plan: 部署生产环境'), '规划：部署生产环境')
  assert.equal(conciseTaskLabel('Read-only: 修改配置风险'), '只读：修改配置风险')
  assert.match(conciseTaskLabel('Avoid deploying: 部署到生产'), /^不要部署/)
  assert.equal(conciseTaskLabel('Review deployment config，仅检查配置'), '审查：部署配置')
})

const actual = (nodes, { closed = false, todos, connection = 'connected', status, deliverables } = {}) => deriveProgress({
  sessionId: 'chosen', session: { sessionId: 'chosen', running: !closed, openState: 'open' },
  connection, status, chat: chat(turn(2, closed ? 'completed' : undefined), nodes), todos, deliverables,
}).timeline
const activity = (id, name, args, { state = 'done', seq = 10 } = {}) => node(state === 'running'
  ? { callId: id, name, argsRaw: JSON.stringify(args), phase: 'start', time: now + seq }
  : { kind: 'tool-result', callId: id, call: { name, argsRaw: JSON.stringify(args) }, seq, time: now + seq,
    ...(state === 'error' ? { isError: true } : {}) })

test('reply wording and deliverables do not turn the overview into an outcome audit', () => {
  for (const response of ['无法读取源文件，因此尚未生成或保存报表。请补充文件后再继续。', '已处理。']) {
    const final = reply(50)
    final.data.blocks[0].text = response
    const model = actual([user('生成销售报表并保存为 report.xlsx'), final], { closed: true,
      deliverables: { produced: [{ path: '/workspace/report.xlsx', seq: 40 }] } })
    assert.ok(model.nodes.every(node => node.status === 'completed'))
    assert.equal(model.headline, '已答复')
    assert.equal(model.completed, 4)
    assert.equal(model.evidenceMode, 'activity')
  }
})

test('no-plan research shows the latest four concrete actions with recoverable call identities', () => {
  const records = [user('研究近期更新并核对实现'),
    ...Array.from({ length: 8 }, (_, i) => activity(`read-${i}`, 'read', { path: `/workspace/source-${i}.mjs` }, { seq: i + 3 })),
    activity('web-1', 'web_search', { query: '版本更新记录' }, { seq: 12 }),
    activity('web-2', 'web_fetch', { url: 'https://example.test/release' }, { seq: 13 }),
    activity('cmd-1', 'bash', { command: 'git diff --stat' }, { seq: 14 }),
    activity('cmd-2', 'exec', { cmd: 'npm test' }, { seq: 15 }),
    activity('cmd-3', 'bash', { command: 'git status --short' }, { seq: 16 })]
  const model = actual(records)
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 4)
  assert.deepEqual(groups.map(group => group.source), Array(4).fill('tool-activity'))
  assert.deepEqual(groups.flatMap(group => group.callIds), ['web-2', 'cmd-1', 'cmd-2', 'cmd-3'])
  assert.ok(groups.every(group => group.callIds.every(id => group.original.includes(`[${id}]`))))
  assert.ok(groups.every(group => !/执行命令|文件操作|查阅资料|\/workspace\//.test(group.label)))
  assert.equal(stage(model, 'planning').status, 'completed')
  assert.equal(stage(model, 'execution').status, 'in_progress')
  assert.equal(stage(model, 'execution').completed, undefined)
  const restored = actual([...records, reply(50)], { closed: true })
  assert.deepEqual(stage(restored, 'execution').children, groups)
  assert.equal(stage(restored, 'execution').status, 'completed')
  assert.equal(restored.headline, '已答复')
})

test('starting a concrete action or response advances planning and leaves one active phase', () => {
  for (const nodes of [
    [user('先读取需求和代码，分析可行方案，暂不实现'), activity('first-read', 'read', { path: '/workspace/requirements.md' }, { state: 'running' })],
    [user('解释这个算法'), reply(20)],
  ]) {
    const model = actual(nodes)
    assert.equal(stage(model, 'planning').status, 'completed')
    assert.equal(stage(model, 'execution').status, 'in_progress')
    assert.equal(model.nodes.filter(node => node.status === 'in_progress').length, 1)
  }
})

test('action grouping keeps errors, disconnection and call order without overriding authored tasks', () => {
  const nodes = [activity('read-first', 'read', { path: '/workspace/first.txt' }, { state: 'error' }),
    activity('write-second', 'write', { path: '/workspace/second.txt' }),
    activity('read-last', 'read', { path: '/workspace/third.txt' }, { state: 'running' })]
  const running = actual(nodes)
  assert.deepEqual(stage(running, 'execution').children.map(group => group.callIds), [['read-first'], ['write-second'], ['read-last']])
  assert.deepEqual(stage(running, 'execution').children.map(group => group.status), ['error', 'completed', 'in_progress'])
  const offline = actual(nodes, { connection: 'disconnected' })
  assert.equal(offline.nodes.some(node => node.status === 'in_progress'), false)
  assert.equal(stage(offline, 'execution').children.some(group => group.status === 'in_progress'), false)
  const ended = actual(nodes.slice(0, 2), { closed: true })
  assert.equal(stage(ended, 'execution').children[0].status, 'error')
  const authored = actual(nodes, { todos: rows(['检查账户设置', 'in_progress']) })
  assert.equal(stage(authored, 'execution').children.length, 1)
  assert.equal(stage(authored, 'execution').children[0].source, 'plan')
})

test('common English task objects become Chinese without dropping constraints or exact identifiers', () => {
  assert.equal(conciseTaskLabel('Implement responsive navigation'), '实现：响应式导航')
  assert.equal(conciseTaskLabel('Research customer requirements'), '调研：用户需求')
  assert.equal(conciseTaskLabel('Refactor account settings panel'), '重构：账户设置面板')
  assert.equal(conciseTaskLabel('Review progress module without UI changes'), '审查进度模块')
  assert.equal(conciseTaskLabel('Read progress.mjs'), '读取：progress.mjs')
  assert.match(conciseTaskLabel('Review `account-settings-panel.tsx`'), /^审查：account-settings/)
  const original = 'Review progress module without UI changes'
  const model = derive({ todos: rows([original, 'in_progress']) })
  assert.equal(stage(model, 'execution').children[0].original, original)
  assert.equal(/^任务\s*\d+$/.test(conciseTaskLabel('Frobnicate widgets')), false)
})

test('command and search records expose short operation labels rather than shell syntax', () => {
  const model = actual([
    activity('command', 'bash', { command: 'git show frontend' }),
    activity('search', 'rg', { pattern: 'settings' }),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups[0].label, '检查文件改动')
  assert.equal(groups[1].label, '检查代码内容')
  assert.match(groups[0].original, /\[command\]/)
  assert.match(groups[1].original, /\[search\]/)
})

test('absolute executable and file references become short actions without directory prefixes', () => {
  const model = actual([
    activity('command', 'bash', { command: '/usr/bin/git status' }),
    activity('search', 'rg', { pattern: '/foo/' }),
    activity('file', 'read', { path: '/workspace/settings.mjs' }),
    activity('url', 'web_fetch', { url: 'https://example.test/path' }),
  ])
  const labels = stage(model, 'execution').children.map(group => group.label)
  assert.deepEqual(labels, ['检查仓库状态', '检查代码内容', '打开 settings.mjs', '查看 example.test'])
  assert.ok(labels.every(label => !/\/usr\/|\/workspace\/|https?:\/\//.test(label)))
})

test('repeated concrete actions merge while different files retain their own rows', () => {
  const model = actual([
    activity('read-first', 'read', { path: '/workspace/README.md' }, { seq: 10 }),
    activity('read-again', 'read', { path: '/workspace/README.md' }, { seq: 11 }),
    activity('read-package', 'read', { path: '/workspace/package.json' }, { seq: 12 }),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map(group => group.callIds), [['read-first', 'read-again'], ['read-package']])
  assert.match(groups[0].label, /README\.md/)
  assert.match(groups[1].label, /package\.json/)
  assert.ok(groups[0].callIds.every(id => groups[0].original.includes(`[${id}]`)))
})

test('the four-action limit keeps an older active action and a failure alongside recent work', () => {
  const model = actual([
    activity('active', 'read', { path: '/workspace/active.txt' }, { seq: 1, state: 'running' }),
    activity('failed', 'read', { path: '/workspace/failed.txt' }, { seq: 2, state: 'error' }),
    ...Array.from({ length: 6 }, (_, i) => activity(`recent-${i}`, 'read', { path: `/workspace/recent-${i}.txt` }, { seq: i + 3 })),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 4)
  assert.deepEqual(groups.flatMap(group => group.callIds), ['active', 'failed', 'recent-4', 'recent-5'])
  assert.deepEqual(groups.map(group => group.status), ['in_progress', 'error', 'completed', 'completed'])
})

test('the reported cd-and-read command closes cleanly with a file action instead of a shell path', () => {
  const model = actual([
    activity('screenshot-command', 'bash', { command: 'cd "/Users/person/project" && cat "plugins/dsh-workspace/package.json"' }, { seq: 10 }),
    reply(30),
  ], { closed: true })
  assert.equal(model.headline, '已答复')
  assert.ok(model.nodes.every(node => node.status === 'completed'))
  const action = stage(model, 'execution').children[0]
  assert.match(action.label, /^(打开|检查) package\.json$/)
  assert.doesNotMatch(action.label, /执行命令|待核验|[?？]|\/Users\/|plugins\//)
})


test('authored plan labels shorten file paths while keeping the original wording in details', () => {
  for (const content of ['检查 /Users/demo/project/package.json', '编写 "src/components/进度 卡片.mjs"',
    'Review /workspace/src/progress.mjs']) {
    const label = conciseTaskLabel(content)
    assert.doesNotMatch(label, /\/Users\/|src\/|\/workspace\//)
    assert.match(label, /package\.json|进度 卡片\.mjs|progress\.mjs/)
    const model = derive({ todos: rows([content, 'in_progress']) })
    assert.equal(taskNodes(model)[0].original, content)
    assert.equal(taskNodes(model)[0].label, label)
  }
})


test('a running tool keeps execution current when the authored plan has stale pending or completed entries', () => {
  for (const status of ['pending', 'completed']) {
    const model = actual([activity('work-still-running', 'read', { path: '/workspace/README.md' }, { state: 'running' })],
      { todos: rows(['检查项目说明', status]) })
    assert.equal(stage(model, 'execution').status, 'in_progress')
    assert.equal(stage(model, 'summary').status, 'pending')
    assert.equal(model.nodes.filter(node => node.status === 'in_progress').length, 1)
    assert.equal(taskNodes(model)[0].status, status)
  }
})

test('an active action stays visible when more than four newer actions have failed', () => {
  const model = actual([
    activity('still-running', 'read', { path: '/workspace/active.txt' }, { state: 'running', seq: 1 }),
    ...Array.from({ length: 5 }, (_, i) => activity(`failure-${i}`, 'read', { path: `/workspace/failure-${i}.txt` }, { state: 'error', seq: i + 2 })),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 4)
  assert.deepEqual(groups.flatMap(group => group.callIds), ['still-running', 'failure-2', 'failure-3', 'failure-4'])
  assert.equal(groups[0].status, 'in_progress')
})

test('a successful retry clears the earlier error from its merged action while retaining both call references', () => {
  const model = actual([
    activity('failed-attempt', 'read', { path: '/workspace/README.md' }, { state: 'error', seq: 10 }),
    activity('successful-retry', 'read', { path: '/workspace/README.md' }, { seq: 20 }),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 1)
  assert.equal(groups[0].status, 'completed')
  assert.deepEqual(groups[0].callIds, ['failed-attempt', 'successful-retry'])
  assert.match(groups[0].original, /\[failed-attempt\]/)
  assert.match(groups[0].original, /\[successful-retry\]/)
})

test('inspection and discovery of one target share a concise activity without losing live calls', () => {
  const model = actual([
    activity('inspect', 'bash', { command: 'cd /workspace && du -sh ai_retouch && ls ai_retouch | head -50 && echo done' }),
    activity('find', 'bash', { command: 'find ai_retouch -maxdepth 1 -mindepth 1 ! -name out -type f | sort' }, { state: 'running', seq: 20 }),
  ])
  const groups = stage(model, 'execution').children
  assert.equal(groups.length, 1)
  assert.equal(groups[0].label, '检查 ai_retouch')
  assert.equal(groups[0].status, 'in_progress')
  assert.deepEqual(groups[0].callIds, ['inspect', 'find'])
  assert.ok(groups[0].callIds.every(id => groups[0].original.includes(`[${id}]`)))
  assert.doesNotMatch(groups[0].label, /等操作|；|sort|head/)
})

test('semantic deduplication keeps other paths, writes, tests and cleanup distinct', () => {
  const model = actual([
    activity('check-a', 'bash', { command: 'ls a/config.mjs' }),
    activity('check-b', 'bash', { command: 'find b/config.mjs' }),
    activity('write-a', 'write', { path: 'a/config.mjs' }),
    activity('test-a', 'bash', { command: 'node --test a/config.mjs' }),
  ])
  assert.deepEqual(stage(model, 'execution').children.map(group => group.callIds), [['check-a'], ['check-b'], ['write-a'], ['test-a']])
  const sameBasename = actual([
    activity('read-a', 'read', { path: 'a/config.mjs' }), activity('read-b', 'read', { path: 'b/config.mjs' }),
    activity('write-a', 'write', { path: 'a/config.mjs' }), activity('write-b', 'write', { path: 'b/config.mjs' }),
  ])
  assert.deepEqual(stage(sameBasename, 'execution').children.map(group => group.callIds), [['read-a'], ['read-b'], ['write-a'], ['write-b']])
  const cleanup = actual([
    activity('check', 'bash', { command: 'ls ai_retouch' }),
    activity('clean', 'bash', { command: 'find ai_retouch -type f -delete' }),
  ])
  assert.deepEqual(stage(cleanup, 'execution').children.map(group => group.label), ['检查 ai_retouch', '清理 ai_retouch'])
})

test('merged inspection retries and disconnections preserve the existing status rules', () => {
  const nodes = [activity('failed-inspection', 'bash', { command: 'ls ai_retouch' }, { state: 'error' }),
    activity('retry-discovery', 'bash', { command: 'find ai_retouch -type f' }, { seq: 20 })]
  assert.equal(stage(actual(nodes), 'execution').children[0].status, 'completed')
  assert.deepEqual(stage(actual(nodes), 'execution').children[0].callIds, ['failed-inspection', 'retry-discovery'])
  const offline = actual([nodes[0], activity('retry-discovery', 'bash', { command: 'find ai_retouch -type f' }, { state: 'running', seq: 20 })], { connection: 'disconnected' })
  assert.equal(stage(offline, 'execution').children[0].status, 'unknown')
})

test('task labels remove phase wrappers while retaining real actions and constraints', () => {
  for (const [source, expected] of [
    ['分析规划：检查目录结构', '检查目录结构'],
    ['任务执行：检查目录结构', '检查目录结构'],
    ['实施步骤：更新 progress.mjs', '更新 progress.mjs'],
    ['步骤一：任务执行：不要删除文件', '不要删除文件'],
    ['总结返回：汇总改动', '汇总改动'],
    ['任务执行：只读：检查配置', '只读：检查配置'],
  ]) assert.equal(conciseTaskLabel(source), expected)
  assert.equal(conciseTaskLabel('Review: 删除文件流程'), '审查：删除文件流程')
})

test('duplicate task content is shown once per phase with every original entry retained', () => {
  const model = derive({ todos: rows(['任务执行：检查目录结构', 'completed'], ['实施步骤：检查目录结构', 'in_progress'], ['检查目录结构', 'pending']) })
  const tasks = taskNodes(model)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].label, '检查目录结构')
  assert.equal(tasks[0].status, 'in_progress')
  assert.deepEqual(tasks[0].taskIds, ['task:0', 'task:1', 'task:2'])
  assert.equal(tasks[0].original, '任务执行：检查目录结构\n实施步骤：检查目录结构\n检查目录结构')
  const exact = derive({ todos: rows(['检查目录结构', 'pending'], ['检查目录结构', 'completed']) })
  assert.equal(taskNodes(exact).length, 1)
  assert.equal(taskNodes(exact)[0].status, 'completed')
})

test('task deduplication does not merge phases, different paths, or clipped constraints', () => {
  const model = derive({ todos: rows(
    ['分析规划：检查目录结构', 'completed'], ['任务执行：检查目录结构', 'in_progress'],
    ['检查 a/config.mjs', 'pending'], ['检查 b/config.mjs', 'pending'],
    ['检查目录结构，不要删除文件', 'pending'], ['检查目录结构，清理无用文件', 'pending']) })
  assert.equal(stage(model, 'planning').total, 1)
  assert.equal(taskNodes(model).length, 5)
})

test('a reverse copy or move cannot clear the failed forward operation', () => {
  for (const command of ['cp', 'mv']) {
    const model = actual([
      activity('forward', 'bash', { command: `${command} src/a.txt dst/b.txt` }, { state: 'error', seq: 10 }),
      activity('reverse', 'bash', { command: `${command} dst/b.txt src/a.txt` }, { seq: 20 }),
    ])
    const groups = stage(model, 'execution').children
    assert.deepEqual(groups.map(group => group.callIds), [['forward'], ['reverse']])
    assert.deepEqual(groups.map(group => group.status), ['error', 'completed'])
  }
})
