/// <reference types="bun-types/test.d.ts" />
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { codeIcons } from "../app/data/code-icons";

const contentDir = join(import.meta.dir, "..", "content");

// ```lang [label] or ```[label] — the label Nuxt UI turns into a filename icon.
const fenceLabel = /^\s*(?:`{3,}|~{3,})[^\s[]*\s*\[([^\]]+)\]/gm;

/** Mirrors Nuxt UI's `ProseCodeIcon`: `false` means the label falls through to vscode-icons. */
function resolvesToLucideOrNothing(label: string): boolean {
	const filename = label.replace(/\s*\(.*\)\s*$/, "");
	const name = filename.split("/").pop()?.toLowerCase();
	if (name && codeIcons[name]) return true;
	if (!filename.includes(".")) return true;
	const extension = filename.split(".").pop();
	return !!extension && !!codeIcons[extension];
}

describe("code-block filename icons", () => {
	test("every label in content/ maps to a Lucide icon or has no dot", async () => {
		const unmapped: string[] = [];
		for await (const file of new Bun.Glob("**/*.md").scan({ cwd: contentDir })) {
			const source = await readFile(join(contentDir, file), "utf-8");
			for (const [, label] of source.matchAll(fenceLabel)) {
				if (label && !resolvesToLucideOrNothing(label)) unmapped.push(`${file}: [${label}]`);
			}
		}
		expect(unmapped).toEqual([]);
	});

	test("the map only uses Lucide icons", () => {
		for (const icon of Object.values(codeIcons)) {
			expect(icon).toStartWith("i-lucide-");
		}
	});
});
