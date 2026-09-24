<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import ImageIcon from '@lucide/svelte/icons/image';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';
	import InheritIcon from '@lucide/svelte/icons/link';

	type Props = {
		/**
		 * The local preview state. `undefined` means the user has not
		 * touched the tab yet (the form's wire-shape imagePaths is
		 * left unset so ancestors pass through). When defined, it's
		 * the explicit replacement list to send to the change record.
		 */
		localPaths: string[] | undefined;
		/**
		 * Paths the inherited replay chain provides. The "Inherit"
		 * button is enabled only when this set is non-empty AND
		 * differs from `localPaths`.
		 */
		inheritedPaths: string[];
		/** node id (the leaf we're editing under). Optional — when missing,
		 * the upload UI is hidden (read-only consumers). */
		nodeId?: string;
		/** change id the form minted up-front — used for per-change uploads.
		 * Optional — when missing, the upload UI is hidden. */
		changeId?: string;
		/** 'ingredient' or 'direction' — used to pick the upload endpoint. */
		kind: 'ingredient' | 'direction';
		/**
		 * Called when the user attaches a new image. The form layer
		 * drives the two-phase commit (upload -> get path -> add to
		 * localPaths). This callback receives the freshly-uploaded
		 * storage path and is responsible for appending it to
		 * `localPaths`.
		 */
		onAddPath: (path: string) => void;
		/** Called when the user clicks the trash icon on a local image. */
		onRemovePath: (path: string) => void;
		/**
		 * Called when the user clicks "Inherit images from parent".
		 * The component copies `inheritedPaths` into the local preview
		 * by calling this with the inherited set. The form layer
		 * appends it to `localPaths` (turning the sentinel from
		 * `undefined` into a concrete list).
		 */
		onInherit: (paths: string[]) => void;
	};

	let {
		localPaths,
		inheritedPaths,
		nodeId,
		changeId,
		kind,
		onAddPath,
		onRemovePath,
		onInherit
	}: Props = $props();

	const canUpload = $derived(Boolean(nodeId && changeId));

	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	const list = $derived(localPaths ?? []);

	// Enabled when the inherited set is non-empty AND the local
	// preview is missing or doesn't already contain the same paths.
	const inheritEnabled = $derived(
		inheritedPaths.length > 0 &&
			!arraysEqual(list.slice().sort(), inheritedPaths.slice().sort())
	);

	const localIsUntouched = $derived(localPaths === undefined);
	const hasInherited = $derived(inheritedPaths.length > 0);

	function arraysEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	}

	async function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = ''; // allow re-picking the same file later
		uploading = true;
		uploadError = null;
		try {
			const form = new FormData();
			form.append('file', file);
			const url = `/mise/api/recipe-node/${nodeId}/change/${changeId}/image?kind=${kind}`;
			const res = await fetch(url, { method: 'POST', body: form });
			if (!res.ok) {
				uploadError = `${res.status}: ${await res.text()}`;
				return;
			}
			const { path } = (await res.json()) as { path: string };
			onAddPath(path);
		} catch (e) {
			uploadError = (e as Error).message;
		} finally {
			uploading = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Inherit affordance: shown when there's something to inherit. -->
	{#if hasInherited}
		<div
			class="flex items-center justify-between gap-2 rounded border border-dashed border-stone-300 px-2 py-1.5 text-xs"
			data-testid="edit-images-inherited-hint"
		>
			<span class="opacity-70">
				{#if localIsUntouched}
					Currently inheriting {inheritedPaths.length} image{inheritedPaths.length === 1 ? '' : 's'} from parent.
					Open this tab to manage images on this change.
				{:else}
					{inheritEnabled
						? `Inherited set available (${inheritedPaths.length} image${inheritedPaths.length === 1 ? '' : 's'}).`
						: 'Inherited set already applied to this change.'}
				{/if}
			</span>
			<Button
				variant="outline"
				size="sm"
				onclick={() => onInherit(inheritedPaths)}
				disabled={!inheritEnabled}
				data-testid="inherit-images-button"
				title="Copy the inherited set of images onto this change record"
			>
				<InheritIcon />
				Inherit images from parent
			</Button>
		</div>
	{/if}

	<!-- Upload control. Hidden when nodeId/changeId aren't threaded
	     (e.g. read-only consumers that wire the Images tab but disable
	     uploads). -->
	{#if canUpload}
		<div class="flex items-center gap-2">
			<label
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-stone-300 cursor-pointer hover:bg-stone-100 text-sm"
				data-testid="upload-image-label"
			>
				<UploadIcon />
				{uploading ? 'Uploading…' : 'Add image'}
				<input
					type="file"
					class="hidden"
					accept="image/*"
					onchange={onFileSelected}
					disabled={uploading}
					data-testid="upload-image-input"
				/>
			</label>
			{#if uploadError}
				<p class="text-sm text-red-600">{uploadError}</p>
			{/if}
		</div>
	{/if}

	<!-- Local preview thumbnails. Each thumbnail has a trash button to
	     remove from the local set. Removing from the local set puts the
	     path into an explicit removal state for the change record — see
	     onRemovePath. -->
	{#if list.length > 0}
		<ul class="flex flex-wrap gap-2" data-testid="edit-images-preview">
			{#each list as path, i (path)}
				<li class="relative">
					<img
						src="/api/image?path={encodeURIComponent(path)}"
						alt=""
						class="h-16 w-16 object-cover rounded border border-stone-300"
						data-testid="edit-image-thumb"
						data-image-index={i}
					/>
					<button
						type="button"
						class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 leading-none hover:bg-red-600"
						aria-label="Remove image"
						onclick={() => onRemovePath(path)}
						data-testid="edit-image-remove"
					>
						<XIcon size={12} />
					</button>
				</li>
			{/each}
		</ul>
	{:else if !hasInherited}
		<p class="text-sm text-stone-500 inline-flex items-center gap-1">
			<ImageIcon size={14} /> No images attached.
		</p>
	{/if}
</div>