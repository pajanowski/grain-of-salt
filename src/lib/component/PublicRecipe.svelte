<script lang="ts">
	import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';

	type Props = {
		recipe: {
			name: string;
			ingredients: Ingredient[];
			directions: Direction[];
		};
		currentNode: {
			author: string | null;
			source: string | null;
			isPublic: boolean;
		};
	};

	let { recipe, currentNode }: Props = $props();
</script>

<svelte:head>
	<title>{recipe.name}{currentNode.author ? ` by ${currentNode.author}` : ''}</title>
	<meta name="description" content="{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}, {recipe.directions.length} step{recipe.directions.length === 1 ? '' : 's'}{currentNode.source ? ` · Source: ${currentNode.source}` : ''}" />
	<meta property="og:title" content={recipe.name} />
	<meta property="og:description" content="{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}, {recipe.directions.length} step{recipe.directions.length === 1 ? '' : 's'}" />
	<meta property="og:type" content="article" />
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
	<!-- Recipe header: name, author, source. No graph button, no context menu. -->
	<div>
		<h1 class="text-2xl font-bold">{recipe.name}</h1>
		{#if currentNode.author}
			<p class="text-sm text-stone-500">by {currentNode.author}</p>
		{/if}
		{#if currentNode.source}
			<p class="text-sm text-stone-400">via {currentNode.source}</p>
		{/if}
	</div>

	<!-- Ingredients section -->
	{#if recipe.ingredients.length > 0}
		<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
			<div class="border-b border-stone-100 px-4 py-3">
				<h2 class="font-semibold text-stone-800">Ingredients</h2>
			</div>
			<div class="p-4">
				<ol class="flex flex-col divide-y divide-stone-100" data-testid="ingredient-list">
					{#each recipe.ingredients as ing, i (ing.id)}
						<li class="py-3 first:pt-0 last:pb-0">
							<IngredientRow
									ingredient={ing}
									index={i}
									total={recipe.ingredients.length}
									note={null}
									onNote={() => {}}
									onUpdate={() => {}}
									onUpdateNote={() => {}}
									onRemove={() => {}}
									onMove={() => {}}
									readOnly={true}
								/>
						</li>
					{/each}
				</ol>
			</div>
		</section>
	{/if}

	<!-- Directions section -->
	{#if recipe.directions.length > 0}
		<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
			<div class="border-b border-stone-100 px-4 py-3">
				<h2 class="font-semibold text-stone-800">Directions</h2>
			</div>
			<div class="p-4">
				<ol class="flex flex-col divide-y divide-stone-100" data-testid="direction-list">
					{#each recipe.directions as dir, i (dir.id)}
						<li class="py-3 first:pt-0 last:pb-0">
							<DirectionRow
									direction={dir}
									index={i}
									total={recipe.directions.length}
									note={null}
									onNote={() => {}}
									onUpdate={() => {}}
									onUpdateNote={() => {}}
									onRemove={() => {}}
									onMove={() => {}}
									readOnly={true}
								/>
						</li>
					{/each}
				</ol>
			</div>
		</section>
	{/if}

	<!-- Sign-in CTA for forks -->
	<p class="text-sm text-stone-500">
		<a href="/auth" class="underline hover:text-stone-700">Sign in to fork</a> this recipe.
	</p>
</div>
