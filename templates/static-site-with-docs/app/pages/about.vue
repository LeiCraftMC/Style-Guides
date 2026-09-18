<script setup lang="ts">
usePageSeo({
	title: "About — <ProjectName>",
	description: "About this LeiCraftMC static site.",
});
</script>

<template>
	<UContainer>
		<div class="space-y-6 py-8">
			<h1 class="text-2xl font-semibold text-white">About</h1>
			<p class="text-slate-400">
				Built with the LeiCraftMC style guide. Dark-first, Lucide icons, Tailwind v4 CSS-first.
			</p>
			<UButton icon="i-lucide-arrow-left" to="/" variant="ghost">Back home</UButton>
		</div>
	</UContainer>
</template>
