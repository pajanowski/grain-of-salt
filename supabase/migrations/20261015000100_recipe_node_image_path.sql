-- Add a per-node "final dish" image path. The image is owned by the
-- specific node (this version, this leaf) — not by the recipe as a
-- whole. Forking resets it to null on the new node so each version
-- carries its own final-dish photo until the user explicitly sets one.
--
-- Unlike ingredient/direction images (which live on the change body
-- inside the jsonb arrays and replay through applyNodes), this image
-- is a leaf-level snapshot. The recipe_nodes row is the natural home
-- because each node already carries its own per-version metadata
-- (is_public, is_favorite, author, source).
alter table public.recipe_nodes
  add column image_path text;