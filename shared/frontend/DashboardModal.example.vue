<!--
	DashboardModal — a thin wrapper over UModal with icon + loading state.
	Copy into `app/components/dashboard/DashboardModal.vue`.
	See docs/15-design-system.md#component-idioms.
-->
<script setup lang="ts">
	const open = defineModel<boolean>("open", { default: false });

	withDefaults(
		defineProps<{
			title: string;
			description?: string;
			icon?: string;
			iconColor?: string;
			loading?: boolean;
		}>(),
		{ iconColor: "primary", loading: false },
	);
</script>

<template>
	<UModal v-model:open="open" :title="title" :description="description">
		<template #title>
			<div class="flex items-center gap-2">
				<UIcon v-if="icon" :name="icon" class="size-5" :class="`text-${iconColor}-500`" />
				<span>{{ title }}</span>
			</div>
		</template>
		<template #body>
			<div v-if="loading" class="flex items-center justify-center py-8">
				<UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
			</div>
			<slot v-else />
		</template>
		<template #footer>
			<slot name="footer" />
		</template>
	</UModal>
</template>