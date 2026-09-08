<script>
	import GrainOfSaltTitle from '$lib/component/GrainOfSaltTitle.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>Grain of Salt</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-8">
	<GrainOfSaltTitle subtitle="Version Control | IDE | Documentation for Recipes" />
	<a
		href={data.signedIn ? '/mise' : '/auth'}
		class="rounded-lg border-2 border-amber-700 bg-amber-300 px-8 py-3 text-lg font-semibold text-amber-950 shadow-md transition-colors hover:bg-amber-400 active:bg-amber-500"
	>
		{data.signedIn ? 'Open the App' : 'Sign in'}
	</a>
</div>
