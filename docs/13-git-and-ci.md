# 13 — Git, commits, and CI

## Branching

Default branch is `main`. Do not use `master` for new repos. Feature work happens on short-lived
branches; merge via MR/PR with at least one passing CI pipeline.

## Conventional Commits

Use Conventional Commits:

```
feat: add domain transfer endpoint
fix: handle missing Authorization header
docs: update API envelope examples
chore: bump dependencies via renovate
refactor: extract AuthHandler.resolveRequest
test: add login route tests
```

- Use lowercase type.
- Short imperative summary.
- Reference issue/MR numbers in the body, not the summary.

## Commit signing

Sign commits with SSH or GPG where possible. Do not bypass hooks with `--no-verify` unless fixing a
broken hook.

## `.gitignore`

Copy [`shared/config/gitignore`](../shared/config/gitignore) as `.gitignore` in every project. It
excludes:

```
node_modules/
.env
.output/
build/
dist/
*.log
.drizzle/
coverage/
.idea/
.vscode/settings.json
```

## Renovate

Every repo has `renovate.json` extending `config:recommended` with a weekly Europe/Berlin schedule:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "labels": ["dependencies"],
  "timezone": "Europe/Berlin",
  "schedule": ["before 6am on Monday"],
  "lockFileMaintenance": { "enabled": true, "schedule": ["before 6am on Monday"] }
}
```

Copy [`shared/config/renovate.json`](../shared/config/renovate.json).

## CI / GitLab

GitLab projects use `oven/bun` images. A typical `.gitlab-ci.yml` includes:

```yaml
stages:
  - test
  - build

variables:
  GIT_DEPTH: "20"

include:
  - local: ".gitlab/ci/testing.yml"
  - local: ".gitlab/ci/build.yml"
```

`.gitlab/ci/testing.yml`:

```yaml
test:
  stage: test
  image: oven/bun:latest
  script:
    - bun install --frozen-lockfile
    - bunx biome check
    - bun run typecheck
    - bun test
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - node_modules/
      - .bun/
```

`.gitlab/ci/build.yml`:

```yaml
build:
  stage: build
  image: oven/bun:latest
  script:
    - bun install --frozen-lockfile
    - bun run build
  artifacts:
    paths:
      - .output/
      - build/
  only:
    - main
```

For Nuxt apps, `build` produces `.output/`. For backend services, it may produce `build/bin/` or a
Docker image.

## CI / GitHub

GitHub projects use `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bunx biome check
      - run: bun run typecheck
      - run: bun test
```

`.github/workflows/release.yml` builds binaries and creates a GitHub Release for CLI tools; it is
project-specific. See [11 — CLI & infra](11-cli-and-infra.md).

## CI rules

- Every push/MR runs `biome check`, `typecheck`, and `test`.
- Lockfile maintenance runs weekly via Renovate.
- `bun install --frozen-lockfile` in CI; local development can use `bun install`.

## License

Default license is **AGPL-3.0**. Place the full text in `LICENSE` (the guide repo already has one).
Templates and services inherit this unless a project explicitly chooses a different license and
documents the reason in [17 — Decisions](17-decisions.md).

## Checklist

- [ ] Default branch is `main`.
- [ ] Conventional Commits used.
- [ ] `.gitignore` from `shared/config/gitignore`.
- [ ] `renovate.json` from `shared/config/renovate.json`.
- [ ] CI runs `bunx biome check`, `bun run typecheck`, `bun test`.
- [ ] GitLab CI uses `oven/bun` image; GitHub uses `oven-sh/setup-bun`.
- [ ] `LICENSE` is AGPL-3.0 unless otherwise decided.
