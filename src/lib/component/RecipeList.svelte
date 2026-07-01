<script lang="ts">
	let { recipes } = $props();
	let createRecipe = $state(false);
	let newRecipeName = $state('');
</script>

<div class="flex flex-col">
	<h1><a href="/">Recipe List</a></h1>
	<ul>
		{#each recipes as rec}
			<li>
				<a href="/recipes/{rec.id}">{rec.name}</a>
			</li>
		{/each}
	</ul>

	{#if createRecipe}
		<div class="flex flex-col gap-2">
			<form>
				<input bind:value={newRecipeName} />
			</form>
			<div class="flex flex-row gap-2">
				<button onclick={() => {}}> Create </button>
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
