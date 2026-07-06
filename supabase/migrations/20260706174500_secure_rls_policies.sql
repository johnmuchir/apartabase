-- Drop old policies on public.profiles
drop policy if exists "Agents can view all profiles" on public.profiles;
drop policy if exists "Agents can insert profiles" on public.profiles;
drop policy if exists "Agents can update all profiles" on public.profiles;

-- Recreate RLS helper functions securely by checking the database profiles table
create or replace function public.is_agent()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agent'
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_landlord()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'landlord'
  );
end;
$$ language plpgsql security definer;

-- Recreate the profiles policies securely using the helper functions
create policy "Agents can view all profiles"
  on public.profiles for select
  using (public.is_agent());

create policy "Agents can insert profiles"
  on public.profiles for insert
  with check (public.is_agent());

create policy "Agents can update all profiles"
  on public.profiles for update
  using (public.is_agent());
