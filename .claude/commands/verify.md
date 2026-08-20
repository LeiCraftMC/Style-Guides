---
description: Run the full self-check for this style-guide repo (Biome + typecheck)
---

Verify that the guide's own code is clean and type-correct before committing.

Run, in order, and report any failures:

1. `bunx biome check` across `shared/`, `templates/` and the repo root — must pass with no errors.
2. `bun run typecheck` (runs `tsc -p ./tsconfig.json`) — must print "Typecheck passed!".
3. If any template changed, sanity-check it: copy the template to a temp dir, replace the `<PREFIX>` / `<PORT>` / `<ProjectName>` placeholders, `bun install`, `bun run typecheck`, `bun test`. Report the result.

Do not commit. Just report a concise pass/fail summary per step with the failing output if any.