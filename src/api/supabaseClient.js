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
  Property:           makeEntity('properties'),
  Unit:               makeEntity('units'),
  Tenant:             makeEntity('tenants'),
  Payment:            makeEntity('payments'),
  MaintenanceRequest: makeEntity('maintenance_requests'),
  Lease:              makeEntity('leases'),
  Invoice:            makeEntity('invoices'),
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
      .single();
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
      console.warn('[integrations.Core.UploadFile] File upload not yet wired up.', file?.name);
      return { url: null };
    },
  },
};
