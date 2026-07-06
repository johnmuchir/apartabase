-- 1. Resolve mutable search paths for all SECURITY DEFINER functions
alter function public.handle_new_user() set search_path = public;
alter function public.is_tenant_of_property(property_uuid uuid) set search_path = public;
alter function public.is_landlord_of_property(property_uuid uuid) set search_path = public;
alter function public.is_tenant_of_unit(unit_uuid uuid) set search_path = public;
alter function public.generate_payment_receipt() set search_path = public;
alter function public.is_agent() set search_path = public;
alter function public.is_landlord() set search_path = public;
alter function public.allocate_invoice_deposits() set search_path = public;
alter function public.recalculate_invoice_payment_deposit_portions(invoice_uuid uuid) set search_path = public;
alter function public.on_payment_change_recalculate_deposit_portions() set search_path = public;
alter function public.on_invoice_change_recalculate_deposit_portions() set search_path = public;
alter function public.rls_auto_enable() set search_path = public;

-- 2. Revoke execute access from PUBLIC (anon and authenticated) for trigger and internal functions
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.generate_payment_receipt() from public;
revoke execute on function public.allocate_invoice_deposits() from public;
revoke execute on function public.recalculate_invoice_payment_deposit_portions(uuid) from public;
revoke execute on function public.on_payment_change_recalculate_deposit_portions() from public;
revoke execute on function public.on_invoice_change_recalculate_deposit_portions() from public;
revoke execute on function public.rls_auto_enable() from public;

-- 3. Revoke public/anon execute access on RLS helper functions, and only grant it to authenticated users
revoke execute on function public.is_agent() from public;
grant execute on function public.is_agent() to authenticated;

revoke execute on function public.is_landlord() from public;
grant execute on function public.is_landlord() to authenticated;

revoke execute on function public.is_tenant_of_property(uuid) from public;
grant execute on function public.is_tenant_of_property(uuid) to authenticated;

revoke execute on function public.is_landlord_of_property(uuid) from public;
grant execute on function public.is_landlord_of_property(uuid) to authenticated;

revoke execute on function public.is_tenant_of_unit(uuid) from public;
grant execute on function public.is_tenant_of_unit(uuid) to authenticated;

-- 4. Drop the broad read policy on the public bucket 'properties' to resolve the file listing warning
drop policy if exists "Allow Public Read Access on properties storage" on storage.objects;
