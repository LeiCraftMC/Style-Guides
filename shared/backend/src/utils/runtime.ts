/**
 * Runtime — abstracts the runtime for full-stack Nuxt apps that ship to both Bun and
 * Cloudflare Pages/D1 (Status-Page). Branches DB init and password hashing on `isBun`.
 *
 * Optional — no template uses it (the templates are Bun-only). Copy into
 * `server/lib/utils/runtime.ts` only if you really need the Cloudflare target. See
 * docs/08-database.md#dual-target-runtime-bun--cloudflared1.
 */
export class Runtime {
	/** True when running under Bun (Node-style process, `Bun.password`, `bun:sqlite`). */
	static get isBun(): boolean {
		return typeof Bun !== "undefined";
	}

	/** True when running under Cloudflare Workers/Pages (D1 bindings, Web Crypto). */
	static get isCloudflare(): boolean {
		return !Runtime.isBun && "caches" in globalThis;
	}
}

export namespace Runtime {
	export namespace Password {
		/**
		 * Hash a password/token base. On Bun this uses `Bun.password` (argon2id by default);
		 * on Cloudflare, fall back to PBKDF2 via Web Crypto (or delegate auth to a Bun sidecar).
		 */
		export async function hash(secret: string): Promise<string> {
			if (Runtime.isBun) return Bun.password.hash(secret);
			// Cloudflare fallback: PBKDF2 (sha256, 100k). Store as `pbkdf2$<iter>$<salt>$<derived>`.
			const enc = new TextEncoder();
			const salt = crypto.getRandomValues(new Uint8Array(16));
			const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, [
				"deriveBits",
			]);
			const bits = await crypto.subtle.deriveBits(
				{ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
				key,
				256,
			);
			const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
			return `pbkdf2$100000$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
		}

		/** Verify a secret against a hash produced by `hash()`. */
		export async function verify(hash: string, secret: string): Promise<boolean> {
			if (Runtime.isBun) return Bun.password.verify(secret, hash);
			const parts = hash.split("$");
			const scheme = parts[0];
			const iterStr = parts[1];
			const saltHex = parts[2];
			const derivedHex = parts[3];
			if (scheme !== "pbkdf2" || !iterStr || !saltHex || !derivedHex) return false;
			const enc = new TextEncoder();
			const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (h) => Number.parseInt(h, 16));
			const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, [
				"deriveBits",
			]);
			const bits = await crypto.subtle.deriveBits(
				{ name: "PBKDF2", salt, iterations: Number(iterStr), hash: "SHA-256" },
				key,
				256,
			);
			const got = Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
			return got === derivedHex;
		}
	}
}
