<script lang="ts">
	import { EmptyDirection, EmptyIngredient, type Ingredient, type Direction } from '$lib/obj/Recipe.svelte';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';
	import { invalidateAll } from '$app/navigation';

	const { recipe } = $props();

	let recipeData = $state(JSON.parse(JSON.stringify(recipe)));

	$effect(() => {
		recipeData = JSON.parse(JSON.stringify(recipe));
	});
	// recipeData.id is the root node id; recipeData.recipeId is the FK
	// into the recipes table that updateRecipeState expects.
	const rootNodeId = recipeData.id;
	const recipeId = recipeData.recipeId;
	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let newIngredient = $state(EmptyIngredient());
	let newDirection = $state(EmptyDirection());
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;

	// ---- per-row mutation handlers -----------------------------------------
	// These mutate recipeData in place; the global Save button below
	// commits the whole recipe state in one PUT.

	function updateIngredientAt(index: number, next: Ingredient) {
		recipeData.ingredients[index] = next;
	}

	function removeIngredientAt(index: number) {
		recipeData.ingredients.splice(index, 1);
	}

	function moveIngredient(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= recipeData.ingredients.length) return;
		const arr = recipeData.ingredients;
		[arr[index], arr[target]] = [arr[target], arr[index]];
	}

	function updateDirectionAt(index: number, next: Direction) {
		recipeData.directions[index] = next;
	}

	function removeDirectionAt(index: number) {
		recipeData.directions.splice(index, 1);
	}

	function moveDirection(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= recipeData.directions.length) return;
		const arr = recipeData.directions;
		[arr[index], arr[target]] = [arr[target], arr[index]];
	}
</script>

<div class="flex flex-col gap-2">
	<h1>Recipe: {recipeData.name}</h1>
	<h2>Ingredients</h2>

	<ol class="list-decimal list-inside">
		{#each recipeData.ingredients as ing, i (ing.id)}
			<IngredientRow
				ingredient={ing}
				index={i}
				total={recipeData.ingredients.length}
				onUpdate={(next) => updateIngredientAt(i, next)}
				onRemove={() => removeIngredientAt(i)}
				onMove={(dir) => moveIngredient(i, dir)}
			/>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingIngredient) {
				newIngredient = EmptyIngredient();
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
					newIngredient = EmptyIngredient();
				}}>Add</button
			>
		</form>
	{/if}

	<h2>Directions</h2>
	<ol class="list-decimal list-inside">
		{#each recipeData.directions as dir, i (dir.id)}
			<DirectionRow
				direction={dir}
				index={i}
				total={recipeData.directions.length}
				onUpdate={(next) => updateDirectionAt(i, next)}
				onRemove={() => removeDirectionAt(i)}
				onMove={(dir) => moveDirection(i, dir)}
			/>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingDirection) {
				newDirection = EmptyDirection();
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
					newDirection = EmptyDirection();
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
					body: new URLSearchParams({
						recipe: JSON.stringify(recipeData),
						recipeId,
						rootNodeId,
					})
				}).then(async (res) => {
					if (!res.ok) {
						const msg = await res.text();
						alert(`Save failed: ${msg}`);
					} else {
						// Refresh the page so the new history entry and the
						// updated recipe state are visible.
						await invalidateAll();
					}
					saveResolve();
				});
			}}
		>
			Save
		</button>
	{/await}
</div>
