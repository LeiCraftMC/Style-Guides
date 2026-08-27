import { $ } from "bun";

const command = process.argv[2];

switch (command) {
	case "generate":
		await $`bunx drizzle-kit generate`;
		break;
	case "migrate":
		await $`bunx drizzle-kit migrate`;
		break;
	case "push":
		await $`bunx drizzle-kit push`;
		break;
	default:
		console.error("Usage: bun scripts/db-utils.ts <generate|migrate|push>");
		process.exit(1);
}