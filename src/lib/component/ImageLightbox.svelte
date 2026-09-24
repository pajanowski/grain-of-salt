<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { Button } from '$lib/components/ui/button/index.js';

	/**
	 * Fullscreen image lightbox.
	 *
	 * Page-level mount (one instance per recipe page) — multiple
	 * per-row mounts fight over focus and z-index. Each row passes its
	 * (paths, index) on click via the `onOpen` callback prop; the
	 * parent (`Recipe.svelte`) holds the open/paths/index state.
	 *
	 * Image source: `/mise/api/image?path=<storage-path>` (signed-URL
	 * gateway). The browser follows the 302 transparently.
	 *
	 * Keyboard:
	 *   ArrowLeft  prev (when >1 image)
	 *   ArrowRight next (when >1 image)
	 *   Escape     close (bits-ui's default)
	 */
	type Props = {
		open: boolean;
		paths: string[];
		index: number;
		onClose: () => void;
		onPrev: () => void;
		onNext: () => void;
	};

	let { open, paths, index, onClose, onPrev, onNext }: Props = $props();

	const hasMultiple = $derived(paths.length > 1);

	function onKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			onPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			onNext();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<Dialog.Root bind:open onOpenChange={(o) => { if (!o) onClose(); }}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content
			class="max-w-[min(96vw,1600px)] w-auto max-h-[96vh] p-0 border-0 bg-transparent shadow-none"
			showCloseButton={false}
		>
			{#if paths.length > 0}
				<div class="relative flex items-center justify-center">
					<img
						src="/mise/api/image?path={encodeURIComponent(paths[index])}"
						alt=""
						class="max-h-[92vh] max-w-full object-contain rounded-md"
					/>

					<!-- Top-right close button -->
					<Button
						variant="ghost"
						size="icon"
						class="absolute top-2 right-2 bg-black/40 text-white hover:bg-black/60"
						onclick={onClose}
						data-testid="lightbox-close"
						aria-label="Close image viewer"
					>
						<XIcon />
					</Button>

					{#if hasMultiple}
						<!-- Prev -->
						<Button
							variant="ghost"
							size="icon"
							class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
							onclick={onPrev}
							data-testid="lightbox-prev"
							aria-label="Previous image"
						>
							<ChevronLeftIcon />
						</Button>
						<!-- Next -->
						<Button
							variant="ghost"
							size="icon"
							class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
							onclick={onNext}
							data-testid="lightbox-next"
							aria-label="Next image"
						>
							<ChevronRightIcon />
						</Button>
						<!-- Counter -->
						<div
							class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full"
							data-testid="lightbox-counter"
						>
							{index + 1} / {paths.length}
						</div>
					{/if}

					<!-- Download (uses the signed URL via api/image so the
					     browser downloads from the storage object URL,
					     not from the api endpoint). -->
					<a
						href="/mise/api/image?path={encodeURIComponent(paths[index])}&download=1"
						class="absolute bottom-2 right-2 bg-black/40 text-white hover:bg-black/60 rounded-md p-2 inline-flex"
						data-testid="lightbox-download"
						aria-label="Download image"
					>
						<DownloadIcon />
					</a>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>