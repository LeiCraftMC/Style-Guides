import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import { DB } from "../../../../../db";
import type { DrizzleDB } from "../../../../../db/utils";
import { Logger } from "../../../../../utils/logger";
import { APIResponse } from "../../../../utils/api-res";
import { AuthHandler, SessionHandler } from "../../../../utils/authHandler";
import { getClientIP, getClientRateLimitKey } from "../../../../utils/clientIP";
import { APIResponseSpec, APIRouteSpec } from "../../../../utils/specHelpers";
import { DOCS_TAGS } from "../../docs";
import { AuthModel } from "./model";

// Dummy bcrypt hash for timing-normalized login failures — prevents username enumeration
// Generated once at module load so it's a valid, cost-equivalent hash
const DUMMY_PASSWORD_HASH = await Bun.password.hash("dummy-timing-constant");

// In-memory login rate limiter. An attempt is registered before the password check, so concurrent
// requests cannot all slip under a limit, and taken back when the login succeeds — the counters
// effectively count failures. Clients are counted by `getClientRateLimitKey`: IPv4 addresses as
// is, IPv6 addresses by /64.
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX_ATTEMPTS = 5; // per client + username
const LOGIN_MAX_CLIENT_ATTEMPTS = 20; // per client, across usernames
// Per username across clients. Past this, only clients without a failure for that username may
// try: a distributed attack gets one guess per new client, and the owner can still log in from a
// client where they have not mistyped in this window.
const LOGIN_USERNAME_ALERT_ATTEMPTS = 15;

type LoginAttemptEntry = { key: string; count: number; resetAt: number };

class LoginAttemptCounter {
	private readonly entries = new Map<string, LoginAttemptEntry>();

	count(key: string) {
		const entry = this.entries.get(key);
		return entry && entry.resetAt > Date.now() ? entry.count : 0;
	}

	/** Count an attempt; returns the window entry it was counted in, for `release`/`clear`. */
	increment(key: string): LoginAttemptEntry {
		const now = Date.now();
		let entry = this.entries.get(key);
		if (!entry || entry.resetAt <= now) {
			entry = { key, count: 1, resetAt: now + LOGIN_WINDOW_MS };
			this.entries.set(key, entry);
		} else {
			entry.count += 1;
		}
		return entry;
	}

	// Both act only while `entry` is still the current window: a login whose window expired during
	// the password check must not take back failures counted in the next one.
	release(entry: LoginAttemptEntry) {
		if (this.entries.get(entry.key) !== entry) return;
		entry.count -= 1;
		if (entry.count <= 0) this.entries.delete(entry.key);
	}

	clear(entry: LoginAttemptEntry) {
		if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
	}

	purgeExpired(now: number) {
		for (const [key, entry] of this.entries) {
			if (entry.resetAt <= now) this.entries.delete(key);
		}
	}
}

const attemptsByClientAndUser = new LoginAttemptCounter();
const attemptsByClient = new LoginAttemptCounter();
const attemptsByUsername = new LoginAttemptCounter();

// Periodic cleanup to prevent unbounded memory growth — runs every 5 minutes
const LOGIN_CLEANUP_INTERVAL = setInterval(() => {
	const now = Date.now();
	attemptsByClientAndUser.purgeExpired(now);
	attemptsByClient.purgeExpired(now);
	attemptsByUsername.purgeExpired(now);
}, LOGIN_WINDOW_MS);
// Allow the process to exit without waiting for this interval
LOGIN_CLEANUP_INTERVAL.unref();

let warnedAboutMissingClientIP = false;

/**
 * Check the limits and register the attempt in one synchronous step (no await in between).
 * Returns `null` when the attempt is rate limited, otherwise a function that takes the attempt
 * back — call it once the login has succeeded.
 */
function tryRegisterLoginAttempt(clientIP: string | null, username: string): (() => void) | null {
	if (clientIP === null && !warnedAboutMissingClientIP) {
		warnedAboutMissingClientIP = true;
		Logger.warn(
			"Client IP unknown (no address, or a loopback peer such as a same-host reverse proxy): these logins share one rate-limit client. Behind a reverse proxy, set APPPREFIX_API_TRUST_PROXY=true and have the proxy append X-Forwarded-For.",
		);
	}

	const clientKey = clientIP === null ? null : getClientRateLimitKey(clientIP);
	// JSON keeps the pair unambiguous: IPv6 keys contain ':' and a login username can be any string.
	const clientUserKey = JSON.stringify([clientKey, username]);
	const clientUserAttempts = attemptsByClientAndUser.count(clientUserKey);

	const limited =
		clientUserAttempts >= LOGIN_MAX_ATTEMPTS ||
		// Without an address every visitor shares one client, so a per-client limit would block everyone.
		(clientKey !== null && attemptsByClient.count(clientKey) >= LOGIN_MAX_CLIENT_ATTEMPTS) ||
		(clientUserAttempts > 0 && attemptsByUsername.count(username) >= LOGIN_USERNAME_ALERT_ATTEMPTS);
	if (limited) return null;

	const clientUserEntry = attemptsByClientAndUser.increment(clientUserKey);
	const clientEntry = clientKey === null ? null : attemptsByClient.increment(clientKey);
	const usernameEntry = attemptsByUsername.increment(username);

	return () => {
		attemptsByClientAndUser.clear(clientUserEntry);
		if (clientEntry) attemptsByClient.release(clientEntry);
		attemptsByUsername.release(usernameEntry);
	};
}

export const router = new Hono().basePath("/auth");

router.post(
	"/login",

	APIRouteSpec.unauthenticated({
		summary: "User Login",
		description: "Authenticate a user with their username and password",
		tags: [DOCS_TAGS.AUTHENTICATION],

		responses: APIResponseSpec.describeWithWrongInputs(
			APIResponseSpec.success("Login successful", AuthModel.Login.Response),
			APIResponseSpec.unauthorized("Unauthorized: Invalid username or password"),
			APIResponseSpec.tooManyRequests("Too many login attempts. Try again later."),
		),
	}),

	zValidator("json", AuthModel.Login.Body),

	async (c) => {
		const authContext = AuthHandler.AuthContext.get(c) as AuthHandler.UnauthenticatedAuthContext;
		if (authContext.type !== "unauthenticated") {
			return APIResponse.forbidden(c, "You are already authenticated");
		}

		const { username, password } = c.req.valid("json");

		try {
			const clientIP = getClientIP(c);
			const usernameKey = username.toLowerCase();

			const releaseLoginAttempt = tryRegisterLoginAttempt(clientIP, usernameKey);
			if (!releaseLoginAttempt) {
				const retrySeconds = Math.max(1, Math.ceil(LOGIN_WINDOW_MS / 1000));
				c.header("Retry-After", retrySeconds.toString());
				return APIResponse.tooManyRequests(c, `Too many login attempts. Try again in ${retrySeconds}s`);
			}

			const user = DB.instance()
				.select()
				.from(DB.Tables.users)
				.where(eq(DB.Tables.users.username, username))
				.get();
			if (!user) {
				// Timing-normalized: always run a bcrypt call to prevent username enumeration
				await Bun.password.verify("dummy-timing-constant", DUMMY_PASSWORD_HASH);
				return APIResponse.unauthorized(c, "Invalid username or password");
			}

			const passwordMatch = await Bun.password.verify(password, user.password_hash);
			if (!passwordMatch) {
				return APIResponse.unauthorized(c, "Invalid username or password");
			}

			releaseLoginAttempt();

			const session = await DB.instance().transaction(async (tx: DrizzleDB) => {
				return await SessionHandler.createSession(user.id, tx);
			});

			return APIResponse.success(c, "Login successful", session satisfies AuthModel.Login.Response);
		} catch (error: any) {
			Logger.error("Failed to create session", error.stack || error.message || error);
			return APIResponse.serverError(c, "Failed to create session");
		}
	},
);

router.get(
	"/session",

	APIRouteSpec.authenticated({
		summary: "Get Current Session",
		description: "Retrieve the current user's session information",
		tags: [DOCS_TAGS.AUTHENTICATION],

		responses: APIResponseSpec.describeBasic(
			APIResponseSpec.success("Session info retrieved successfully", AuthModel.Session.Response),
			APIResponseSpec.unauthorized(
				"Unauthorized: Invalid or missing session token / Your Auth Context is not a session",
			),
		),
	}),

	async (c) => {
		const authContext = AuthHandler.AuthContext.get(c);
		if (authContext.type !== "session") {
			return APIResponse.unauthorized(c, "Your Auth Context is not a session");
		}

		return APIResponse.success(c, "Session info retrieved successfully", {
			user_id: authContext.user_id,
			user_role: authContext.user_role,
			created_at: authContext.created_at,
			expires_at: authContext.expires_at,
		} satisfies AuthModel.Session.Response);
	},
);

router.post(
	"/logout",

	APIRouteSpec.authenticated({
		summary: "User Logout",
		description: "Invalidate the current user's session",
		tags: [DOCS_TAGS.AUTHENTICATION],

		responses: APIResponseSpec.describeBasic(
			APIResponseSpec.successNoData("Logout successful"),
			APIResponseSpec.unauthorized(
				"Unauthorized: Invalid or missing session token / Your Auth Context is not a session",
			),
		),
	}),

	async (c) => {
		const authContext = AuthHandler.AuthContext.get(c);

		if (authContext.type !== "session") {
			return APIResponse.unauthorized(c, "Your Auth Context is not a session");
		}

		await SessionHandler.inValidateSession(authContext.id);

		return APIResponse.successNoData(c, "Logout successful");
	},
);

router.route("/", (await import("./reset-password")).router);
