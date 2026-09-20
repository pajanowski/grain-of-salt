-- Add a per-node favorite flag. Users favorite individual nodes (versions)
-- rather than whole recipes, mirroring how is_public is scoped: marking
-- one node as favorite exposes only that node's view, never ancestors or
-- siblings. A partial index keeps lookups for "show me my favorites" fast
-- even if the table grows — only favorited rows land in the index.
alter table public.recipe_nodes
  add column is_favorite boolean not null default false;

create index recipe_nodes_favorite_idx
  on public.recipe_nodes (is_favorite)
  where is_favorite = true;
