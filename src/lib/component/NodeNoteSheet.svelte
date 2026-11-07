<script lang="ts">
	/**
	 * Slide-out panel for viewing and (optionally) editing a recipe node's
	 * note — the freeform, node-level note, not a per-change note (that is
	 * `NoteSidebar`).
	 *
	 * Two modes:
	 *  - Read-only (default): show the note text plus a close button. Used
	 *    by `PublicRecipe` to view a node's note.
	 *  - Editable: when `onsave` is provided, also show a textarea and
	 *    Save / Delete / Cancel buttons. Used by `Recipe` on the private
	 *    page.
	 *
	 * The parent controls visibility via `bind:open`; closing always calls
	 * `onclose` so the parent can sync its state.
	 */
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	type Props = {
		/** The node's current note. Drives the read-only text and the draft. */
		note: string | null;
		open?: boolean;
		onclose: () => void;
		onsave?: (text: string) => void;
		ondelete?: () => void;
	};

	let { note, open = $bindable(false), onclose, onsave, ondelete }: Props = $props();

	let draft = $state('');

	// Re-seed the draft each time the panel opens, so stale edits from a
	// previous session don't leak into the next one.
	$effect(() => {
		if (open) {
			draft = note ?? '';
		}
	});

	const editable = $derived(!!onsave);

	function handleOpenChange(next: boolean) {
		if (!next) {
			open = false;
			onclose();
		}
	}

	function commit() {
		onsave?.(draft.trim());
		open = false;
		onclose();
	}

	function remove() {
		ondelete?.();
		open = false;
		onclose();
	}
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
	<Sheet.Content side="right" class="w-96 max-w-full gap-0 p-0">
		<Sheet.Header class="bg-amber-300 px-4 py-3 rounded-none">
			<Sheet.Title class="text-base font-bold uppercase tracking-wide text-stone-900">
				{editable ? 'Edit note' : 'Note'}
			</Sheet.Title>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
			{#if editable}
				<textarea
					class="border rounded px-2 py-1 text-sm w-full"
					rows="6"
					bind:value={draft}
					placeholder="Write a note about this recipe…"
					data-testid="node-note-input"
				></textarea>
				<div class="flex gap-2 mt-1">
					<Button type="button" onclick={commit} data-testid="node-note-confirm">Confirm</Button>
					{#if note && ondelete}
						<Button
							type="button"
							variant="outline"
							class="text-red-700"
							onclick={remove}
							data-testid="node-note-delete"
						>
							Delete
						</Button>
					{/if}
					<Button
						type="button"
						variant="outline"
						onclick={() => {
							open = false;
							onclose();
						}}
						data-testid="node-note-cancel"
					>
						Cancel
					</Button>
				</div>
			{:else}
				<p class="whitespace-pre-wrap text-base leading-relaxed" data-testid="node-note-text">
					{note ?? '(no note)'}
				</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
