-- 9. Storage Configuration for Public Uploads
insert into storage.buckets (id, name, public)
values ('properties', 'properties', true)
on conflict (id) do nothing;

drop policy if exists "Allow Public Read Access on properties storage" on storage.objects;
drop policy if exists "Allow Authenticated Insert Access on properties storage" on storage.objects;

create policy "Allow Public Read Access on properties storage"
  on storage.objects for select
  using (bucket_id = 'properties');

create policy "Allow Authenticated Insert Access on properties storage"
  on storage.objects for insert
  with check (bucket_id = 'properties' and auth.role() = 'authenticated');
