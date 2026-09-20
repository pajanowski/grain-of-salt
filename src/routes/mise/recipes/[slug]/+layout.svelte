<script lang="ts">
	import { page } from '$app/state';
	import GitForkIcon from '@lucide/svelte/icons/git-fork';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';

	const { children } = $props();

	// The route slug is the recipe (node) id; both tabs navigate to it.
	let slug = $derived(page.params.slug ?? '');
	let isGraph = $derived(page.url.pathname.endsWith('/graph'));
</script>

<nav
	aria-label="Recipe views"
	class="mx-auto max-w-3xl border-b border-stone-200 px-4 pt-4"
>
	<div role="tablist" class="-mb-px flex gap-1">
		<a
			role="tab"
			aria-selected={!isGraph}
			aria-current={!isGraph ? 'page' : undefined}
			data-testid="tab-recipe"
			href="/mise/recipes/{slug}"
			class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors {!isGraph
				? 'border-amber-400 font-semibold text-stone-900'
				: 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'}"
		>
			<ScrollTextIcon class="h-4 w-4" />
			Recipe
		</a>
		<a
			role="tab"
			aria-selected={isGraph}
			aria-current={isGraph ? 'page' : undefined}
			data-testid="tab-graph"
			href="/mise/recipes/{slug}/graph"
			class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors {isGraph
				? 'border-amber-400 font-semibold text-stone-900'
				: 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'}"
		>
			<GitForkIcon class="h-4 w-4" />
			Graph
		</a>
	</div>
</nav>

{@render children()}
