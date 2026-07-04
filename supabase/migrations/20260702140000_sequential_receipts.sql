-- Create sequence for receipts
create sequence if not exists public.receipt_number_seq start with 1001;

-- Create receipts table
create table if not exists public.receipts (
  id             uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  payment_id     uuid not null references public.payments(id) on delete cascade,
  invoice_id     uuid references public.invoices(id) on delete set null,
  amount         integer not null,
  payment_date   date not null,
  created_date   timestamptz default now()
);

-- Enable RLS
alter table public.receipts enable row level security;

-- Drop existing policies if any
drop policy if exists "Agent full access on receipts" on public.receipts;
drop policy if exists "Landlord view receipts of own properties" on public.receipts;
drop policy if exists "Tenant view own receipts" on public.receipts;

-- Create RLS Policies
create policy "Agent full access on receipts"
  on public.receipts for all using (public.is_agent());

create policy "Landlord view receipts of own properties"
  on public.receipts for select
  using (
    exists (
      select 1 from public.payments p
      where p.id = receipts.payment_id
      and public.is_landlord_of_property(p.property_id)
    )
  );

create policy "Tenant view own receipts"
  on public.receipts for select
  using (
    exists (
      select 1 from public.payments p
      where p.id = receipts.payment_id
      and public.is_tenant_of_property(p.property_id)
    )
  );

-- Create trigger function to generate receipt on payment verification
create or replace function public.generate_payment_receipt()
returns trigger as $$
declare
  next_num integer;
  linked_invoice_id uuid;
begin
  if new.status = 'Verified' and (tg_op = 'INSERT' or old.status is null or old.status != 'Verified') then
    -- Prevent duplicate receipts for the same payment
    if not exists (select 1 from public.receipts r where r.payment_id = new.id) then
      -- Get next sequence number
      next_num := nextval('public.receipt_number_seq');

      -- Find linked invoice
      if new.invoice_number is not null then
        select id into linked_invoice_id from public.invoices where invoice_number = new.invoice_number limit 1;
      else
        select id into linked_invoice_id from public.invoices 
        where unit_id = new.unit_id 
          and tenant_id = new.tenant_id 
          and month_for = new.month_for 
        limit 1;
      end if;

      -- Insert receipt record
      insert into public.receipts (receipt_number, payment_id, invoice_id, amount, payment_date)
      values (
        'RCT-' || next_num,
        new.id,
        linked_invoice_id,
        new.amount,
        new.payment_date
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists after_payment_verified on public.payments;
create trigger after_payment_verified
  after insert or update on public.payments
  for each row
  execute function public.generate_payment_receipt();
