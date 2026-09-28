<script setup lang="ts">
import { getProjectById } from "~/data/projects";

const route = useRoute();
const project = computed(() => getProjectById(route.params.id as string));

if (!project.value) {
	throw createError({ statusCode: 404, statusMessage: "Project not found" });
}

const projectTitle = `${project.value.title} — Projects — <ProjectName>`;

usePageSeo({
	title: projectTitle,
	description: project.value.shortDescription,
});

const allLinks = computed(() => {
	const links = [];

	if (project.value?.sourceUrl) {
		links.push({
			label: "Source Code",
			url: project.value.sourceUrl,
			icon: "i-lucide-code",
		});
	}

	if (project.value?.websiteUrl) {
		links.push({
			label: "Website",
			url: project.value.websiteUrl,
			icon: "i-lucide-globe",
		});
	}

	if (project.value?.additionalLinks) {
		for (const link of project.value.additionalLinks) {
			links.push({
				label: link.label,
				url: link.url,
				icon: link.icon ?? "i-lucide-external-link",
			});
		}
	}

	return links;
});
</script>

<template>
	<UContainer>
		<section v-if="project" class="mx-auto max-w-4xl py-8">
			<NuxtLink
				to="/projects"
				class="mb-6 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
			>
				<UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
				<span>All Projects</span>
			</NuxtLink>

			<div class="flex flex-col items-center text-center">
				<img :src="project.logo" :alt="`${project.title} Logo`" height="100" width="100" class="mb-4" />

				<h1 class="mb-2 text-4xl font-bold">{{ project.title }}</h1>

				<div v-if="project.status" class="mb-4">
					<span class="inline-block rounded-full bg-sky-500/20 px-3 py-1 text-sm font-medium text-sky-300"
						>{{ project.status }}</span
					>
				</div>

				<div v-if="project.tags.length" class="mb-6 flex flex-wrap justify-center gap-2">
					<span
						v-for="tag in project.tags"
						:key="tag"
						class="rounded-md bg-neutral-800 px-3 py-1 text-sm text-neutral-300"
					>
						{{ tag }}
					</span>
				</div>
			</div>

			<div class="mt-6 rounded-lg bg-[#1a1b2e] p-6 md:p-8">
				<p class="text-lg leading-relaxed text-gray-300">
					{{ project.description }}
				</p>
			</div>

			<div v-if="allLinks.length" class="mt-8 flex flex-wrap justify-center gap-3">
				<UButton
					v-for="link in allLinks"
					:key="link.url"
					:to="link.url"
					target="_blank"
					:icon="link.icon"
					color="neutral"
					variant="soft"
					size="lg"
				>
					{{ link.label }}
				</UButton>
			</div>
		</section>
	</UContainer>
</template>
