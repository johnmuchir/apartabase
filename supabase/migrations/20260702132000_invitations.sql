-- 8. Create invitations table
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  full_name   text not null,
  role        text not null check (role in ('agent', 'landlord', 'tenant', 'caretaker')),
  token       uuid not null default gen_random_uuid(),
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_date timestamptz default now()
);

alter table public.invitations enable row level security;

-- Policies for invitations
drop policy if exists "Agent full access on invitations" on public.invitations;
drop policy if exists "Public view pending invitations by email/token" on public.invitations;

create policy "Agent full access on invitations"
  on public.invitations for all using (public.is_agent());

create policy "Public view pending invitations by email/token"
  on public.invitations for select
  using (status = 'pending');
