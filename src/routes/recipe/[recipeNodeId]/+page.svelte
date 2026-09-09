<script lang="ts">
	import PublicRecipe from '$lib/component/PublicRecipe.svelte';

	const { data } = $props();
</script>

<PublicRecipe recipe={data.recipe} currentNode={data.currentNode} />
