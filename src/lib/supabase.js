import { createClient } from '@supabase/supabase-js';
import { mockDb } from './mockDb';

const safeGetItem = (key) => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch (err) {
    console.warn("localStorage.setItem failed:", err);
  }
};

const safeRemoveItem = (key) => {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  } catch (err) {
    console.warn("localStorage.removeItem failed:", err);
  }
};

let realSupabase;
try {
  const isUrlValid = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const rawUrl = import.meta.env.VITE_SUPABASE_URL;
  const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const supabaseUrl = rawUrl && isUrlValid(rawUrl) ? rawUrl : 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = rawKey || 'placeholder-anon-key';

  realSupabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  console.error("Failed to initialize real Supabase client:", err);
  // Create a minimal dummy client to prevent null pointer exceptions
  realSupabase = {
    auth: {
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user: null }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
      async signInWithPassword() { return { data: { user: null }, error: new Error('Supabase client failed to initialize') }; },
      async signUp() { return { data: { user: null }, error: new Error('Supabase client failed to initialize') }; },
      async signOut() { return { error: null }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { data: { user: null }, error: null }; },
    },
    from() {
      return {
        select() { return this; },
        match() { return this; },
        eq() { return this; },
        neq() { return this; },
        gt() { return this; },
        gte() { return this; },
        lt() { return this; },
        lte() { return this; },
        in() { return this; },
        or() { return this; },
        order() { return this; },
        limit() { return this; },
        single() { return this; },
        maybeSingle() { return this; },
        then(resolve) { resolve({ data: [], error: new Error('Supabase client failed to initialize'), count: 0 }); }
      };
    }
  };
}

// Check if we are running in simulated/demo mode.
// NOTE: /login and /accept-invite are intentionally excluded — real users must
// always reach real Supabase on those paths. Demo sessions are activated
// exclusively by setting 'demo_role' in localStorage from Welcome.jsx.
export const isDemoMode = () => {
  if (typeof window === 'undefined') return false;
  return (
    !!safeGetItem('demo_role') ||
    !!safeGetItem('demo_user') ||
    window.location.pathname === '/welcome'
  );
};

// Fluent Query Builder to mimic Supabase query chains on mockDb
class DemoQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.filters = [];
    this.orderConfig = null;
    this.limitVal = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.isMutation = false;
    this.resultData = null;
    this.rangeConfig = null;
  }

  select(columns, options) {
    // For counting or querying all
    return this;
  }

  match(filters) {
    for (const [k, v] of Object.entries(filters)) {
      this.filters.push({ type: 'eq', column: k, value: v });
    }
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  or(filterStr) {
    this.filters.push({ type: 'or', raw: filterStr });
    return this;
  }

  range(from, to) {
    this.rangeConfig = { from, to };
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(row) {
    const rows = Array.isArray(row) ? row : [row];
    const created = [];
    for (const r of rows) {
      const newRow = mockDb.create(this.tableName, r);
      created.push(newRow);
    }
    this.resultData = Array.isArray(row) ? created : created[0];
    this.isMutation = true;
    return this;
  }

  update(changes) {
    const matching = this._executeSelect();
    const updated = [];
    for (const item of matching) {
      const res = mockDb.update(this.tableName, item.id, changes);
      if (res) updated.push(res);
    }
    this.resultData = this.isSingle ? (updated[0] ?? null) : updated;
    this.isMutation = true;
    return this;
  }

  delete() {
    const matching = this._executeSelect();
    for (const item of matching) {
      mockDb.delete(this.tableName, item.id);
    }
    this.resultData = matching;
    this.isMutation = true;
    return this;
  }

  _executeSelect() {
    let data = mockDb.getTable(this.tableName);

    // Apply filters
    for (const filter of this.filters) {
      if (filter.type === 'eq') {
        data = data.filter(item => item[filter.column] === filter.value);
      } else if (filter.type === 'neq') {
        data = data.filter(item => item[filter.column] !== filter.value);
      } else if (filter.type === 'gt') {
        data = data.filter(item => item[filter.column] > filter.value);
      } else if (filter.type === 'gte') {
        data = data.filter(item => item[filter.column] >= filter.value);
      } else if (filter.type === 'lt') {
        data = data.filter(item => item[filter.column] < filter.value);
      } else if (filter.type === 'lte') {
        data = data.filter(item => item[filter.column] <= filter.value);
      } else if (filter.type === 'in') {
        data = data.filter(item => filter.values.includes(item[filter.column]));
      } else if (filter.type === 'or') {
        const parts = filter.raw.split(',');
        const firstPart = parts[0] || '';
        const match = firstPart.match(/\.ilike\.(.+)$/);
        if (match && match[1]) {
          const term = match[1].replace(/%/g, '').toLowerCase();
          data = data.filter(item => {
            return parts.some(p => {
              const col = p.split('.')[0];
              const val = String(item[col] || '').toLowerCase();
              return val.includes(term);
            });
          });
        }
      }
    }

    // Apply ordering
    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      data = [...data].sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'string') {
          return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return ascending ? valA - valB : valB - valA;
      });
    }

    // Apply limit
    if (this.limitVal) {
      data = data.slice(0, this.limitVal);
    }

    return data;
  }

  then(onfulfilled, onrejected) {
    const run = async () => {
      try {
        if (this.isMutation) {
          let res = this.resultData;
          if (this.isSingle && Array.isArray(res)) {
            res = res[0] ?? null;
          }
          return { data: res, error: null, count: Array.isArray(res) ? res.length : (res ? 1 : 0) };
        }

        const data = this._executeSelect();
        const count = data.length;
        let result = data;

        if (this.rangeConfig) {
          result = result.slice(this.rangeConfig.from, this.rangeConfig.to + 1);
        }

        if (this.isSingle) {
          result = result[0] ?? null;
          if (!result) {
            return { data: null, error: new Error('No records found'), count: 0 };
          }
        } else if (this.isMaybeSingle) {
          result = result[0] ?? null;
        }
        return { data: result, error: null, count };
      } catch (err) {
        return { data: null, error: err, count: 0 };
      }
    };
    return run().then(onfulfilled, onrejected);
  }
}

// Mock auth interface
const mockAuth = {
  async getSession() {
    if (!isDemoMode()) return { data: { session: null }, error: null };

    const role = safeGetItem('demo_role') || 'tenant';
    const savedUser = safeGetItem('demo_user');
    const profile = savedUser ? JSON.parse(savedUser) : {
      id: `demo-${role}-id`,
      email: `${role}@apartabase.app`,
      full_name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role: role
    };

    return {
      data: {
        session: {
          user: {
            id: profile.id,
            email: profile.email,
            user_metadata: {
              full_name: profile.full_name,
              role: profile.role
            }
          }
        }
      },
      error: null
    };
  },

  async getUser() {
    const { data: { session } } = await this.getSession();
    return { data: { user: session?.user ?? null }, error: null };
  },

  async signInWithPassword({ email, password }) {
    // Look up profile by email in mockDb
    const profiles = mockDb.getTable('profiles');
    const matched = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      // Fallback to real supabase login
      return realSupabase.auth.signInWithPassword({ email, password });
    }

    // Set demo state
    safeSetItem('demo_role', matched.role);
    safeSetItem('demo_user', JSON.stringify(matched));

    return {
      data: {
        user: {
          id: matched.id,
          email: matched.email,
          user_metadata: {
            full_name: matched.full_name,
            role: matched.role
          }
        }
      },
      error: null
    };
  },

  async signUp({ email, password, options }) {
    const fullName = options?.data?.full_name || 'New Demo User';
    const role = options?.data?.role || 'tenant';

    // Verify if already exists
    const profiles = mockDb.getTable('profiles');
    if (profiles.some(p => p.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('A profile with this email already exists.');
    }

    // Create profile
    const newProfile = mockDb.create('profiles', {
      email: email.toLowerCase(),
      full_name: fullName,
      role: role,
      phone: '+254 700 000000'
    });

    return {
      data: {
        user: {
          id: newProfile.id,
          email: newProfile.email,
          user_metadata: {
            full_name: newProfile.full_name,
            role: newProfile.role
          }
        }
      },
      error: null
    };
  },

  async signOut() {
    safeRemoveItem('demo_role');
    safeRemoveItem('demo_user');
    return { error: null };
  },

  async resetPasswordForEmail(email) {
    console.log(`[Demo Auth] Simulating password reset link for ${email}`);
    return { error: null };
  },

  async updateUser({ password }) {
    console.log('[Demo Auth] Simulating password update');
    return { data: { user: {} }, error: null };
  },

  onAuthStateChange(callback) {
    // Provide stub auth subscriber
    const unsubscribe = () => {};
    return { data: { subscription: { unsubscribe } } };
  }
};

// Create a Proxy around realSupabase so we can dynamically intercept when in demo mode
export const supabase = new Proxy(realSupabase, {
  get(target, prop) {
    if (isDemoMode()) {
      if (prop === 'from') {
        return (tableName) => new DemoQueryBuilder(tableName);
      }
      if (prop === 'auth') {
        return mockAuth;
      }
    }

    // Otherwise fall back to real supabase client
    const value = target[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  }
});
