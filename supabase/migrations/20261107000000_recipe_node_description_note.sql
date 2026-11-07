-- Per-node description (a short summary of the change this node makes) and
-- note (freeform notes about the node itself). Both are optional metadata:
-- the replay pass ignores them, they ride along on every node row.
alter table public.recipe_nodes
  add column description text,
  add column note text;

-- get_recipe_chain's RETURNS TABLE is an explicit column list, and the
-- public route at /recipe/[recipeNodeId] reads node metadata through it —
-- so the function must be recreated with the two new columns or the
-- public page will never see them. Postgres cannot change a function's
-- return type via CREATE OR REPLACE, so drop first (grants are re-issued
-- below).
drop function if exists get_recipe_chain(uuid);

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
  is_public boolean,
  description text,
  note text
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
           rn.description, rn.note,
           0 as depth
    from recipe_nodes rn
    where rn.id = start_id

    union all

    select rn.id, rn.parent_id, rn.owner_id, rn.name, rn.timestamp,
           rn.ingredient_changes, rn.direction_changes, rn.author, rn.source, rn.is_public,
           rn.description, rn.note,
           c.depth + 1
    from recipe_nodes rn
    inner join chain c on c.parent_id = rn.id
  )
  select chain.id, chain.parent_id, chain.owner_id, chain.name,
         chain.timestamp, chain.ingredient_changes, chain.direction_changes,
         chain.author, chain.source, chain.is_public,
         chain.description, chain.note
  from chain
  order by chain.depth;
end;
$$;

grant execute on function get_recipe_chain(uuid) to anon;
grant execute on function get_recipe_chain(uuid) to authenticated;
grant execute on function get_recipe_chain(uuid) to service_role;
grant execute on function get_recipe_chain(uuid) to postgres;
