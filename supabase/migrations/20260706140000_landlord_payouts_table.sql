-- Add agent payment/payout details to profiles
alter table public.profiles add column if not exists mpesa_number text;
alter table public.profiles add column if not exists bank_name text;
alter table public.profiles add column if not exists bank_account text;
alter table public.profiles add column if not exists bank_paybill text;

-- Create landlord_payouts table
create table if not exists public.landlord_payouts (
  id                          uuid primary key default gen_random_uuid(),
  property_id                 uuid references public.properties(id) on delete set null,
  property_name               text,
  payout_type                 text not null check (payout_type in ('Commission', 'Deposit Refund', 'Maintenance')),
  amount                      numeric not null default 0,
  payout_date                 date not null default current_date,
  payee_name                  text,
  description                 text,
  reference                   text,
  notes                       text,
  status                      text not null default 'Pending' check (status in ('Pending', 'Confirmed')),
  confirmed_date              date,
  linked_account_release_id   uuid references public.property_accounts(id) on delete set null,
  linked_deposit_id           uuid references public.tenant_deposits(id) on delete set null,
  linked_maintenance_id       uuid references public.maintenance_requests(id) on delete set null,
  created_date                timestamptz default now()
);

alter table public.landlord_payouts enable row level security;

drop policy if exists "Agent full access on landlord_payouts" on public.landlord_payouts;
drop policy if exists "Landlord manage own property payouts" on public.landlord_payouts;

create policy "Agent full access on landlord_payouts"
  on public.landlord_payouts for all using (public.is_agent());

create policy "Landlord manage own property payouts"
  on public.landlord_payouts for all
  using (public.is_landlord_of_property(property_id));

-- Add payout_id link column to tenant_deposits table
alter table public.tenant_deposits add column if not exists payout_id uuid references public.landlord_payouts(id) on delete set null;

-- Alter status check constraint on tenant_deposits to allow 'Pending'
alter table public.tenant_deposits drop constraint if exists tenant_deposits_status_check;
alter table public.tenant_deposits add constraint tenant_deposits_status_check check (status in ('Held', 'Refunded', 'Applied', 'Pending'));
