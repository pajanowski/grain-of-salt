<script lang="ts">
	import { enhance } from '$app/forms';
	import { Direction, Ingredient, Recipe } from '../obj/Recipe.svelte.ts';
	import doughJson from '../assets/dough.json';

	const { recipe, fileName } = $props();
	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let newIngredient = $state(Ingredient.Empty());
	let newDirection = $state(Direction.Empty());
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;

	function submitWhileSaving() {
		return async ({ update }: { update: () => Promise<void> }) => {
			savePromise = Promise.resolve();
			await update();
		};
	}

	function submitToSave() {
		savePromise = new Promise((resolve) => (saveResolve = resolve));
		return async ({ update }: { update: () => Promise<void> }) => {
			saveResolve();
			await update();
		};
	}
</script>

<div class="flex flex-col gap-2">
	<h1>Recipe: {recipe.name}</h1>
	<h2>Ingredients</h2>

	<ol class="list-decimal list-inside">
		{#each recipe.ingredients as ing (ing.id)}
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
				newIngredient = Ingredient.Empty();
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
					recipe.ingredients.push(newIngredient);
					addingIngredient = !addingIngredient;
					newIngredient = Ingredient.Empty();
				}}>Add</button
			>
		</form>
	{/if}

	<h2>Directions</h2>
	<ol class="list-decimal list-inside">
		{#each recipe.directions as dir (dir.id)}
			<li>
				{dir.body}
			</li>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingDirection) {
				newDirection = Direction.Empty();
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
					recipe.directions.push(newDirection);
					addingDirection = !addingDirection;
					newDirection = Direction.Empty();
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
					body: new URLSearchParams({ recipe: JSON.stringify(recipe), fileName })
				}).then(() => {
					saveResolve();
				});
			}}
		>
			Save
		</button>
	{/await}
</div>
