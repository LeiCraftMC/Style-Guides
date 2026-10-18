<script setup lang="ts">
import { useUserInfoStore } from "~/composables/stores/useUserStore";

definePageMeta({
	layout: "dashboard",
});

useSeoMeta({
	title: "Dashboard | ProjectName",
	description: "Overview of your account",
});

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();
if (!userInfoStore.isValid(user)) {
	throw createError({ statusCode: 401, statusMessage: "Not authenticated" });
}

const isAdmin = computed(() => user.value.role === "admin");

// Example data for the stat cards — replace with your app's own numbers.
const { data: apiKeys, loading: loadingApiKeys } = await useAPILazyAsyncData(
	"dashboard-apikeys",
	async () => {
		const res = await useAPI((api) => api.getAccountApikeys({}));
		return res.success ? res.data : [];
	},
);

const { data: users, loading: loadingUsers } = await useAPILazyAsyncData(
	"dashboard-admin-users",
	async () => {
		if (!isAdmin.value) return [];
		const res = await useAPI((api) => api.getAdminUsers({}));
		return res.success ? res.data : [];
	},
);

const stats = computed(() => [
	{
		label: "API Keys",
		value: apiKeys.value?.length ?? 0,
		loading: loadingApiKeys.value,
		icon: "i-lucide-key",
		iconColor: "primary" as const,
	},
	{
		label: "Member since",
		value: formatDate(user.value.created_at),
		loading: false,
		icon: "i-lucide-calendar",
		iconColor: "emerald" as const,
	},
	...(isAdmin.value
		? [
				{
					label: "Users",
					value: users.value?.length ?? 0,
					loading: loadingUsers.value,
					icon: "i-lucide-users",
					iconColor: "amber" as const,
				},
			]
		: []),
]);

const quickActions = computed(() => [
	{
		label: "Edit Profile",
		description: "Update your name and email",
		icon: "i-lucide-user",
		to: "/dashboard/settings",
		iconClass: "bg-primary/10 text-primary-400",
		hoverClass: "hover:border-primary/50",
	},
	{
		label: "Create API Key",
		description: "Access the API from scripts",
		icon: "i-lucide-key",
		to: "/dashboard/apikeys/new",
		iconClass: "bg-emerald-500/10 text-emerald-400",
		hoverClass: "hover:border-emerald-500/50",
	},
	...(isAdmin.value
		? [
				{
					label: "Manage Users",
					description: "Create and edit accounts",
					icon: "i-lucide-users",
					to: "/dashboard/admin/users",
					iconClass: "bg-amber-500/10 text-amber-400",
					hoverClass: "hover:border-amber-500/50",
				},
			]
		: []),
]);
</script>

<template>
	<UDashboardPanel>
		<template #header>
			<DashboardPageHeader title="Dashboard" icon="i-lucide-layout-dashboard" />
		</template>

		<template #body>
			<DashboardPageBody>
				<!-- Welcome -->
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-2xl font-bold">
							Welcome back, {{ user.display_name || user.username }}
						</h1>
						<p class="mt-1 text-slate-400">Here's an overview of your account.</p>
					</div>
					<UBadge v-if="isAdmin" color="primary" variant="soft" size="lg" icon="i-lucide-shield">
						Admin
					</UBadge>
				</div>

				<!-- Stats -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<DashboardStatCard
						v-for="stat in stats"
						:key="stat.label"
						:label="stat.label"
						:value="stat.value"
						:loading="stat.loading"
						:icon="stat.icon"
						:icon-color="stat.iconColor"
					/>
				</div>

				<!-- Quick actions -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<NuxtLink v-for="action in quickActions" :key="action.label" :to="action.to">
						<UCard :class="['border-slate-800 bg-slate-900/60 transition', action.hoverClass]">
							<div class="flex items-center gap-3">
								<div
									:class="['flex h-10 w-10 items-center justify-center rounded-lg', action.iconClass]"
								>
									<UIcon :name="action.icon" />
								</div>
								<div>
									<p class="font-semibold">{{ action.label }}</p>
									<p class="text-sm text-slate-400">{{ action.description }}</p>
								</div>
							</div>
						</UCard>
					</NuxtLink>
				</div>
			</DashboardPageBody>
		</template>
	</UDashboardPanel>
</template>
