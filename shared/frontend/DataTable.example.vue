<!--
	DataTable — generic data table wrapper over UTable (TanStack) with filters, per-column
	cell slots (`<column>-cell`), pagination, page-size, empty + loading states.
	Copy into `app/components/dashboard/DataTable.vue`.
	See docs/15-design-system.md#component-idioms.
-->
<script setup lang="ts" generic="T extends Record<string, any>">
	import type { TableColumn } from "@nuxt/ui";

	type FilterDef = {
		column: string;
		label: string;
		type: "text" | "select";
		options?: { label: string; value: string }[];
	};

	const props = withDefaults(
		defineProps<{
			columns: TableColumn<T>[];
			rows: T[];
			rowKey?: (row: T) => string | number;
			filters?: FilterDef[];
			loading?: boolean;
			pageSize?: number;
		}>(),
		{ loading: false, pageSize: 10 },
	);

	const filterState = reactive<Record<string, string>>({});
	const page = ref(1);
	const size = ref(props.pageSize);

	const filteredRows = computed(() => {
		let out = props.rows;
		for (const def of props.filters ?? []) {
			const value = filterState[def.column];
			if (!value) continue;
			out = out.filter((row) => String(row[def.column]).toLowerCase().includes(value.toLowerCase()));
		}
		return out;
	});

	const pagedRows = computed(() => {
		const start = (page.value - 1) * size.value;
		return filteredRows.slice(start, start + size.value);
	});

	watch(filteredRows, () => {
		page.value = 1;
	});
</script>

<template>
	<UCard :ui="{ body: "p-0" }">
		<template v-if="filters?.length" #header>
			<div class="flex flex-wrap items-center gap-3">
				<div v-for="def in filters" :key="def.column" class="flex items-center gap-2">
					<span class="text-sm text-muted">{{ def.label }}</span>
					<UInput
						v-if="def.type === 'text'"
						v-model="filterState[def.column]"
						:placeholder="def.label"
						icon="i-lucide-search"
					/>
					<USelectMenu
						v-else
						v-model="filterState[def.column]"
						:options="def.options ?? []"
						value-key="value"
						option-attribute="label"
						:placeholder="def.label"
					/>
				</div>
			</div>
		</template>

		<UTable :columns="columns" :rows="pagedRows" :row-key="rowKey">
			<template v-for="col in columns" :key="String(col.key)" #[`${col.key}-cell`]="slotProps">
				<slot :name="`${col.key}-cell`" v-bind="slotProps" />
			</template>
		</UTable>

		<div v-if="loading" class="flex justify-center py-8">
			<UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
		</div>
		<UEmpty
			v-else-if="filteredRows.length === 0"
			icon="i-lucide-inbox"
			title="No results"
			description="Nothing matches the current filters."
			variant="naked"
		/>

		<template #footer>
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-2 text-sm text-muted">
					<span>Per page</span>
					<USelect v-model="size" :options="[10, 25, 50]" />
				</div>
				<UPagination v-model:page="page" :items-per-page="size" :total="filteredRows.length" />
			</div>
		</template>
	</UCard>
</template>