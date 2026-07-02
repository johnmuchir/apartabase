-- Drop existing tables to ensure schema modifications are cleanly applied
drop table if exists public.invoices cascade;
drop table if exists public.maintenance_requests cascade;
drop table if exists public.payments cascade;
drop table if exists public.leases cascade;
drop table if exists public.tenants cascade;
drop table if exists public.units cascade;
drop table if exists public.properties cascade;

-- 1. Create properties table
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null,
  address     text,
  total_units integer,
  image_url   text,
  landlord_id uuid references public.profiles(id) on delete set null,
  created_date timestamptz default now()
);

-- Enable RLS on properties
alter table public.properties enable row level security;

-- 2. Create units table
create table public.units (
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

-- Enable RLS on units
alter table public.units enable row level security;

-- 3. Create tenants table
create table public.tenants (
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
  user_id       uuid references public.profiles(id) on delete set null, -- Link to auth profile
  created_date  timestamptz default now()
);

-- Enable RLS on tenants
alter table public.tenants enable row level security;

-- Add self-reference from units to tenants table for integrity
alter table public.units add constraint fk_units_tenant foreign key (tenant_id) references public.tenants(id) on delete set null;

-- 4. Create leases table
create table public.leases (
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

-- Enable RLS on leases
alter table public.leases enable row level security;

-- 5. Create payments table
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete set null,
  tenant_name    text,
  unit_id        uuid references public.units(id) on delete set null,
  unit_number    text,
  property_id    uuid references public.properties(id) on delete set null,
  property_name  text,
  amount         integer not null,
  payment_date   date not null,
  payment_method text not null,
  month_for      text not null,
  reference      text,
  notes          text,
  created_date   timestamptz default now()
);

-- Enable RLS on payments
alter table public.payments enable row level security;

-- 6. Create maintenance_requests table
create table public.maintenance_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete set null,
  tenant_name   text,
  unit_id       uuid references public.units(id) on delete set null,
  unit_number   text,
  property_id   uuid references public.properties(id) on delete set null,
  property_name text,
  title         text not null,
  description   text,
  category      text not null,
  priority      text not null check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status        text not null default 'Open' check (status in ('Open', 'In Progress', 'Completed')),
  cost          integer,
  created_date  timestamptz default now()
);

-- Enable RLS on maintenance_requests
alter table public.maintenance_requests enable row level security;

-- 7. Create invoices table
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid references public.leases(id) on delete set null,
  unit_id       uuid not null references public.units(id) on delete cascade,
  unit_number   text,
  property_id   uuid not null references public.properties(id) on delete cascade,
  property_name text,
  tenant_id     uuid references public.tenants(id) on delete set null,
  tenant_name   text,
  month_for     text not null,
  due_date      date,
  base_rent     integer not null,
  items         jsonb default '[]'::jsonb,
  total         integer not null,
  status        text not null default 'Unpaid' check (status in ('Unpaid', 'Paid')),
  reminder_sent boolean default false,
  created_date  timestamptz default now()
);

-- Enable RLS on invoices
alter table public.invoices enable row level security;


-- =========================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS to break recursion loops)
-- =========================================================================

-- Checks if requester role in JWT metadata is 'agent'
create or replace function public.is_agent()
returns boolean as $$
begin
  return coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'agent';
end;
$$ language plpgsql security definer;

-- Checks if requester role in JWT metadata is 'landlord'
create or replace function public.is_landlord()
returns boolean as $$
begin
  return coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'landlord';
end;
$$ language plpgsql security definer;

-- Checks if the user is a tenant of a given property (RLS bypass)
create or replace function public.is_tenant_of_property(property_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenants
    where user_id = auth.uid() and property_id = property_uuid
  );
end;
$$ language plpgsql security definer;

-- Checks if the user is the landlord of a given property (RLS bypass)
create or replace function public.is_landlord_of_property(property_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.properties
    where id = property_uuid and landlord_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Checks if the user is the tenant of a given unit (RLS bypass)
create or replace function public.is_tenant_of_unit(unit_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenants
    where user_id = auth.uid() and unit_id = unit_uuid
  );
end;
$$ language plpgsql security definer;


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Clean policies to avoid duplicate name conflicts if running multiple times
drop policy if exists "Agent full access on properties" on public.properties;
drop policy if exists "Landlord view own properties" on public.properties;
drop policy if exists "Tenant view linked properties" on public.properties;
drop policy if exists "Public view unit details" on public.properties;

drop policy if exists "Agent full access on units" on public.units;
drop policy if exists "Landlord view units of own properties" on public.units;
drop policy if exists "Tenant view own unit" on public.units;
drop policy if exists "Public view unit info" on public.units;

drop policy if exists "Agent full access on tenants" on public.tenants;
drop policy if exists "Landlord view tenants of own properties" on public.tenants;
drop policy if exists "Tenant view own profile" on public.tenants;

drop policy if exists "Agent full access on leases" on public.leases;
drop policy if exists "Landlord view leases of own properties" on public.leases;
drop policy if exists "Tenant view own leases" on public.leases;
drop policy if exists "Public view lease config" on public.leases;

drop policy if exists "Agent full access on payments" on public.payments;
drop policy if exists "Landlord view payments of own properties" on public.payments;
drop policy if exists "Tenant view own payments" on public.payments;

drop policy if exists "Agent full access on maintenance" on public.maintenance_requests;
drop policy if exists "Landlord view maintenance of own properties" on public.maintenance_requests;
drop policy if exists "Tenant full access to own maintenance requests" on public.maintenance_requests;

drop policy if exists "Agent full access on invoices" on public.invoices;
drop policy if exists "Landlord view invoices of own properties" on public.invoices;
drop policy if exists "Tenant view own invoices" on public.invoices;


-- --- Properties Policies ---
create policy "Agent full access on properties"
  on public.properties for all using (public.is_agent());

create policy "Landlord view own properties"
  on public.properties for select
  using (public.is_landlord() and landlord_id = auth.uid());

create policy "Tenant view linked properties"
  on public.properties for select
  using (public.is_tenant_of_property(id));

create policy "Public view unit details"
  on public.properties for select
  using (true);


-- --- Units Policies ---
create policy "Agent full access on units"
  on public.units for all using (public.is_agent());

create policy "Landlord view units of own properties"
  on public.units for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own unit"
  on public.units for select
  using (public.is_tenant_of_unit(id));

create policy "Public view unit info"
  on public.units for select
  using (true);


-- --- Tenants Policies ---
create policy "Agent full access on tenants"
  on public.tenants for all using (public.is_agent());

create policy "Landlord view tenants of own properties"
  on public.tenants for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own profile"
  on public.tenants for select
  using (user_id = auth.uid());


-- --- Leases Policies ---
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


-- --- Payments Policies ---
create policy "Agent full access on payments"
  on public.payments for all using (public.is_agent());

create policy "Landlord view payments of own properties"
  on public.payments for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own payments"
  on public.payments for select
  using (public.is_tenant_of_property(property_id));


-- --- Maintenance Requests Policies ---
create policy "Agent full access on maintenance"
  on public.maintenance_requests for all using (public.is_agent());

create policy "Landlord view maintenance of own properties"
  on public.maintenance_requests for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant full access to own maintenance requests"
  on public.maintenance_requests for all
  using (public.is_tenant_of_property(property_id));


-- --- Invoices Policies ---
create policy "Agent full access on invoices"
  on public.invoices for all using (public.is_agent());

create policy "Landlord view invoices of own properties"
  on public.invoices for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own invoices"
  on public.invoices for select
  using (public.is_tenant_of_property(property_id));
