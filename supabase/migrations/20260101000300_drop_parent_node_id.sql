-- Drop parent_node_id and its associated check constraint and index.
--
-- Under the chain-extension model (ADR 0002), forks create a new node in
-- the same chain via `parent_id`, not a new chain linked via a separate
-- pointer. The `parent_node_id` column was for the (now-removed) cross-
-- recipe fork concept, so it's dead weight.
--
-- The `parent_node_only_on_root` check constraint existed only to enforce
-- the mutual exclusion between the two parent fields. With one field gone,
-- the constraint is meaningless.
alter table public.recipe_nodes
  drop constraint if exists parent_node_only_on_root;

drop index if exists recipe_nodes_parent_node_idx;

alter table public.recipe_nodes
  drop column if exists parent_node_id;
