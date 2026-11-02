<script lang="ts">
 import type { Ingredient, Direction } from '$lib/obj/Recipe.svelte';
 import IngredientRow from './IngredientRow.svelte';
 import DirectionRow from './DirectionRow.svelte';
 import { invalidateAll } from '$app/navigation';
 import { toggleRecipeFavorite, errorMessage } from '$lib/api';

 type Props = {
 	recipe: {
 		name: string;
 		ingredients: Ingredient[];
 		directions: Direction[];
 	};
 	currentNode: {
 		id: string;
 		author: string | null;
 		source: string | null;
 		isPublic: boolean;
 		isFavorite?: boolean;
 	};
 	isSignedIn?: boolean;
 };

 let { recipe, currentNode, isSignedIn = false }: Props = $props();

 let isFavorite = $state(false);

 $effect(() => {
 	isFavorite = Boolean(currentNode.isFavorite);
 });

 async function handleFavoriteClick() {
 	if (!isSignedIn) {
 		const nextUrl = encodeURIComponent(`/recipe/${currentNode.id}`);
 		window.location.href = `/auth?next=${nextUrl}`;
 		return;
 	}

 	const prev = isFavorite;
 	isFavorite = !prev;
 	try {
 		isFavorite = await toggleRecipeFavorite(currentNode.id);
 		await invalidateAll();
 	} catch (e) {
 		isFavorite = prev;
 		alert(`Failed to update favorite: ${errorMessage(e)}`);
 	}
 }
</script>

<svelte:head>
	<title>{recipe.name}{currentNode.author ? ` by ${currentNode.author}` : ''}</title>
	<meta
		name="description"
		content="{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1
			? ''
			: 's'}, {recipe.directions.length} step{recipe.directions.length === 1
			? ''
			: 's'}{currentNode.source ? ` · Source: ${currentNode.source}` : ''}"
	/>
	<meta property="og:title" content={recipe.name} />
	<meta
		property="og:description"
		content="{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1
			? ''
			: 's'}, {recipe.directions.length} step{recipe.directions.length === 1 ? '' : 's'}"
	/>
	<meta property="og:type" content="article" />
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
	<!-- Recipe header: name, author, source. No graph button, no context menu. -->
	<div>
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<button
				type="button"
				onclick={handleFavoriteClick}
				class="p-0.5 rounded transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
				aria-label={isFavorite ? 'Unfavorite recipe' : 'Favorite recipe'}
				data-testid="recipe-favorite-star"
			>
				<svg
					class="h-6 w-6 transition-colors {isFavorite ? 'fill-amber-400 stroke-amber-500' : 'fill-none stroke-stone-400 hover:stroke-amber-400'}"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polygon
						points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
					/>
				</svg>
			</button>
			<span>{recipe.name}</span>
		</h1>
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
								note={ing.note ?? null}
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
								note={dir.note ?? null}
								onNote={() => {}}
								onUpdate={() => {}}
								onUpdateNote={() => {}}
								onRemove={() => {}}
								onMove={() => {}}
								readOnly={true}
								ingredients={recipe.ingredients}
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
