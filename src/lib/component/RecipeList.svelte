<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	let { recipes } = $props();
</script>

<div class="flex flex-col">
	<h1><a href="/">Recipe List</a></h1>
	<ul>
		{#each recipes as rec}
			<div class="flex flex-row justify-between">
				<li>
					<a href="/recipes/{rec.id}">{rec.name}</a>
				</li>
				<button
					onclick={async () => {
						if (window.confirm(`Delete ${rec.name}`)) {
							await fetch(`/api/recipe/${rec.id}`, {
								method: 'DELETE'
							});
							invalidateAll();
						}
					}}>Delete</button
				>
			</div>
		{/each}
	</ul>
</div>
