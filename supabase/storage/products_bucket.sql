-- ============================================================================
-- Princess — Storage: 'products' bucket + RLS  (Phase 1, Task 1.2)
-- DATABASE.md §7 · CLAUDE_RULES §5 · Decision D3. Replaces Cloudinary (C3).
--
-- ▶ RUN THIS IN THE SUPABASE DASHBOARD → SQL EDITOR (not via `supabase db push`).
--   `storage.objects` is owned by `supabase_storage_admin`, so the CLI migration
--   role usually CANNOT create these policies (ownership error) — and a failing
--   file in supabase/migrations/ would block the whole migration chain. The
--   dashboard SQL editor has the privileges. (Or use Storage → Policies UI.)
--   Idempotent: safe to re-run.
--
-- Path convention (object NAME inside the 'products' bucket):
--     {auth.uid()}/{uuid}-{filename}
--   The FIRST folder segment is the owner's uid — that is the ownership gate
--   (`(storage.foldername(name))[1] = auth.uid()`). The upload route enforces the
--   same path (lib/storage/buckets.ts → buildObjectPath).
-- ============================================================================

-- 1) Bucket — public read.
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- 2) Public read of objects in the 'products' bucket.
drop policy if exists "products_public_read" on storage.objects;
create policy "products_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using ( bucket_id = 'products' );

-- 3) Owner write — an authenticated user may INSERT/UPDATE/DELETE only under their
--    own uid folder (first path segment = auth.uid()).
drop policy if exists "products_owner_insert" on storage.objects;
create policy "products_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "products_owner_update" on storage.objects;
create policy "products_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "products_owner_delete" on storage.objects;
create policy "products_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
