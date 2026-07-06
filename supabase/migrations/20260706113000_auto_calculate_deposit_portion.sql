-- 1. Create a function to recalculate the deposit portions of all verified payments for a given invoice
create or replace function public.recalculate_invoice_payment_deposit_portions(invoice_uuid uuid)
returns void as $$
declare
  inv_record record;
  item jsonb;
  total_deposit_billed integer := 0;
  total_non_deposit_billed integer := 0;
  remaining_non_deposit integer := 0;
  remaining_deposit integer := 0;
  pay_record record;
  allocated_non_deposit integer;
  allocated_deposit integer;
begin
  -- Fetch invoice
  select * into inv_record from public.invoices where id = invoice_uuid;
  if not found then
    return;
  end if;

  -- Calculate total deposit billed from invoice items
  for item in select * from jsonb_array_elements(inv_record.items)
  loop
    if item->>'description' ilike '%Deposit%' then
      total_deposit_billed := total_deposit_billed + (item->>'amount')::integer;
    end if;
  end loop;

  total_non_deposit_billed := inv_record.total - total_deposit_billed;
  remaining_non_deposit := total_non_deposit_billed;
  remaining_deposit := total_deposit_billed;

  -- Loop through all verified payments for this invoice in order of payment_date, created_date ascending
  for pay_record in 
    select * from public.payments 
    where status = 'Verified'
      and (
        (invoice_number is not null and invoice_number = inv_record.invoice_number)
        or (invoice_number is null and unit_id = inv_record.unit_id and tenant_id = inv_record.tenant_id and month_for = inv_record.month_for)
      )
    order by payment_date asc, created_date asc
  loop
    -- Determine how much of the payment goes to non-deposit charges first
    if pay_record.amount <= remaining_non_deposit then
      allocated_non_deposit := pay_record.amount;
      allocated_deposit := 0;
    else
      allocated_non_deposit := remaining_non_deposit;
      allocated_deposit := pay_record.amount - remaining_non_deposit;
      if allocated_deposit > remaining_deposit then
        allocated_deposit := remaining_deposit;
      end if;
    end if;

    -- Deduct from remaining balances
    remaining_non_deposit := remaining_non_deposit - allocated_non_deposit;
    remaining_deposit := remaining_deposit - allocated_deposit;

    -- Update the payment's deposit portion if it's different
    if pay_record.deposit_portion != allocated_deposit then
      update public.payments
      set deposit_portion = allocated_deposit
      where id = pay_record.id;
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- 2. Create the trigger function on payments table
create or replace function public.on_payment_change_recalculate_deposit_portions()
returns trigger as $$
declare
  linked_invoice_id uuid;
begin
  -- Find linked invoice for the NEW payment (if inserting or updating)
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.invoice_number is not null then
      select id into linked_invoice_id from public.invoices where invoice_number = new.invoice_number limit 1;
    else
      select id into linked_invoice_id from public.invoices 
      where unit_id = new.unit_id 
        and tenant_id = new.tenant_id 
        and month_for = new.month_for 
      limit 1;
    end if;
    
    if linked_invoice_id is not null then
      perform public.recalculate_invoice_payment_deposit_portions(linked_invoice_id);
    end if;
  end if;

  -- Also find linked invoice for the OLD payment (if updating or deleting) to handle shifting/unlinking
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    if old.invoice_number is not null then
      select id into linked_invoice_id from public.invoices where invoice_number = old.invoice_number limit 1;
    else
      select id into linked_invoice_id from public.invoices 
      where unit_id = old.unit_id 
        and tenant_id = old.tenant_id 
        and month_for = old.month_for 
      limit 1;
    end if;
    
    if linked_invoice_id is not null then
      perform public.recalculate_invoice_payment_deposit_portions(linked_invoice_id);
    end if;
  end if;

  return null;
end;
$$ language plpgsql security definer;

-- 3. Register the trigger on payments table
drop trigger if exists trigger_recalculate_deposit_portions on public.payments;
create trigger trigger_recalculate_deposit_portions
  after insert or delete or update of amount, status, payment_date, payment_method, month_for, reference, notes, invoice_number, unit_id, tenant_id
  on public.payments
  for each row
  execute function public.on_payment_change_recalculate_deposit_portions();

-- 4. Create the trigger function on invoices table
create or replace function public.on_invoice_change_recalculate_deposit_portions()
returns trigger as $$
begin
  perform public.recalculate_invoice_payment_deposit_portions(new.id);
  return null;
end;
$$ language plpgsql security definer;

-- 5. Register the trigger on invoices table
drop trigger if exists trigger_invoice_recalculate_deposit_portions on public.invoices;
create trigger trigger_invoice_recalculate_deposit_portions
  after update of items, total
  on public.invoices
  for each row
  execute function public.on_invoice_change_recalculate_deposit_portions();

-- 6. Recalculate deposit portions for all existing invoices to populate the deposit_portion column on past payments
do $$
declare
  inv_record record;
begin
  for inv_record in select id from public.invoices loop
    perform public.recalculate_invoice_payment_deposit_portions(inv_record.id);
  end loop;
end $$;
