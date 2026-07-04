-- Create property_accounts table
create table if not exists public.property_accounts (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties(id) on delete cascade,
  release_date          date not null default current_date,
  amount_gross          numeric not null default 0,
  amount_commission     numeric not null default 0,
  amount_refunds        numeric not null default 0,
  amount_net            numeric not null default 0,
  status                text not null default 'Paid' check (status in ('Paid', 'Pending')),
  notes                 text,
  created_date          timestamptz default now()
);

-- Enable RLS
alter table public.property_accounts enable row level security;

-- Policies for property_accounts
drop policy if exists "Agent full access on property_accounts" on public.property_accounts;
drop policy if exists "Landlord view own property_accounts" on public.property_accounts;

create policy "Agent full access on property_accounts"
  on public.property_accounts for all using (public.is_agent());

create policy "Landlord view own property_accounts"
  on public.property_accounts for select using (public.is_landlord_of_property(property_id));

-- Add account_release_id link columns to payments and tenant_deposits tables
alter table public.payments add column if not exists account_release_id uuid references public.property_accounts(id) on delete set null;
alter table public.tenant_deposits add column if not exists account_release_id uuid references public.property_accounts(id) on delete set null;
