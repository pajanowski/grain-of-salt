/**
 * Image storage path conventions.
 *
 * Storage layout (see also supabase/migrations/20261015000000_recipe_images_bucket.sql):
 *
 *   {ownerId}/
 *     nodes/{nodeId}/final.{ext}                  ← node-level final-dish image
 *     ingredients/{changeId}.{ext}                ← change-level image
 *     directions/{changeId}.{ext}                 ← change-level image
 *
 * Storage paths are STORED on the change record / row column and are
 * RELATIVE to the bucket root (no bucket prefix). Render code passes
 * the relative path to /api/image which mints a signed URL.
 */
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;
type Ext = (typeof ALLOWED_EXTS)[number];

const EXT_FROM_MIME: Record<string, Ext> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/**
 * Pick a sensible extension for an uploaded file based on its MIME type.
 * Falls back to 'jpg' when the MIME type is unknown — uploads without
 * a recognizable image MIME are rejected upstream.
 */
export function extFromMime(mime: string): Ext {
	const ext = EXT_FROM_MIME[mime.toLowerCase()];
	if (!ext) {
		throw new Error(`Unsupported image MIME type: ${mime}`);
	}
	return ext;
}

/**
 * Verify a storage path is well-formed and rooted under the given
 * ownerId. Throws on any violation — caller maps to 400. This is the
 * trust boundary that prevents a user from referencing another
 * user's storage object by supplying a hand-crafted path.
 */
export function assertPathUnderOwner(path: string, ownerId: string): void {
	const parts = path.split('/');
	if (parts.length < 2) {
		throw new Error(`Image path '${path}' must include at least an owner segment`);
	}
	if (parts[0] !== ownerId) {
		throw new Error(`Image path '${path}' is not under owner ${ownerId}`);
	}
	// Each subsequent segment must be non-empty.
	for (let i = 1; i < parts.length; i++) {
		if (parts[i].length === 0) {
			throw new Error(`Image path '${path}' has an empty segment at position ${i}`);
		}
	}
	// Leaf must end in a recognized extension.
	const leaf = parts[parts.length - 1];
	const dot = leaf.lastIndexOf('.');
	if (dot < 0) {
		throw new Error(`Image path '${path}' has no extension`);
	}
	const ext = leaf.slice(dot + 1).toLowerCase();
	if (!ALLOWED_EXTS.includes(ext as Ext)) {
		throw new Error(`Image path '${path}' has an unsupported extension '${ext}'`);
	}
}

/**
 * Build the storage path for a node-level "final dish" image. The
 * `{ext}` placeholder is replaced by the file's MIME-derived
 * extension; the resulting path is opaque (timestamps etc. are
 * inside the change record, not the path).
 */
export function nodeImagePath(ownerId: string, nodeId: string, ext: Ext): string {
	return `${ownerId}/nodes/${nodeId}/final.${ext}`;
}

/**
 * Build the storage path for a change-level image. The changeId is
 * the recipe change record's uuid — see IngredientChange.id /
 * DirectionChange.id.
 */
export function changeImagePath(
	ownerId: string,
	kind: 'ingredient' | 'direction',
	changeId: string,
	ext: Ext
): string {
	return `${ownerId}/${kind}s/${changeId}.${ext}`;
}