<script lang="ts">
	import type { RecipeNode } from '$lib/obj/RecipeNode.svelte';
	import { formatChain, nodeDisplayLabel, formatTimestamp, type FormattedChange } from '$lib/obj/recipeDiff';
	import NoteSidebar from './NoteSidebar.svelte';

	const { history }: { history: RecipeNode[] } = $props();

	let entries = $derived(formatChain(history));

	type OpenNote = { text: string; change: FormattedChange };
	let openNote = $state<OpenNote | null>(null);
</script>

<section class="flex flex-col gap-3 mt-4">
	<h2>History</h2>

	{#if history.length === 0}
		<p>No history yet.</p>
	{:else}
		<ol class="flex flex-col gap-2 list-none p-0">
			{#each entries as entry, i (entry.node.id)}
				<li class="border rounded p-2">
					<header class="flex justify-between items-baseline">
						<strong>{nodeDisplayLabel(entry.node, i)}</strong>
						<small class="opacity-70">{formatTimestamp(entry.node.timestamp)}</small>
					</header>

					{#if entry.changes.length === 0}
						<p class="opacity-60 italic">(no changes)</p>
					{:else}
						<ul class="mt-1 pl-4 list-disc">
							{#each entry.changes as c, j (j)}
								<li class="flex items-start gap-2">
									<span
										class:text-green-700={c.changeType === 'add'}
										class:text-amber-700={c.changeType === 'edit'}
										class:text-red-700={c.changeType === 'remove'}>{c.text}</span
									>
									{#if c.note}
										<button
											type="button"
											class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
											aria-label="Show note"
											title="Show note"
											onclick={() => (openNote = { text: c.note, change: c })}
										>
											📝
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<NoteSidebar note={openNote} onclose={() => (openNote = null)} />
