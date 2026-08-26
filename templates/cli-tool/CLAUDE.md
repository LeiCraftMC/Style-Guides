# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/verify` — typecheck + relevant tests.
- `/typecheck` — `bun run typecheck`.
- `/test` — `bun test`.
- `/compile` — build the standalone binary.

## Releases

Push a `v*` tag to trigger `.github/workflows/release.yml`, which builds all platforms and attaches
the binaries to a GitHub Release.

```bash
git tag v1.2.3
git push origin v1.2.3
```
