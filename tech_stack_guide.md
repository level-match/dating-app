# LEVEL — Full Tech Stack Guide

Welcome to the **LEVEL** Tech Stack Guide. This document details the architectural layout, core libraries, database models, and setup procedures for the entire codebase.

---

## 📁 Repository Overview
LEVEL is structured as a monorepo containing a frontend and backend subsystem:

*   **Root Configs**: Convenience orchestration scripts and monorepo management details.
    *   [package.json](file:///c:/Users/HP_06/sideHustle/dating-app/package.json)
*   **Frontend**: Located in [`/client`](file:///c:/Users/HP_06/sideHustle/dating-app/client) containing HTML pages, static styling assets, and React components compiled via Vite.
    *   [client/package.json](file:///c:/Users/HP_06/sideHustle/dating-app/client/package.json)
*   **Backend**: Located in [`/server`](file:///c:/Users/HP_06/sideHustle/dating-app/server) containing Express routes, service layers, and database migrations.
    *   [server/package.json](file:///c:/Users/HP_06/sideHustle/dating-app/server/package.json)

---

## 💻 Frontend Architecture

The frontend is a lightweight SPA/MPA hybrid, serving static pages while harnessing Vite, React, and Tailwind CSS for custom interface modules.

### Core Stack & Versioning
| Layer | Tech / Tool | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Build & Dev Tool** | Vite | `^5.4.0` | High-speed frontend bundling and local dev server. |
| **UI Framework** | React | `^18.3.0` | Building modern dashboard features and page components. |
| **Styling** | Tailwind CSS | `^3.4.10` | Utility-first CSS classes for layout and visual styling. |
| **Icons** | Lucide React | `^1.16.0` | Unified premium svg icon pack. |
| **Animation** | Framer Motion | `^11.3.0` | Elegant micro-animations and transition states. |
| **Backend Integration** | Supabase JS Client | `^2.106.2` | Client-side OAuth/email authentication and real-time listeners. |

### Config Files
*   [client/vite.config.js](file:///c:/Users/HP_06/sideHustle/dating-app/client/vite.config.js): Handles routing config, asset resolution, and dev-server parameters.
*   [client/tailwind.config.js](file:///c:/Users/HP_06/sideHustle/dating-app/client/tailwind.config.js): Custom themes, color palettes, and container overrides.
*   [client/postcss.config.js](file:///c:/Users/HP_06/sideHustle/dating-app/client/postcss.config.js): Compiles and post-processes Tailwind styles.

---

## ⚙️ Backend Architecture

The backend acts as the gateway for secure transactions, admin controls, webhook validation, and user session mapping.

### Core Stack & Versioning
| Dependency | Version | Purpose |
| :--- | :--- | :--- |
| **Web Server** | `express` | RESTful routing and API endpoints. |
| **Security Headers** | `helmet` | Injection/XSS prevention via HTTP headers. |
| **CORS Middleware** | `cors` | Restricting/permitting API calls to trusted origins. |
| **Authentication** | `jsonwebtoken` & `bcrypt` | JWT token issuing, verification, and password hashing. |
| **Rate Limiter** | `express-rate-limit` | Preventing DDoS attacks and brute-force logins. |
| **Database Connector** | `pg` | PostgreSQL pool and query manager. |

### Folder Breakdown
*   [server/index.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/index.js): App entrypoint setting up middleware, security configurations, and route mapping.
*   [`/server/routes`](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes): Express routers mapping HTTP requests to logic modules.
    *   [auth.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/auth.js): Handles profiles mapping and authentication checkups.
    *   [ref.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/ref.js): Returns reference lookup tables (intent, career, life integration, etc.).
    *   [subscriptions.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/subscriptions.js): Manages member tier updates and transaction records.
    *   [webhooks.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/webhooks.js): Listens for payments from payment gateways (e.g. PayMongo).
    *   [admin-auth.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/admin-auth.js): Session validation for administrators.
    *   [admin-api.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/routes/admin-api.js): Backend API routes for administrator tasks.
*   [`/server/services`](file:///c:/Users/HP_06/sideHustle/dating-app/server/services): Business logic and transaction engines.
    *   [subscription.service.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/services/subscription.service.js): Orchestrates payments, upgrades, and cancellations.
    *   [admin-auth.service.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/services/admin-auth.service.js): Houses admin session and tracking details.
*   [`/server/utils`](file:///c:/Users/HP_06/sideHustle/dating-app/server/utils): Custom helper utilities.
    *   [prorate.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/utils/prorate.js): Computes upgrade/downgrade fee prorating adjustments.

---

## 🗄️ Database Architecture & Schema

We use **PostgreSQL** configured via a connection pool in [server/db/pool.js](file:///c:/Users/HP_06/sideHustle/dating-app/server/db/pool.js). 

### Migration Setup
Migrations are written in plain SQL or JS wrappers inside `server/db/migrations/`:
1.  **001 Initial Schema**: Applies core billing and authentication schema mapping from [server/db/schema.sql](file:///c:/Users/HP_06/sideHustle/dating-app/server/db/schema.sql).
2.  **002 Admin Schema**: Configures tables from [server/db/admin-schema.sql](file:///c:/Users/HP_06/sideHustle/dating-app/server/db/admin-schema.sql) for administrative portals.
3.  **003 Profiles Table**: Adds the core `profiles` table to house matchmaking preferences.
4.  **004 Lookup Tables**: Installs normalized lookup metadata columns.
5.  **005 Preferred Genders**: Adds matchmaking parameters.
6.  **006 Profile Setup Fields**: Extends profiles with details needed for registration checks.

### Key Tables
*   `users`: Minimal mirror of Supabase users for payment associations.
*   `profiles`: Matchmaking, preferences, occupation, and onboarding answers.
*   `subscriptions`: Active payment tiers (`base`, `plus`, `prime`) and statuses (`active`, `pending`, `past_due`, `cancelled`, `expired`).
*   `payment_ledger`: Immutable audit logs for payments, credits, and refunds.
*   `admin_users`: Credentials and roles for administrative portals.
*   `admin_activity_logs`: Immutable logs tracking admin operations.

---

## ⚙️ Quickstart Workflow

### Environment Configuration

Share only the `.example` templates (no secrets). See README for the full file map.

1.  **Client**: `cp client/.env.example client/.env.local` (and optionally `.env.production.example` → `.env.production` for builds)
2.  **Server**: `cp server/.env.example server/.env`, plus `.env.development.example` → `.env.development` (local) or `.env.production.example` → `.env.production` (Droplet)

### Command Reference

Running commands from the **monorepo root**:

```bash
# 1. Install all dependencies at once
npm run install:all

# 2. Reset and build a fresh Database schema + seed values
npm run db:fresh

# 3. Start client dev server (runs on Port 3000)
npm run dev:client

# 4. Start backend API dev server (runs on Port 4000)
npm run dev:server
```

> [!NOTE]
> For UI styling development without database connectivity, use **Demo Mode** on the login page (`auth.html`). It utilizes local data structures loaded from `client/js/demo-data.js` to preview dashboard layouts.
