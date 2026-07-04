-- Add status column to payments table (Pending or Verified)
alter table public.payments 
add column if not exists status text default 'Pending';

-- Mark existing payments as Verified
update public.payments set status = 'Verified' where status is null;
