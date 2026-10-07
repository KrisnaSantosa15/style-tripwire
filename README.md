# style-tripwire

**Your house style, enforced on Claude before the code lands.**

You told Claude "no em dashes". Twice. It wrote one anyway.

style-tripwire turns those rules into regex tripwires. When Claude's edit or commit message breaks one, the call is stopped and Claude gets told why, so it fixes the line itself.

```
style-tripwire: this change trips the house style rules. Fix it and try again.
- no-em-dash: Use a comma or a hyphen instead of an em dash.
  in: Fast — really fast.
```

## Install

```
/plugin install style-tripwire --marketplace KrisnaSantosa15/style-tripwire
```

Needs Claude Code 2.1.287 or later.

## Set your rules

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

Rules are read on every call, so edits take effect right away.

## What it checks

- **Edit**: only the lines Claude adds, so old code never trips it.
- **Write**: only lines that weren't in the file already.
- **Bash**: `git commit` commands, against rules with `"commits": true`.

One rule is on out of the box: no merge conflict markers. Set `"defaults": false` to turn it off.

A broken config file or an invalid pattern gets you a toast, and the call goes through unchecked. The tripwire never blocks your work over its own bug.

## Develop

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

MIT licensed.
