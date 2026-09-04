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

	export type SidebarChange = {
		id: string;
		kind: 'ingredient' | 'direction';
		changeType: 'add' | 'edit' | 'remove';
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

	// Reset the draft whenever a new note opens. Without this the textarea
	// would carry over the previous note's text after the user closed it
	// without saving.
	$effect(() => {
		if (note) {
			draft = note.currentNote ?? '';
		} else {
			draft = '';
		}
	});

	const editable = $derived(!!onsave);

	function handleKeydown(e: KeyboardEvent) {
		if (!note) return;
		if (e.key === 'Escape') onclose();
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

<svelte:window onkeydown={handleKeydown} />
{#if note}
	<!--
		Backdrop: clicking outside the panel closes it.
	-->
	<aside
		class="fixed top-0 right-0 h-full w-96 max-w-full bg-white shadow-2xl z-50 flex flex-col"
		aria-label="Change note"
	>
		<header class="bg-amber-300 px-4 py-3 flex justify-between items-center shrink-0">
			<h2 class="text-base font-bold uppercase tracking-wide">
				{editable ? 'Edit note' : 'Note'}
			</h2>
			<button
				type="button"
				class="text-sm font-bold opacity-70 hover:opacity-100"
				aria-label="Close"
				onclick={onclose}>X</button
			>
		</header>

		<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
			<!-- The change the note is attached to, shown as a quote. -->
			<blockquote class="border-l-4 border-amber-300 pl-3 italic opacity-90">
				{note.change.text}
			</blockquote>

			<p class="text-xs opacity-50 uppercase tracking-wide">
				{note.change.kind} · {note.change.changeType}
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
					<button
						type="button"
						class="flat-button"
						onclick={commit}
						data-testid="note-confirm"
					>
						Confirm
					</button>
					{#if note.currentNote && ondelete}
						<button
							type="button"
							class="flat-button text-red-700"
							onclick={remove}
							data-testid="note-delete"
						>
							Delete
						</button>
					{/if}
					<button
						type="button"
						class="flat-button"
						onclick={onclose}
					>
						Cancel
					</button>
				</div>
			{:else}
				<p class="whitespace-pre-wrap text-base leading-relaxed">
					{note.currentNote ?? '(no note)'}
				</p>
			{/if}
		</div>
	</aside>
{/if}
