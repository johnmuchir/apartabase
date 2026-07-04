-- 5. Create payments table
create table if not exists public.payments (
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

alter table public.payments enable row level security;

-- Policies for payments
drop policy if exists "Agent full access on payments" on public.payments;
drop policy if exists "Landlord view payments of own properties" on public.payments;
drop policy if exists "Tenant view own payments" on public.payments;

create policy "Agent full access on payments"
  on public.payments for all using (public.is_agent());

create policy "Landlord view payments of own properties"
  on public.payments for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own payments"
  on public.payments for select
  using (public.is_tenant_of_property(property_id));

-- 6. Create invoices table
create table if not exists public.invoices (
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

alter table public.invoices enable row level security;

-- Policies for invoices
drop policy if exists "Agent full access on invoices" on public.invoices;
drop policy if exists "Landlord view invoices of own properties" on public.invoices;
drop policy if exists "Tenant view own invoices" on public.invoices;

create policy "Agent full access on invoices"
  on public.invoices for all using (public.is_agent());

create policy "Landlord view invoices of own properties"
  on public.invoices for select
  using (public.is_landlord_of_property(property_id));

create policy "Tenant view own invoices"
  on public.invoices for select
  using (public.is_tenant_of_property(property_id));
