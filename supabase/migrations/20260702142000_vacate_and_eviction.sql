-- Create vacate_notices table
create table if not exists public.vacate_notices (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  lease_id              uuid references public.leases(id) on delete cascade,
  notice_date           date not null default current_date,
  expected_vacate_date  date not null,
  reason                text,
  status                text not null default 'Pending' check (status in ('Pending', 'Approved', 'Cancelled', 'Completed')),
  created_date          timestamptz default now()
);

-- Create evictions table
create table if not exists public.evictions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  lease_id             uuid references public.leases(id) on delete cascade,
  breach_type          text not null,
  notice_period_days   integer not null default 14,
  issued_date          date not null default current_date,
  termination_date     date not null,
  eviction_letter_url  text,
  status               text not null default 'Issued' check (status in ('Issued', 'Rescinded', 'Enforced')),
  created_date         timestamptz default now()
);

-- Enable RLS
alter table public.vacate_notices enable row level security;
alter table public.evictions enable row level security;

-- Drop existing policies if any
drop policy if exists "Agent full access on vacate_notices" on public.vacate_notices;
drop policy if exists "Landlord view vacate_notices of own properties" on public.vacate_notices;
drop policy if exists "Tenant view own vacate_notices" on public.vacate_notices;
drop policy if exists "Tenant create vacate_notices" on public.vacate_notices;
drop policy if exists "Tenant update own vacate_notices" on public.vacate_notices;

drop policy if exists "Agent full access on evictions" on public.evictions;
drop policy if exists "Landlord view evictions of own properties" on public.evictions;
drop policy if exists "Tenant view own evictions" on public.evictions;

-- Create policies for vacate_notices
create policy "Agent full access on vacate_notices"
  on public.vacate_notices for all using (public.is_agent());

create policy "Landlord view vacate_notices of own properties"
  on public.vacate_notices for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = vacate_notices.tenant_id
      and public.is_landlord_of_property(t.property_id)
    )
  );

create policy "Tenant view own vacate_notices"
  on public.vacate_notices for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = vacate_notices.tenant_id
      and public.is_tenant_of_property(t.property_id)
    )
  );

create policy "Tenant create vacate_notices"
  on public.vacate_notices for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = vacate_notices.tenant_id
      and public.is_tenant_of_property(t.property_id)
    )
  );

create policy "Tenant update own vacate_notices"
  on public.vacate_notices for update
  using (
    exists (
      select 1 from public.tenants t
      where t.id = vacate_notices.tenant_id
      and public.is_tenant_of_property(t.property_id)
    )
  );

-- Create policies for evictions
create policy "Agent full access on evictions"
  on public.evictions for all using (public.is_agent());

create policy "Landlord view evictions of own properties"
  on public.evictions for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = evictions.tenant_id
      and public.is_landlord_of_property(t.property_id)
    )
  );

create policy "Tenant view own evictions"
  on public.evictions for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = evictions.tenant_id
      and public.is_tenant_of_property(t.property_id)
    )
  );
