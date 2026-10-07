# style-tripwire

**Your house style, enforced on Claude before the code lands.**

[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-D97757?logo=claude&logoColor=white)](https://github.com/karanb192/awesome-claude-code-mods) [![Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-D97757)](https://code.claude.com) [![GitHub stars](https://img.shields.io/github/stars/KrisnaSantosa15/style-tripwire?style=flat&color=yellow)](https://github.com/KrisnaSantosa15/style-tripwire/stargazers) [![Last commit](https://img.shields.io/github/last-commit/KrisnaSantosa15/style-tripwire?color=green)](https://github.com/KrisnaSantosa15/style-tripwire/commits) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## The Problem

You told Claude "no em dashes". Twice. It wrote one anyway. Then it left a `dd()` in a PHP file and a TODO in the commit you were about to push.

Style rules in `CLAUDE.md` are suggestions. Claude reads them, means well, and forgets them twenty tool calls later. You catch it in review, ask for a fix, and the cycle repeats.

### How style-tripwire Solves It

It turns each rule into a regex tripwire on Claude's own tool calls:

1. **Block**: an edit or commit message that breaks a rule never lands. Claude gets the reason and fixes the line itself.
2. **Warn**: softer rules let the change through and tell Claude what to clean up.
3. **Only new lines**: existing code never trips it, so it works on legacy codebases from day one.

```
style-tripwire: this change trips the house style rules. Fix it and try again.
- no-em-dash: Use a comma or a hyphen instead of an em dash.
  in: Fast — really fast.
```

## Install

**Prerequisites:** Claude Code 2.1.287 or later (`claude --version`).

```bash
/plugin marketplace add KrisnaSantosa15/style-tripwire
/plugin install style-tripwire@style-tripwire
```

Then add your rules (below). They're read on every call, so no restart is needed.

**Verify:** add the `no-em-dash` rule from the example, then ask Claude to write a sentence with an em dash into a file. The write is refused.

## Set Your Rules

Put rules in `.claude/style-tripwire.json` for one project, or `~/.claude/style-tripwire.json` for all of them. Both are read, so you can mix them.

```json
{
  "rules": [
    {
      "name": "no-em-dash",
      "pattern": "—",
      "message": "Use a comma or a hyphen instead of an em dash.",
      "commits": true
    },
    {
      "name": "no-debug-dump",
      "pattern": "\\b(dd|dump|var_dump)\\(",
      "message": "Remove the debug dump.",
      "files": "\\.php$"
    },
    {
      "name": "todo",
      "pattern": "TODO",
      "message": "Open an issue instead of leaving a TODO.",
      "action": "warn"
    }
  ]
}
```

| Field | What it does |
| --- | --- |
| `name` | Shown to Claude and in the toast. |
| `pattern` | A regex, tested against each line Claude adds. |
| `message` | What Claude should do instead. |
| `flags` | Regex flags, like `"i"`. Optional. |
| `files` | A regex on the file path. Leave it out to check every file. |
| `commits` | `true` to also check `git commit` commands. |
| `action` | `"block"` (default) stops the call. `"warn"` lets it through and tells Claude. |

## What It Checks

- **Edit**: only the lines Claude adds.
- **Write**: only lines that weren't in the file already.
- **Bash**: `git commit` commands, against rules with `"commits": true`.

One rule is on out of the box: no merge conflict markers. Set `"defaults": false` to turn it off.

A broken config file or an invalid pattern gets you a toast, and the call goes through unchecked. The tripwire never blocks your work over its own bug.

## Contributing

Issues and pull requests are welcome. Add a test for any behavior you change.

```bash
git clone https://github.com/KrisnaSantosa15/style-tripwire.git
cd style-tripwire && claude plugin validate . && claude plugin test .
```

Try your changes live with `claude --plugin-dir .`.

## License

[MIT](LICENSE). Use it, fork it, ship it.
