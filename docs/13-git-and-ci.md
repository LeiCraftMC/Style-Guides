# 13 — Git, commits, and CI

## Branching

Default branch is `main`. Do not use `master` for new repos. Feature work happens on short-lived
branches; merge via MR/PR with at least one passing CI pipeline. The GitLab build/deploy jobs run
only on the default branch (`$CI_DEFAULT_BRANCH`), so merging to `main` is what ships.

## Conventional Commits

Use Conventional Commits:

```
feat: add domain transfer endpoint
fix: handle missing Authorization header
docs: update API envelope examples
chore: bump dependencies via renovate
refactor: extract isPublicAuthPath helper
test: add login route tests
```

- Use lowercase type.
- Short imperative summary.
- Reference issue/MR numbers in the body, not the summary.

## Commit signing

Sign commits with SSH or GPG where possible. Do not bypass hooks with `--no-verify` unless fixing a
broken hook.

## `.gitignore`

Copy [`shared/config/gitignore`](../shared/config/gitignore) as `.gitignore` in every project — it
is the file the backend, Nuxt, full-stack and static templates ship. Abridged:

```gitignore
node_modules
.output
.data
.nuxt
.nitro
.cache
build/
out/
dist/
*.tgz
.drizzle
*.tsbuildinfo
coverage
logs
*.log
.DS_Store
.idea
.env
.env.*
!.env.example
tmp-data-*
data/
!app/data/
config/*
!config/*.example.json
```

`tmp-data-*` are the test temp dirs (`tests/helpers/preload.ts`); `data/` is runtime data (SQLite
DB, logs) while `!app/data/` keeps the static sites' `app/data/*.ts` modules; `config/*` is
`CONFIG_BASE_DIR` (it receives the initial admin reset link). `example.env` is committed; `.env` is
not. `drizzle/migrations/` is **not** ignored — commit the
generated migrations (the compiled service embeds them). The cli-tool template still ships an older,
shorter `.gitignore`; use the shared one.

## Renovate

Templates ship a deliberately minimal `.gitlab/renovate.json` — only the schema. Schedules, labels
and lockfile maintenance come from the organisation-level Renovate config, so projects don't
duplicate (and drift from) it:

```json
{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json"
}
```

Copy [`shared/config/renovate.json`](../shared/config/renovate.json) to `.gitlab/renovate.json`.
Add project-specific rules there only when a project really needs them.

## CI / GitLab

GitLab projects use `oven/bun` images. The root `.gitlab-ci.yml`
([`shared/config/gitlab-ci/gitlab-ci.yml`](../shared/config/gitlab-ci/gitlab-ci.yml)):

```yaml
stages:
  - test
  - build

variables:
  GIT_DEPTH: "20"
  BUN_INSTALL_CACHE: "$CI_PROJECT_DIR/.bun"

include:
  - local: ".gitlab/ci/testing.yml"
  - local: ".gitlab/ci/build.yml"
```

`.gitlab/ci/testing.yml`
([`shared/config/gitlab-ci/testing.yml`](../shared/config/gitlab-ci/testing.yml)) sets a `default:`
block for every job — image, bun.lock-keyed cache, `bun install` — and runs three parallel jobs:

```yaml
default:
  image: oven/bun
  interruptible: true
  cache:
    key:
      files:
        - bun.lock
    paths:
      - .bun/install/cache/
      - node_modules/
  before_script:
    - bun install --frozen-lockfile

variables:
  BUN_INSTALL_CACHE_DIR: .bun/install/cache
  NUXT_TELEMETRY_DISABLED: "1"

test:lint:
  stage: test
  script:
    - bun run check:ci

test:typecheck:
  stage: test
  script:
    - bun run typecheck

test:unit:
  stage: test
  script:
    - bun test
```

`.gitlab/ci/build.yml` comes in three flavours — copy the one that matches the shape:

| Flavour | Used by | Script |
| --- | --- | --- |
| [`build.docker.yml`](../shared/config/gitlab-ci/build.docker.yml) | nuxt-app, fullstack-nuxt-app | `bun run build` → `docker build -f docker/Dockerfile` → push `:latest` |
| [`build.service.yml`](../shared/config/gitlab-ci/build.service.yml) | backend-service | `bun run compile linux-x64-baseline --no-version-tag` → `docker build` → push `:latest` |
| [`build.static.yml`](../shared/config/gitlab-ci/build.static.yml) + [`deploy.sh`](../shared/config/gitlab-ci/deploy.sh) | static-site, static-site-with-docs | `bun run generate` → `bash .gitlab/ci/deploy.sh` (rsync) |

All three run on the default branch only, via `rules:` (no `only:`):

```yaml
  script:
    - bun run compile linux-x64-baseline --no-version-tag
    - docker build -f docker/Dockerfile -t "$CI_REGISTRY_IMAGE:latest" .
    - docker push "$CI_REGISTRY_IMAGE:latest"

  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

- The two Docker flavours install Docker CE inside the `oven/bun` job and start `dockerd`, so they
  need a **privileged** runner. They log in with the predefined `CI_REGISTRY*` variables and push
  only `$CI_REGISTRY_IMAGE:latest` — no version tags, no image signing.
- The static flavour installs `rsync sshpass openssh-client` and needs the CI variables
  `DEPLOY_REMOTE_USER`, `DEPLOY_REMOTE_PASSWORD`, `DEPLOY_REMOTE_HOST`, `DEPLOY_REMOTE_DIR`.
  The job runs it via `bash`, so the script needs no executable bit.
- The cli-tool template ships no GitLab build job (its `build.yml` include is commented out); CLI
  binaries are released via GitHub.

What each build produces and how it is run: [14 — Deployment](14-deployment.md).

## CI / GitHub

GitHub projects use `.github/workflows/ci.yml`
([`shared/config/github-actions/ci.yml`](../shared/config/github-actions/ci.yml)) — pushes to
`main`, every pull request, and manual runs:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run check:ci
      - run: bun run typecheck
      - run: bun test
```

CLI tools add `.github/workflows/release.yml`
([`shared/config/github-actions/release.yml`](../shared/config/github-actions/release.yml)): on a
`v*` tag it runs `bun run compile all --no-version-tag` and attaches `build/bin/*` to a GitHub
Release via `softprops/action-gh-release@v2` (`permissions: contents: write`,
`generate_release_notes: true`). The binaries report `package.json`'s version, not the tag — see
[14](14-deployment.md#cli-tools) and [11 — CLI & infra](11-cli-and-infra.md).

Which template ships what:

| Template | GitLab `build.yml` | GitHub workflows |
| --- | --- | --- |
| backend-service | service | — (GitLab only; copy `ci.yml` if hosted on GitHub) |
| nuxt-app, fullstack-nuxt-app | docker | `ci.yml` |
| static-site, static-site-with-docs | static | `ci.yml` (older variant: PRs to `main` only, no `workflow_dispatch`) |
| cli-tool | — | `ci.yml`, `release.yml` |

## CI rules

- Every pipeline runs `bun run check:ci` (`biome ci`), `bun run typecheck` and `bun test`. All
  templates pass `check:ci` as shipped; their `biome.json` excludes `**/api-client`, `**/*.gen.ts`
  and `**/drizzle/migrations` (generated code).
- `bun install --frozen-lockfile` in CI; local development can use `bun install`.
- Dependency and lockfile updates come from Renovate (organisation-level config).

## License

Default license is **AGPL-3.0**. Every template ships the full text in `LICENSE`, as does the guide
repo. Projects inherit this unless they explicitly choose a different license and document the
reason in [17 — Decisions](17-decisions.md).

## Checklist

- [ ] Default branch is `main`.
- [ ] Conventional Commits used.
- [ ] `.gitignore` from `shared/config/gitignore`; `drizzle/migrations/` committed.
- [ ] `.gitlab/renovate.json` from `shared/config/renovate.json` (minimal).
- [ ] GitLab: `.gitlab-ci.yml` from `shared/config/gitlab-ci/gitlab-ci.yml`,
      `.gitlab/ci/testing.yml` from `testing.yml`, `.gitlab/ci/build.yml` from the matching
      `build.{docker,service,static}.yml` (+ `deploy.sh` for static sites).
- [ ] GitHub: `.github/workflows/ci.yml` from `shared/config/github-actions/ci.yml`; CLI tools also
      `release.yml`.
- [ ] CI runs `bun run check:ci`, `bun run typecheck`, `bun test` with `--frozen-lockfile`.
- [ ] GitLab CI uses `oven/bun`; GitHub uses `oven-sh/setup-bun`.
- [ ] `LICENSE` is AGPL-3.0 unless otherwise decided.
