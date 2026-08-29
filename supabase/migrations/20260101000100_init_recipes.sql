-- Recipe nodes. Identity-bearing column is `id`; `parent_id` chains history
-- within a recipe; `parent_node_id` chains recipes to their parent recipe.
-- Owner column ties every node (and thus every recipe) to an auth user.
create table public.recipe_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.recipe_nodes(id) on delete cascade,
  parent_node_id uuid references public.recipe_nodes(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  label text,
  timestamp timestamptz not null default now(),
  ingredient_changes jsonb not null default '[]'::jsonb,
  direction_changes jsonb not null default '[]'::jsonb,
  -- parent_node_id (fork/derivation pointer) may only be set on roots
  -- (parent_id = null). Within a recipe's history the pointer is meaningless.
  constraint parent_node_only_on_root check (
    parent_node_id is null or parent_id is null
  )
);

create index recipe_nodes_owner_idx on public.recipe_nodes (owner_id);
create index recipe_nodes_parent_idx on public.recipe_nodes (parent_id);
create index recipe_nodes_parent_node_idx on public.recipe_nodes (parent_node_id);

-- Updated-at bookkeeping, same pattern as profiles.
create trigger recipe_nodes_set_updated_at
  before update on public.recipe_nodes
  for each row execute function public.set_updated_at();

-- RLS: every row is visible to and editable by its owner.
alter table public.recipe_nodes enable row level security;

create policy recipe_nodes_select_own
  on public.recipe_nodes
  for select
  using (auth.uid() = owner_id);

create policy recipe_nodes_insert_own
  on public.recipe_nodes
  for insert
  with check (auth.uid() = owner_id);

create policy recipe_nodes_update_own
  on public.recipe_nodes
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy recipe_nodes_delete_own
  on public.recipe_nodes
  for delete
  using (auth.uid() = owner_id);

-- Demo-user id used by the seed script and the guest demo tree.
-- Lives in auth.users so RLS evaluates it the same way as a real user.
do $$
declare
  demo_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where id = demo_id) then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      demo_id,
      'authenticated',
      'authenticated',
      'demo@grain-of-salt.local',
      crypt('demo-password-not-used', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Demo User"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  end if;
end $$;
