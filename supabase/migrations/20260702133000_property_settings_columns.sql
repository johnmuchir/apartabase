-- Add columns to properties table to support commission, accounts, and landlord-agent contracts
alter table public.properties 
add column if not exists commission_type text check (commission_type in ('percentage', 'fixed')) default 'percentage',
add column if not exists commission_rate numeric default 0,
add column if not exists bank_name text,
add column if not exists account_number text,
add column if not exists paybill_number text,
add column if not exists account_name text,
add column if not exists contract_url text,
add column if not exists compliance_url text;
