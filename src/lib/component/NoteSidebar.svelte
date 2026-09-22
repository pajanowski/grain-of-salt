<script lang="ts">
	/**
	 * Slide-out panel for inspecting and (optionally) editing a change's note.
	 *
	 * Two modes:
	 *  - Read-only (default): show the change context and note text, plus
	 *    a close button. Used by `RecipeHistory` to view a saved note.
	 *  - Editable: when `onsave` is provided, also show a textarea and
	 *    Save / Delete / Cancel buttons. Used by `NodeChanges` to add or
	 *    edit a note on the current leaf's changes.
	 *
	 * Save calls `onsave(draft)` and then `onclose`. Delete calls
	 * `ondelete` and then `onclose`. Cancel just calls `onclose`.
	 */

	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	export type SidebarChange = {
		id: string;
		kind: 'ingredient' | 'direction';
		changeType: 'add' | 'edit' | 'remove' | 'substitute';
		text: string;
	};

	type Props = {
		note: { change: SidebarChange; currentNote: string | null } | null;
		onclose: () => void;
		onsave?: (text: string) => void;
		ondelete?: () => void;
	};

	let { note, onclose, onsave, ondelete }: Props = $props();

	let draft = $state('');
	let open = $state(false);

	// Sync the sheet's open state with `note`. Bits UI Sheet renders
	// nothing when closed and mounts the panel + overlay when open, so we
	// drive the Sheet via this derived state.
	$effect(() => {
		if (note) {
			draft = note.currentNote ?? '';
			open = true;
		} else {
			open = false;
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
		const trimmed = draft.trim();
		onsave?.(trimmed.length > 0 ? trimmed : '');
		onclose();
	}

	function remove() {
		ondelete?.();
		onclose();
	}
</script>

<Sheet.Root bind:open onOpenChange={handleOpenChange}>
	<Sheet.Content side="right" class="w-96 max-w-full gap-0 p-0">
		<Sheet.Header class="bg-amber-300 px-4 py-3 rounded-none">
			<Sheet.Title class="text-base font-bold uppercase tracking-wide text-stone-900">
				{editable ? 'Edit note' : 'Note'}
			</Sheet.Title>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
			<!-- The change the note is attached to, shown as a quote. -->
			<blockquote class="border-l-4 border-amber-300 pl-3 italic opacity-90">
				{note?.change.text}
			</blockquote>

			<p class="text-xs opacity-50 uppercase tracking-wide">
				{note?.change.kind} · {note?.change.changeType}
			</p>

			<hr class="opacity-20" />

			{#if editable}
				<textarea
					class="border rounded px-2 py-1 text-sm w-full"
					rows="6"
					bind:value={draft}
					placeholder="Write a note about this change…"
				></textarea>
				<div class="flex gap-2 mt-1">
					<Button type="button" onclick={commit} data-testid="note-confirm">Confirm</Button>
					{#if note?.currentNote && ondelete}
						<Button
							type="button"
							variant="outline"
							class="text-red-700"
							onclick={remove}
							data-testid="note-delete"
						>
							Delete
						</Button>
					{/if}
					<Button type="button" variant="outline" onclick={onclose}>Cancel</Button>
				</div>
			{:else}
				<p class="whitespace-pre-wrap text-base leading-relaxed">
					{note?.currentNote ?? '(no note)'}
				</p>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
