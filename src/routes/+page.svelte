<script lang="ts">
	import { Ingredient, Recipe } from '$lib/obj/Recipe.svelte.ts';
	const recipe = $state(new Recipe('Dough'));
	let addingIngredient = $state(false);
	let newIngredient = $state(Ingredient.Empty());
</script>

<div class="flex flex-col gap-2">
	<h1>Recipe: {recipe.name}</h1>
	<h2>Ingredients</h2>
	<div class="flex flex-col">
		{#each recipe.ingredients as ing (ing.id)}
			{ing.name} {ing.amount} {ing.unit}
		{/each}
	</div>
	<button
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
				onclick={() => {
					recipe.ingredients.push(newIngredient);
					addingIngredient = !addingIngredient;
					newIngredient = Ingredient.Empty();
				}}>Add</button
			>
		</form>
	{/if}
</div>
