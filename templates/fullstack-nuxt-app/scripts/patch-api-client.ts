/**
 * patch-api-client.ts — automated, idempotent post-`openapi-ts` patch step.
 *
 * `@hey-api/openapi-ts` occasionally emits typing bugs. Rather than hand-editing the
 * generated `*.gen.ts` (forbidden — see docs/05-api-contract.md), apply fixes here so
 * they run on every regeneration. This template ships a no-op that logs and exits 0;
 * add your regex replacements below when you hit a generator bug. Example (commented):
 *
 *   const sdk = await Bun.file("./app/api-client/sdk.gen.ts").text();
 *   const fixed = sdk.replace(/: Promise<([^>]+)>/g, ": Promise<$1 | undefined>");
 *   await Bun.write("./app/api-client/sdk.gen.ts", fixed);
 */
const log = (message: string) => console.log(`[patch-api-client] ${message}`);

log("No patches configured — this is a no-op. Add fixes above when needed.");