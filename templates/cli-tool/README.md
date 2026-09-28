# <ProjectName> CLI

CLI tool template for LeiCraftMC projects.

## Stack

- Bun runtime
- `@cleverjs/cli` command framework
- `bun build --compile` for single-binary distribution
- Biome formatter/linter
- AGPL-3.0

## Setup

```bash
bun install
bun run dev hello
```

## Commands

- `bun run dev version` — print version
- `bun run dev hello` — example command
- `bun run compile auto 1.2.3` — compile for host platform
- `bun run compile all 1.2.3` — compile for all platforms

## Scripts

- `bun run dev` — run in watch mode
- `bun run compile` — build binary
- `bun run typecheck` — TypeScript check
- `bun test` — run tests

## Structure

See the LeiCraftMC style guide:

- [docs/11-cli-and-infra.md](https://github.com/LeiCraftMC/Style-Guides/blob/main/docs/11-cli-and-infra.md)

## License

AGPL-3.0
