<script lang="ts">
	import { v4 as uuid } from 'uuid';

	const { recipe } = $props();
	const emptyIngredient = () => ({ id: uuid(), name: '', amount: 0, unit: '' });
	const emptyDirection = () => ({ id: uuid(), body: '' });

	let recipeData = $state(
		JSON.parse(JSON.stringify(recipe))
	);

	$effect(() => {
		recipeData = JSON.parse(JSON.stringify(recipe));
	});
	const recipeId = recipeData.id;
	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let newIngredient = $state(emptyIngredient());
	let newDirection = $state(emptyDirection());
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;
</script>

<div class="flex flex-col gap-2">
	<h1>Recipe: {recipeData.name}</h1>
	<h2>Ingredients</h2>

	<ol class="list-decimal list-inside">
		{#each recipeData.ingredients as ing (ing.id)}
			<li>
				<span>{ing.name}</span>
				<span>{ing.amount}</span>
				<span>{ing.unit}</span>
			</li>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingIngredient) {
				newIngredient = emptyIngredient();
			}
			addingIngredient = !addingIngredient;
		}}>Add new ingredient</button
	>
	{#if addingIngredient}
		<form class="flex flex-col">
			<label>
				Name
				<input bind:value={newIngredient.name} />
			</label>
			<label>
				Amount
				<input bind:value={newIngredient.amount} />
			</label>
			<label>
				Unit
				<input bind:value={newIngredient.unit} />
			</label>
			<button
				type="button"
				onclick={() => {
					recipeData.ingredients.push(newIngredient);
					addingIngredient = !addingIngredient;
					newIngredient = emptyIngredient();
				}}>Add</button
			>
		</form>
	{/if}

	<h2>Directions</h2>
	<ol class="list-decimal list-inside">
		{#each recipeData.directions as dir (dir.id)}
			<li>
				{dir.body}
			</li>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingDirection) {
				newDirection = emptyDirection();
			}
			addingDirection = !addingDirection;
		}}>Add new direction</button
	>
	{#if addingDirection}
		<form class="flex flex-col gap-2">
			<label>
				Body
				<input bind:value={newDirection.body} />
			</label>
			<button
				type="button"
				onclick={() => {
					recipeData.directions.push(newDirection);
					addingDirection = !addingDirection;
					newDirection = emptyDirection();
				}}>Add</button
			>
		</form>
	{/if}
	{#await savePromise}
		<button type="submit" disabled>Save</button>
	{:then}
		<button
			type="button"
			onclick={() => {
				savePromise = new Promise((resolve) => (saveResolve = resolve));
				fetch('/api/save', {
					method: 'PUT',
					body: new URLSearchParams({ recipe: JSON.stringify(recipeData), recipeId })
				}).then(() => {
					saveResolve();
				});
			}}
		>
			Save
		</button>
	{/await}
</div>
