<script lang="ts">
	import type { Ingredient } from '$lib/obj/Recipe.svelte';
	import { formatAmount } from '$lib/formatAmount';
	import { parseAmount } from '$lib/parseAmount';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Tabs from './Tabs.svelte';
	import NoteIcon from './NoteIcon.svelte';
	import UnitAutocomplete from './UnitAutocomplete.svelte';
	import { normalizeUnit, displayUnit } from '$lib/unit';
	import type { DescendantSubstitute } from '$lib/types/descendantSubstitute';

	type Props = {
		ingredient: Ingredient;
		index: number;
		total: number;
		note: string | null;
		onNote: () => void;
		onUpdate: (next: Ingredient) => void;
		/**
		 * Save the edited value as a `substitute` change instead of an
		 * `edit` change. Same wire shape, distinct changeType label so the
		 * row renders with the blue SUB badge. The Save button picks
		 * between `onUpdate` and `onSubstitute` based on the menu item the
		 * user picked to open the form.
		 */
		onSubstitute?: (next: Ingredient) => void;
		/**
		 * When false, the "Substitute" menu item is rendered as disabled.
		 * Substitute is only valid on rows that the leaf has not already
		 * authored an `add` (fresh row the leaf owns), `edit`, or
		 * `substitute` change for — otherwise the operation would either
		 * be incoherent (subbing a row you just added) or redundant
		 * (stacking a substitute on top of an edit/substitute). Reorder-
		 * only `add` claims don't block substitute.
		 */
		canSubstitute?: boolean;
		onUpdateNote: (note: string | null) => void;
		onRemove: () => void;
		onMove: (direction: 'up' | 'down') => void;
		/**
		 * Descendant substitute changes authored by later nodes in the
		 * recipe chain that target this exact ingredient row. When the
		 * list is non-null (even an empty array), a "Subs: N" chip
		 * renders next to the note icon and clicking it opens the
		 * substitutes sidebar.
		 *
		 * `null` means the row has no descendant substitutes (chip hidden).
		 */
		descendantSubstitutes?: DescendantSubstitute[] | null;
		onOpenSubstitutes?: () => void;
		readOnly?: boolean;
		/**
		 * Which changeType to record when the row is saved via Edit or
		 * Substitute. The two menu items open the same form; the only
		 * difference is which changeType label the leaf emits on save.
		 * Defaults to 'edit'. Substitute uses this when its menu item is
		 * picked so the saved row renders with the blue SUB badge.
		 */
		changeType?: 'edit' | 'substitute';
	};

	let {
		ingredient,
		index,
		total,
		note,
		onNote,
		onUpdate,
		onSubstitute,
		canSubstitute = true,
		onUpdateNote,
		onRemove,
		onMove,
		descendantSubstitutes = null,
		onOpenSubstitutes,
		readOnly = false,
		changeType = 'edit'
	}: Props = $props();

	let editing = $state(false);
	let draft = $state<Ingredient>({ ...ingredient });
	let amountDraft = $state('');
	let amountError = $state<string | null>(null);
	let editTab = $state<'details' | 'note'>('details');
	let noteDraft = $state('');

	// Which changeType to emit on save. The Edit menu item leaves this as
	// 'edit'; the Substitute menu item flips it to 'substitute' for the
	// duration of the form, so the saved row gets the blue SUB badge.
	let saveChangeType = $state<'edit' | 'substitute'>('edit');

	function startEdit() {
		draft = { ...ingredient };
		amountDraft = ingredient.amount ? String(ingredient.amount) : '';
		amountError = null;
		noteDraft = note ?? '';
		editTab = 'details';
		saveChangeType = changeType;
		editing = true;
	}

	function startSubstitute() {
		startEdit();
		saveChangeType = 'substitute';
	}

	function cancelEdit() {
		editing = false;
	}

	function doEdit() {
		const amtResult = parseAmount(amountDraft);
		if (amtResult.error) {
			amountError = amtResult.error;
			return;
		}
		amountError = null;
		const normalizedUnit = normalizeUnit(draft.unit);
		// Pass through saveChangeType so the leaf's onUpdate can emit a
		// 'substitute' change instead of 'edit' when the user picked the
		// Substitute menu item. Recipe.svelte is the source of truth for
		// the wire shape and validation. If onSubstitute is not provided
		// (e.g. caller didn't wire it), fall back to onUpdate — the
		// changeType label is still preserved on save in Recipe.svelte.
		const handler = saveChangeType === 'substitute' ? (onSubstitute ?? onUpdate) : onUpdate;
		handler({
			...draft,
			amount: amtResult.value!,
			unit: normalizedUnit
		});
		const trimmedNote = noteDraft.trim();
		onUpdateNote(trimmedNote.length > 0 ? trimmedNote : null);
		editing = false;
	}

	function confirmRemove() {
		if (window.confirm(`Remove ingredient "${ingredient.name}"?`)) {
			onRemove();
		}
	}

	// Focus the name input when editing starts — avoids bind:this hydration issues
	$effect(() => {
		if (editing && editTab === 'details') {
			requestAnimationFrame(() => {
				(document.querySelector('[data-editing-ingredient]') as HTMLInputElement)?.focus();
			});
		}
	});

	const items: MenuItem[] = $derived([
		{ label: 'Edit', onSelect: startEdit },
		...(canSubstitute
			? [{ label: 'Substitute' as const, onSelect: startSubstitute }]
			: []),
		{
			label: 'Move up',
			disabled: index === 0,
			onSelect: () => onMove('up')
		},
		{
			label: 'Move down',
			disabled: index === total - 1,
			onSelect: () => onMove('down')
		},
		{ label: 'Remove', onSelect: confirmRemove, danger: true }
	]);
</script>

<li
	class="flex items-start gap-2"
	class:items-center={!note || !readOnly}
	data-testid="ingredient-row"
	data-ingredient-name={ingredient.name}
>
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
				<input
					class="border rounded px-3 py-2"
					placeholder="Ingredient name"
					aria-label="Ingredient name"
					data-editing-ingredient
					bind:value={draft.name}
				/>
				<div class="flex gap-2">
					<input
						class="border rounded px-3 py-2 w-24"
						placeholder="Amount (e.g. 1/3, 1 1/2)"
						type="text"
						inputmode="numeric"
						bind:value={amountDraft}
					/>

					<UnitAutocomplete value={draft.unit} onchange={(u) => (draft.unit = u)} />
				</div>
				{#if amountError}
					<p class="text-sm text-red-600">{amountError}</p>
				{/if}
			{:else}
				<textarea
					class="border rounded px-3 py-2 text-sm w-full"
					rows="3"
					placeholder="Optional note for this ingredient…"
					aria-label="Note"
					bind:value={noteDraft}></textarea>
			{/if}
			<div class="flex gap-2">
				<button type="button" class="btn-amber" onclick={doEdit}>Save</button>
				<button type="button" class="btn-amber secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</form>
	{:else}
		<!-- read-only + editable ingredient row, optionally with note below -->
		<div class="flex flex-col gap-1 flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<span class="flex-1 flex items-center min-w-0">
					<span class="opacity-60 mr-2">{index + 1}.</span>
					<span>{ingredient.name}</span>
					<span class="opacity-60 ml-1">{formatAmount(ingredient.amount)}</span>
					<span class="opacity-60 ml-1">{displayUnit(ingredient.unit, ingredient.amount)}</span>
				</span>
			{#if note && !readOnly}
				<button
					type="button"
					class="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 shrink-0"
					title={note}
					aria-label="Edit note"
					onclick={onNote}
					data-testid="ingredient-note-button"
				>
					<NoteIcon />
				</button>
			{/if}
			{#if descendantSubstitutes && descendantSubstitutes.length > 0}
				<button
					type="button"
					class="inline-flex items-center gap-1 px-2 h-5 text-xs rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 shrink-0"
					title={`${descendantSubstitutes.length} descendant substitute${descendantSubstitutes.length === 1 ? "" : "s"} available`}
					aria-label="View descendant substitutes"
					onclick={onOpenSubstitutes}
					data-testid="substitutes-chip"
				>
					Subs: {descendantSubstitutes.length}
				</button>
			{/if}
		</div>
			{#if note && readOnly}
				<p class="flex items-center gap-1.5 text-sm text-stone-500 italic pl-5" title={note}>
					<NoteIcon />
					{note}
				</p>
			{/if}
		</div>
		{#if !readOnly}
			<ContextMenu {items} label={`Actions for ${ingredient.name}`} />
		{/if}
	{/if}
</li>
