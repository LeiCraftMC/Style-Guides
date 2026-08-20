/**
 * useAppCookies — typed session-cookie accessor.
 *
 * `AppCookie` wraps `useCookie` so callers do `useAppCookies().sessionToken.get().value` /
 * `.set(value)`. The cookie name uses the project's `<PREFIX>` (e.g. `dla_session_token`,
 * `mindcode_session_token`) — keep it in sync with the backend's token prefix.
 * See docs/07-state-and-data.md and docs/10-auth.md.
 */
import type { CookieOptions } from "#app";

type CookieOptionsWithoutReadonly<T> = CookieOptions<T> & {
	readonly?: false;
};

class AppCookie<T extends string | null | undefined> {
	constructor(
		protected readonly name: string,
		protected readonly options?: CookieOptionsWithoutReadonly<T>,
	) {}

	get() {
		return useCookie(this.name);
	}

	set(value: T) {
		useCookie(this.name, this.options as CookieOptionsWithoutReadonly<T> | undefined).value = value;
	}
}

export function useAppCookies() {
	return {
		// Replace <PREFIX> with your project's prefix (e.g. dla_, nowip_, mindcode_).
		sessionToken: new AppCookie<string | null>("<PREFIX>_session_token"),
	} as const;
}
