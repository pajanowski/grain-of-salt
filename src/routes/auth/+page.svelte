<script lang="ts">
	import { enhance } from '$app/forms';
	import { writable } from 'svelte/store';
	import type { ActionData, PageData } from './$types';
	import GrainOfSaltTitle from '$lib/component/GrainOfSaltTitle.svelte';
	import Spinner from '$lib/component/Spinner.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let step: 'request' | 'verify' = $derived(form?.step === 'verify' ? 'verify' : 'request');
	let email = $derived(form?.email ?? '');
	let token = $state<string>('');
	const otpPattern = '[0-9]{8}';

	// Tracks whether either form action is in-flight. Updated by use:enhance callbacks.
	let pending = writable(false);
</script>

<svelte:head>
	<title>Sign in · Grain of Salt</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-4 sm:p-8">
	<GrainOfSaltTitle />
	<div class="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-md">
		<h2 class="mb-6 text-2xl font-semibold text-stone-800">Sign in</h2>

		{#if !data.supabaseConfigured}
			<div class="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
				Supabase isn't configured. Set <code>PUBLIC_SUPABASE_URL</code> and
				<code>PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env</code> (copy from
				<code>.env.example</code>) and run <code>supabase start</code>.
			</div>
		{/if}

		{#if step === 'request'}
			<form
				method="POST"
				action="?/otpRequest"
				use:enhance={() => {
					pending.set(true);
					return async ({ update }) => {
						await update();
						pending.set(false);
					};
				}}
				class="flex flex-col gap-3"
			>
				<label class="flex flex-col gap-1 text-sm text-stone-700">
					<span>Email</span>
					<input
						type="email"
						name="email"
						required
						disabled={$pending}
						bind:value={email}
						autocomplete="email"
					/>
				</label>
				{#if form?.step === 'request' && form.error}
					<p class="text-sm text-red-600">{form.error}</p>
				{/if}
				<button type="submit" disabled={$pending}>
					{#if $pending}
						<span class="flex items-center gap-2"><Spinner size="1rem" /> Sending…</span>
					{:else}
						Email me a code
					{/if}
				</button>
			</form>
		{:else}
			<p class="mb-4 text-sm text-stone-600">
				Code sent to <strong>{email}</strong>. Check your inbox.
				{#if data.isLocal}
					(or <a href="http://127.0.0.1:54324" target="_blank" rel="noopener" class="underline">Mailpit</a> in local dev).
				{/if}
			</p>
			<form
				method="POST"
				action="?/otpVerify"
				use:enhance={() => {
					pending.set(true);
					return async ({ update }) => {
						await update();
						pending.set(false);
					};
				}}
				class="flex flex-col gap-3"
			>
				<input type="hidden" name="email" value={email} />
				<label class="flex flex-col gap-1 text-sm text-stone-700">
					<span>8-digit code</span>
					<input
						type="text"
						name="token"
						inputmode="numeric"
						pattern={otpPattern}
						maxlength="8"
						required
						disabled={$pending}
						bind:value={token}
						class="tracking-widest"
						autocomplete="one-time-code"
					/>
				</label>
				{#if form?.step === 'verify' && form.error}
					<p class="text-sm text-red-600">{form.error}</p>
				{/if}
				<button type="submit" disabled={$pending}>
					{#if $pending}
						<span class="flex items-center gap-2"><Spinner size="1rem" /> Verifying…</span>
					{:else}
						Verify
					{/if}
				</button>
				<button
					type="button"
					class="text-xs text-stone-500 underline"
					onclick={() => (step = 'request')}
				>
					Use a different email
				</button>
			</form>
		{/if}
	</div>
</div>
