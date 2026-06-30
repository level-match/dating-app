# LEVEL — Exclusive Dating Platform for Ambitious Professionals

## Project Structure

```
dating-app/              ← repo root
├── client/              ← all frontend (Vite + Tailwind + React)
│   ├── assets/          (images, fonts, static files)
│   ├── css/             (global stylesheets)
│   ├── js/              (vanilla JS page scripts)
│   │   ├── demo-data.js   ← mock personas & prepopulated answers (see below)
│   │   ├── demo-mode.js   ← “Try demo” local preview sessions
│   │   ├── members.js     ← mock *other* people’s profiles
│   │   └── ref-data.js    ← lookup options from /api/ref/all
│   ├── src/             (React components & pages)
│   ├── *.html           (all app pages)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── server/              ← Node.js / Express backend
│   ├── db/              (migrations, seeds)
│   ├── middleware/       (auth, rate limiting)
│   ├── routes/          (API route handlers)
│   ├── services/        (business logic)
│   ├── utils/           (helpers)
│   ├── index.js         (entry point, port 4000)
│   └── package.json
├── .gitignore
└── package.json         ← root convenience scripts
```

---

## Getting Started

### 1. Install dependencies

From the repo root, install both client and server at once:

```bash
npm run install:all
```

Or install them separately:

```bash
cd client && npm install
cd server && npm install
```

### 2. Set up environment variables

**Client** — copy and fill in `client/.env.example`:

```bash
cp client/.env.example client/.env.local
```

**Server** — copy and fill in `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Fill in Supabase URL/keys on the client and `DATABASE_URL` + `SUPABASE_JWT_SECRET` on the server.

### 3. Database (first time or reset)

From repo root:

```bash
npm run db:fresh
```

This drops all tables, runs migrations 001–006, and seeds lookup values + admin user.

---

## Running the App

All commands below are run from the **repo root**.

| Command | What it does |
|---|---|
| `npm run dev:client` | Start Vite frontend on **port 3000** |
| `npm run dev:server` | Start Express backend on **port 4000** |
| `npm run build` | Build frontend for production |
| `npm run start:server` | Start backend in production mode |
| `npm run db:fresh` | Reset DB + migrate + seed |
| `npm run db:reset` | Drop all tables only (then run `db:fresh` to rebuild) |

You can also `cd` into either folder and run their own `npm` scripts directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, Tailwind CSS, React |
| Backend | Node.js, Express |
| Database / Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Payments | Subscription routes via server |
| Lookup options | `ref_*` tables → `/api/ref/all` |

---

## Real sign-up vs demo preview

| | **Real account** | **Demo preview** |
|---|---|---|
| Auth | Supabase — Google OAuth or email OTP | “Try demo” on `auth.html` |
| Database | Saved on profile setup **Save** | Local browser only |
| MFA | Real email OTP + mock phone `123456` | Skipped |
| Match cards on dashboard | After profile saved + eligible | Mock from `members.js` |

### Real sign-up flow

1. `auth.html` → Sign in with **Google** (or email OTP).
2. `mfa.html` → Email code from inbox; phone code **`123456`** (mock SMS).
3. `onboarding.html` → Options from **`GET /api/ref/all`** (not static HTML).
4. Complete onboarding → **`profile-setup.html`** (review name, email, selections).
5. **Save & Go to Dashboard** → `POST /api/auth/profile` → dashboard shows your real name.

---

## Demo & preview mode

Demo sessions are **local only** — no Supabase, no API profile. Use them for UI walkthroughs and design review.

Open **`http://localhost:3000/auth.html`** (or your Vite port) and scroll to **Try demo**:

| Button | Email shown | Lands on | What’s prepopulated |
|---|---|---|---|
| **New applicant** | `demo@level.app` | `onboarding.html` | Name + email only — walk onboarding from scratch |
| **After onboarding** | `preview@level.app` | `profile-setup.html` | Name, email, **all onboarding selections** — edit then save |
| **Returning member** | `alexandra@level.app` | `dashboard.html` | Full local session + mock match grid |

Prepopulated onboarding answers are defined in **`client/js/demo-data.js`** (`DEMO_ONBOARDING`). Labels match the DB seed in `server/db/seeds/20260629_002_lookup_values.js`.

### Mock *other* people (not your account)

Curated member profiles for browsing live in **`client/js/members.js`**:

- `profile.html?id=james-t`
- `profile.html?id=sarah-m`
- `matches.html` / dashboard match cards

Your own saved profile: **`profile.html?me=1`** (after real sign-up + save).

### MFA demo codes

| Step | Code |
|---|---|
| Phone (mock SMS) | `123456` |
| Email | Real code from Supabase inbox |

Defined in `client/js/demo-data.js` → `DEMO_MFA_PHONE_CODE`.

### Admin panel (server seed)

After `npm run db:fresh`:

| | |
|---|---|
| URL | `admin-login.html` |
| Email | `admin@level.app` |
| Password | `Level@Admin2024!` |

Change these in production. Override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env`.

---

## Key files

| File | Purpose |
|---|---|
| `client/js/demo-data.js` | Demo emails, prepopulated onboarding, admin credentials |
| `client/js/demo-mode.js` | `startDemoSession('applicant' \| 'profileReview' \| 'member')` |
| `client/js/members.js` | Mock profiles for *other* members |
| `client/js/onboarding.js` | Dynamic options + store-only until profile save |
| `client/js/profile-setup.js` | Review/edit + `POST /api/auth/profile` on save |
