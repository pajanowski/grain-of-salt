<script lang="ts">
	let { recipes } = $props();
</script>

<div class="flex flex-col">
	<h1><a href="/">Recipe List</a></h1>
	<ul>
		{#each recipes as rec}
			<li>
				<a href="/recipes/{rec.id}">{rec.name}</a>
			</li>
		{/each}
	</ul>
</div>
