-- Add payout linking columns to maintenance_requests table
alter table public.maintenance_requests 
  add column if not exists payout_id uuid references public.landlord_payouts(id) on delete set null,
  add column if not exists payout_status text default null check (payout_status in ('Pending', 'Paid'));
