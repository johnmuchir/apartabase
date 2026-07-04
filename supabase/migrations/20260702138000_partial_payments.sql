-- Add amount_paid column to invoices table to support partial payments
alter table public.invoices 
add column if not exists amount_paid integer default 0;

-- Update existing paid invoices to have amount_paid set to total
update public.invoices set amount_paid = total where status = 'Paid' and (amount_paid is null or amount_paid = 0);
