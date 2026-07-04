-- 3. Create tenants table
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text not null,
  id_number     text,
  email         text,
  property_id   uuid references public.properties(id) on delete set null,
  unit_id       uuid references public.units(id) on delete set null,
  unit_number   text,
  property_name text,
  status        text not null default 'Active' check (status in ('Active', 'Inactive')),
  monthly_rent  integer,
  lease_start   date,
  lease_end     date,
  user_id       uuid references public.profiles(id) on delete set null,
  created_date  timestamptz default now()
);

alter table public.tenants enable row level security;

-- Add self-reference from units to tenants table for integrity
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_units_tenant'
  ) then
    alter table public.units add constraint fk_units_tenant foreign key (tenant_id) references public.tenants(id) on delete set null;
  end if;
end $$;

-- 4. Create leases table
create table if not exists public.leases (
  id                    uuid primary key default gen_random_uuid(),
  unit_id               uuid not null references public.units(id) on delete cascade,
  property_id           uuid not null references public.properties(id) on delete cascade,
  tenant_id             uuid references public.tenants(id) on delete set null,
  start_date            date,
  end_date              date,
  monthly_rent          integer,
  deposit               integer,
  lease_agreement_url   text,
  inspection_before_url text,
  inspection_after_url  text,
  status                text not null default 'Active' check (status in ('Active', 'Expired', 'Terminated')),
  created_date          timestamptz default now()
);

alter table public.leases enable row level security;

-- More helper functions
create or replace function public.is_tenant_of_property(property_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenants
    where user_id = auth.uid() and property_id = property_uuid
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_tenant_of_unit(unit_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenants
    where user_id = auth.uid() and unit_id = unit_uuid
  );
end;
$$ language plpgsql security definer;

-- Apply "Tenant view linked properties" policy to properties table now that helper function & tenants table exists
drop policy if exists "Tenant view linked properties" on public.properties;
create policy "Tenant view linked properties"
  on public.properties for select
  using (public.is_tenant_of_property(id));

-- Apply "Tenant view own unit" to units table
drop policy if exists "Tenant view own unit" on public.units;
create policy "Tenant view own unit"
  on public.units for select
  using (public.is_tenant_of_unit(id));

-- Policies for tenants
drop policy if exists "Agent full access on tenants" on public.tenants;
drop policy if exists "Landlord view tenants of own properties" on public.tenants;
drop policy if exists "Tenant view own profile" on public.tenants;

create policy "Agent full access on tenants"
  on public.tenants for all using (public.is_agent());

create policy "Landlord view tenants of own properties"
  on public.tenants for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own profile"
  on public.tenants for select
  using (user_id = auth.uid());

-- Policies for leases
drop policy if exists "Agent full access on leases" on public.leases;
drop policy if exists "Landlord view leases of own properties" on public.leases;
drop policy if exists "Tenant view own leases" on public.leases;
drop policy if exists "Public view lease config" on public.leases;

create policy "Agent full access on leases"
  on public.leases for all using (public.is_agent());

create policy "Landlord view leases of own properties"
  on public.leases for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own leases"
  on public.leases for select
  using (public.is_tenant_of_property(property_id));

create policy "Public view lease config"
  on public.leases for select
  using (true);
