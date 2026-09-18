<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import LCMCIcon from "~/components/img/LCMCIcon.vue";

const links = computed<NavigationMenuItem[]>(() => [
	{
		label: "About",
		to: "/about",
	},
	{
		label: "Projects",
		to: "/projects",
	},
	{
		label: "Docs",
		to: "/docs",
	},
	{
		label: "Contact",
		to: "/contact",
	},
]);

const socialLinks = [
	{ icon: "i-lucide-github", to: "https://github.com/LeiCraft/", label: "GitHub" },
	{ icon: "i-lucide-gitlab", to: "https://git.leicraftmc.de/LeiCraft/", label: "GitLab" },
	{ icon: "i-lucide-message-circle", to: "https://discord.com/invite/3cdazADhtv", label: "Discord" },
	{ icon: "i-lucide-twitter", to: "https://twitter.com/leicraft_", label: "Twitter" },
];

const mobileLinks = computed<NavigationMenuItem[][]>(() => [
	links.value,
	socialLinks.map((social) => ({
		label: social.label,
		to: social.to,
		target: "_blank",
		icon: social.icon,
	})),
]);
</script>

<template>
	<UHeader class="backdrop-blur-xl">
		<template #title>
			<NuxtLink to="/" class="flex items-center gap-1.5">
				<LCMCIcon class="h-10 w-10" />
				<span class="text-3xl font-extrabold">App Name</span>
			</NuxtLink>
		</template>

		<UNavigationMenu :items="[links]" />

		<template #body>
			<UNavigationMenu :items="mobileLinks" orientation="vertical" class="w-full" />
		</template>

		<template #right>
			<div class="hidden items-center gap-2 lg:flex">
				<UButton
					v-for="social in socialLinks"
					:key="social.label"
					:to="social.to"
					target="_blank"
					:icon="social.icon"
					color="neutral"
					variant="ghost"
					size="lg"
					:aria-label="social.label"
					class="transition-transform duration-200 hover:scale-110"
				/>
			</div>
			<UButton to="/docs" color="primary" variant="solid" class="font-medium">
				Docs
			</UButton>
		</template>
	</UHeader>
</template>
