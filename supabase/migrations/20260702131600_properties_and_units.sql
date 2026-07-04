-- 1. Create properties table
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null,
  address     text,
  total_units integer,
  image_url   text,
  landlord_id uuid references public.profiles(id) on delete set null,
  created_date timestamptz default now()
);

alter table public.properties enable row level security;

-- 2. Create units table
create table if not exists public.units (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  unit_number  text not null,
  unit_type    text not null,
  status       text not null default 'Vacant' check (status in ('Vacant', 'Occupied')),
  monthly_rent integer not null,
  tenant_id    uuid, -- Will be set/cleared when tenant is checked in/out
  tenant_name  text,
  floor        text,
  notes        text,
  lease_url    text,
  inspection_url text,
  created_date   timestamptz default now()
);

alter table public.units enable row level security;

-- RLS helper functions
create or replace function public.is_agent()
returns boolean as $$
begin
  return coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'agent';
end;
$$ language plpgsql security definer;

create or replace function public.is_landlord()
returns boolean as $$
begin
  return coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'landlord';
end;
$$ language plpgsql security definer;

create or replace function public.is_landlord_of_property(property_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.properties
    where id = property_uuid and landlord_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Policies for properties
drop policy if exists "Agent full access on properties" on public.properties;
drop policy if exists "Landlord view own properties" on public.properties;
drop policy if exists "Tenant view linked properties" on public.properties;
drop policy if exists "Public view unit details" on public.properties;

create policy "Agent full access on properties"
  on public.properties for all using (public.is_agent());

create policy "Landlord view own properties"
  on public.properties for select
  using (public.is_landlord() and landlord_id = auth.uid());

create policy "Public view unit details"
  on public.properties for select
  using (true);

-- Policies for units
drop policy if exists "Agent full access on units" on public.units;
drop policy if exists "Landlord view units of own properties" on public.units;
drop policy if exists "Tenant view own unit" on public.units;
drop policy if exists "Public view unit info" on public.units;

create policy "Agent full access on units"
  on public.units for all using (public.is_agent());

create policy "Landlord view units of own properties"
  on public.units for select
  using (public.is_landlord_of_property(property_id));

create policy "Public view unit info"
  on public.units for select
  using (true);
