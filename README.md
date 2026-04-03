# D&M Travelers Inn – Hotel Management & Booking System

Full-stack hotel booking and admin platform per the project PRD: public booking site (mobile-first, SEO, Framer Motion), admin panel, Supabase, REST API on Vercel serverless, email verification, Stripe/PayPal/GCash, RBAC, and reports.

## Stack

- **Frontend:** React (Vite), TypeScript, TailwindCSS, Framer Motion, React Router
- **Backend:** Separate API (e.g. Vercel serverless or other); see `app/api/` for route contracts
- **Database:** Supabase (PostgreSQL)
- **Auth:** JWT (admin), email verification (guests)
- **Payments:** Stripe (PayPal/GCash stubbed for integration)
- **Email:** SMTP (Nodemailer)

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and set:

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL  
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key  
- `JWT_SECRET` – random string for signing admin JWTs  
- `VITE_API_URL` – base URL of the API server (`http://localhost:5471`; see “Two ports” below)  
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`  
- Payments: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (optional for deposit flow)
- PayMongo QRPh:
  - `PAYMONGO_SECRET_KEY` (server-side API key)
  - `PAYMONGO_WEBHOOK_SECRET` (webhook signature secret from PayMongo dashboard)
  - `PAYMONGO_QRPH_EXPIRY_SECONDS` (optional, 60-9000; defaults to 1800)
  - `PAYMONGO_TREASURY_WALLET_ID` (required for Treasury withdrawal submission to PayMongo)
  - `PAYMONGO_TREASURY_CALLBACK_SECRET` (optional; falls back to `JWT_SECRET` to sign Treasury transfer callbacks)
  - `TREASURY_DESTINATION_SECRET` (required to encrypt saved treasury destination account numbers at rest)

### 3. Database

Run the migration in Supabase (SQL Editor or CLI):

```bash
# From project root, run the SQL in:
# supabase/migrations/001_initial_schema.sql
```

### 4. Seed first admin (optional)

```bash
node scripts/seed-admin.mjs
```

The script will prompt for **email** and **password** if they’re not set in `.env` / `.env.local` as `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Enter the credentials you want for the first admin user.

### 5. Run the app (two ports only)

This project uses **exactly two ports**:

| Port  | Role    | Command       | URL                      |
|-------|---------|---------------|--------------------------|
| **4242** | Frontend | `npm run dev` | http://localhost:4242   |
| **5471** | Server (API) | `npm run api`  | http://localhost:5471   |

All API calls from the frontend go to the server on **5471**. Set `VITE_API_URL=http://localhost:5471` in `.env.local`.

**Terminal 1 – Server (API):**

```bash
npm run api
```

**Terminal 2 – Frontend:**

```bash
npm run dev
```

Then open **http://localhost:4242** (site and admin at `/admin`). If port 4242 is in use, Vite will error (no automatic fallback to another port).

**Production preview (after building):**

```bash
npm run build
npm start
```

Serves the built app from `dist/` on port 4242. Run `npm run build` first or you’ll get “page not found”.

---

## How to access the admin

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open the admin in your browser:**
   - **URL:** [http://localhost:4242/admin](http://localhost:4242/admin)  
   - Or use the **Admin** link in the site navbar.  
   - Visiting `/admin` automatically redirects to `/admin/login`.

3. **Log in** with an admin account.  
   If you don’t have one yet, create the first admin user:
   ```bash
   node scripts/seed-admin.mjs
   ```
   Enter your email and password when prompted, then use those same credentials on the admin login page.  
   Make sure the **API server is running** (`npm run api`, port 5471) and `VITE_API_URL=http://localhost:5471` in `.env.local`, or login will fail with 404.

4. **After login** you’ll see the dashboard. From the sidebar you can open:
   - **Dashboard** – overview and recent bookings  
   - **Bookings** – list and manage reservations  
   - **Rooms** – room list and management  
   - **Housekeeping** – room status (Dirty, In Cleaning, Clean, Maintenance)  
   - **Restaurant** – menu items  
   - **Reports** – revenue and occupancy (with CSV export)  
   - **Users** – admin users (Super Admin only)  
   - **Settings** – hotel settings  

**Note:** The database (Supabase) must be set up and the migration `supabase/migrations/001_initial_schema.sql` applied before admin login will work. Fill in `.env.local` with your Supabase URL and service role key.

## Deployment (Vercel)

1. Connect the repo to Vercel.
2. Add all variables from `.env.example` in **Project → Settings → Environment Variables** (for Production/Preview).
3. Deploy. API routes are serverless under `/api/*`.

**Note:** For CSV/PDF report export with auth, call the reports API with `Authorization: Bearer <token>` (e.g. from a frontend button that fetches and triggers download).

## API overview

- `POST /api/admin/login` – admin login (returns JWT)
- `GET/POST /api/bookings` – list (admin) / create (public)
- `GET/PATCH /api/bookings/[id]` – get/update booking
- `POST /api/bookings/verify` – submit email verification code
- `POST /api/bookings/payment/deposit` – confirm 30% deposit
- `POST /api/public/bookings/payments/qrph/intent` – create/reuse QRPh payment intent for verified public booking
- `GET /api/public/bookings/payments/qrph/status` – check live QRPh payment status
- `POST /api/public/bookings/payments/qrph/cancel` – cancel booking from QR payment step
- `GET /api/public/booking-config` – public booking policy config (`deposit_percent`, cancellation policy, security notice)
- `POST /api/public/paymongo/webhook` – PayMongo webhook endpoint (must be configured in PayMongo dashboard)
- `GET /api/treasury/summary` – hotel-only treasury summary based on segregated ledger entries
- `GET /api/treasury/receiving-institutions?provider=instapay|pesonet` – fetch PayMongo receiving institutions for destination setup
- `GET/POST /api/treasury/destinations` – list or save treasury destinations with provider/institution code
- `POST /api/treasury/withdrawals` – create treasury withdrawal request
- `POST /api/treasury/withdrawals/[id]/approve` – approve withdrawal request
- `POST /api/treasury/withdrawals/[id]/complete` – mark approved withdrawal as completed with external reference
- `POST /api/treasury/withdrawals/[id]/cancel` – cancel pending treasury withdrawal
- `GET/POST/PATCH /api/rooms`, `PATCH /api/rooms/[id]`
- `GET /api/room_types`
- `GET /api/housekeeping/rooms`, `PATCH /api/housekeeping/room/[id]/status`
- `GET/POST /api/reviews`, `PATCH /api/reviews/[id]/approve`
- `GET/POST /api/menu`, `PATCH /api/menu/[id]`
- `GET /api/reports/occupancy`, `GET /api/reports/revenue` (optional `?format=csv`)
- `GET/POST /api/admin/users`, `GET/PATCH /api/settings`

## Data retention (per PRD)

- **Payments:** 7 years (archival)
- **Bookings:** 5 years (audit)
- **Reviews:** indefinite when public

## KPIs

- LCP ≤ 2.5s, TTI ≤ 3s (public site)
- `POST /api/bookings` latency ≤ 1.5s
- Uptime target ≥ 99.9%
