<script lang="ts" generics="T extends string">
	/**
	 * Minimal segmented tab control — used inside the add/edit
	 * ingredient & direction forms to switch between the main inputs
	 * and a note textarea.
	 *
	 * Implementation: a `role="tablist"` of buttons. Selected tab is
	 * amber-highlighted; the others use the secondary style. Keyboard:
	 * ← / → move focus and selection between tabs.
	 */
	type Props = {
		tabs: { id: T; label: string }[];
		selected: T;
		onchange: (id: T) => void;
	};

	let { tabs, selected, onchange }: Props = $props();

	function select(id: T) {
		if (id !== selected) onchange(id);
	}

	function handleKey(e: KeyboardEvent, idx: number) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const dir = e.key === 'ArrowRight' ? 1 : -1;
		const next = (idx + dir + tabs.length) % tabs.length;
		const nextId = tabs[next].id;
		const btns = (e.currentTarget as HTMLElement).parentElement?.children;
		(btns?.[next] as HTMLButtonElement | undefined)?.focus();
		select(nextId);
	}
</script>

<div role="tablist" class="flex gap-1 border-b border-stone-200 mb-3">
	{#each tabs as tab, i (tab.id)}
		<button
			type="button"
			role="tab"
			aria-selected={selected === tab.id}
			data-testid={`tab-${tab.id}`}
			class="px-3 py-1.5 text-sm rounded-t border border-b-0 {selected === tab.id
				? 'bg-amber-300 border-amber-400 text-stone-900 font-semibold'
				: 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200'}"
			onclick={() => select(tab.id)}
			onkeydown={(e) => handleKey(e, i)}
		>
			{tab.label}
		</button>
	{/each}
</div>
