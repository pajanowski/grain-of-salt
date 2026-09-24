-- Storage bucket for recipe images, plus row-level security.
--
-- Layout (enforced by convention; RLS gates access per the first folder
-- segment matching auth.uid()):
--
--   recipe-images/
--     {owner_id}/
--       nodes/
--         {node_id}/final.{ext}            ← node-level final-dish image
--       ingredients/
--         {change_id}.{ext}                ← change-level image (keyed by
--       directions/                          change uuid, NOT row id —
--                                            keeps a 1:1 between change
--                                            records and storage objects)
--         {change_id}.{ext}
--
-- The bucket is private. Reads happen through the
-- /api/image?path=<storage-path> server endpoint which mints a
-- short-lived signed URL after verifying that the requester can see
-- the recipe node that owns the path. This keeps public-recipe image
-- access gated by the same RLS rules as the node itself.

insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-images', 'recipe-images', false, 52428800)
on conflict (id) do nothing;

-- Owners can read their own images.
create policy "Users can read their own recipe images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can upload to their own folder. Path must start with their
-- auth.uid() as the first folder segment; the upload endpoint
-- constructs the path server-side so clients cannot escape the
-- owner folder.
create policy "Users can upload to their own recipe images folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can update objects in their own folder (no-op in practice;
-- kept for parity with the delete policy below).
create policy "Users can update their own recipe images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can delete objects in their own folder (used by the image
-- delete endpoint to clean up after an edit replaces an image).
create policy "Users can delete their own recipe images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );