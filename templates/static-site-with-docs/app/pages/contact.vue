<script setup lang="ts">
usePageSeo({
	title: "Contact — <ProjectName>",
	description: "Contact <ProjectName>.",
});
</script>

<template>
	<UContainer>
		<div class="space-y-6 py-8">
			<h1 class="text-2xl font-semibold text-white">Contact</h1>
			<p class="text-slate-400">
				Get in touch through the channels linked in the header or footer.
			</p>
			<UButton icon="i-lucide-arrow-left" to="/" variant="ghost">Back home</UButton>
		</div>
	</UContainer>
</template>
