<script lang="ts">
	import { page } from '$app/state';

	let status = $derived(page.status);
	let message = $derived(page.error?.message ?? 'Something went wrong');
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
	<h1 class="text-2xl font-semibold text-stone-800">{status}</h1>
	<p class="mt-2 text-stone-600">{message}</p>
	<a href="/mise" class="mt-4 inline-block text-sm text-amber-700 hover:underline">
		← Back to recipe list
	</a>
</div>
