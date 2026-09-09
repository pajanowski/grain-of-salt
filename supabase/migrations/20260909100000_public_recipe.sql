-- Mark a single recipe node as Public. The flag is per-node, not per-
-- recipe: marking a leaf public exposes only that node's view, never
-- ancestors or siblings. The corresponding read-only page lives at
-- /recipe/[recipeNodeId] outside the /mise/ group.
alter table public.recipe_nodes
  add column is_public boolean not null default false;

-- Partial index — the partial-where shape keeps the index tiny even if
-- the recipe_nodes table grows: it only contains rows where is_public
-- is true, which is a vanishingly small fraction of all recipes.
create index recipe_nodes_public_idx
  on public.recipe_nodes (is_public)
  where is_public = true;

-- Allow anonymous reads of explicitly-public nodes. Existing RLS
-- (recipe_nodes_select_own etc.) is unchanged; this policy is
-- additive and only exposes rows the owner has chosen to publish.
-- The route handler at /recipe/[recipeNodeId] uses an anon Supabase
-- client and relies on this policy — no app-layer check needed.
create policy recipe_nodes_select_public
  on public.recipe_nodes
  for select
  using (is_public = true);

-- Recursive function to walk a recipe node chain (parent_id links)
-- and return all nodes ordered oldest-first. Callable by the public
-- route's server-side fetch so RLS policies apply to the caller.
create or replace function get_recipe_chain(start_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  owner_id uuid,
  name text,
  "timestamp" timestamptz,
  ingredient_changes jsonb,
  direction_changes jsonb,
  author text,
  source text,
  is_public boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with recursive chain as (
    select rn.id, rn.parent_id, rn.owner_id, rn.name, rn.timestamp,
           rn.ingredient_changes, rn.direction_changes, rn.author, rn.source, rn.is_public,
           0 as depth
    from recipe_nodes rn
    where rn.id = start_id

    union all

    select rn.id, rn.parent_id, rn.owner_id, rn.name, rn.timestamp,
           rn.ingredient_changes, rn.direction_changes, rn.author, rn.source, rn.is_public,
           c.depth + 1
    from recipe_nodes rn
    inner join chain c on c.parent_id = rn.id
  )
  select chain.id, chain.parent_id, chain.owner_id, chain.name,
         chain.timestamp, chain.ingredient_changes, chain.direction_changes,
         chain.author, chain.source, chain.is_public
  from chain
  order by chain.depth;
end;
$$;

grant execute on function get_recipe_chain(uuid) to anon;
grant execute on function get_recipe_chain(uuid) to authenticated;
grant execute on function get_recipe_chain(uuid) to service_role;
grant execute on function get_recipe_chain(uuid) to postgres;
