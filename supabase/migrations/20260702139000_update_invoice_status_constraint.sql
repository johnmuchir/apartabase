-- Drop the old constraint restricting invoice status choices
alter table public.invoices drop constraint if exists invoices_status_check;

-- Re-create status constraint to allow new workflow states
alter table public.invoices 
add constraint invoices_status_check 
check (status in ('Unpaid', 'Pending Verification', 'Partially Paid', 'Paid'));
