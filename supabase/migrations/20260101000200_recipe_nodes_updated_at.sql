-- Add an updated_at column to recipe_nodes. The set_updated_at trigger
-- defined in the profiles migration also fires on recipe_nodes but
-- fails because that table has no updated_at column.
alter table public.recipe_nodes
  add column updated_at timestamptz not null default now();
