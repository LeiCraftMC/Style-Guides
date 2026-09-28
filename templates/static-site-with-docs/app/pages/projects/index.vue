<script setup lang="ts">
import ProjectCard from "~/components/ProjectCard.vue";
import { projects } from "~/data/projects";

usePageSeo({
	title: "Projects — <ProjectName>",
	description: "Overview of all projects of <ProjectName>.",
});
</script>

<template>
	<UContainer>
		<section class="py-8">
			<h1 class="mb-10 text-center text-3xl font-bold">Projects</h1>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				<ProjectCard
					v-for="project in projects"
					:key="project.id"
					:title="project.title"
					:img="project?.logo"
					:to="`/projects/${project.id}`"
					:tags="project.tags"
					:status="project.status"
				>
					{{ project.shortDescription }}
				</ProjectCard>
			</div>
		</section>
	</UContainer>
</template>
