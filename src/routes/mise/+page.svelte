<script lang="ts">
	import RecipeDashboard from '$lib/component/RecipeDashboard.svelte';
	import RecipeList from '$lib/component/RecipeList.svelte';
	import { isDemoMode } from '$lib/demo-init';
	import { demoStore, demoNodes } from '$lib/recipe-store.demo';

	let { data } = $props();

	let demoDashboard = $state<any[]>([]);
	let demoFavorites = $state<any[]>([]);
	let demoTree = $state<any[]>([]);

	$effect(() => {
		if (data.demoMode || isDemoMode) {
			const unsub = demoNodes.subscribe(async () => {
				demoDashboard = await demoStore.getDashboard(5);
				demoFavorites = await demoStore.getFavorites(5);
				demoTree = await demoStore.listTree();
			});
			return () => unsub();
		}
	});

	let activeDashboard = $derived(data.demoMode || isDemoMode ? demoDashboard : data.dashboard);
	let activeFavorites = $derived(data.demoMode || isDemoMode ? demoFavorites : data.favorites);
	let activeTree = $derived(data.demoMode || isDemoMode ? demoTree : data.recipeTree);
</script>

<svelte:head>
	<title>Grain of Salt</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-8">
	<RecipeDashboard dashboard={activeDashboard} favorites={activeFavorites} />
	<RecipeList recipeTree={activeTree} />
</div>
