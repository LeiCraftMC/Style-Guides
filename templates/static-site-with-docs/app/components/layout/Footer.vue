<template>
	<UFooter class="mt-8 bg-neutral-900">
		<div class="text-center text-sm text-slate-500">
			<p class="mb-1">
				<span> &copy; 2021 - {{ new Date().getFullYear() }} LeiCraft_MC. All rights reserved. </span>
			</p>
			<p>
				<NuxtLink
					to="https://legal.leicraftmc.de/impressum/"
					target="_blank"
					class="transition-colors hover:text-slate-300"
					>
					Impressum
				</NuxtLink>
				<span class="mx-2">|</span>
				<NuxtLink
					to="https://legal.leicraftmc.de/datenschutz/"
					target="_blank"
					class="transition-colors hover:text-slate-300"
					>
					Datenschutz
				</NuxtLink>
			</p>
		</div>
	</UFooter>
</template>
