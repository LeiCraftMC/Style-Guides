export default defineNuxtRouteMiddleware(async (to) => {
	const publicRoutes = ["/auth/login", "/auth/register"];
	const match = SimpleRouteMatcher.match(to.path, publicRoutes);
	if (match) return;

	const result = await useAPI((api) => api.getHealth(), true);
	if (!result.success) {
		return navigateTo(`/auth/login?url=${encodeURIComponent(to.fullPath)}`);
	}
});
