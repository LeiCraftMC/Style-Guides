# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Use the commands in `.claude/commands/`:

- `/verify` — run Biome + typecheck + tests.
- `/typecheck` — `bun run typecheck`.
- `/format` — format and lint with Biome.

## Releases

Push a `v*` tag to trigger `.github/workflows/release.yml`, which builds all platforms and attaches
the binaries to a GitHub Release.

```bash
git tag v1.2.3
git push origin v1.2.3
```
