# CLAUDE.md — Claude Code specifics

Read `AGENTS.md` first. This file adds Claude-Code-specific notes.

## Slash commands

Defined in `.claude/settings.json`:

- `/verify` — typecheck + relevant tests.
- `/typecheck` — `bun run typecheck`.
- `/test` — `bun test`.
- `/compile` — build the standalone binary.

## Releases

The template ships no release job. On GitHub, copy the Style Guide's
`shared/config/github-actions/release.yml` to `.github/workflows/release.yml`; pushing a `v*` tag
then builds all platforms and attaches the binaries to a GitHub Release. Bump `"version"` in
`package.json` first — the binaries report it, not the tag.

```bash
git tag v1.2.3
git push origin v1.2.3
```
