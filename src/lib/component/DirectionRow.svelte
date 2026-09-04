<script lang="ts">
	import type { Direction } from '$lib/obj/Recipe.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

	type Props = {
		direction: Direction;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Direction) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
	};

	let { direction, index, total, note, onNote, onUpdate, onRemove, onMove }: Props = $props();

	let editing = $state(false);
	let draft = $state<Direction>({ ...direction });

	function startEdit() {
		draft = { ...direction };
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	function saveEdit() {
		onUpdate({ ...draft });
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove this direction?`)) {
			onRemove();
		}
	}

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
			class="flex flex-col gap-2 flex-1"
			onsubmit={(e) => {
				e.preventDefault();
				saveEdit();
			}}
		>
			<textarea
				class="border rounded px-2 py-1 w-full"
				rows="3"
				bind:value={draft.body}
			></textarea>
			<div class="flex gap-2">
				<button
					type="submit"
					class="px-2 py-1 text-sm rounded border hover:bg-gray-100">Save</button
				>
				<button
					type="button"
					class="px-2 py-1 text-sm rounded border hover:bg-gray-100"
					onclick={cancelEdit}>Cancel</button
				>
			</div>
		</form>
	{:else}
		<span class="flex-1">
			<span class="opacity-60 mr-2">{index + 1}.</span>
			{direction.body}
		</span>
	<ContextMenu {items} label={`Actions for direction ${index + 1}`} />
	{#if note}
		<button
			type="button"
			class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
			aria-label="Edit note"
			title={note}
			onclick={onNote}
			data-testid="direction-note-button"
		>
			📝
		</button>
	{/if}
{/if}
</li>
