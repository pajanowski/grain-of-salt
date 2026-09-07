<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	let displayName = $state(data.displayName ?? '');
	let saved = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function handleSave() {
		saved = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => { saved = false; }, 2000);
	}
</script>

<svelte:head>
	<title>Me · Grain of Salt</title>
</svelte:head>

<div class="mx-auto mt-12 max-w-md">
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
	<p class="mt-6 text-xs text-gray-500">
		Loading this page required a Supabase session. Guests and unauthenticated
		browsers are redirected to <a href="/auth" class="underline">/auth</a>.
	</p>
</div>
