<script setup lang="ts">
definePageMeta({ layout: "auth" });

const username = ref("");
const password = ref("");
const error = ref("");

async function login() {
	error.value = "";
	const result = await useAPI((api) => api.login({ body: { username: username.value, password: password.value } }));

	if (!result.success) {
		error.value = result.message;
		return;
	}

	useAppCookies().sessionToken.set(result.data.token);
	const redirect = useRoute().query.url as string;
	await navigateTo(redirect || "/");
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-white">Sign in</h1>
    <UFormGroup label="Username">
      <UInput v-model="username" icon="i-lucide-user" />
    </UFormGroup>
    <UFormGroup label="Password">
      <UInput v-model="password" type="password" icon="i-lucide-lock" />
    </UFormGroup>
    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
    <UButton icon="i-lucide-log-in" block @click="login">Sign in</UButton>
  </div>
</template>
