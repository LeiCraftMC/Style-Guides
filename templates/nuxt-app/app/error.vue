<script setup lang="ts">
defineProps<{ error: any }>();
</script>

<template>
  <UError :error="error" />
</template>
