<script lang="ts">
	import Autocomplete from '$lib/component/Autocomplete.svelte';
	import type { AutocompleteItem } from '$lib/component/Autocomplete.svelte';
	import { CANONICAL_UNITS, UNIT_SYNONYMS } from '$lib/constants/units';

	let { value = $bindable(''), onchange }: { value?: string; onchange?: (v: string) => void } =
		$props();

	const items: AutocompleteItem[] = CANONICAL_UNITS.map((canonical) => {
		const synonyms = Object.entries(UNIT_SYNONYMS)
			.filter(([, c]) => c === canonical)
			.map(([syn]) => syn as string);
		const abbrev = synonyms.find((s: string) => s !== canonical);
		return {
			value: canonical,
			label: abbrev ? `${canonical} (${abbrev})` : canonical
		};
	});

	function handleExactMatch(search: string, allItems: AutocompleteItem[]) {
		const normalized = search.trim().toLowerCase();
		const canonical =
			allItems.find(
				(item) =>
					item.value.toLowerCase() === normalized ||
					item.label.toLowerCase().includes(normalized)
			)?.value ?? search.trim();
		value = canonical;
		onchange?.(canonical);
	}
</script>

<div>
	<Autocomplete
		{items}
		bind:value
		{onchange}
		onExactMatch={handleExactMatch}
		placeholder="Unit"
	/>
</div>
