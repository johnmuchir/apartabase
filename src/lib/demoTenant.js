/**
 * demoTenant.js
 *
 * Replaces the old missing demoTenant lib.
 * In real (Supabase) mode: looks up the authenticated user's tenant record by email.
 * In demo mode (demo_role=tenant in localStorage): returns a mock tenant object.
 */

import { supabase } from '@/lib/supabase';

const DEMO_TENANT = {
  id: 'demo-tenant-id',
  full_name: 'Demo Tenant',
  email: 'demo@apartabase.app',
  phone: '+254 700 000000',
  unit_id: 'demo-unit-id',
  unit_number: 'A1',
  unit_type: '1 Bedroom',
  property_id: 'demo-property-id',
  property_name: 'Demo Apartments',
  status: 'Active',
  monthly_rent: 25000,
  lease_start: '2024-01-01',
  lease_end: '2024-12-31',
};

const DEMO_PAYMENTS = [
  {
    id: 'demo-pay-1',
    tenant_id: 'demo-tenant-id',
    amount: 25000,
    payment_date: '2024-06-05',
    payment_method: 'M-Pesa',
    month_for: 'June 2024',
    reference: 'MPE001',
  },
  {
    id: 'demo-pay-2',
    tenant_id: 'demo-tenant-id',
    amount: 25000,
    payment_date: '2024-05-03',
    payment_method: 'M-Pesa',
    month_for: 'May 2024',
    reference: 'MPE002',
  },
];

/**
 * Returns { tenant, payments } for the currently authenticated tenant.
 * Falls back to demo data when demo_role is set.
 */
export async function loadDemoTenant() {
  const demoRole = localStorage.getItem('demo_role');

  if (demoRole === 'tenant') {
    return { tenant: DEMO_TENANT, payments: DEMO_PAYMENTS };
  }

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return { tenant: null, payments: [] };

    // Find tenant record linked to this user's email
    const { data: tenants } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', user.email)
      .limit(1);

    const tenant = tenants?.[0] ?? null;
    if (!tenant) return { tenant: null, payments: [] };

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('payment_date', { ascending: false });

    return { tenant, payments: payments ?? [] };
  } catch {
    return { tenant: null, payments: [] };
  }
}
