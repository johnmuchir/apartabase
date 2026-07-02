-- Create profiles table
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('agent', 'landlord', 'tenant', 'caretaker')),
  phone       text,
  created_at  timestamptz default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Agents can view all profiles"
  on public.profiles for select
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'agent'
  );

create policy "Agents can insert profiles"
  on public.profiles for insert
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'agent'
  );

create policy "Agents can update all profiles"
  on public.profiles for update
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'agent'
  );

-- Trigger function to automatically create a profile entry when a user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'tenant'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
