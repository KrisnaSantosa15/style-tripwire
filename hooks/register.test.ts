import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const RULES = {
  rules: [
    { name: 'no-em-dash', pattern: '—', message: 'Use a comma or a hyphen.', commits: true },
    { name: 'no-dd', pattern: '\\bdd\\(', message: 'Remove the debug dump.', files: '\\.php$' },
    { name: 'todo', pattern: 'TODO', message: 'Track it in an issue.', action: 'warn' },
  ],
}

const engine = (on: On, config?: object, files: Record<string, string> = {}) => {
  const ran: string[] = []
  mock.env(on, { HOME: '/home/someone' })
  on('fs.exists', ($, e) => ({
    value: e.path in files || (config !== undefined && e.path.endsWith('.claude/style-tripwire.json') && !e.path.startsWith('/home/someone/')),
  }))
  on('fs.read', ($, e) => ({ value: files[e.path] ?? JSON.stringify(config) }))
  on('tool.call', { tool: 'Edit' }, ($, e) => {
    ran.push(e.file_path)
    return { result: { filePath: e.file_path, oldString: e.old_string, newString: e.new_string, originalFile: '', structuredPatch: [], userModified: false, replaceAll: false } }
  })
  on('tool.call', { tool: 'Write' }, ($, e) => {
    ran.push(e.file_path)
    return { result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [] } }
  })
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    ran.push(e.command)
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  return ran
}

const edit = (file_path: string, old_string: string, new_string: string) => ({ tool: 'Edit' as const, file_path, old_string, new_string })
const refusal = (r: { deny?: string; text?: string }) => r.deny ?? r.text ?? ''

test('blocks merge conflict markers with no config at all', async ($, on) => {
  const ran = engine(on)
  const r = await $.tool.call(edit('/repo/a.ts', 'x', '<<<<<<< HEAD\nx'))
  expect(refusal(r)).toContain('merge-conflict-marker')
  expect(ran).toEqual([])
})

test('blocks an edit that adds a rule breaking line', async ($, on) => {
  const ran = engine(on, RULES)
  const r = await $.tool.call(edit('/repo/README.md', 'Fast.', 'Fast — really fast.'))
  expect(refusal(r)).toContain('no-em-dash: Use a comma or a hyphen.')
  expect(ran).toEqual([])
})

test('ignores lines that were already there', async ($, on) => {
  const ran = engine(on, RULES)
  await $.tool.call(edit('/repo/README.md', 'Old — line\nA', 'Old — line\nB'))
  expect(ran).toEqual(['/repo/README.md'])
})

test('only checks the files a rule names', async ($, on) => {
  const ran = engine(on, RULES)
  await $.tool.call(edit('/repo/notes.md', 'a', 'call dd($x)'))
  expect(refusal(await $.tool.call(edit('/repo/User.php', 'a', 'dd($user);')))).toContain('no-dd')
  expect(ran).toEqual(['/repo/notes.md'])
})

test('checks only the new lines of a Write over an existing file', async ($, on) => {
  const ran = engine(on, RULES, { '/repo/User.php': 'dd($old);\n' })
  await $.tool.call({ tool: 'Write', file_path: '/repo/User.php', content: 'dd($old);\nreturn 1;\n' })
  expect(refusal(await $.tool.call({ tool: 'Write', file_path: '/repo/New.php', content: 'dd($new);\n' }))).toContain('no-dd')
  expect(ran).toEqual(['/repo/User.php'])
})

test('checks commit messages only against rules that opt in', async ($, on) => {
  const ran = engine(on, RULES)
  expect(refusal(await $.tool.call({ tool: 'Bash', command: 'git commit -m "fix: login — again"' }))).toContain('no-em-dash')
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "fix: drop dd( call"' })
  await $.tool.call({ tool: 'Bash', command: 'echo "a — b"' })
  expect(ran).toEqual(['git commit -m "fix: drop dd( call"', 'echo "a — b"'])
})

test('a warn rule lets the edit through and tells the model', async ($, on) => {
  const ran = engine(on, RULES)
  const r = await $.tool.call(edit('/repo/app.ts', 'a', '// TODO later'))
  expect(ran).toEqual(['/repo/app.ts'])
  expect(r.context?.join(' ')).toContain('todo: Track it in an issue.')
})

test('defaults can be switched off', async ($, on) => {
  const ran = engine(on, { defaults: false })
  await $.tool.call(edit('/repo/a.ts', 'x', '<<<<<<< HEAD'))
  expect(ran).toEqual(['/repo/a.ts'])
})
