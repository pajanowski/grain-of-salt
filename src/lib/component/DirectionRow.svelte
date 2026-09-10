<script lang="ts">
	import type { Direction } from '$lib/obj/Recipe.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Tabs from './Tabs.svelte';

	type Props = {
		direction: Direction;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Direction) => void;
		onUpdateNote: (note: string | null) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
		readOnly?: boolean;
	};

	let {
		direction,
		index,
		total,
		note,
		onNote,
		onUpdate,
		onUpdateNote,
		onRemove,
		onMove,
		readOnly = false
	}: Props = $props();

	let editing = $state(false);
	let draft = $state<Direction>({ ...direction });
	let editTab = $state<'details' | 'note'>('details');
	let noteDraft = $state('');

	function startEdit() {
		draft = { ...direction };
		noteDraft = note ?? '';
		editTab = 'details';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	function doEdit() {
		onUpdate({ ...draft });
		const trimmedNote = noteDraft.trim();
		onUpdateNote(trimmedNote.length > 0 ? trimmedNote : null);
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove this direction?`)) {
			onRemove();
		}
	}

	// Focus the textarea when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing && editTab === 'details') {
			requestAnimationFrame(() => {
				(document.querySelector('[data-editing-direction]') as HTMLTextAreaElement)?.focus();
			});
		}
	});

	const items: MenuItem[] = $derived([
		{ label: 'Edit', onSelect: startEdit },
		{
			label: 'Move up',
			disabled: index === 0,
			onSelect: () => onMove('up'),
		},
		{
			label: 'Move down',
			disabled: index === total - 1,
			onSelect: () => onMove('down'),
		},
		{ label: 'Remove', onSelect: confirmRemove, danger: true },
	]);
</script>

<li class="flex items-start gap-2" data-testid="direction-row" data-direction-index={index}>
	{#if editing}
		<form
			class="flex flex-col gap-2 flex-1 rounded border border-stone-200 bg-stone-50 p-3"
			onkeydown={(e) => {
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					e.preventDefault();
					doEdit();
				}
			}}
		>
			<Tabs
				tabs={[
					{ id: 'details', label: 'Details' },
					{ id: 'note', label: noteDraft.length > 0 ? 'Note ●' : 'Note' }
				]}
				selected={editTab}
				onchange={(id) => (editTab = id)}
			/>
			{#if editTab === 'details'}
				<textarea
					class="border rounded px-3 py-2 w-full"
					rows="3"
					placeholder="Direction"
					aria-label="Direction"
					data-editing-direction
					bind:value={draft.body}
				></textarea>
			{:else}
				<textarea
					class="border rounded px-3 py-2 text-sm w-full"
					rows="3"
					placeholder="Optional note for this direction…"
					aria-label="Note"
					bind:value={noteDraft}
				></textarea>
			{/if}
			<div class="flex gap-2">
				<button type="button" class="btn-amber" onclick={doEdit}>Save</button>
				<button type="button" class="btn-amber secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</form>
	{:else}
		<span class="flex-1">
			<span class="opacity-60 mr-2">{index + 1}.</span>
			{direction.body}
		</span>
		{#if note}
			<button
				type="button"
				class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 self-center"
				title={note}
				aria-label="Edit note"
				onclick={onNote}
				data-testid="direction-note-button"
			>
				📝
			</button>
		{/if}
		{#if !readOnly}
			<ContextMenu {items} label={`Actions for direction ${index + 1}`} />
		{/if}
	{/if}
</li>
