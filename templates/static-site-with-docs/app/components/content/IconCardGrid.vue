<script setup lang="ts">
interface Card {
	icon: string;
	title: string;
	description: string;
	to?: string;
	target?: string;
	/** Text of the external-link hint on `target: _blank` cards. */
	linkLabel?: string;
}

const { cards = [] } = defineProps<{
	cards?: Card[];
}>();

const NuxtLink = resolveComponent("NuxtLink");
</script>

<template>
	<div class="not-prose my-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
		<component
			:is="card.to ? NuxtLink : 'div'"
			v-for="card in cards"
			:key="card.title"
			v-bind="card.to ? { to: card.to, target: card.target } : {}"
			class="group flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition"
			:class="card.to ? 'hover:border-primary-400/50' : ''"
		>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
				<UIcon :name="card.icon" class="text-lg text-primary-400" />
			</div>
			<div>
				<h3
					class="font-semibold text-slate-200"
					:class="card.to ? 'group-hover:text-primary-400' : ''"
				>
					{{ card.title }}
				</h3>
				<p class="text-sm text-slate-400">{{ card.description }}</p>
				<!-- The whole card is already the link; a nested <a> would be invalid HTML. -->
				<span
					v-if="card.to && card.target === '_blank'"
					class="mt-1 inline-flex items-center gap-1 text-sm text-primary-400 group-hover:underline"
				>
					{{ card.linkLabel ?? "Open" }}
					<UIcon name="i-lucide-external-link" class="text-xs" />
				</span>
			</div>
		</component>
	</div>
</template>
