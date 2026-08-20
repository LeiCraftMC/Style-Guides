<template>
  <div class="min-h-screen main-bg-color text-slate-200">
    <header class="border-b border-slate-800 p-4">
      <div class="mx-auto flex max-w-5xl items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 text-lg font-semibold text-white">
          <ImgAppLogo class="h-8 w-auto" />
          <span><ProjectName></span>
        </NuxtLink>
        <UButton icon="i-lucide-log-in" to="/auth/login" variant="ghost" />
      </div>
    </header>
    <main class="mx-auto max-w-5xl p-6">
      <slot />
    </main>
  </div>
</template>
