<script lang="ts">
	import {
		EmptyIngredient,
		EmptyDirection,
		type Ingredient,
		type Direction
	} from '$lib/obj/Recipe.svelte';
	import type { IngredientChange, DirectionChange } from '$lib/obj/RecipeNode.svelte';
	import { v4 as uuid } from 'uuid';
	import { parseAmount } from '$lib/parseAmount';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Modal from './Modal.svelte';
	import NodeChanges from './NodeChanges.svelte';
	import NoteSidebar, { type SidebarChange } from './NoteSidebar.svelte';
	import { invalidateAll, goto, invalidate } from '$app/navigation';
	import { api, errorMessage } from '$lib/api';

	const { data } = $props();

	let recipe = $derived(data.recipe);
	let currentNode = $derived(data.currentNode);
	let rootNodeId = $derived(recipe.id);

	let leafIngredientChanges = $state<IngredientChange[]>([]);
	let leafDirectionChanges = $state<DirectionChange[]>([]);

	let syncedNodeId = $state<string | null>(null);
	$effect(() => {
		if (currentNode.id !== syncedNodeId) {
			leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
			leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
			syncedNodeId = currentNode.id;
		}
	});

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

	function editIngredient(rowId: string, next: Ingredient) {
		const record = leafRecordForIngredient(rowId);
		if (record && record.body) {
			record.body = { ...next };
		} else {
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
			leafIngredientChanges.splice(idx, 1);
		} else {
			leafIngredientChanges.push({
				id: uuid(),
				changeType: 'remove',
				targetId: rowId,
				note: null,
				body: null
			});
		}
	}
	function moveIngredient(rowId: string, direction: 'up' | 'down') {
		const currentIdx = displayedIngredients.findIndex((i) => i.id === rowId);
		if (currentIdx < 0) return;
		const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
		if (targetIdx < 0 || targetIdx >= displayedIngredients.length) return;

		// Build the reordered visible list by swapping current and target
		const reordered = [...displayedIngredients];
		[reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];

		// Rebuild leafIngredientChanges so the server applies them in the new order.
		// For ingredients that already have an 'add' in this node, reuse the record
		// (with a fresh UUID so the server accepts it as a new entry).
		// For ingredients that originated in an ancestor, emit a fresh 'add'.
		leafIngredientChanges = reordered.map((ing) => {
			const existing = currentNode.ingredientChanges.find(
				(c) => c.changeType === 'add' && c.body?.id === ing.id
			);
			if (existing) {
				return { ...existing, id: uuid() };
			}
			return {
				id: uuid(),
				changeType: 'add' as const,
				targetId: null,
				note: null,
				body: { ...ing }
			};
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
	function moveDirection(rowId: string, direction: 'up' | 'down') {
		const currentIdx = displayedDirections.findIndex((d) => d.id === rowId);
		if (currentIdx < 0) return;
		const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
		if (targetIdx < 0 || targetIdx >= displayedDirections.length) return;

		const reordered = [...displayedDirections];
		[reordered[currentIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[currentIdx]];

		leafDirectionChanges = reordered.map((dir) => {
			const existing = currentNode.directionChanges.find(
				(c) => c.changeType === 'add' && c.body?.id === dir.id
			);
			if (existing) {
				return { ...existing, id: uuid() };
			}
			return {
				id: uuid(),
				changeType: 'add' as const,
				targetId: null,
				note: null,
				body: { ...dir }
			};
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

	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let amountError = $state<string | null>(null);
	let amountRaw = $state('');
	let newIngredient = $state(EmptyIngredient());
	let newDirection = $state(EmptyDirection());

	function doAddIngredient() {
		const amtResult = parseAmount(amountRaw);
		if (amtResult.error) {
			amountError = amtResult.error;
			return;
		}
		amountError = null;
		addIngredient({ ...newIngredient, amount: amtResult.value! });
		newIngredient = EmptyIngredient();
		amountRaw = '';
		requestAnimationFrame(() => {
			(document.querySelector('[data-add-ingredient-name]') as HTMLInputElement | null)?.focus();
		});
	}

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
		api
			.put(`/mise/api/recipe-node/${currentNode.id}`, {
				nodeId: currentNode.id,
				ingredientChanges: leafIngredientChanges,
				directionChanges: leafDirectionChanges
			})
			.then(async () => {
				await invalidateAll();
				syncedNodeId = null;
			})
			.catch((e) => {
				alert(`Save failed: ${errorMessage(e)}`);
			});
	}

	function performReset() {
		leafIngredientChanges = JSON.parse(JSON.stringify(currentNode.ingredientChanges));
		leafDirectionChanges = JSON.parse(JSON.stringify(currentNode.directionChanges));
	}

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
			await api.patch(`/mise/api/recipe/${rootNodeId}`, { name: trimmed });
			await invalidate('app:recipe-tree');
			showRenameModal = false;
		} catch (e) {
			alert(`Rename failed: ${errorMessage(e)}`);
		} finally {
			renameBusy = false;
		}
	}

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
			const { data: newRecipe } = await api.post<{ id: string }>(
				`/mise/api/recipe/${currentNode.id}/fork`,
				{ name: trimmed }
			);
			showForkModal = false;
			await invalidate('app:recipe-tree');
			await goto(`/mise/recipes/${newRecipe.id}`);
		} catch (e) {
			alert(`Fork failed: ${errorMessage(e)}`);
		} finally {
			forkBusy = false;
		}
	}

	async function confirmDelete() {
		if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
		const res = await fetch(`/mise/api/recipe/${rootNodeId}`, { method: 'DELETE' });
		if (!res.ok) {
			alert(`Delete failed: ${res.status} ${res.statusText}`);
			return;
		}
		await invalidate('app:recipe-tree');
		await goto('/mise');
	}

	let shareLinkCopied = $state(false);
	async function togglePublic() {
		const next = !currentNode.isPublic;
		try {
			await api.patch(`/mise/api/recipe-node/${currentNode.id}/public`, {
				isPublic: next
			});
			await invalidateAll();
		} catch (e) {
			alert(`Failed to update visibility: ${errorMessage(e)}`);
		}
	}
	async function copyShareLink() {
		const url = `${window.location.origin}/recipe/${currentNode.id}`;
		await navigator.clipboard.writeText(url);
		shareLinkCopied = true;
		setTimeout(() => (shareLinkCopied = false), 2000);
	}

	const menuItems: MenuItem[] = $derived([
		{ label: 'Rename recipe', onSelect: openRename },
		{ label: 'Fork recipe', onSelect: openFork },
		{ label: currentNode.isPublic ? 'Make private' : 'Make public', onSelect: togglePublic },
		{ label: 'Delete recipe', onSelect: confirmDelete, danger: true }
	]);
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	<!-- Recipe header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<a
				href="/mise/recipes/{data.currentNode.id}/graph"
				class="flex items-center gap-1 rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-stone-600 hover:border-stone-400 hover:bg-stone-100"
				title="View recipe graph"
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<circle cx="8" cy="3" r="1.5" />
					<circle cx="3" cy="13" r="1.5" />
					<circle cx="13" cy="13" r="1.5" />
					<line x1="8" y1="4.5" x2="3" y2="11.5" />
					<line x1="8" y1="4.5" x2="13" y2="11.5" />
				</svg>
			Graph
		</a>
		</div>
		<div>
			<h1 class="text-2xl font-bold">{recipe.name}</h1>
			{#if data.currentNode.author}
				<p class="text-sm text-stone-500">by {data.currentNode.author}</p>
			{/if}
			{#if data.currentNode.source}
				<p class="text-sm text-stone-400">via {data.currentNode.source}</p>
			{/if}
			{#if data.currentNode.isPublic}
				<p class="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
					<a
						href="/recipe/{data.currentNode.id}"
						target="_blank"
						rel="noopener noreferrer"
						class="underline hover:text-stone-600"
					>
						/recipe/{data.currentNode.id}
					</a>
					<button
						type="button"
						class="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-xs hover:bg-stone-100"
						onclick={copyShareLink}
					>
						{shareLinkCopied ? 'Copied!' : 'Copy'}
					</button>
				</p>
			{/if}
		</div>
		<ContextMenu items={menuItems} label="Recipe actions" />
	</div>

	<!-- Ingredients -->
	<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-stone-100 px-4 py-3">
			<h2 class="font-semibold text-stone-800">Ingredients</h2>
			<button
				class="btn-amber secondary flex items-center gap-1.5 text-sm"
				onclick={() => {
						if (!addingIngredient) {
							newIngredient = EmptyIngredient();
							amountRaw = '';
							amountError = null;
						}
						addingIngredient = !addingIngredient;
						if (addingIngredient) {
							requestAnimationFrame(() => {
								(document.querySelector('[data-add-ingredient-name]') as HTMLInputElement | null)?.focus();
							});
						}
						}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<line x1="12" x2="12" y1="5" y2="19" />
					<line x1="5" x2="19" y1="12" y2="12" />
				</svg>
				Add
			</button>
		</div>

		<div class="p-4">
			<ol class="flex flex-col divide-y divide-stone-100" data-testid="ingredient-list">
				{#each displayedIngredients as ing, i (ing.id)}
					<li class="py-3 first:pt-0 last:pb-0">
						<IngredientRow
							ingredient={ing}
							index={i}
							total={displayedIngredients.length}
							note={ingredientNoteFor(ing.id)}
							onNote={() => openRowNote(ing.id, 'ingredient')}
							onUpdate={(next) => editIngredient(ing.id, next)}
							onRemove={() => removeIngredient(ing.id)}
							onMove={(dir) => moveIngredient(ing.id, dir)}
						/>
					</li>
				{/each}
			</ol>

			{#if addingIngredient}
				<form class="mt-3 flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-3" onkeydown={(e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
						e.preventDefault();
						doAddIngredient();
					}
				}}>
					<input
						class="border rounded px-3 py-2"
						placeholder="Ingredient name"
						aria-label="Ingredient name"
						data-add-ingredient-name
						bind:value={newIngredient.name}
					/>
					<div class="flex gap-2">
						<input
							class="border rounded px-3 py-2 w-24"
							placeholder="Amount (e.g. 1/3, 1 1/2)"
							type="text"
							inputmode="numeric"
							bind:value={amountRaw}
						/>
						<input
							class="border rounded px-3 py-2 flex-1"
							placeholder="Unit"
							bind:value={newIngredient.unit}
						/>
					</div>
					{#if amountError}
						<p class="text-sm text-red-600">{amountError}</p>
					{/if}
					<div class="flex gap-2">
						<button
							class="btn-amber"
							onclick={doAddIngredient}>Add</button
						>
						<button
							type="button"
							class="btn-amber secondary"
							onclick={() => (addingIngredient = false)}>Cancel</button
						>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<!-- Directions -->
	<section class="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-stone-100 px-4 py-3">
			<h2 class="font-semibold text-stone-800">Directions</h2>
			<button
				class="btn-amber secondary flex items-center gap-1.5 text-sm"
				onclick={() => {
						if (!addingDirection) newDirection = EmptyDirection();
						addingDirection = !addingDirection;
						if (addingDirection) {
							requestAnimationFrame(() => {
								(document.querySelector('[data-add-direction-body]') as HTMLTextAreaElement | null)?.focus();
							});
						}
					}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<line x1="12" x2="12" y1="5" y2="19" />
					<line x1="5" x2="19" y1="12" y2="12" />
				</svg>
				Add
			</button>
		</div>

		<div class="p-4">
			<ol class="flex flex-col divide-y divide-stone-100" data-testid="direction-list">
				{#each displayedDirections as dir, i (dir.id)}
					<li class="py-3 first:pt-0 last:pb-0">
						<DirectionRow
							direction={dir}
							index={i}
							total={displayedDirections.length}
							note={directionNoteFor(dir.id)}
							onNote={() => openRowNote(dir.id, 'direction')}
							onUpdate={(next) => editDirection(dir.id, next)}
							onRemove={() => removeDirection(dir.id)}
							onMove={(moveDir) => moveDirection(dir.id, moveDir)}
						/>
					</li>
				{/each}
			</ol>

			{#if addingDirection}
				<form class="mt-3 flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-3" onkeydown={(e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
						e.preventDefault();
						addDirection(newDirection);
						newDirection = EmptyDirection();
						requestAnimationFrame(() => {
							(document.querySelector('[data-add-direction-body]') as HTMLTextAreaElement | null)?.focus();
						});
					}
				}}>
					<textarea
						class="border rounded px-3 py-2 w-full"
						rows="3"
						placeholder="Direction"
						aria-label="Direction"
						data-add-direction-body
						bind:value={newDirection.body}></textarea>
					<div class="flex gap-2">
						<button
							class="btn-amber"
							onclick={() => {
								addDirection(newDirection);
								newDirection = EmptyDirection();
								requestAnimationFrame(() => {
									(document.querySelector('[data-add-direction-body]') as HTMLTextAreaElement | null)?.focus();
								});
							}}>Add</button
						>
						<button
							type="button"
							class="btn-amber secondary"
							onclick={() => (addingDirection = false)}>Cancel</button
						>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<!-- Unsaved changes bar -->
	{#if hasUnsavedChanges}
		<div
			class="sticky bottom-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-md"
		>
			<span class="text-sm font-medium text-amber-900">Unsaved changes</span>
			<div class="flex gap-2">
				<button type="button" class="btn-amber secondary" onclick={performReset}>Reset</button>
				<button type="button" class="btn-amber" onclick={performSave}>Save</button>
			</div>
		</div>
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
</div>

<Modal bind:showModal={showRenameModal}>
	{#snippet header()}<h2 class="font-semibold">Rename recipe</h2>{/snippet}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			confirmRename();
		}}
	>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">New name</span>
			<input bind:value={renameName} aria-label="New recipe name" />
		</label>
		<div class="mt-3 flex gap-2">
			<button type="submit" class="btn-amber" disabled={renameBusy}
				>{renameBusy ? 'Saving…' : 'Save'}</button
			>
			<button type="button" class="btn-amber secondary" onclick={() => (showRenameModal = false)}
				>Cancel</button
			>
		</div>
	</form>
</Modal>

<Modal bind:showModal={showForkModal}>
	{#snippet header()}<h2 class="font-semibold">Fork recipe</h2>{/snippet}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			confirmFork();
		}}
	>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Fork name</span>
			<input bind:value={forkName} aria-label="Forked recipe name" />
		</label>
		<div class="mt-3 flex gap-2">
			<button type="submit" class="btn-amber" disabled={forkBusy}
				>{forkBusy ? 'Forking…' : 'Fork'}</button
			>
			<button type="button" class="btn-amber secondary" onclick={() => (showForkModal = false)}
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
