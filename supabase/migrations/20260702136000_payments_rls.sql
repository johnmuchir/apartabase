-- Add policies to allow tenants to insert their payments
drop policy if exists "Tenant can insert own payments" on public.payments;
create policy "Tenant can insert own payments"
  on public.payments for insert
  with check (public.is_tenant_of_property(property_id));

-- Add policies to allow tenants to mark invoices as paid
drop policy if exists "Tenant can update own invoices to paid" on public.invoices;
create policy "Tenant can update own invoices to paid"
  on public.invoices for update
  using (public.is_tenant_of_property(property_id))
  with check (public.is_tenant_of_property(property_id));
