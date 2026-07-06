/**
 * supabaseClient.js
 *
 * Thin wrapper around @supabase/supabase-js that mirrors the old base44.entities API
 * surface so page-level code needs only a 1-line import change.
 *
 * Old:  import { base44 } from "@/api/base44Client"
 *       base44.entities.Property.list()
 *
 * New:  import { entities, auth, integrations } from "@/api/supabaseClient"
 *       entities.Property.list()
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a base44-style sort string ("-created_date") to Supabase order args.
 * Prefix "-" means descending.
 */
function parseOrder(orderBy) {
  if (!orderBy) return null;
  const desc = orderBy.startsWith('-');
  const column = desc ? orderBy.slice(1) : orderBy;
  return { column, ascending: !desc };
}

/** Throw a normalised error when a Supabase query fails. */
function throwIf(error) {
  if (error) throw new Error(error.message || JSON.stringify(error));
}

// ---------------------------------------------------------------------------
// Entity factory — creates a CRUD helper for any Supabase table
// ---------------------------------------------------------------------------

function makeEntity(tableName) {
  return {
    /** list(orderBy?, limit?) — returns all rows, optionally ordered and limited */
    async list(orderBy, limit) {
      let query = supabase.from(tableName).select('*');
      const order = parseOrder(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIf(error);
      return data ?? [];
    },

    /** filter(filters, orderBy?) — returns rows matching all key/value pairs */
    async filter(filters = {}, orderBy) {
      let query = supabase.from(tableName).select('*').match(filters);
      const order = parseOrder(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      const { data, error } = await query;
      throwIf(error);
      return data ?? [];
    },

    /** get(id) — returns a single row by primary key */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      throwIf(error);
      return data;
    },

    /** create(row) — inserts a row and returns it */
    async create(row) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(row)
        .select()
        .single();
      throwIf(error);
      return data;
    },

    /** update(id, changes) — patches a row and returns it */
    async update(id, changes) {
      const { data, error } = await supabase
        .from(tableName)
        .update(changes)
        .eq('id', id)
        .select()
        .single();
      throwIf(error);
      return data;
    },

    /** delete(id) — removes a row */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      throwIf(error);
    },
  };
}

// ---------------------------------------------------------------------------
// Entity map — covers every entity used in the app
// ---------------------------------------------------------------------------

export const entities = {
  Property: makeEntity('properties'),
  Unit: makeEntity('units'),
  Tenant: makeEntity('tenants'),
  Payment: makeEntity('payments'),
  MaintenanceRequest: makeEntity('maintenance_requests'),
  Lease: makeEntity('leases'),
  Invoice: makeEntity('invoices'),
  Invitation: makeEntity('invitations'),
  Receipt: makeEntity('receipts'),
  TenantDeposit: makeEntity('tenant_deposits'),
  VacateNotice: makeEntity('vacate_notices'),
  Eviction: makeEntity('evictions'),
  PropertyAccount: makeEntity('property_accounts'),
  LandlordPayout: makeEntity('landlord_payouts'),
};

// ---------------------------------------------------------------------------
// Auth helpers — mirrors base44.auth.me()
// ---------------------------------------------------------------------------

export const auth = {
  async me() {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    throwIf(userErr);
    if (!user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    throwIf(profileErr);

    // Return a merged object that looks like the old base44 user shape
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name ?? '',
      role: profile?.role ?? 'tenant',
      phone: profile?.phone ?? '',
      ...profile,
    };
  },
};

// ---------------------------------------------------------------------------
// Settlement Recalculator — single source of truth for invoice status.
// Call this after ANY payment is verified. It sums all Verified payments
// for the invoice and sets amount_paid + status accordingly.
// Verification ≠ paid-in-full: the system decides that independently.
// ---------------------------------------------------------------------------
export async function recalculateInvoiceSettlement(invoiceId) {
  if (!invoiceId) return;

  // Fetch the invoice
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !inv) return;

  // Sum only Verified payments linked to this invoice
  let payQuery = supabase
    .from("payments")
    .select("amount")
    .eq("status", "Verified");

  if (inv.invoice_number) {
    payQuery = payQuery.eq("invoice_number", inv.invoice_number);
  } else {
    payQuery = payQuery
      .eq("unit_id", inv.unit_id)
      .eq("tenant_id", inv.tenant_id)
      .eq("month_for", inv.month_for);
  }

  const { data: verifiedPayments, error: payErr } = await payQuery;
  if (payErr) return;

  const totalVerified = (verifiedPayments || []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  // Determine status from verified total vs invoice principal
  const newStatus =
    totalVerified >= inv.total
      ? "Paid"
      : totalVerified > 0
      ? "Partially Paid"
      : "Unpaid";

  await supabase
    .from("invoices")
    .update({ amount_paid: totalVerified, status: newStatus })
    .eq("id", inv.id);
}

// ---------------------------------------------------------------------------
// Integrations — stubs for email & file upload
// (wire up Supabase Edge Functions / Storage when ready)
// ---------------------------------------------------------------------------

export const integrations = {
  Core: {
    /** TODO: replace with Supabase Edge Function + Resend/SendGrid */
    async SendEmail(params) {
      console.warn('[integrations.Core.SendEmail] Email sending not yet wired up.', params);
    },

    /** TODO: replace with Supabase Storage upload */
    async UploadFile({ file }) {
      if (!file) return { url: null, file_url: null };
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('properties')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('properties')
          .getPublicUrl(filePath);

        return { url: publicUrl, file_url: publicUrl };
      } catch (err) {
        console.error('File upload error:', err);
        throw err;
      }
    },
  },
};
