import test from 'node:test'
import assert from 'node:assert/strict'
import { conciseFileReferences, describeToolAction, shortFileName, summarizeCommand } from '../lib/client/action-labels.mjs'
import { deriveProgress } from '../lib/client/progress-state.mjs'

test('direct file actions retain only useful short filenames', () => {
  for (const [name, verb] of [['read', '打开'], ['write', '编写'], ['edit', '编辑']]) {
    const result = describeToolAction(name, JSON.stringify({ file_path: '/Users/person/project/生日 设计.md', token: 'secret-value' }))
    assert.equal(result.actionLabel, `${verb} 生日 设计.md`)
    assert.equal(result.detail, '生日 设计.md')
    assert.doesNotMatch(JSON.stringify(result), /Users|person|secret-value/)
  }
  assert.equal(describeToolAction('mcp__filesystem__read_file', JSON.stringify({ path: 'C:\\work\\配置.json' })).actionLabel, '打开 配置.json')
})

test('setup commands yield to the concrete action and respect quoted Chinese paths', () => {
  assert.equal(summarizeCommand('cd "/Users/person/a project" && sed -n \'1,240p\' "src/进度 状态.mjs"').actionLabel, '打开 进度 状态.mjs')
  assert.equal(summarizeCommand('cd /workspace && head -n 50 src/main.mjs').actionLabel, '打开 main.mjs')
  assert.equal(summarizeCommand('pwd; cat src/a.mjs src/b.mjs src/c.mjs').actionLabel, '打开 a.mjs、b.mjs 等3个文件')
  assert.equal(summarizeCommand('cat "src/a; b.mjs"').actionLabel, '打开 a; b.mjs')
})

test('search arguments become file checks instead of displayed patterns', () => {
  assert.equal(summarizeCommand('rg -n "token|password" src/progress.mjs').actionLabel, '检查 progress.mjs')
  assert.equal(summarizeCommand('rg -n -g "*.mjs" -e "secret-pattern" src').actionLabel, '检查 src')
  assert.equal(summarizeCommand('rg --files src').actionLabel, '查找 src')
  assert.equal(summarizeCommand('rg "private-pattern"').actionLabel, '检查代码内容')
  assert.equal(summarizeCommand('grep -n "secret-query" "docs/需求 文档.md"').actionLabel, '检查 需求 文档.md')
  assert.equal(summarizeCommand('find ai_retouch -maxdepth 1 -mindepth 1 ! -name out -type d').actionLabel, '查找 ai_retouch')
  assert.equal(summarizeCommand("grep --include '*.js' 'Authorization' src").actionLabel, '检查 src')
  assert.equal(summarizeCommand("rg --type-add 'custom:*.mjs' --type custom 'Authorization' src").actionLabel, '检查 src')
  assert.equal(summarizeCommand("grep --exclude-dir generated --include='*.js' -e 'Authorization' src").actionLabel, '检查 src')
  assert.equal(summarizeCommand('grep -r pattern src').actionLabel, '检查 src')
  assert.equal(summarizeCommand('grep -r -T pattern src').actionLabel, '检查 src')
  assert.equal(summarizeCommand('rg -r replacement pattern src').actionLabel, '检查 src')
})

test('git actions describe the operation without exposing commit or credential arguments', () => {
  assert.equal(summarizeCommand('git -C /workspace diff -- src/progress.mjs').actionLabel, '检查 progress.mjs')
  assert.equal(summarizeCommand('git diff src/progress.mjs').actionLabel, '检查 progress.mjs')
  assert.equal(summarizeCommand('git diff --stat').actionLabel, '检查文件改动')
  assert.equal(summarizeCommand('git status --short').actionLabel, '检查仓库状态')
  assert.equal(summarizeCommand('git -c http.extraHeader=Authorization:secret push origin HEAD').actionLabel, '上传代码')
  assert.equal(summarizeCommand('git commit -m "private message"').actionLabel, '提交代码')
})

test('tests, scripts and package commands identify the useful task', () => {
  assert.equal(summarizeCommand('node --test tests/progress.test.mjs').actionLabel, '测试 progress.test.mjs')
  assert.equal(summarizeCommand('node scripts/build.mjs --token private-value').actionLabel, '运行 build.mjs')
  assert.equal(summarizeCommand('python3 -c "print(\'private value\')"').actionLabel, '运行脚本')
  assert.equal(summarizeCommand('npm run build').actionLabel, '构建项目')
  assert.equal(summarizeCommand('python3 - <<\'PY\'\nsecret = "hidden-value"\nPY').actionLabel, '运行脚本')
})

test('patches name their edited files without quoting patch contents', () => {
  const command = "apply_patch <<'PATCH'\n*** Begin Patch\n*** Update File: /Users/person/src/progress.mjs\n@@\n-secret-text\n+new-secret-text\n*** Add File: src/文案.md\n+content\n*** End Patch\nPATCH"
  const result = summarizeCommand(command)
  assert.equal(result.actionLabel, '编辑 progress.mjs、文案.md')
  assert.doesNotMatch(JSON.stringify(result), /secret|Users/)
  assert.equal(summarizeCommand('cat > "docs/需求 文档.md" <<\'EOF\'\nprivate content\nEOF').actionLabel, '编写 需求 文档.md')
})

test('output redirection identifies writes in either heredoc-header order', () => {
  assert.equal(summarizeCommand("printf '%s' 'x' > src/config.mjs").actionLabel, '编写 config.mjs')
  assert.equal(summarizeCommand("cat <<'EOF' > src/config.mjs\nsecret body; cat private.txt\nEOF").actionLabel, '编写 config.mjs')
  assert.equal(summarizeCommand("cat <<-'EOF' >> 'src/配置 文件.mjs'\nsecret body\nEOF").actionLabel, '编写 配置 文件.mjs')
  assert.equal(summarizeCommand('echo private > /dev/null').actionLabel, '准备工作环境')
})

test('discarding or duplicating descriptors does not create file actions', () => {
  assert.equal(summarizeCommand('rg -n pattern src 2>/dev/null').actionLabel, '检查 src')
  assert.equal(summarizeCommand('ls src 2>/dev/null').actionLabel, '检查 src')
  assert.equal(summarizeCommand('node scripts/check.mjs 2>&1').actionLabel, '运行 check.mjs')
  assert.equal(summarizeCommand('cat 2>/dev/null src/config.mjs').actionLabel, '打开 config.mjs')
  assert.equal(summarizeCommand('cat src/config.mjs >/dev/stdout').actionLabel, '打开 config.mjs')
})

test('multi-command calls show one useful activity without compound labels', () => {
  assert.equal(summarizeCommand('cd /workspace && cat src/main.mjs; git diff -- src/main.mjs').actionLabel, '检查 main.mjs')
  assert.equal(summarizeCommand('cat src/main.mjs; cat src/main.mjs').actionLabel, '打开 main.mjs')
  assert.equal(summarizeCommand('cat a; cat b; cat c').actionLabel, '打开 c')
  assert.equal(summarizeCommand('bash -lc \'cd /workspace && cat "src/a b.mjs"\'').actionLabel, '打开 a b.mjs')
  assert.equal(summarizeCommand('cd "/Users/person/project" && du -sh ai_retouch && ls ai_retouch | head -50 && echo "done"').actionLabel, '检查 ai_retouch')
  assert.equal(summarizeCommand('du -sh ai_retouch && find ai_retouch -type f | sort | head -50').actionLabel, '检查 ai_retouch')
  assert.equal(summarizeCommand('find ai_retouch -type f | sort | uniq | head -50').actionLabel, '查找 ai_retouch')
  assert.equal(summarizeCommand('cat src/main.mjs && printf x > src/config.mjs && npm test').actionLabel, '运行测试')
  assert.equal(summarizeCommand('ls src | sort | wc -l').actionLabel, '检查 src')
  assert.equal(summarizeCommand('sort src/names.txt').actionLabel, '整理 names.txt')
})

test('cleanup operations outrank inspection and retain their real meaning', () => {
  assert.equal(summarizeCommand('du -sh ai_retouch && rm -rf ai_retouch').actionLabel, '删除 ai_retouch')
  assert.equal(summarizeCommand('find ai_retouch -maxdepth 1 -mindepth 1 ! -name out -exec rm -rf {} +').actionLabel, '清理 ai_retouch')
  assert.equal(summarizeCommand('find ai_retouch -type f -delete && ls ai_retouch').actionLabel, '清理 ai_retouch')
  assert.equal(summarizeCommand('find ai_retouch -type f -print0 | xargs -0 rm -f').actionLabel, '删除文件')
  assert.equal(summarizeCommand('rm src/old.mjs').actionLabel, '删除 old.mjs')
  assert.equal(summarizeCommand('rm -rf build > cleanup.log').actionLabel, '删除 build')
  assert.equal(summarizeCommand('find cache -type f -delete > cleanup.log').actionLabel, '清理 cache')
  assert.equal(summarizeCommand('find cache -type f -exec rm -f {} + > cleanup.log 2>&1').actionLabel, '清理 cache')
})

test('copy and move identities preserve the source-to-destination direction', () => {
  for (const command of ['cp', 'mv']) {
    const forward = summarizeCommand(`${command} src/a.txt dst/b.txt`)
    const reverse = summarizeCommand(`${command} dst/b.txt src/a.txt`)
    assert.notEqual(forward.actionGroupKey, reverse.actionGroupKey)
    assert.equal(summarizeCommand(`${command} src/a.txt dst/b.txt`).actionGroupKey, forward.actionGroupKey)
  }
})

test('unknown commands expose the program only and never execute substitutions', () => {
  const result = summarizeCommand('API_KEY=private-value curl -H "Authorization: secret" "https://user:pass@example.test/?token=private"')
  assert.equal(result.actionLabel, '运行 curl')
  assert.equal(result.detail, '')
  assert.doesNotMatch(JSON.stringify(result), /private|secret|pass|Authorization/)
  assert.equal(summarizeCommand('cat "$(cat /tmp/secret)"').actionLabel, '打开文件')
  assert.equal(summarizeCommand('cd /Users/person/project').actionLabel, '切换工作目录')
})

test('web targets omit authentication, path, query and fragment', () => {
  const result = describeToolAction('web_fetch', JSON.stringify({ url: 'https://user:pass@example.test/private?token=secret#section' }))
  assert.deepEqual(result, { actionLabel: '查看 example.test', detail: 'example.test', detailKind: 'hostname' })
})

test('malformed, incomplete and oversized arguments remain bounded', () => {
  for (const raw of ['{', 'null', '[]', JSON.stringify({ cmd: 'a'.repeat(100001) })]) {
    const result = describeToolAction('bash', raw, '运行脚本')
    assert.equal(result.actionLabel, '运行脚本')
    assert.equal(result.detail, '')
  }
  assert.equal(shortFileName('a'.repeat(100)).length, 40)
})

test('authored text shortens file references while keeping surrounding prose and websites', () => {
  assert.equal(conciseFileReferences('检查 /Users/person/src/progress.mjs，然后编辑 src/style.css'), '检查 progress.mjs，然后编辑 style.css')
  assert.equal(conciseFileReferences('打开 "src/中文 空格.md" 和 C:\\work\\配置.json'), '打开 "中文 空格.md" 和 配置.json')
  assert.equal(conciseFileReferences('查看 https://example.test/docs/a 并检查 ./src/main.mjs'), '查看 https://example.test/docs/a 并检查 main.mjs')
  assert.equal(conciseFileReferences('不删除/覆盖现有文件'), '不删除/覆盖现有文件')
  assert.equal(conciseFileReferences('不删除/覆盖README.md'), '不删除/覆盖README.md')
  assert.equal(conciseFileReferences('检查读/写权限并保留原行为'), '检查读/写权限并保留原行为')
  assert.equal(conciseFileReferences('保持 "读/写" 权限与 input/output 行为'), '保持 "读/写" 权限与 input/output 行为')
  assert.equal(conciseFileReferences('检查 `src/文案.md` 并保留 删除/覆盖 约束'), '检查 `文案.md` 并保留 删除/覆盖 约束')
})

test('current session tool rows carry concrete labels and no raw command paths', () => {
  const root = { callId: 'call-1', name: 'bash', phase: 'start', argsRaw: JSON.stringify({ command: 'cd /Users/person/project && cat src/progress.mjs' }) }
  const node = { key: 'call-1', kind: 'tool-call', location: { kind: 'step', turn: { turn: 1 } }, data: { root } }
  const turn = { turn: 1, status: 'open', data: new Map() }
  const model = deriveProgress({ sessionId: 'chosen', session: { sessionId: 'chosen', running: true, openState: 'open' },
    chat: { order: ['call-1'], nodes: new Map([['call-1', node]]), timeline: { turnOrder: [1], turns: new Map([[1, turn]]) } } })
  assert.equal(model.tools[0].actionLabel, '打开 progress.mjs')
  assert.equal(model.tools[0].detail, 'progress.mjs')
  assert.doesNotMatch(JSON.stringify(model.tools[0]), /Users|person|cd /)
})
