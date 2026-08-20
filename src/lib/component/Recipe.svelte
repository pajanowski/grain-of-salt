<script lang="ts">
	import {
		EmptyDirection,
		EmptyIngredient,
		type Ingredient,
		type Direction
	} from '$lib/obj/Recipe.svelte';
	import IngredientRow from './IngredientRow.svelte';
	import DirectionRow from './DirectionRow.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import Modal from './Modal.svelte';
	import { invalidateAll, goto } from '$app/navigation';

	const { recipe } = $props();

	let recipeData = $state(JSON.parse(JSON.stringify(recipe)));

	$effect(() => {
		recipeData = JSON.parse(JSON.stringify(recipe));
	});

// recipeData.id is the root node id, which IS the recipe's identity.
const rootNodeId = $derived(recipeData.id);

	let addingIngredient = $state(false);
	let addingDirection = $state(false);
	let newIngredient = $state(EmptyIngredient());
	let newDirection = $state(EmptyDirection());
	let savePromise = $state(Promise.resolve());
	let saveResolve: (value: void) => void;

	// ---- rename modal state ----
	let showRenameModal = $state(false);
	let renameName = $state('');
	let renameBusy = $state(false);

	function openRename() {
		renameName = recipeData.name;
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
			showRenameModal = false;
			await invalidateAll();
		} finally {
			renameBusy = false;
		}
	}

	// ---- fork modal state ----
	let showForkModal = $state(false);
	let forkName = $state('');
	let forkBusy = $state(false);

	function openFork() {
		forkName = recipeData.name + ' (fork)';
		showForkModal = true;
	}

	async function confirmFork() {
		const trimmed = forkName.trim();
		if (!trimmed || forkBusy) return;
		forkBusy = true;
		try {
			const res = await fetch(`/api/recipe/${rootNodeId}/fork`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			if (!res.ok) {
				alert(`Fork failed: ${await res.text()}`);
				return;
			}
			const newRecipe = await res.json();
			console.log(JSON.stringify(newRecipe));
			showForkModal = false;
			await goto(`/recipes/${newRecipe.id}`);
		} catch (e) {
			alert(`Fork failed: ${(e as Error).message}`);
		} finally {
			forkBusy = false;
		}
	}

	// ---- delete ----
	async function confirmDelete() {
		if (!confirm(`Delete "${recipeData.name}"? This cannot be undone.`)) return;
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

	// ---- per-row mutation handlers -----------------------------------------

	function updateIngredientAt(index: number, next: Ingredient) {
		recipeData.ingredients[index] = next;
	}

	function removeIngredientAt(index: number) {
		recipeData.ingredients.splice(index, 1);
	}

	function moveIngredient(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= recipeData.ingredients.length) return;
		const arr = recipeData.ingredients;
		[arr[index], arr[target]] = [arr[target], arr[index]];
	}

	function updateDirectionAt(index: number, next: Direction) {
		recipeData.directions[index] = next;
	}

	function removeDirectionAt(index: number) {
		recipeData.directions.splice(index, 1);
	}

	function moveDirection(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= recipeData.directions.length) return;
		const arr = recipeData.directions;
		[arr[index], arr[target]] = [arr[target], arr[index]];
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<h1>Recipe: {recipeData.name}</h1>
		<ContextMenu items={menuItems} label="Recipe actions" />
	</div>

	<h2>Ingredients</h2>
	<ol class="list-decimal list-inside" data-testid="ingredient-list">
		{#each recipeData.ingredients as ing, i (ing.id)}
			<IngredientRow
				ingredient={ing}
				index={i}
				total={recipeData.ingredients.length}
				onUpdate={(next) => updateIngredientAt(i, next)}
				onRemove={() => removeIngredientAt(i)}
				onMove={(dir) => moveIngredient(i, dir)}
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
					recipeData.ingredients.push(newIngredient);
					addingIngredient = !addingIngredient;
					newIngredient = EmptyIngredient();
				}}>Add</button
			>
		</form>
	{/if}

	<h2>Directions</h2>
	<ol class="list-decimal list-inside" data-testid="direction-list">
		{#each recipeData.directions as dir, i (dir.id)}
			<DirectionRow
				direction={dir}
				index={i}
				total={recipeData.directions.length}
				onUpdate={(next) => updateDirectionAt(i, next)}
				onRemove={() => removeDirectionAt(i)}
				onMove={(dir) => moveDirection(i, dir)}
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
					recipeData.directions.push(newDirection);
					addingDirection = !addingDirection;
					newDirection = EmptyDirection();
				}}>Add</button
			>
		</form>
	{/if}

	{#await savePromise}
		<button type="submit" disabled>Save</button>
	{:then}
		<button
			type="button"
			onclick={() => {
				savePromise = new Promise((resolve) => (saveResolve = resolve));
				fetch('/api/save', {
					method: 'PUT',
					body: new URLSearchParams({
						recipe: JSON.stringify(recipeData)
					})
				}).then(async (res) => {
					if (!res.ok) {
						const msg = await res.text();
						alert(`Save failed: ${msg}`);
					} else {
						await invalidateAll();
					}
					saveResolve();
				});
			}}
		>
			Save
		</button>
	{/await}
</div>

<Modal bind:showModal={showRenameModal}>
	{#snippet header()}
		<h2>Rename recipe</h2>
	{/snippet}
	<form
		class="flex flex-col gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			confirmRename();
		}}
	>
		<label class="flex flex-col gap-1">
			Name
			<input
				data-testid="rename-name-input"
				bind:value={renameName}
				disabled={renameBusy}
				autocomplete="off"
			/>
		</label>
		<div class="flex gap-2 justify-end">
			<button
				type="button"
				data-testid="rename-cancel"
				onclick={() => (showRenameModal = false)}
				disabled={renameBusy}>Cancel</button
			>
			<button type="submit" data-testid="rename-save" disabled={!renameName.trim() || renameBusy}
				>Save</button
			>
		</div>
	</form>
</Modal>

<Modal bind:showModal={showForkModal}>
	{#snippet header()}
		<h2>Fork recipe</h2>
	{/snippet}
	<form
		class="flex flex-col gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			confirmFork();
		}}
	>
		<label class="flex flex-col gap-1">
			New recipe name
			<input
				data-testid="fork-name-input"
				bind:value={forkName}
				disabled={forkBusy}
				autocomplete="off"
			/>
		</label>
		<div class="flex gap-2 justify-end">
			<button
				type="button"
				data-testid="fork-cancel"
				onclick={() => (showForkModal = false)}
				disabled={forkBusy}>Cancel</button
			>
			<button type="submit" data-testid="fork-save" disabled={!forkName.trim() || forkBusy}
				>Save</button
			>
		</div>
	</form>
</Modal>
