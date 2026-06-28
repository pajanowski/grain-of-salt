<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import RecipeList from '$lib/component/RecipeList.svelte';

	let { data, children } = $props();
	const recipes = data.recipes;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex flex-row gap-4 p-4">
	<RecipeList {recipes} />
	{@render children()}
</div>
