# Apartabase - Property Management System

Apartabase is a modern, premium, role-based Property Management System (PMS) designed for landlords, property agents, caretakers, and tenants. It features a complete React frontend powered by Vite, Tailwind CSS, and Radix UI components, backed by a robust Supabase (Postgres) database with strict Row-Level Security (RLS) policies.

---

## 🚀 Key Features

*   **Role-Based Dashboards**: Custom interfaces, workflows, and statistics tailored for:
    *   **Agents**: Full administration capabilities (managing properties, units, tenants, invoices, leases, invitations).
    *   **Landlords**: Financial and occupancy overview for their owned properties.
    *   **Caretakers**: Property-specific operations and maintenance oversight.
    *   **Tenants**: Private dashboard to view lease details, pay rent (Stripe-ready), and submit/track maintenance requests.
*   **Property & Unit Management**: Add and inspect properties, organize units by floor/type, and monitor occupancy status.
*   **Tenant & Lease Tracking**: Seamlessly check tenants in and out, sign digital lease references, and track deposits, utility balances, and lease durations.
*   **Automated Billing & Invoices**: Generate sequential invoice numbering, log partial payments, track deposit/utility ledgers, and manage payment states (`Paid`, `Unpaid`).
*   **Maintenance Work Orders**: Tenants can submit tickets, and agents/landlords can assign priorities (`Low`, `Medium`, `High`, `Urgent`), estimate costs, and track resolution status.
*   **Secure Invitations**: Agents can invite other users (landlords, tenants, caretakers) to join the platform securely via email-bound tokens.

---

## 🛠️ Architecture & Tech Stack

### Frontend
*   **Framework**: [React 18](https://react.dev/) initialized with [Vite](https://vitejs.dev/)
*   **Routing**: [React Router DOM v6](https://reactrouter.com/) (using protected routing based on authenticated profiles)
*   **State Management & Data Fetching**: [TanStack Query v5 (React Query)](https://tanstack.com/query/latest) for efficient, cached server-state fetching
*   **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with custom animations and variables
*   **UI Components**: [Radix UI](https://www.radix-ui.com/) primitives styled with `class-variance-authority` (shadcn/ui setup)
*   **Visualizations**: [Recharts](https://recharts.org/) for business analytics and monthly financial metrics
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Forms**: [React Hook Form](https://react-hook-form.com/) combined with [Zod](https://zod.dev/) validation

### Backend (Supabase)
*   **Database**: PostgreSQL
*   **Authentication**: Supabase Auth (with email-based login and password resets)
*   **Row-Level Security (RLS)**: Fine-grained Postgres policies protecting every table, ensuring tenants only view their own data, landlords view their properties' data, and agents have global operational access.
*   **Triggers & Functions**: PL/pgSQL routines to automate profile generation, sequential invoice numbering, ledger balances, and cascading updates.

---

## 🗄️ Database Schema & Migrations

The database setup is managed via migration scripts located in the [supabase/migrations](file:///c:/Users/muchir/apartabase/supabase/migrations) directory.

### Key Database Tables

1.  **`profiles`**: Links directly to Supabase Auth (`auth.users`). Holds user info and enforces one of four roles: `'agent'`, `'landlord'`, `'tenant'`, or `'caretaker'`.
2.  **`properties`**: Represents buildings or estates, linked to a landlord owner.
3.  **`units`**: Represents physical rooms/apartments within a property, storing monthly rent rates, floor numbers, occupancy status, and active tenant links.
4.  **`tenants`**: Profiles of individuals renting units, storing lease durations and status (`Active`/`Inactive`).
5.  **`leases`**: Logs rent, deposit amounts, start/end dates, and document URLs (lease agreements, move-in/move-out inspections).
6.  **`payments`**: Records of transactions, specifying the payment date, method, reference numbers, and payment categories (e.g., base rent, utility fees, deposit portions).
7.  **`invoices`**: Rent invoices generated monthly or manually. Tracks itemized totals and billing status.
8.  **`maintenance_requests`**: Tickets filed for repair work, indicating priority, state (`Open`, `In Progress`, `Completed`), and associated cost records.
9.  **`invitations`**: Stores tokenized invites to onboard landlords, tenants, or caretakers securely.

---

## 📁 Directory Structure

```bash
apartabase/
├── supabase/
│   ├── config.toml           # Supabase local project config
│   └── migrations/           # PostgreSQL migration schema SQL files
├── src/
│   ├── api/                  # API communication functions
│   ├── components/           # UI elements & reusable React components
│   │   ├── charts/           # Dashboard data visualizations
│   │   ├── invoices/         # Invoice styling & receipt exporters
│   │   ├── layout/           # Sidebar, PageHeader, and Navigation shell
│   │   ├── ui/               # Shadcn/ui core components (Accordion, Buttons, Dialogs, etc.)
│   │   └── ProtectedRoute.jsx# Auth wrapper for routing guardrails
│   ├── hooks/                # Custom React hooks (e.g., queries & mutations)
│   ├── lib/                  # Library configurations (Supabase client, AuthContext, PDF utilities)
│   ├── pages/                # High-level route pages (Dashboards & management panels)
│   ├── utils/                # Helper utilities
│   ├── App.jsx               # Central Router & path configuration
│   ├── main.jsx              # App entry point with Providers
│   └── index.css             # Tailwind base and design system tokens
├── tailwind.config.js        # Tailwind layout adjustments & colors
└── vite.config.js            # Build config
```

---

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18 or higher recommended)
*   npm or yarn
*   A Supabase project (for local development or hosted cloud)

### Setup Instructions

1.  **Clone the Repository & Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment Variables**:
    Create a `.env` file in the root directory using the layout from `.env.example`:
    ```env
    VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
    VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
    ```

3.  **Run Migrations**:
    Apply the SQL migrations located in [supabase/migrations](file:///c:/Users/muchir/apartabase/supabase/migrations) to your Supabase instance to set up tables, triggers, and Row-Level Security (RLS) policies.

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Your local instance will start running at `http://localhost:5173`.

5.  **Build for Production**:
    ```bash
    npm run build
    ```

---

## 🔒 Security & Access Rules (RLS Summary)

*   **Agents**:
    *   Helper function: `public.is_agent()`
    *   Access: Full CRUD across all schemas to administer the properties.
*   **Landlords**:
    *   Helper functions: `public.is_landlord()`, `public.is_landlord_of_property()`
    *   Access: Read-only access to view their own properties, units, tenants, invoices, payments, and maintenance requests.
*   **Tenants**:
    *   Helper functions: `public.is_tenant_of_property()`, `public.is_tenant_of_unit()`
    *   Access: Allowed to view their own profile, rent payments, invoices, and have full write/read access to their own maintenance requests.
