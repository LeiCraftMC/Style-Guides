# AGENTS.md — operating manual for AI coding agents

You are working in a LeiCraftMC CLI tool. Follow the LeiCraftMC Style Guides:
https://github.com/LeiCraftMC/Style-Guides.

## Must read

- [docs/00-overview.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/00-overview.md)
- [docs/11-cli-and-infra.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/11-cli-and-infra.md)

## Non-negotiable

- Use `@cleverjs/cli` for command handling.
- CLI Logger from `src/utils/logger.ts` (with `logHistory` for crash dumps).
- Global `--log-level` flag on the app.
- `VersionCMD` reads `process.env.APP_VERSION`.
- Compile script in `scripts/compile/` supports `auto`, `all`, and platform targets.
- Format with Biome before finishing.
- Conventional Commits.

Replace `<ProjectName>` with the real project name.
