<script lang="ts">
	let { subtitle = '' }: { subtitle?: string } = $props();
</script>

<div class="flex flex-col items-center gap-1">
	<h1 class="text-5xl font-extrabold tracking-tight text-amber-400">Grain of Salt</h1>
	{#if subtitle}
		<p class="text-lg text-stone-400">{subtitle}</p>
	{/if}
</div>
