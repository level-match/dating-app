# LEVEL — Exclusive Dating Platform for Ambitious Professionals

## Project Structure

```
dating-app/              ← repo root
├── client/              ← all frontend (Vite + Tailwind + React)
│   ├── assets/          (images, fonts, static files)
│   ├── css/             (global stylesheets)
│   ├── js/              (vanilla JS page scripts)
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

---

## Running the App

All commands below are run from the **repo root**.

| Command | What it does |
|---|---|
| `npm run dev:client` | Start Vite frontend on **port 3000** |
| `npm run dev:server` | Start Express backend on **port 4000** |
| `npm run build` | Build frontend for production |
| `npm run start:server` | Start backend in production mode |

You can also `cd` into either folder and run their own `npm` scripts directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, Tailwind CSS, React |
| Backend | Node.js, Express |
| Database / Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Payments | Subscription routes via server |
