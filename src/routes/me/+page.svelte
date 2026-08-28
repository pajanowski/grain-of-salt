<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Me · Grain of Salt</title>
</svelte:head>

<div class="mx-auto mt-12 max-w-md">
	<h1 class="mb-4 text-2xl font-semibold">Account</h1>
	<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
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
