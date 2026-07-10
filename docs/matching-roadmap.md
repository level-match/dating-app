# Matching Engine Roadmap

> **Status:** v1 shipped (`GET /api/matches`) — subscription-tier geo gating, intent guardrail, placeholder scoring, Base daily delivery tracking.  
> **Goal:** Replace mock/placeholder logic with a production matching system.

---

## Current state (v1)

| Layer | Status |
|-------|--------|
| Subscription tiers (base / plus / prime) | Done — `subscriptions` + `server/utils/entitlements.js` |
| Geo reach (local / national / global) | Done — `country_code` + `region_code` comparison |
| Intent guardrail | Done — `server/utils/matching-policy.js` |
| Daily delivery cap (Base) | Done — `match_deliveries` table (migration 012) |
| Compatibility score | **Placeholder** — shared FK overlap + deterministic seed |
| Candidate pool | All onboarded profiles except self |
| Profile view from match card | **Mock** — `client/js/members.js` |
| Connection requests / mutual state | Not built |
| Age / gender / block filters | Not built |

### v1 API

```
GET /api/matches
```

Returns: `matchingEligible`, `tier`, `geoReach`, `quota`, `matches[]`, `locked[]`.

---

## Target architecture

```
Client (matches.html, browse.html, profile.html)
    │
    ▼
GET  /api/matches                    — curated feed (tier + quota + geo)
GET  /api/matches/:profileId         — single candidate (public fields)
POST /api/matches/:profileId/request — connection request
GET  /api/matches/eligibility        — server-authoritative intent check
    │
    ▼
match.service.js
  ├── eligibility (intent, profile completeness, location)
  ├── candidate query (SQL + indexes)
  ├── hard filters (age, gender prefs, blocks)
  ├── geo classifier (viewer-relative local / national / global)
  ├── tier gate (subscription entitlements)
  ├── scoring engine (alignment weights)
  ├── queue / ranking (FIFO / enhanced / realtime by tier)
  └── delivery ledger (Base quota)
```

---

## Phased build plan

### Phase 1 — Candidate filtering (hard gates)

**Tasks**
- [ ] Filter by viewer `age_range_min` / `age_range_max` vs candidate `age`
- [ ] Filter by `profile_preferred_genders` vs candidate `gender_identity_id`
- [ ] Exclude blocked / declined pairs (new `connection_requests` table)
- [ ] Respect `block_colleagues` and `discretion_mode` (define overlap rules)
- [ ] Require minimum profile completeness (photos, intent, location)

**Database**
```sql
connection_requests (
  id, from_user_id, to_user_id, status, created_at, updated_at
)
-- status: pending | accepted | declined | withdrawn
```

**Files to touch**
- `server/services/match.service.js` — extend `CANDIDATE_SQL` / post-filter
- `server/db/migrations/20260710_013_connection_requests.js`

---

### Phase 2 — Alignment scoring engine

**Tasks**
- [ ] Define weight matrix for profile signal overlaps:
  - Intent category (preferred vs aligned bonus)
  - Career chapter, life integration, emotional style
  - Lifestyle values (junction table overlap count)
  - Long-term vision, mobility profile
- [ ] Replace `computeCompatibilityScore()` placeholder in `match.service.js`
- [ ] Return `compatibilityBreakdown` per match for profile view
- [ ] Add unit tests for scoring determinism

**Files to touch**
- `server/services/match.service.js`
- `server/utils/alignment-scoring.js` (new)
- `server/tests/alignment-scoring.test.js` (new)

---

### Phase 3 — Queue and ranking by tier

| Tier | Algorithm | Behavior |
|------|-----------|----------|
| Base | FIFO | Score order; deliver undelivered batch; 10/day cap |
| Plus | Enhanced | Boost preferred-intent pairs; recency factor |
| Prime | Realtime | Priority queue; rerank on profile updates |

**Tasks**
- [ ] Implement tier-specific sort in `match.service.js`
- [ ] Remove client-side `level_match_cycle` localStorage (server is source of truth)
- [ ] Optional: nightly job to refresh Base curated sets

---

### Phase 4 — Profile and connection flow

**Tasks**
- [ ] `GET /api/matches/:profileId` — public profile for match cards
- [ ] Wire `profile.html?id=<uuid>` to API (replace `members.js` for real users)
- [ ] `POST /api/matches/:profileId/request` — send connection request
- [ ] Mutual match detection → unlock messaging thread
- [ ] Update match status pills: `new` / `viewed` / `request` / `mutual`

**Files to touch**
- `server/routes/matches.js`
- `client/js/profile.js`
- `client/js/matches-api.js`
- `client/js/chat.js` (thread unlock on mutual)

---

### Phase 5 — Admin and quality

**Tasks**
- [ ] Admin dashboard: match queue health, delivery stats by tier
- [ ] Report / hide profiles from candidate pool
- [ ] Backfill structured location for legacy `location`-only profiles
- [ ] Metrics: delivery rate, request rate, mutual rate by tier

---

## Key files (keep in sync)

| Concern | Server | Client |
|---------|--------|--------|
| Entitlements | `server/utils/entitlements.js` | `client/js/membership.js` |
| Intent policy | `server/utils/matching-policy.js` | `client/js/matching-policy.js` |
| Geo | `server/utils/geo-matching.js` | — |
| Match feed | `server/services/match.service.js` | `client/js/matches.js` |
| API client | `server/routes/matches.js` | `client/js/matches-api.js` |
| Tier guards | — | `client/js/membership-guard.js` |

---

## Acceptance criteria (v2 complete)

1. Matches page shows **only real DB profiles** (no mock fallback in production)
2. Geo-locked cards enforced server-side per subscription tier
3. Base users cannot exceed 10 deliveries/day via API abuse
4. Casual-intent users cannot receive matches (server enforced)
5. Clicking a match opens a real profile from the API
6. Connection requests persist and update match status
7. Compatibility score is explainable (breakdown on profile)

---

## Deploy checklist

```bash
cd server
npm run migrate:012   # match_deliveries (required for Base quota)
```

Users need `country_code` + `region_code` in profile setup before geo matching works.
