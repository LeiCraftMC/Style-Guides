<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
    error: NuxtError
}>()
</script>

<template>
    <div class="app-layout main-bg-color min-h-screen flex flex-col items-center justify-center p-4">
        <UError :error="error" />
    </div>
</template>

<style scoped>
.app-layout {
    color: rgb(241 245 249);
}
</style>
