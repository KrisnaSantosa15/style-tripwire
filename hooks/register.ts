import type { EngineInterface, Register } from 'claude-code'

type Rule = {
  name: string
  pattern: string
  flags?: string
  message: string
  files?: string
  commits?: boolean
  action?: 'block' | 'warn'
}
type Config = { defaults?: boolean; rules?: Rule[] }
type Compiled = Rule & { regex: RegExp; fileRegex?: RegExp }
type Hit = { rule: Compiled; line: string }

const NAME = 'style-tripwire'

const DEFAULT_RULES: Rule[] = [
  {
    name: 'merge-conflict-marker',
    pattern: '^(<{7}|>{7})( |$)',
    message: 'Resolve the merge conflict instead of writing its markers.',
  },
]

const readConfig = async ($: EngineInterface, path: string): Promise<Config> => {
  if (!(await $.fs.exists(path))) return {}
  try {
    return JSON.parse(await $.fs.read(path)) as Config
  } catch {
    $.ui.toast(`${NAME}: ${path} is not valid JSON, so it was ignored`)
    return {}
  }
}

const compile = ($: EngineInterface, rule: Rule): Compiled[] => {
  try {
    return [{
      ...rule,
      regex: new RegExp(rule.pattern, (rule.flags ?? '').replace('g', '')),
      fileRegex: rule.files === undefined ? undefined : new RegExp(rule.files),
    }]
  } catch {
    $.ui.toast(`${NAME}: rule "${rule.name}" has an invalid pattern, so it was skipped`)
    return []
  }
}

const loadRules = async ($: EngineInterface): Promise<Compiled[]> => {
  const home = await $.env.get('HOME')
  const global = home === undefined ? {} : await readConfig($, `${home}/.claude/${NAME}.json`)
  const project = await readConfig($, `.claude/${NAME}.json`)
  const defaults = project.defaults ?? global.defaults ?? true
  const rules = [...(defaults ? DEFAULT_RULES : []), ...(global.rules ?? []), ...(project.rules ?? [])]

  return rules.flatMap(rule => compile($, rule))
}

const addedLines = (before: string, after: string) => {
  const existing = new Set(before.split('\n'))
  return after.split('\n').filter(line => !existing.has(line))
}

const findHits = (rules: Compiled[], lines: string[]): Hit[] =>
  rules.flatMap(rule => {
    const line = lines.find(candidate => rule.regex.test(candidate))
    return line === undefined ? [] : [{ rule, line: line.trim().slice(0, 120) }]
  })

const describe = (hits: Hit[]) =>
  hits.map(({ rule, line }) => `- ${rule.name}: ${rule.message}\n  in: ${line}`).join('\n')


export const register: Register = on => {
  on('tool.call', async ($, e, next) => {
    let lines: string[] | undefined
    let path: string | undefined

    if (e.tool === 'Edit') {
      path = e.file_path
      lines = addedLines(e.old_string, e.new_string)
    } else if (e.tool === 'Write') {
      path = e.file_path
      const before = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
      lines = addedLines(before, e.content)
    } else if (e.tool === 'Bash' && /\bgit\s+commit\b/.test(e.command)) {
      lines = e.command.split('\n')
    }

    if (lines === undefined) return next(e)

    const rules = (await loadRules($)).filter(rule =>
      path === undefined ? rule.commits === true : rule.fileRegex === undefined || rule.fileRegex.test(path),
    )
    const hits = findHits(rules, lines)
    const blocking = hits.filter(hit => (hit.rule.action ?? 'block') === 'block')

    if (blocking.length > 0) {
      return { deny: `${NAME}: this change trips the house style rules. Fix it and try again.\n${describe(blocking)}` }
    }
    if (hits.length === 0) return next(e)

    $.ui.toast(`${NAME}: ${hits.map(hit => hit.rule.name).join(', ')}`)
    const ran = await next(e)
    if (ran.deny !== undefined) return ran

    return { ...ran, context: [...(ran.context ?? []), `${NAME} warnings, worth fixing:\n${describe(hits)}`] }
  }).catch(($, e, next) => {
    $.ui.toast(`${NAME}: the check failed, so this call went through unchecked`)
    return next(e)
  })
}
