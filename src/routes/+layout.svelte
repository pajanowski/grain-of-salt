<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import RecipeList from '$lib/component/RecipeList.svelte';
	import { api, errorMessage } from '$lib/api';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();

	let sidebarCollapsed = $state(false);
	let createRecipe = $state(false);
	let newRecipeName = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	let importRecipe = $state(false);
	let importUrl = $state('');
	let importUrlInputEl = $state<HTMLInputElement | null>(null);
	let importLoading = $state(false);
	let importError = $state<string | null>(null);

	$effect(() => {
		if (createRecipe && inputEl) {
			inputEl.focus();
		}
	});

	$effect(() => {
		if (importRecipe && importUrlInputEl) {
			importUrlInputEl.focus();
		}
	});

	function handleCreate() {
		if (!newRecipeName.trim()) return;
		api
			.post('/api/save', new URLSearchParams({ recipeName: newRecipeName }))
			.then(() => {
				newRecipeName = '';
				createRecipe = false;
				invalidateAll();
			})
			.catch((e) => {
				alert(`Create failed: ${errorMessage(e)}`);
			});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleCreate();
		if (e.key === 'Escape') {
			newRecipeName = '';
			createRecipe = false;
		}
	}

	function importKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleImport();
		if (e.key === 'Escape') {
			importUrl = '';
			importRecipe = false;
		}
	}

	function handleImport() {
		if (!importUrl.trim()) return;
		importLoading = true;
		importError = null;

		// Step 1: client fetches the URL directly (bypasses server-side bot detection)
		// Step 2: send HTML + URL to server for parsing
		fetch(importUrl, {
			signal: AbortSignal.timeout(10_000),
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			}
		})
			.then((res) => {
				if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
				return res.text();
			})
			.then((html) => api.post('/api/import', { url: importUrl, html }))
			.catch(() => {
				// CORS or fetch failed — fall back to server-side fetch
				return api.post('/api/import', { url: importUrl });
			})
			.then(() => {
				importUrl = '';
				importError = null;
				importRecipe = false;
				invalidateAll();
			})
			.catch((e) => {
				importError = errorMessage(e);
			})
			.finally(() => {
				importLoading = false;
			});
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen w-screen overflow-hidden">
	<!-- Collapsed strip -->
	{#if sidebarCollapsed}
		<div
			class="flex h-full w-12 shrink-0 flex-col items-center border-r border-stone-200 bg-stone-100 py-4 shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
		>
			<button
				class="secondary flex h-10 w-10 items-center justify-center rounded-lg"
				onclick={() => {
					sidebarCollapsed = false;
				}}
				aria-label="Expand recipe list"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-6 w-6"
					aria-hidden="true"
				>
					<rect width="18" height="18" x="3" y="3" rx="2" />
					<path d="M9 3v18" />
				</svg>
			</button>

			<div class="mt-auto flex flex-col items-center gap-2">
				{#if !data.user}
					<a
						href="/auth"
						class="secondary flex h-10 w-10 items-center justify-center rounded-lg"
						aria-label="Sign in"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-5 w-5"
							aria-hidden="true"
						>
							<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
							<polyline points="10 17 15 12 10 7" />
							<line x1="15" x2="3" y1="12" y2="12" />
						</svg>
					</a>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Full sidebar -->
	{#if !sidebarCollapsed}
		<aside
			class="flex h-full w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100 shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
		>
			<!-- Sidebar header -->
			<div class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
				<span class="font-semibold text-stone-700">Grain of Salt</span>
				<button
					class="secondary flex h-10 w-10 items-center justify-center rounded-lg"
					onclick={() => {
						sidebarCollapsed = true;
					}}
					aria-label="Collapse recipe list"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-6 w-6"
						aria-hidden="true"
					>
						<line x1="4" x2="20" y1="12" y2="12" />
						<line x1="4" x2="20" y1="6" y2="6" />
						<line x1="4" x2="20" y1="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
				<RecipeList recipeTree={data.recipeTree} />

				{#if createRecipe}
					<div class="rounded-lg border border-stone-300 bg-stone-50 p-4 shadow-sm">
						<p class="mb-3 font-semibold text-stone-800">New Recipe</p>
						<div class="flex flex-col gap-3">
							<input
								bind:this={inputEl}
								bind:value={newRecipeName}
								onkeydown={handleKeydown}
								placeholder="Recipe name"
								class="text-sm"
							/>
							<div class="flex gap-2">
								<button onclick={handleCreate}>Create</button>
								<button
									class="secondary"
									onclick={() => {
										newRecipeName = '';
										createRecipe = false;
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<button onclick={() => (createRecipe = true)} class="flex items-center gap-2">
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
						Create Recipe
					</button>
				{/if}

				{#if importRecipe}
					<div class="rounded-lg border border-stone-300 bg-stone-50 p-4 shadow-sm">
						<p class="mb-3 font-semibold text-stone-800">Import from URL</p>
						<div class="flex flex-col gap-3">
							<input
								bind:this={importUrlInputEl}
								bind:value={importUrl}
								onkeydown={importKeydown}
								placeholder="https://example.com/recipe"
								disabled={importLoading}
								class="text-sm"
							/>
							{#if importError}
								<p class="text-xs text-red-600">{importError}</p>
							{/if}
							<div class="flex gap-2">
								<button onclick={handleImport} disabled={importLoading}>
									{importLoading ? 'Importing…' : 'Import'}
								</button>
								<button
									class="secondary"
									disabled={importLoading}
									onclick={() => {
										importUrl = '';
										importError = null;
										importRecipe = false;
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<button
						onclick={() => (importRecipe = true)}
						class="flex items-center gap-2"
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
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" x2="12" y1="15" y2="3" />
						</svg>
						Import from URL
					</button>
				{/if}
			</div>

			<!-- Auth footer -->
			<div class="border-t border-stone-200 p-4">
			{#if data.user}
				<div class="flex flex-col gap-2">
					<span class="text-xs text-stone-500">Signed in as {data.user.email}</span>
					<a
						href="/me"
						class="secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
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
							<circle cx="12" cy="8" r="4" />
							<path d="M6 20c0-4 2.7-6 6-6s6 2 6 6" />
						</svg>
						Profile
					</a>
					<form method="POST" action="/auth?/logout" use:enhance>
						<button type="submit" class="secondary w-full text-sm">Sign out</button>
					</form>
				</div>
			{:else}
					<a
						href="/auth"
						class="secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
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
							<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
							<polyline points="10 17 15 12 10 7" />
							<line x1="15" x2="3" y1="12" y2="12" />
						</svg>
						Sign in
					</a>
				{/if}
			</div>
		</aside>
	{/if}

	<!-- Main content -->
	<main class="min-w-0 flex-1 overflow-y-auto bg-white">
		{@render children()}
	</main>
	<style>
	/* Override global button { padding: 0.5rem } for expand/collapse — icon fills the button */
	button[aria-label='Expand recipe list'],
	button[aria-label='Collapse recipe list'] {
		padding: 0;
	}
	</style>
</div>
