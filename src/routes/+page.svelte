<script>
	let { data } = $props();
</script>

<svelte:head>
	<title>Grain of Salt</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-8">
	<div class="flex flex-col items-center gap-1">
		<h1 class="text-5xl font-extrabold tracking-tight text-amber-400">Grain of Salt</h1>
		<p class="text-lg text-stone-400">Version Control | Documentation for Recipes</p>
	</div>
	<a
		href={data.signedIn ? '/mise' : '/auth'}
		class="rounded-lg border-2 border-amber-700 bg-amber-300 px-8 py-3 text-lg font-semibold text-amber-950 shadow-md transition-colors hover:bg-amber-400 active:bg-amber-500"
	>
		{data.signedIn ? 'Open the App' : 'Sign in'}
	</a>
</div>
