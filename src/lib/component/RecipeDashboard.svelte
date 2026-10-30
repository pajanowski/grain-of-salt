<script lang="ts">
	import type { RecipeDashboardEntry, RecipeFavoriteEntry } from '$lib/server/bo/recipenodesbo';
	import { formatRelativeTime } from '$lib/formatDate';

	let {
		dashboard,
		favorites = []
	}: {
		dashboard: RecipeDashboardEntry[];
		favorites?: RecipeFavoriteEntry[];
	} = $props();
</script>

<div class="flex flex-col gap-8">
	{#if favorites && favorites.length > 0}
		<div class="flex flex-col gap-4">
			<h2 class="text-2xl font-semibold text-stone-800">Favorites</h2>
			<div class="flex flex-col gap-3">
				{#each favorites as fav (fav.id)}
					<a
						href="/mise/recipes/{fav.id}"
						class="group flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:bg-stone-50"
						data-testid="recipe-favorite-card"
					>
						<div class="flex min-w-0 flex-col gap-1">
							<div class="flex items-center gap-2">
								<svg
									data-testid="recipe-favorite-card-star"
									aria-hidden="true"
									class="h-4 w-4 shrink-0 fill-amber-400 stroke-amber-500"
									viewBox="0 0 24 24"
									fill="currentColor"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
								<span class="truncate font-semibold text-stone-900 group-hover:text-amber-800">
									{fav.name}
								</span>
							</div>
							<div class="flex items-center gap-2 text-xs text-stone-500">
								<span>{formatRelativeTime(fav.lastEditedAt)}</span>
							</div>
						</div>
						<div
							class="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if dashboard && dashboard.length > 0}
		<div class="flex flex-col gap-4">
			<h2 class="text-2xl font-semibold text-stone-800">Recent recipes</h2>
			<div class="flex flex-col gap-3">
				{#each dashboard as entry (entry.rootId)}
					<a
						href="/mise/recipes/{entry.leafId}"
						class="group flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:bg-stone-50"
						data-testid="recipe-dashboard-card"
					>
						<div class="flex min-w-0 flex-col gap-1">
							<span class="truncate font-semibold text-stone-900 group-hover:text-amber-800">
								{entry.name}
							</span>
							<div class="flex items-center gap-2 text-xs text-stone-500">
								{#if entry.forkCount > 0}
									<span>{entry.forkCount} {entry.forkCount === 1 ? 'fork' : 'forks'}</span>
									<span aria-hidden="true">·</span>
								{/if}
								<span>{formatRelativeTime(entry.lastEditedAt)}</span>
							</div>
						</div>
						<div
							class="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
