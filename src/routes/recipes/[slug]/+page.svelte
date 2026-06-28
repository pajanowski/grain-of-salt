<script lang="ts">
	import Recipe from '$lib/component/Recipe.svelte';

	const { data } = $props();
</script>

<div class="max-w-200">
	<Recipe recipe={data.recipe} fileName={data.fileName} />
</div>
