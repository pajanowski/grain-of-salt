<script lang="ts">
	import type {
		IngredientChange,
		DirectionChange
	} from '$lib/obj/RecipeNode.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import NoteSidebar, { type SidebarChange } from './NoteSidebar.svelte';

	/**
	 * The current node's changes, rendered inline beneath the recipe editor.
	 *
	 * For each change we compute an "unsaved" indicator by diffing the
	 * leaf's local changes against the server's snapshot of the node at
	 * page load. A change is "unsaved" if any of the following differ from
	 * the server's record with the same id:
	 *   - `changeType` (locally converted add↔edit↔remove)
	 *   - `body` (locally mutated in place)
	 *   - `note` (locally added, edited, or cleared)
	 * Or if the change's id is new (locally added).
	 *
	 * Saved changes get no badge — saved is the default. Only unsaved
	 * changes wear the marker.
	 *
	 * Each change row has a kebab menu with two actions:
	 *   - Add note / Edit note: opens the shared NoteSidebar in edit mode.
	 *   - Remove change: splices the change from the leaf's array. The
	 *     effect on the materialized recipe depends on the change's op
	 *     (add: row disappears; edit: reverts; remove: row resurfaces).
	 */

	type Props = {
		leafIngredientChanges: IngredientChange[];
		leafDirectionChanges: DirectionChange[];
		/** Server-stored snapshot at page load — used to compute saved/unsaved. */
		savedIngredientChanges: IngredientChange[];
		savedDirectionChanges: DirectionChange[];
		onRemoveIngredient: (changeId: string) => void;
		onRemoveDirection: (changeId: string) => void;
		onSetNote: (
			kind: 'ingredient' | 'direction',
			changeId: string,
			note: string | null
		) => void;
	};

	let {
		leafIngredientChanges,
		leafDirectionChanges,
		savedIngredientChanges,
		savedDirectionChanges,
		onRemoveIngredient,
		onRemoveDirection,
		onSetNote
	}: Props = $props();

	type AnnotatedChange<T extends IngredientChange | DirectionChange> = {
		change: T;
		kind: 'ingredient' | 'direction';
		status: 'saved' | 'unsaved';
	};

	function bodyMatches(a: unknown, b: unknown): boolean {
		if (a === b) return true;
		if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
		return JSON.stringify(a) === JSON.stringify(b);
	}

	function diffStatus<T extends IngredientChange | DirectionChange>(
		change: T,
		savedById: Map<string, T>
	): 'saved' | 'unsaved' {
		const prior = savedById.get(change.id);
		if (!prior) return 'unsaved';
		if (prior.changeType !== change.changeType) return 'unsaved';
		if (!bodyMatches(prior.body, change.body)) return 'unsaved';
		if ((prior.note ?? null) !== (change.note ?? null)) return 'unsaved';
		return 'saved';
	}

	let savedIngById = $derived(new Map(savedIngredientChanges.map((c) => [c.id, c])));
	let savedDirById = $derived(new Map(savedDirectionChanges.map((c) => [c.id, c])));

	let annotated = $derived.by<AnnotatedChange<IngredientChange | DirectionChange>[]>(() => {
		const items: AnnotatedChange<IngredientChange | DirectionChange>[] = [];
		for (const c of leafIngredientChanges) {
			items.push({ change: c, kind: 'ingredient', status: diffStatus(c, savedIngById) });
		}
		for (const c of leafDirectionChanges) {
			items.push({ change: c, kind: 'direction', status: diffStatus(c, savedDirById) });
		}
		// Unsaved first; saved keep insertion order. Stable for unchanged inputs.
		return items.sort((a, b) => (a.status === b.status ? 0 : a.status === 'unsaved' ? -1 : 1));
	});

	function labelFor(item: AnnotatedChange<IngredientChange | DirectionChange>): string {
		const c = item.change;
		if (c.changeType === 'remove') return item.kind;
		if (!c.body) return item.kind;
		if (item.kind === 'ingredient') {
			const ing = c.body as { name: string; amount?: number; unit?: string };
			const parts = [ing.name];
			if (ing.amount) parts.push(String(ing.amount));
			if (ing.unit) parts.push(ing.unit);
			return parts.join(' ');
		}
		const dir = c.body as { body: string };
		return dir.body || '(empty)';
	}

	function changeText(item: AnnotatedChange<IngredientChange | DirectionChange>): string {
		const c = item.change;
		const label = labelFor(item);
		if (c.changeType === 'add') return `+ ${label}`;
		if (c.changeType === 'remove') return `− ${label}`;
		return `~ ${label}`;
	}

	// Note editor — single open-at-a-time. State lives here so the
	// NoteSidebar instance mounted by this component can be controlled.
	let openEditor = $state<{
		change: SidebarChange;
		kind: 'ingredient' | 'direction';
		changeId: string;
		currentNote: string | null;
	} | null>(null);

	function openNoteEditor(item: AnnotatedChange<IngredientChange | DirectionChange>) {
		openEditor = {
			change: {
				id: item.change.id,
				kind: item.kind,
				changeType: item.change.changeType,
				text: changeText(item)
			},
			kind: item.kind,
			changeId: item.change.id,
			currentNote: item.change.note
		};
	}

	function closeEditor() {
		openEditor = null;
	}

	function saveEditorNote(text: string) {
		if (!openEditor) return;
		onSetNote(openEditor.kind, openEditor.changeId, text.length > 0 ? text : null);
	}

	function deleteEditorNote() {
		if (!openEditor) return;
		onSetNote(openEditor.kind, openEditor.changeId, null);
	}

	function menuItems(
		item: AnnotatedChange<IngredientChange | DirectionChange>
	): MenuItem[] {
		const hasNote = !!item.change.note;
		return [
			{
				label: hasNote ? 'Edit note' : 'Add note',
				onSelect: () => openNoteEditor(item)
			},
			{
				label: 'Remove change',
				danger: true,
				onSelect: () =>
					item.kind === 'ingredient'
						? onRemoveIngredient(item.change.id)
						: onRemoveDirection(item.change.id)
			}
		];
	}
</script>

<section
	class="mt-4 border-t pt-3"
	aria-label="Changes on this node"
	data-testid="node-changes"
>
	<header class="flex items-baseline justify-between mb-2">
		<h2 class="text-base font-semibold">Changes on this node</h2>
		<span class="text-xs opacity-60">{annotated.length} change{annotated.length === 1 ? '' : 's'}</span>
	</header>

	{#if annotated.length === 0}
		<p class="text-sm opacity-60 italic">No changes yet. Use the form above to add or edit.</p>
	{:else}
		<ol class="flex flex-col gap-1 list-none p-0" data-testid="node-changes-list">
			{#each annotated as item (item.change.id)}
				<li
					class="flex items-center gap-2 border rounded px-2 py-1"
					data-change-id={item.change.id}
					data-status={item.status}
				>
					<span
						class="text-sm flex-1 truncate"
						class:text-green-700={item.change.changeType === 'add'}
						class:text-amber-700={item.change.changeType === 'edit'}
						class:text-red-700={item.change.changeType === 'remove'}
					>
						{changeText(item)}
					</span>

					{#if item.change.note}
						<span
							class="text-xs opacity-70 italic max-w-[18rem] truncate"
							title={item.change.note}
						>
							📝 {item.change.note}
						</span>
					{/if}

					{#if item.status === 'unsaved'}
						<span
							class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
							data-status="unsaved"
						>
							unsaved
						</span>
					{/if}

					<ContextMenu
						items={menuItems(item)}
						label={`Actions for change ${item.change.id}`}
					/>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<NoteSidebar
	note={openEditor}
	onclose={closeEditor}
	onsave={saveEditorNote}
	ondelete={deleteEditorNote}
/>
