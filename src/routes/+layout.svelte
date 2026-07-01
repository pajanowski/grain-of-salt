<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import RecipeList from '$lib/component/RecipeList.svelte';
	import { invalidate } from '$app/navigation';

	let { data, children } = $props();
	const recipes = $state(data.recipes);

	let createRecipe = $state(false);
	let newRecipeName = $state('');
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex flex-row gap-4 p-4">
	<div class="flex flex-col gap-2">
		<RecipeList {recipes} />
		{#if createRecipe}
			<div class="flex flex-col gap-2">
				<form>
					<input bind:value={newRecipeName} />
				</form>
				<div class="flex flex-row gap-2">
					<button
						onclick={() => {
							savePromise = new Promise((resolve) => (saveResolve = resolve));
							fetch('/api/save', {
								method: 'POST',
								body: new URLSearchParams({ recipeName: newRecipeName })
							}).then((res) => {
								invalidate('/');
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
