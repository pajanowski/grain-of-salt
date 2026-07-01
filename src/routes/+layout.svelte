<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import RecipeList from '$lib/component/RecipeList.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();

	let createRecipe = $state(false);
	let newRecipeName = $state('');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex flex-row gap-4 p-4">
	<div class="flex flex-col gap-2">
		<RecipeList recipes={data.recipes} />
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
								invalidateAll();
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
