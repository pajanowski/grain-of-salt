<script lang="ts">
	import Recipe from '$lib/component/Recipe.svelte';

	const { data } = $props();
	// console.log(data);
	let recipe = $derived(data.recipe);
</script>

<div class="max-w-200">
	<Recipe {recipe} />
</div>
