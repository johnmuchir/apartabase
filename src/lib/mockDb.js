/**
 * mockDb.js
 * 
 * In-memory relational database for Apartabase demo mode.
 * Data lives in a JS module-level object — always fresh on every page load.
 * No localStorage, no stale-cache issues, no version checks needed.
 * Interactive CRUD changes persist within the tab session only (correct for a demo).
 */


const DEFAULT_DB = {
  profiles: [
    { id: "demo-agent-id", email: "agent@apartabase.app", full_name: "Demo Agent", role: "agent", phone: "+254 711 111111" },
    { id: "demo-landlord-id", email: "landlord@apartabase.app", full_name: "Demo Landlord", role: "landlord", phone: "+254 722 222222" },
    { id: "demo-caretaker-id", email: "caretaker@apartabase.app", full_name: "Demo Caretaker", role: "caretaker", phone: "+254 733 333333" },
    { id: "demo-tenant-id", email: "tenant@apartabase.app", full_name: "Demo Tenant", role: "tenant", phone: "+254 744 444444" },
  ],
  properties: [
    { id: "prop-1", name: "Riverside Residences", location: "Westlands, Nairobi", address: "12 Rivers Road", total_units: 3, landlord_id: "demo-landlord-id", image_url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80", created_date: "2024-01-01T08:00:00.000Z" },
    { id: "prop-2", name: "Greengables Heights", location: "Kilimani, Nairobi", address: "5 Wood Avenue", total_units: 3, landlord_id: "demo-landlord-id", image_url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80", created_date: "2024-02-01T08:00:00.000Z" }
  ],
  units: [
    { id: "unit-1", property_id: "prop-1", unit_number: "101", floor_number: 1, unit_type: "2 Bedroom", monthly_rent: 45000, status: "Occupied", tenant_id: "tenant-1", created_date: "2024-01-02T09:00:00.000Z" },
    { id: "unit-2", property_id: "prop-1", unit_number: "102", floor_number: 1, unit_type: "1 Bedroom", monthly_rent: 30000, status: "Vacant", tenant_id: null, created_date: "2024-01-02T10:00:00.000Z" },
    { id: "unit-3", property_id: "prop-1", unit_number: "201", floor_number: 2, unit_type: "3 Bedroom Penthouse", monthly_rent: 75000, status: "Occupied", tenant_id: "tenant-2", created_date: "2024-01-02T11:00:00.000Z" },
    { id: "unit-4", property_id: "prop-2", unit_number: "A1", floor_number: 1, unit_type: "1 Bedroom Studio", monthly_rent: 25000, status: "Occupied", tenant_id: "demo-tenant-id", created_date: "2024-02-02T09:00:00.000Z" },
    { id: "unit-5", property_id: "prop-2", unit_number: "A2", floor_number: 1, unit_type: "2 Bedroom", monthly_rent: 40000, status: "Vacant", tenant_id: null, created_date: "2024-02-02T10:00:00.000Z" },
    { id: "unit-6", property_id: "prop-2", unit_number: "B1", floor_number: 2, unit_type: "2 Bedroom", monthly_rent: 40000, status: "Occupied", tenant_id: "tenant-3", created_date: "2024-02-02T11:00:00.000Z" }
  ],
  tenants: [
    { id: "tenant-1", user_id: "tenant-1", full_name: "John Muchiri", email: "john@gmail.com", phone: "+254 712 345678", status: "Active", unit_id: "unit-1", property_id: "prop-1", unit_number: "101", property_name: "Riverside Residences", monthly_rent: 45000, lease_start: "2024-01-01", lease_end: "2024-12-31", created_date: "2024-01-05T08:00:00.000Z" },
    { id: "tenant-2", user_id: "tenant-2", full_name: "Alice Wambui", email: "alice@gmail.com", phone: "+254 722 345678", status: "Active", unit_id: "unit-3", property_id: "prop-1", unit_number: "201", property_name: "Riverside Residences", monthly_rent: 75000, lease_start: "2024-03-01", lease_end: "2025-02-28", created_date: "2024-03-05T08:00:00.000Z" },
    { id: "demo-tenant-id", user_id: "demo-tenant-id", full_name: "Demo Tenant", email: "tenant@apartabase.app", phone: "+254 700 000000", status: "Active", unit_id: "unit-4", property_id: "prop-2", unit_number: "A1", property_name: "Greengables Heights", monthly_rent: 25000, lease_start: "2024-01-01", lease_end: "2024-12-31", created_date: "2024-02-05T08:00:00.000Z" },
    { id: "tenant-3", user_id: "tenant-3", full_name: "David Ochieng", email: "david@gmail.com", phone: "+254 733 345678", status: "Active", unit_id: "unit-6", property_id: "prop-2", unit_number: "B1", property_name: "Greengables Heights", monthly_rent: 40000, lease_start: "2024-05-01", lease_end: "2025-04-30", created_date: "2024-05-05T08:00:00.000Z" }
  ],
  leases: [
    { id: "lease-1", unit_id: "unit-1", tenant_id: "tenant-1", rent: 45000, deposit: 45000, start_date: "2024-01-01", end_date: "2024-12-31", status: "Active", doc_url: "https://example.com/lease-john.pdf", created_date: "2024-01-05T08:00:00.000Z" },
    { id: "lease-2", unit_id: "unit-3", tenant_id: "tenant-2", rent: 75000, deposit: 75000, start_date: "2024-03-01", end_date: "2025-02-28", status: "Active", doc_url: "https://example.com/lease-alice.pdf", created_date: "2024-03-05T08:00:00.000Z" },
    { id: "lease-3", unit_id: "unit-4", tenant_id: "demo-tenant-id", rent: 25000, deposit: 25000, start_date: "2024-01-01", end_date: "2024-12-31", status: "Active", doc_url: "https://example.com/lease-demo.pdf", created_date: "2024-02-05T08:00:00.000Z" },
    { id: "lease-4", unit_id: "unit-6", tenant_id: "tenant-3", rent: 40000, deposit: 40000, start_date: "2024-05-01", end_date: "2025-04-30", status: "Active", doc_url: "https://example.com/lease-david.pdf", created_date: "2024-05-05T08:00:00.000Z" }
  ],
  invoices: [
    { id: "inv-1", unit_id: "unit-1", tenant_id: "tenant-1", month_for: "July 2026", total: 45000, amount_paid: 45000, status: "Paid", due_date: "2026-07-05", invoice_number: "INV-0001", created_date: "2026-07-01T08:00:00.000Z" },
    { id: "inv-2", unit_id: "unit-3", tenant_id: "tenant-2", month_for: "July 2026", total: 75000, amount_paid: 0, status: "Unpaid", due_date: "2026-07-05", invoice_number: "INV-0002", created_date: "2026-07-01T08:00:00.000Z" },
    { id: "inv-3", unit_id: "unit-4", tenant_id: "demo-tenant-id", month_for: "July 2026", total: 25000, amount_paid: 0, status: "Unpaid", due_date: "2026-07-05", invoice_number: "INV-0003", created_date: "2026-07-01T08:00:00.000Z" },
    { id: "inv-4", unit_id: "unit-6", tenant_id: "tenant-3", month_for: "July 2026", total: 40000, amount_paid: 40000, status: "Paid", due_date: "2026-07-05", invoice_number: "INV-0004", created_date: "2026-07-01T08:00:00.000Z" }
  ],
  payments: [
    { id: "pay-1", tenant_id: "tenant-1", unit_id: "unit-1", amount: 45000, payment_date: "2026-07-03", payment_method: "M-Pesa", month_for: "July 2026", reference: "QER56TYUI8", status: "Verified", category: "Rent", deposit_portion: 0, created_date: "2026-07-03T10:00:00.000Z" },
    { id: "pay-2", tenant_id: "tenant-3", unit_id: "unit-6", amount: 40000, payment_date: "2026-07-04", payment_method: "Bank Transfer", month_for: "July 2026", reference: "TXN77890", status: "Verified", category: "Rent", deposit_portion: 0, created_date: "2026-07-04T12:00:00.000Z" },
    { id: "pay-3", tenant_id: "demo-tenant-id", unit_id: "unit-4", amount: 25000, payment_date: "2026-06-03", payment_method: "M-Pesa", month_for: "June 2026", reference: "MPE44567", status: "Verified", category: "Rent", deposit_portion: 0, created_date: "2026-06-03T10:00:00.000Z" }
  ],
  maintenance_requests: [
    { id: "maint-1", unit_id: "unit-4", tenant_id: "demo-tenant-id", title: "Leaking Bathroom Pipe", description: "The pipe beneath the bathroom sink is dripping slowly onto the cabinet floor.", priority: "Medium", status: "In Progress", cost: 1500, assigned_to: "Plumber Joe", payout_id: null, payout_status: "Unpaid", created_date: "2026-07-10T14:00:00.000Z" },
    { id: "maint-2", unit_id: "unit-1", tenant_id: "tenant-1", title: "Flickering Living Room Lights", description: "Living room chandelier light bulbs keep flickering even after replacing them.", priority: "Low", status: "Open", cost: 0, assigned_to: null, payout_id: null, payout_status: "Unpaid", created_date: "2026-07-12T09:00:00.000Z" }
  ],
  invitations: [
    { id: "invite-1", email: "test-landlord@gmail.com", full_name: "Test Landlord", role: "landlord", token: "4f6efde0-7b2a-4318-ae9f-1d89e5c4bc3a", status: "pending", created_date: "2026-07-13T10:00:00.000Z" }
  ],
  property_accounts: [
    { id: "acc-1", property_id: "prop-1", balance: 120000, status: "Paid", created_date: "2026-07-01T08:00:00.000Z" },
    { id: "acc-2", property_id: "prop-2", balance: 40000, status: "Paid", created_date: "2026-07-01T08:00:00.000Z" }
  ],
  landlord_payouts: [
    { id: "payout-1", property_id: "prop-1", amount: 100000, status: "Confirmed", reference: "PAY-9901", description: "June Rent Disbursement", payout_date: "2026-07-02", payout_type: "Commission", linked_deposit_id: null, linked_account_release_id: null, linked_maintenance_id: null, confirmed_date: "2026-07-02T16:00:00.000Z", created_date: "2026-07-02T10:00:00.000Z" }
  ],
  vacate_notices: [],
  evictions: [],
  receipts: [],
  tenant_deposits: []
};

// ─── In-memory store ─────────────────────────────────────────────────────────
// Deep-cloned from DEFAULT_DB so mutations don't affect the original.
// Resets to DEFAULT_DB automatically on every page refresh (module re-import).
let _db = JSON.parse(JSON.stringify(DEFAULT_DB));

class DemoDb {
  getTable(tableName) {
    return _db[tableName] || [];
  }

  reset() {
    _db = JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  list(tableName, orderBy, limit) {
    let list = [...this.getTable(tableName)];
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      const col = desc ? orderBy.slice(1) : orderBy;
      list.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === "string") return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return desc ? valB - valA : valA - valB;
      });
    }
    if (limit) list = list.slice(0, limit);
    return list;
  }

  filter(tableName, filters = {}, orderBy) {
    let list = this.getTable(tableName).filter(item =>
      Object.entries(filters).every(([key, value]) => item[key] === value)
    );
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      const col = desc ? orderBy.slice(1) : orderBy;
      list = [...list].sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === "string") return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return desc ? valB - valA : valA - valB;
      });
    }
    return list;
  }

  get(tableName, id) {
    return this.getTable(tableName).find(item => item.id === id) || null;
  }

  create(tableName, row) {
    if (!_db[tableName]) _db[tableName] = [];
    const newRow = {
      id: row.id || crypto.randomUUID(),
      created_date: new Date().toISOString(),
      ...row
    };
    _db[tableName].push(newRow);
    return newRow;
  }

  update(tableName, id, changes) {
    const list = _db[tableName] || [];
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;
    const updatedRow = { ...list[idx], ...changes };
    list[idx] = updatedRow;
    _db[tableName] = list;
    return updatedRow;
  }

  delete(tableName, id) {
    const list = _db[tableName] || [];
    _db[tableName] = list.filter(item => item.id !== id);
    return true;
  }
}

export const mockDb = new DemoDb();

/** Reset demo DB to defaults within the current session. */
export const resetMockDb = () => mockDb.reset();
