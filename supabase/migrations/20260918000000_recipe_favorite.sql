-- Add a per-node favorite flag. Users favorite individual nodes (versions)
-- rather than whole recipes, mirroring how is_public is scoped: marking
-- one node as favorite exposes only that node's view, never ancestors or
-- siblings. The partial index is keyed by (owner_id, is_favorite) so a
-- future "show me my favorites" query can scope by owner and only land
-- favorited rows in the index — non-favorites never enter it.
alter table public.recipe_nodes
  add column is_favorite boolean not null default false;

create index recipe_nodes_favorite_idx
  on public.recipe_nodes (owner_id, is_favorite)
  where is_favorite = true;
