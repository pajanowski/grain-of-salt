<script lang="ts">
	import RecipeDashboard from '$lib/component/RecipeDashboard.svelte';
	import RecipeList from '$lib/component/RecipeList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Grain of Salt</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-8">
	<RecipeDashboard dashboard={data.dashboard} favorites={data.favorites} />
	<RecipeList recipeTree={data.recipeTree} />
</div>
