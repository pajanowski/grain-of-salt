<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	let displayName = $state(data.displayName ?? '');
	let saved = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let seeding = $state(false);
	let seedMsg = $state<{ ok: boolean; msg: string } | null>(null);

	function handleSave() {
		saved = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => { saved = false; }, 2000);
	}

	async function seedRecipes() {
		seeding = true;
		seedMsg = null;
		try {
			const res = await fetch('/mise/api/seed', { method: 'POST' });
			const json = await res.json() as { ok: boolean; error?: string };
			if (json.ok) {
				seedMsg = { ok: true, msg: 'Sample recipes seeded! Reload to see them.' };
			} else {
				seedMsg = { ok: false, msg: json.error ?? 'Seed failed' };
			}
		} catch {
			seedMsg = { ok: false, msg: 'Network error — is the server running?' };
		} finally {
			seeding = false;
		}
	}
</script>

<svelte:head>
	<title>Me · Grain of Salt</title>
</svelte:head>

<div class="mx-auto mt-12 max-w-md px-4 sm:px-6">
	<h1 class="mb-4 text-2xl font-semibold">Account</h1>
	<form method="POST" use:enhance={() => {
		return async ({ update }) => {
			await update();
			handleSave();
		};
	}}>
		<div class="mb-4 flex items-center gap-3">
			<label for="displayName" class="text-sm text-gray-500">Display name</label>
			<input
				id="displayName"
				name="displayName"
				type="text"
				class="flex-1 rounded border border-stone-300 px-3 py-2"
				bind:value={displayName}
			/>
			<button
				type="submit"
				class="rounded bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700"
			>
				Save
			</button>
		</div>
		{#if saved}
			<p class="text-sm text-green-600">Saved</p>
		{/if}
	</form>
	<dl class="mt-8 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
		<dt class="text-gray-500">Email</dt>
		<dd>{data.userEmail}</dd>
		<dt class="text-gray-500">User ID</dt>
		<dd class="break-all font-mono text-xs">{data.userId}</dd>
		<dt class="text-gray-500">Created</dt>
		<dd>{new Date(data.createdAt).toLocaleString()}</dd>
	</dl>

	{#if data.recipeCount === 0}
		<div class="mt-8 rounded border border-stone-200 bg-stone-50 p-4">
			<p class="mb-3 text-sm text-stone-600">You have no recipes yet.</p>
			<button
				type="button"
				class="rounded bg-sky-700 px-4 py-2 text-sm text-white hover:bg-sky-600"
				onclick={seedRecipes}
			>
				{seeding ? 'Seeding…' : 'Seed sample recipes'}
			</button>
			{#if seedMsg}
				<p class="mt-2 text-sm" class:text-green-600={seedMsg.ok} class:text-red-600={!seedMsg.ok}>
					{seedMsg.msg}
				</p>
			{/if}
		</div>
	{/if}
</div>
