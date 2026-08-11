<script lang="ts">
	import type { FormattedChange } from '$lib/obj/recipeDiff';

	type Props = {
		note: { text: string; change: FormattedChange } | null;
		onclose: () => void;
	};

	let { note, onclose }: Props = $props();

	// Close on Escape, like most slide-out panels.
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && note) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if note}
	<!-- Backdrop: clicks close the sidebar. -->
	<!--
		Genius-style slide-out: fixed to the right edge, full viewport height,
		scrolls independently. A yellow band at the top echoes the lyrics-
		annotation look.
	-->
	<aside
		class="fixed top-0 right-0 h-full w-96 max-w-full bg-white shadow-2xl z-50 flex flex-col"
		role="complementary"
		aria-label="Change note"
	>
		<header class="bg-amber-300 px-4 py-3 flex justify-between items-center shrink-0">
			<h2 class="text-base font-bold uppercase tracking-wide">Note</h2>
			<button
				type="button"
				class="text-sm font-bold opacity-70 hover:opacity-100"
				aria-label="Close"
				onclick={onclose}>X</button
			>
		</header>

		<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
			<!-- The change the note is attached to, shown as a quote. -->
			<blockquote class="border-l-4 border-amber-300 pl-3 italic opacity-90">
				{note.change.text}
			</blockquote>

			<p class="text-xs opacity-50 uppercase tracking-wide">
				{note.change.kind} · {note.change.changeType}
			</p>

			<hr class="opacity-20" />

			<p class="whitespace-pre-wrap text-base leading-relaxed">{note.text}</p>
		</div>
	</aside>
{/if}
