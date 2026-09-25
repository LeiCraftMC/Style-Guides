<script setup lang="ts">
usePageSeo({
	title: "About - <ProjectName>",
	description: "About this LeiCraft_MC static site.",
});
</script>

<template>
	<div class="space-y-6">
		<h1 class="text-2xl font-semibold text-white">About</h1>
		<p class="text-slate-400">
			Built with the LeiCraftMC style guide. Dark-first, Lucide icons, Tailwind v4 CSS-first.
		</p>
		<UButton icon="i-lucide-arrow-left" to="/" variant="ghost">Back home</UButton>
	</div>
</template>
