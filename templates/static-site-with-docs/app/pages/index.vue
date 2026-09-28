<script setup lang="ts">
usePageSeo({
	title: "<ProjectName>",
	description: "A LeiCraftMC static site with docs.",
});
</script>

<template>
	<UContainer>
		<div class="space-y-6 py-8">
			<h1 class="text-3xl font-semibold text-white">Welcome to ProjectName</h1>
			<p class="text-slate-400">
				This is a static site built with Nuxt 4, NuxtUI v4, and Tailwind v4.
			</p>
			<UButton icon="i-lucide-arrow-right" to="/docs">Read the docs</UButton>
		</div>
	</UContainer>
</template>
