import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import { DB } from "../../../../../db";
import { type DrizzleDB } from "../../../../../db/utils";
import { Logger } from "../../../../../utils/logger";
import { APIResponse } from "../../../../utils/api-res";
import { AuthHandler, SessionHandler } from "../../../../utils/authHandler";
import { getClientIP } from "../../../../utils/clientIP";
import { APIResponseSpec, APIRouteSpec } from "../../../../utils/specHelpers";
import { DOCS_TAGS } from "../../docs";
import { AuthModel } from "./model";

// Dummy bcrypt hash for timing-normalized login failures — prevents username enumeration
// Generated once at module load so it's a valid, cost-equivalent hash
const DUMMY_PASSWORD_HASH = await Bun.password.hash("dummy-timing-constant");

// In-memory login rate limiter. An attempt is registered before the password check, so concurrent
// requests cannot all slip under a limit, and taken back when the login succeeds — the counters
// effectively count failures.
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX_ATTEMPTS = 5; // per client + username
const LOGIN_MAX_CLIENT_ATTEMPTS = 20; // per client, across usernames
// Per username across clients. Past this, only clients without a failure for that username may
// try: a distributed attack gets one guess per new address, while the owner can still log in.
const LOGIN_USERNAME_ALERT_ATTEMPTS = 15;

class LoginAttemptCounter {
	private readonly entries = new Map<string, { count: number; resetAt: number }>();

	count(key: string) {
		const entry = this.entries.get(key);
		return entry && entry.resetAt > Date.now() ? entry.count : 0;
	}

	increment(key: string) {
		const now = Date.now();
		const entry = this.entries.get(key);
		if (!entry || entry.resetAt <= now) {
			this.entries.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
		} else {
			entry.count += 1;
		}
	}

	decrement(key: string) {
		const entry = this.entries.get(key);
		if (!entry) return;
		entry.count -= 1;
		if (entry.count <= 0) this.entries.delete(key);
	}

	clear(key: string) {
		this.entries.delete(key);
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
 * Returns false when the attempt is rate limited.
 */
function tryRegisterLoginAttempt(clientIP: string | null, username: string): boolean {
	if (clientIP === null && !warnedAboutMissingClientIP) {
		warnedAboutMissingClientIP = true;
		Logger.warn(
			"Client IP unavailable: login limits fall back to one shared client. Behind a reverse proxy, set API_TRUST_PROXY.",
		);
	}

	const clientUserKey = `${clientIP ?? "unknown"}:${username}`;
	const clientUserAttempts = attemptsByClientAndUser.count(clientUserKey);

	const limited =
		clientUserAttempts >= LOGIN_MAX_ATTEMPTS ||
		// Without an address every visitor shares one client, so a per-client limit would block everyone.
		(clientIP !== null && attemptsByClient.count(clientIP) >= LOGIN_MAX_CLIENT_ATTEMPTS) ||
		(clientUserAttempts > 0 && attemptsByUsername.count(username) >= LOGIN_USERNAME_ALERT_ATTEMPTS);
	if (limited) return false;

	attemptsByClientAndUser.increment(clientUserKey);
	if (clientIP !== null) attemptsByClient.increment(clientIP);
	attemptsByUsername.increment(username);
	return true;
}

function releaseSuccessfulLoginAttempt(clientIP: string | null, username: string) {
	attemptsByClientAndUser.clear(`${clientIP ?? "unknown"}:${username}`);
	if (clientIP !== null) attemptsByClient.decrement(clientIP);
	attemptsByUsername.decrement(username);
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

			if (!tryRegisterLoginAttempt(clientIP, usernameKey)) {
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

			releaseSuccessfulLoginAttempt(clientIP, usernameKey);

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
