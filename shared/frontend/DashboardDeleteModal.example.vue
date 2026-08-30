<!--
	DashboardDeleteModal — destructive-confirm modal built on DashboardModal.
	User must type DELETE to enable the confirm button. Copy into
	`app/components/dashboard/DashboardDeleteModal.vue`.
	See docs/15-design-system.md#component-idioms.
-->
<script setup lang="ts">
	const open = defineModel<boolean>("open", { default: false });

	withDefaults(
		defineProps<{
			title?: string;
			description?: string;
			loading?: boolean;
		}>(),
		{ title: "Delete", description: "This action cannot be undone.", loading: false },
	);

	const emit = defineEmits<{ confirm: [] }>();
	const confirmInput = ref("");

	watch(open, (value) => {
		if (!value) confirmInput.value = "";
	});

	const canConfirm = computed(() => confirmInput.value === "DELETE");

	function onConfirm() {
		if (!canConfirm.value) return;
		emit("confirm");
	}
</script>

<template>
	<DashboardModal
		v-model:open="open"
		:title="title"
		:description="description"
		icon="i-lucide-trash-2"
		icon-color="error"
		:loading="loading"
	>
		<div class="space-y-4">
			<div class="rounded-lg border border-red-900/50 bg-red-950/50 p-4 text-sm text-red-200">
				<slot />
			</div>
			<UFormField label="Type DELETE to confirm">
				<UInput v-model="confirmInput" placeholder="DELETE" autocomplete="off" />
			</UFormField>
		</div>
		<template #footer>
			<UButton variant="ghost" label="Cancel" @click="open = false" />
			<UButton
				color="error"
				label="Delete"
				icon="i-lucide-trash-2"
				:loading="loading"
				:disabled="!canConfirm"
				@click="onConfirm"
			/>
		</template>
	</DashboardModal>
</template>