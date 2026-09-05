<script lang="ts">
	import {
		EmptyIngredient,
		EmptyDirection,
		type Ingredient,
		type Direction
	} from '$lib/obj/Recipe.svelte';
	import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
	import { v4 as uuid } from 'uuid';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Modal from './Modal.svelte';
	import NodeChanges from './NodeChanges.svelte';
	import NoteSidebar, { type SidebarChange } from './NoteSidebar.svelte';
	import { invalidateAll, goto, invalidate } from '$app/navigation';

	const { data } = $props();

	// Materialized recipe (id = root, ingredients/directions = applied across
	// the full chain). The leaf being edited is `data.currentNode`.
	let recipe = $derived(data.recipe);
	let currentNode = $derived(data.currentNode);
	let rootNodeId = $derived(recipe.id);

	// The leaf node's change arrays. These are the wire payload — the server
	// replaces them on the row in place. See ADR 0001.
	let leafIngredientChanges = $state<IngredientChange[]>([]);
	let leafDirectionChanges = $state<DirectionChange[]>([]);

	// Resync local change arrays from the server when the editing node id
	// changes (initial load, navigation). On post-save invalidateAll, the id
	// is the same so no resync — last-saved state is preserved locally.
	let syncedNodeId = $state<string | null>(null);
	$effect(() => {
		if (currentNode.id !== syncedNodeId) {
			leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
			leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
			syncedNodeId = currentNode.id;
		}
	});

	// Displayed state = materialized state with the leaf's pending changes
	// applied optimistically. After save + invalidateAll, the materialized
	// state catches up and this derivation re-runs to match.
	let displayedIngredients = $derived.by(() => {
		const map = new Map<string, Ingredient>();
		for (const ing of recipe.ingredients) map.set(ing.id, ing);
		for (const c of leafIngredientChanges) {
			if (c.changeType === 'add' && c.body) map.set(c.body.id, c.body);
			else if (c.changeType === 'edit' && c.body && c.targetId) map.set(c.targetId, c.body);
			else if (c.changeType === 'remove' && c.targetId) map.delete(c.targetId);
		}
		return Array.from(map.values());
	});
	let displayedDirections = $derived.by(() => {
		const map = new Map<string, Direction>();
		for (const dir of recipe.directions) map.set(dir.id, dir);
		for (const c of leafDirectionChanges) {
			if (c.changeType === 'add' && c.body) map.set(c.body.id, c.body);
			else if (c.changeType === 'edit' && c.body && c.targetId) map.set(c.targetId, c.body);
			else if (c.changeType === 'remove' && c.targetId) map.delete(c.targetId);
		}
		return Array.from(map.values());
	});

	// ---- leaf-record lookup (Case A detection) ----
	function leafRecordForIngredient(rowId: string): IngredientChange | undefined {
		return leafIngredientChanges.find(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
	}
	function leafRecordForDirection(rowId: string): DirectionChange | undefined {
		return leafDirectionChanges.find(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
	}

	// ---- per-row handlers (Case A mutate / Case B push) ----
	function editIngredient(rowId: string, next: Ingredient) {
		const record = leafRecordForIngredient(rowId);
		if (record && record.body) {
			// Case A: mutate the existing change record in place; same id, same op.
			record.body = { ...next };
		} else {
			// Case B: push an edit on the leaf targeting the ancestor's add id.
			leafIngredientChanges.push({
				id: uuid(),
				changeType: 'edit',
				targetId: rowId,
				note: null,
				body: { ...next }
			});
		}
	}
	function removeIngredient(rowId: string) {
		const idx = leafIngredientChanges.findIndex(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
		if (idx >= 0) {
			// Case A: drop the leaf's record. If it was an add, the row is
			// gone (unless an ancestor also added it). If it was an edit,
			// the row falls back to whatever the ancestor chain produces.
			leafIngredientChanges.splice(idx, 1);
		} else {
			// Case B: push a remove targeting the ancestor's add id.
			leafIngredientChanges.push({
				id: uuid(),
				changeType: 'remove',
				targetId: rowId,
				note: null,
				body: null
			});
		}
	}
	function moveIngredient(rowId: string) {
		// Reorder = remove + add. The new add has a fresh id and lands at the
		// end of the apply order, so the row visually jumps to the end.
		const visible = displayedIngredients.find((i) => i.id === rowId);
		if (!visible) return;
		removeIngredient(rowId);
		leafIngredientChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { ...visible }
		});
	}
	function addIngredient(input: Ingredient) {
		leafIngredientChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { ...input }
		});
	}

	function editDirection(rowId: string, next: Direction) {
		const record = leafRecordForDirection(rowId);
		if (record && record.body) {
			record.body = { ...next };
		} else {
			leafDirectionChanges.push({
				id: uuid(),
				changeType: 'edit',
				targetId: rowId,
				note: null,
				body: { ...next }
			});
		}
	}
	function removeDirection(rowId: string) {
		const idx = leafDirectionChanges.findIndex(
			(c) =>
				(c.changeType === 'add' && c.body?.id === rowId) ||
				(c.changeType === 'edit' && c.targetId === rowId)
		);
		if (idx >= 0) {
			leafDirectionChanges.splice(idx, 1);
		} else {
			leafDirectionChanges.push({
				id: uuid(),
				changeType: 'remove',
				targetId: rowId,
				note: null,
				body: null
			});
		}
	}
	function moveDirection(rowId: string) {
		const visible = displayedDirections.find((d) => d.id === rowId);
		if (!visible) return;
		removeDirection(rowId);
		leafDirectionChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { ...visible }
		});
	}
	function addDirection(input: Direction) {
		leafDirectionChanges.push({
			id: uuid(),
			changeType: 'add',
			targetId: null,
			note: null,
			body: { ...input }
		});
	}

	// ---- add forms ----
	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let newIngredient = $state(EmptyIngredient());
	let newDirection = $state(EmptyDirection());

	// For each visible row, find the leaf's change record that "owns" it (the
	// latest change referencing this row's id). The note on that change is
	// what the recipe view should show inline; ancestor-owned notes are
	// reachable from the History section instead.
	function ingredientNoteFor(rowId: string): string | null {
		const c = leafIngredientChanges.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		return c?.note ?? null;
	}

	function directionNoteFor(rowId: string): string | null {
		const c = leafDirectionChanges.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		return c?.note ?? null;
	}

	// ---- per-row note editor ----
	// The row-level note button opens the same shared NoteSidebar as the
	// NodeChanges section. The sidebar is mounted at the bottom of this
	// component so the state lives here.
	let openRowNoteEditor = $state<{
		change: SidebarChange;
		kind: 'ingredient' | 'direction';
		changeId: string;
		currentNote: string | null;
	} | null>(null);

	function openRowNote(rowId: string, kind: 'ingredient' | 'direction') {
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find(
			(x) =>
				(x.changeType === 'add' && x.body?.id === rowId) ||
				((x.changeType === 'edit' || x.changeType === 'remove') && x.targetId === rowId)
		);
		if (!c) return;
		openRowNoteEditor = {
			change: {
				id: c.id,
				kind,
				changeType: c.changeType,
				text:
					kind === 'ingredient'
						? formatIngredient(c.body, c.changeType)
						: formatDirection(c.body, c.changeType)
			},
			kind,
			changeId: c.id,
			currentNote: c.note ?? null
		};
	}

	function closeRowNote() {
		openRowNoteEditor = null;
	}

	function commitRowNote(text: string) {
		if (!openRowNoteEditor) return;
		const { kind, changeId } = openRowNoteEditor;
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find((x) => x.id === changeId);
		if (c) c.note = text.length > 0 ? text : null;
	}

	function deleteRowNote() {
		if (!openRowNoteEditor) return;
		const { kind, changeId } = openRowNoteEditor;
		const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
		const c = arr.find((x) => x.id === changeId);
		if (c) c.note = null;
	}

	function formatIngredient(body: unknown, op: 'add' | 'edit' | 'remove'): string {
		if (op === 'remove') return 'ingredient';
		if (!body || typeof body !== 'object') return 'ingredient';
		const ing = body as { name?: string; amount?: number; unit?: string };
		const parts = [ing.name ?? ''];
		if (ing.amount) parts.push(String(ing.amount));
		if (ing.unit) parts.push(ing.unit);
		return parts.filter(Boolean).join(' ').trim() || 'ingredient';
	}

	function formatDirection(body: unknown, op: 'add' | 'edit' | 'remove'): string {
		if (op === 'remove') return 'direction';
		if (!body || typeof body !== 'object') return 'direction';
		const dir = body as { body?: string };
		return dir.body || '(empty)';
	}

	// ---- save / reset ----
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;

	// load. If anything differs (id, op, body, or note), the page has
	// unsaved changes. The check normalises array order so client-side
	// reordering doesn't trigger a false positive — we care about content,
	// not sequence.
	function snapshotKey(
		changes: { id: string; changeType: string; body: unknown; note: string | null }[]
	): string {
		return JSON.stringify(
			[...changes]
				.map((c) => ({ id: c.id, changeType: c.changeType, body: c.body, note: c.note }))
				.sort((a, b) => a.id.localeCompare(b.id))
		);
	}

	let hasUnsavedChanges = $derived(
		snapshotKey(leafIngredientChanges) !== snapshotKey(currentNode.ingredientChanges) ||
			snapshotKey(leafDirectionChanges) !== snapshotKey(currentNode.directionChanges)
	);

	function performSave() {
		if (!hasUnsavedChanges) return;
		savePromise = new Promise((resolve) => (saveResolve = resolve));
		fetch(`/api/recipe-node/${currentNode.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				nodeId: currentNode.id,
				ingredientChanges: leafIngredientChanges,
				directionChanges: leafDirectionChanges
			})
		}).then(async (res) => {
			if (!res.ok) {
				alert(`Save failed: ${await res.text()}`);
			} else {
				await invalidateAll();
				// Force the sync $effect to re-run. The server wrote the leaf's
				// change arrays, so data.currentNode carries the updated values.
				// Resetting syncedNodeId makes the effect re-copy them into the
				// leaf state vars — snapshotKey(leaf) === snapshotKey(server).
				syncedNodeId = null;
			}
			saveResolve();
		});
	}

	function performReset() {
		leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
		leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
	}

	// ---- rename modal state ----
	let showRenameModal = $state(false);
	let renameName = $state('');
	let renameBusy = $state(false);

	function openRename() {
		renameName = recipe.name;
		showRenameModal = true;
	}

	async function confirmRename() {
		const trimmed = renameName.trim();
		if (!trimmed || renameBusy) return;
		renameBusy = true;
		try {
			const res = await fetch(`/api/recipe/${rootNodeId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			if (!res.ok) {
				alert(`Rename failed: ${await res.text()}`);
				return;
			}
			await invalidate('app:recipe-tree');
			showRenameModal = false;
		} finally {
			renameBusy = false;
		}
	}

	// ---- fork modal state ----
	let showForkModal = $state(false);
	let forkName = $state('');
	let forkBusy = $state(false);

	function openFork() {
		forkName = recipe.name + ' (fork)';
		showForkModal = true;
	}

	async function confirmFork() {
		const trimmed = forkName.trim();
		if (!trimmed || forkBusy) return;
		forkBusy = true;
		try {
			const res = await fetch(`/api/recipe/${currentNode.id}/fork`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			if (!res.ok) {
				alert(`Fork failed: ${await res.text()}`);
				return;
			}
			const newRecipe = await res.json();
			showForkModal = false;
			await invalidate('app:recipe-tree');
			await goto(`/recipes/${newRecipe.id}`);
		} catch (e) {
			alert(`Fork failed: ${(e as Error).message}`);
		} finally {
			forkBusy = false;
		}
	}

	// ---- delete ----
	async function confirmDelete() {
		if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
		const res = await fetch(`/api/recipe/${rootNodeId}`, { method: 'DELETE' });
		if (!res.ok) {
			alert(`Delete failed: ${await res.text()}`);
			return;
		}
		await goto('/');
	}

	const menuItems: MenuItem[] = $derived([
		{ label: 'Rename recipe', onSelect: openRename },
		{ label: 'Fork recipe', onSelect: openFork },
		{ label: 'Delete recipe', onSelect: confirmDelete, danger: true }
	]);
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<h1>Recipe: {recipe.name}</h1>
		<ContextMenu items={menuItems} label="Recipe actions" />
	</div>

	<h2>Ingredients</h2>
	<ol class="list-decimal list-inside" data-testid="ingredient-list">
		{#each displayedIngredients as ing, i (ing.id)}
			<IngredientRow
				ingredient={ing}
				index={i}
				total={displayedIngredients.length}
				note={ingredientNoteFor(ing.id)}
				onNote={() => openRowNote(ing.id, 'ingredient')}
				onUpdate={(next) => editIngredient(ing.id, next)}
				onRemove={() => removeIngredient(ing.id)}
				onMove={(_dir) => moveIngredient(ing.id)}
			/>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingIngredient) {
				newIngredient = EmptyIngredient();
			}
			addingIngredient = !addingIngredient;
		}}>Add new ingredient</button
	>
	{#if addingIngredient}
		<form class="flex flex-col">
			<label>
				Name
				<input placeholder="Name" aria-label="Name" bind:value={newIngredient.name} />
			</label>
			<label>
				Amount
				<input placeholder="Amount" aria-label="Amount" bind:value={newIngredient.amount} />
			</label>
			<label>
				Unit
				<input placeholder="Unit" aria-label="Unit" bind:value={newIngredient.unit} />
			</label>
			<button
				type="button"
				onclick={() => {
					addIngredient(newIngredient);
					addingIngredient = !addingIngredient;
					newIngredient = EmptyIngredient();
				}}>Add</button
			>
		</form>
	{/if}

	<h2>Directions</h2>
	<ol class="list-decimal list-inside" data-testid="direction-list">
		{#each displayedDirections as dir, i (dir.id)}
			<DirectionRow
				direction={dir}
				index={i}
				total={displayedDirections.length}
				note={directionNoteFor(dir.id)}
				onNote={() => openRowNote(dir.id, 'direction')}
				onUpdate={(next) => editDirection(dir.id, next)}
				onRemove={() => removeDirection(dir.id)}
				onMove={(_dir) => moveDirection(dir.id)}
			/>
		{/each}
	</ol>
	<button
		class="flat-button"
		onclick={() => {
			if (!addingDirection) {
				newDirection = EmptyDirection();
			}
			addingDirection = !addingDirection;
		}}>Add new direction</button
	>
	{#if addingDirection}
		<form class="flex flex-col gap-2">
			<label>
				Body
				<input placeholder="Body" aria-label="Body" bind:value={newDirection.body} />
			</label>
			<button
				type="button"
				onclick={() => {
					addDirection(newDirection);
					addingDirection = !addingDirection;
					newDirection = EmptyDirection();
				}}>Add</button
			>
		</form>
	{/if}

	<NodeChanges
		{leafIngredientChanges}
		{leafDirectionChanges}
		savedIngredientChanges={currentNode.ingredientChanges}
		savedDirectionChanges={currentNode.directionChanges}
		onRemoveIngredient={(id) => {
			const idx = leafIngredientChanges.findIndex((c) => c.id === id);
			if (idx >= 0) leafIngredientChanges.splice(idx, 1);
		}}
		onRemoveDirection={(id) => {
			const idx = leafDirectionChanges.findIndex((c) => c.id === id);
			if (idx >= 0) leafDirectionChanges.splice(idx, 1);
		}}
		onSetNote={(kind, id, note) => {
			const arr = kind === 'ingredient' ? leafIngredientChanges : leafDirectionChanges;
			const change = arr.find((c) => c.id === id);
			if (change) change.note = note;
		}}
	/>

	{#await savePromise}
		<button type="submit" disabled>Saving…</button>
	{:then}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={performSave}
				disabled={!hasUnsavedChanges}
				data-testid="save-button">Save</button
			>
			<button
				type="button"
				class="flat-button"
				onclick={performReset}
				disabled={!hasUnsavedChanges}
				data-testid="reset-button">Reset</button
			>
		</div>
	{/await}
</div>

<Modal bind:showModal={showRenameModal}>
	{#snippet header()}
		<h2>Rename recipe</h2>
	{/snippet}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			confirmRename();
		}}
	>
		<label>
			Name
			<input bind:value={renameName} aria-label="New recipe name" />
		</label>
		<div class="flex gap-2 mt-2">
			<button type="submit" class="flat-button" disabled={renameBusy}>
				{renameBusy ? 'Saving…' : 'Save'}
			</button>
			<button type="button" class="flat-button" onclick={() => (showRenameModal = false)}
				>Cancel</button
			>
		</div>
	</form>
</Modal>

<Modal bind:showModal={showForkModal}>
	{#snippet header()}
		<h2>Fork recipe</h2>
	{/snippet}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			confirmFork();
		}}
	>
		<label>
			Name
			<input bind:value={forkName} aria-label="Forked recipe name" />
		</label>
		<div class="flex gap-2 mt-2">
			<button type="submit" class="flat-button" disabled={forkBusy}>
				{forkBusy ? 'Forking…' : 'Fork'}
			</button>
			<button type="button" class="flat-button" onclick={() => (showForkModal = false)}
				>Cancel</button
			>
		</div>
	</form>
</Modal>

<NoteSidebar
	note={openRowNoteEditor}
	onclose={closeRowNote}
	onsave={commitRowNote}
	ondelete={deleteRowNote}
/>
