-- Create sequence for invoice numbering starting at 1001
create sequence if not exists public.invoice_number_seq start with 1001;

-- Add invoice_number to invoices (auto-generated on insert)
alter table public.invoices 
add column if not exists invoice_number text default 'INV-' || nextval('invoice_number_seq');

-- Add invoice_number to payments to link payments to specific invoices
alter table public.payments 
add column if not exists invoice_number text;
