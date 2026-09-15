<script setup lang="ts">
import ProjectCard from '~/components/ProjectCard.vue';
import { projects } from '~/data/projects';

const pageTitle = "Projects | <ProjectName>";
const pageDescription = "Overview of all projects of <ProjectName>.";

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
});

</script>

<template>
    <section class="py-8">
        <h1 class="text-center text-3xl font-bold mb-10">Meine Projekte</h1>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
</template>
