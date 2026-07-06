-- Add deposit_portion column to payments table
-- This stores how much of a payment is a deposit vs pure rent,
-- so commission can be calculated on rent-only without cross-joining invoice/deposit tables.
alter table public.payments
  add column if not exists deposit_portion integer not null default 0;
