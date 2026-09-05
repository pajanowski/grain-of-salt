<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import RecipeList from '$lib/component/RecipeList.svelte';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';

	let { data, children } = $props();

	let createRecipe = $state(false);
	let newRecipeName = $state('');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
<header
	class="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm"
>
	{#if data.user}
		<span class="text-gray-700">Signed in as <strong>{data.user.email}</strong></span>
		<form method="POST" action="/auth?/logout" use:enhance>
			<button type="submit" class="rounded border px-2 py-1 hover:bg-gray-100">Sign out</button>
		</form>
	{:else if data.isGuest}
		<span class="rounded bg-yellow-100 px-2 py-0.5 text-xs">Guest</span>
		<a href="/auth" class="rounded border px-2 py-1 hover:bg-gray-100">Sign in</a>
		<form method="POST" action="/auth?/guestClear" use:enhance>
			<button type="submit" class="text-xs text-gray-500 underline">End guest session</button>
		</form>
	{:else}
		<a href="/auth" class="rounded bg-black px-3 py-1 text-white">Sign in</a>
	{/if}
</header>

<div class="flex flex-row gap-4 p-4">
	<div class="flex flex-col gap-2">
		<RecipeList recipeTree={data.recipeTree} />
		{#if createRecipe}
			<div class="flex flex-col gap-2">
				<form>
					<input bind:value={newRecipeName} />
				</form>
				<div class="flex flex-row gap-2">
					<button
						onclick={() => {
							fetch('/api/save', {
								method: 'POST',
								body: new URLSearchParams({ recipeName: newRecipeName })
							}).then((res) => {
								// TODO: surface server errors — this handler ignores
								//       res.ok and closes the form on any response.
								//       See "server failure during save" in
								//       tests/e2e/recipe-create.e2e.ts.
								invalidateAll();
								// TODO: also reset `newRecipeName = ''` here so
								//       re-opening the form starts blank. Only
								//       Cancel resets it today, so a successful
								//       submit leaves a stale value in the input.
								createRecipe = false;
							});
						}}
					>
						Create
					</button>
					<button
						onclick={() => {
							newRecipeName = '';
							createRecipe = false;
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				onclick={() => {
					createRecipe = !createRecipe;
				}}
			>
				Create Recipe
			</button>
		{/if}
	</div>
	{@render children()}
</div>
