<script setup lang="ts">
const route = useRoute();
const { data: page } = await useAsyncData(route.path, () =>
	queryCollection("docs")
		.path(`/docs/${route.params.slug?.toString() || ""}`)
		.first(),
);

if (!page.value) {
	throw createError({
		statusCode: 404,
		statusMessage: "Page not found",
		fatal: true,
	});
}

usePageSeo({
	title: `${page.value.title} — <ProjectName> Docs`,
	description: page.value.description,
});
</script>

<template>
	<DocsPage>
		<ContentRenderer
			v-if="page"
			:value="page"
			class="prose prose-invert max-w-none"
		/>
	</DocsPage>
</template>
