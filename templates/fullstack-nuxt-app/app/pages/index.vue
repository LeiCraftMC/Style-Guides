<script setup lang="ts">
useSeoMeta({
	title: "<ProjectName>",
});

const { data: health, refresh, loading } = await useAPIAsyncData("health", async () => {
	const result = await useAPI((api) => api.getHealth(), true);
	return result.success ? result.data : null;
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white">Welcome to <ProjectName></h1>
    <p class="mt-2 text-slate-400">Nuxt 4 + NuxtUI v4 + Tailwind v4 template.</p>

    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-heart-pulse" class="text-emerald-400" />
          <span class="font-medium">Health</span>
        </div>
      </template>
      <div v-if="loading" class="text-slate-400">Loading…</div>
      <pre v-else class="text-sm">{{ health }}</pre>
      <template #footer>
        <UButton icon="i-lucide-refresh-cw" :loading="loading" @click="refresh">Refresh</UButton>
      </template>
    </UCard>
  </div>
</template>
