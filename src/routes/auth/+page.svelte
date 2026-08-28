<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let step: 'request' | 'verify' = $state(form?.step === 'verify' ? 'verify' : 'request');
	let email = $state<string>(form?.email ?? '');
	let token = $state<string>('');
	const otpPattern = '[0-9]{6}';
</script>

<svelte:head>
	<title>Sign in · Grain of Salt</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<h1 class="mb-6 text-2xl font-semibold">Sign in</h1>

	{#if !data.supabaseConfigured}
		<div class="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
			Supabase isn't configured. Set <code>PUBLIC_SUPABASE_URL</code> and
			<code>PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env</code> (copy from
			<code>.env.example</code>) and run <code>supabase start</code>.
		</div>
	{/if}

	{#if step === 'request'}
		<form
			method="POST"
			action="?/otpRequest"
			use:enhance
			class="flex flex-col gap-3"
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm">Email</span>
				<input
					type="email"
					name="email"
					required
					bind:value={email}
					class="rounded border px-3 py-2"
					autocomplete="email"
				/>
			</label>
			{#if form?.step === 'request' && form.error}
				<p class="text-sm text-red-600">{form.error}</p>
			{/if}
			<button type="submit" class="rounded bg-black px-4 py-2 text-white">
				Email me a code
			</button>
		</form>

		<div class="my-6 flex items-center gap-3 text-xs text-gray-500">
			<div class="h-px flex-1 bg-gray-300"></div>
			or
			<div class="h-px flex-1 bg-gray-300"></div>
		</div>

		<form method="POST" action="?/guestIn" use:enhance>
			<button type="submit" class="w-full rounded border px-4 py-2">
				Continue as guest (demo)
			</button>
		</form>
	{:else}
		<p class="mb-4 text-sm">
			Code sent to <strong>{email}</strong>. Check your inbox
			(or Mailpit at <code>http://127.0.0.1:54324</code> in local dev).
		</p>
		<form
			method="POST"
			action="?/otpVerify"
			use:enhance
			class="flex flex-col gap-3"
		>
			<input type="hidden" name="email" value={email} />
			<label class="flex flex-col gap-1">
				<span class="text-sm">6-digit code</span>
				<input
					type="text"
					name="token"
					inputmode="numeric"
				pattern="{otpPattern}"
					maxlength="6"
					required
					bind:value={token}
					class="rounded border px-3 py-2 tracking-widest"
					autocomplete="one-time-code"
				/>
			</label>
			{#if form?.step === 'verify' && form.error}
				<p class="text-sm text-red-600">{form.error}</p>
			{/if}
			<button type="submit" class="rounded bg-black px-4 py-2 text-white">
				Verify
			</button>
			<button
				type="button"
				class="text-xs text-gray-600 underline"
				onclick={() => (step = 'request')}
			>
				Use a different email
			</button>
		</form>
	{/if}
</div>
