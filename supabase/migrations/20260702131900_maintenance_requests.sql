-- 7. Create maintenance_requests table
create table if not exists public.maintenance_requests (
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

alter table public.maintenance_requests enable row level security;

-- Policies for maintenance
drop policy if exists "Agent full access on maintenance" on public.maintenance_requests;
drop policy if exists "Landlord view maintenance of own properties" on public.maintenance_requests;
drop policy if exists "Tenant full access to own maintenance requests" on public.maintenance_requests;

create policy "Agent full access on maintenance"
  on public.maintenance_requests for all using (public.is_agent());

create policy "Landlord view maintenance of own properties"
  on public.maintenance_requests for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant full access to own maintenance requests"
  on public.maintenance_requests for all
  using (public.is_tenant_of_property(property_id));
