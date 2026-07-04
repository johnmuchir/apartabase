-- Create tenant_deposits table
create table if not exists public.tenant_deposits (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  deposit_type   text not null, -- e.g. 'Security Deposit'
  amount_billed  integer not null,
  amount_paid    integer not null default 0,
  status         text not null check (status in ('Held', 'Refunded', 'Applied')),
  created_date   timestamptz default now(),
  constraint tenant_deposit_uniq unique (tenant_id, invoice_id, deposit_type)
);

-- Enable RLS
alter table public.tenant_deposits enable row level security;

-- Drop existing policies if any
drop policy if exists "Agent full access on tenant_deposits" on public.tenant_deposits;
drop policy if exists "Landlord view tenant_deposits of own properties" on public.tenant_deposits;
drop policy if exists "Tenant view own tenant_deposits" on public.tenant_deposits;

-- Create RLS Policies
create policy "Agent full access on tenant_deposits"
  on public.tenant_deposits for all using (public.is_agent());

create policy "Landlord view tenant_deposits of own properties"
  on public.tenant_deposits for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_deposits.tenant_id
      and public.is_landlord_of_property(t.property_id)
    )
  );

create policy "Tenant view own tenant_deposits"
  on public.tenant_deposits for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_deposits.tenant_id
      and public.is_tenant_of_property(t.property_id)
    )
  );

-- Create trigger function to allocate invoice deposits
create or replace function public.allocate_invoice_deposits()
returns trigger as $$
declare
  item jsonb;
  deposit_amount integer;
  other_charges_total integer;
  allocated_paid integer;
begin
  -- Loop through all items in the invoice
  for item in select * from jsonb_array_elements(new.items)
  loop
    -- Check if the item is a deposit (description contains 'Deposit')
    if item->>'description' ilike '%Deposit%' then
      deposit_amount := (item->>'amount')::integer;
      
      -- Other charges = total invoice amount minus this deposit amount
      other_charges_total := new.total - deposit_amount;
      
      -- Calculate how much of the deposit has been paid:
      -- We allocate payments to other charges (rent/utilities) first, then deposit.
      if new.amount_paid > other_charges_total then
        allocated_paid := new.amount_paid - other_charges_total;
        if allocated_paid > deposit_amount then
          allocated_paid := deposit_amount;
        end if;
      else
        allocated_paid := 0;
      end if;

      -- Insert or update the tenant_deposits ledger
      insert into public.tenant_deposits (tenant_id, invoice_id, deposit_type, amount_billed, amount_paid, status)
      values (
        new.tenant_id,
        new.id,
        item->>'description',
        deposit_amount,
        allocated_paid,
        'Held'
      )
      on conflict (tenant_id, invoice_id, deposit_type) 
      do update set 
        amount_paid = excluded.amount_paid,
        amount_billed = excluded.amount_billed;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists after_invoice_amount_paid_update on public.invoices;
create trigger after_invoice_amount_paid_update
  after update of amount_paid on public.invoices
  for each row
  execute function public.allocate_invoice_deposits();
