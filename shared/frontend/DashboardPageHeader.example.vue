<!--
	DashboardPageHeader — wraps UDashboardNavbar with title/description/icon + optional breadcrumb.
	Copy into `app/components/dashboard/DashboardPageHeader.vue`.
	See docs/15-design-system.md#component-idioms.
-->
<script setup lang="ts">
	import type { BreadcrumbItem } from "@nuxt/ui";

	defineProps<{
		title: string;
		description?: string;
		icon?: string;
		breadcrumbs?: BreadcrumbItem[];
	}>();
</script>

<template>
	<UDashboardNavbar :ui="{ root: "gap-2" }">
		<template #leading>
			<UIcon v-if="icon" :name="icon" class="size-5 text-primary-500" />
		</template>
		<template #title>
			<div class="flex flex-col">
				<span class="text-lg font-semibold">{{ title }}</span>
				<span v-if="description" class="text-sm text-muted">{{ description }}</span>
			</div>
		</template>
		<template #right>
			<slot name="actions" />
		</template>
		<template v-if="breadcrumbs" #default>
			<UBreadcrumb :items="breadcrumbs" />
		</template>
	</UDashboardNavbar>
</template>