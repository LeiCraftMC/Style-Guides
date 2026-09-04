import { existsSync, mkdirSync } from "fs";

// Pre-migration setup: ensure the data dir exists before drizzle-kit writes to it.
// Invoked as `bun scripts/db-utils.ts && bunx --bun drizzle-kit ...`.
if (!existsSync("./data/")) {
	mkdirSync("./data/");
}
