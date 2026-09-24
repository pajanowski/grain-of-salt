<script lang="ts">
	type Props = {
		/**
		 * The materialized row's images. May be null/empty for rows
		 * without images. Per the applyNodes contract, this is always
		 * the resolved list (with ancestors' images filling through).
		 */
		imagePaths: string[] | null | undefined;
		/**
		 * Called when the user clicks a thumbnail. The parent page
		 * owns the lightbox state — it opens the dialog with the row's
		 * full image list and the clicked index.
		 */
		onOpen: (paths: string[], index: number) => void;
	};

	let { imagePaths, onOpen }: Props = $props();

	const list = $derived(imagePaths ?? []);
</script>

{#if list.length > 0}
	<div class="flex flex-wrap gap-1.5 shrink-0" data-testid="row-image-strip">
		{#each list as path, i (path)}
			<button
				type="button"
				class="block h-12 w-12 overflow-hidden rounded border border-stone-300 hover:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
				onclick={() => onOpen(list, i)}
				aria-label="Open image {i + 1} of {list.length}"
				data-testid="row-image"
				data-image-index={i}
			>
				<img
					src="/api/image?path={encodeURIComponent(path)}"
					alt=""
					class="h-full w-full object-cover"
					loading="lazy"
				/>
			</button>
		{/each}
	</div>
{/if}