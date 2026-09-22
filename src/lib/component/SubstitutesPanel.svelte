<script lang="ts">
	import type { DescendantSubstitute } from '$lib/types/descendantSubstitute';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	/**
	 * Slide-out side bar listing the descendant substitute changes
	 * authored for a specific ingredient or direction row.
	 *
	 * Triggered by clicking the "Subs: N" chip rendered next to the
	 * row's note icon. Backdrop click, Escape, or the X button all
	 * close it. The opener is responsible for setting `selection`;
	 * this component just renders the panel when selection is
	 * non-null.
	 */
	type Props = {
		/**
		 * Which row the user clicked on, or null when the panel is
		 * closed. When `null`, the panel renders nothing (used as a
		 * sentinel for the open/close state in the parent).
		 */
		selection: { rowId: string; kind: 'ingredient' | 'direction'; rowLabel: string } | null;
		/** Descendant substitutes grouped by their `targetId`. */
		byRowId: Record<string, DescendantSubstitute[]>;
		onclose: () => void;
	};

	let { selection, byRowId, onclose }: Props = $props();

	let open = $state(false);

	// Sync the sheet's open state with `selection`.
	$effect(() => {
		open = selection !== null;
	});

	/** Substitutes for the currently selected row, or empty list. */
	const substitutes = $derived(selection ? (byRowId[selection.rowId] ?? []) : []);

	function handleOpenChange(next: boolean) {
		if (!next) {
			open = false;
			onclose();
		}
	}
</script>

<Sheet.Root bind:open onOpenChange={handleOpenChange}>
	<Sheet.Content
		side="right"
		class="w-full max-w-sm gap-0 p-0"
		data-testid="substitutes-panel"
		showCloseButton={false}
	>
		<header
			class="flex items-start justify-between gap-2 px-4 py-3 border-b border-stone-200"
		>
			<div class="flex flex-col gap-1 min-w-0 flex-1">
				<h2 class="text-sm font-semibold text-stone-800">Descendant substitutes</h2>
				<p class="text-xs text-stone-500 break-words" data-testid="substitutes-row-label">
					for: <span class="font-medium text-stone-700">{selection?.rowLabel}</span>
				</p>
			</div>
			<button
				type="button"
				class="inline-flex items-center justify-center w-7 h-7 rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800"
				aria-label="Close"
				onclick={onclose}
				data-testid="substitutes-close"
			>
				<span aria-hidden="true">×</span>
			</button>
		</header>

		<div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" data-testid="substitutes-list">
			{#each substitutes as sub (sub.nodeId + ':' + sub.targetId + ':' + sub.changeType)}
				<article
					class="rounded border border-blue-200 bg-blue-50 p-3 flex flex-col gap-1"
					data-testid="substitute-entry"
				>
					<header class="flex items-baseline justify-between gap-2">
						<a
							class="text-sm font-medium text-blue-900 hover:underline"
							href="/mise/recipes/{sub.nodeSlug}"
							data-testid="substitute-source-link"
						>
							{sub.nodeName}
						</a>
						<span
							class="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-blue-200 text-blue-900"
						>
							{sub.changeType}
						</span>
					</header>
					<p class="text-xs text-blue-800 break-words" data-testid="substitute-text">{sub.text}</p>
				</article>
			{:else}
				<p class="text-sm text-stone-500 italic" data-testid="substitutes-empty">
					No descendant substitutes found for this row.
				</p>
			{/each}
		</div>
	</Sheet.Content>
</Sheet.Root>
