# Matching Engine Roadmap

> **Status:** v2 — weighted alignment scoring, 75% threshold, tier ranking, alignment persistence, pass/withdraw flow, and lightweight recommendation boosts.  
> **Goal:** Production curated matching with explainable compatibility.

---

## Current state (v2)

| Layer | Status |
|-------|--------|
| Subscription tiers (base / plus / prime) | Done |
| Geo reach (local / national / global) | Done |
| Intent guardrail | Done |
| Hard filters (age, gender, completeness, discretion) | Done |
| Weighted alignment scoring (6 dimensions) | Done |
| Alignment questionnaire persisted server-side | Done |
| 75% match queue threshold | Done |
| Tier ranking (fifo / enhanced / realtime) | Done |
| Base daily delivery cap | **6/day** (product target 4–6) |
| Pass / decline / withdraw | Done |
| Recommendation boosts from connect history | Done (v1) |
| Viewer alignment required for feed | Done |
| Compatibility breakdown on profile + cards | Done |

### API

```
GET  /api/matches
GET  /api/matches/eligibility
GET  /api/matches/:profileId
POST /api/matches/:profileId/request
POST /api/matches/:profileId/accept
POST /api/matches/:profileId/decline
POST /api/matches/:profileId/withdraw
POST /api/matches/:profileId/pass
PUT  /api/auth/profile/alignment
```

---

## Phased build plan

### Phase 1 — Candidate filtering ✅

- Age / gender hard gates, declined pairs, discretion mode, profile completeness

### Phase 2 — Alignment scoring ✅

- Six-dimension weighted engine, demographic fit, questionnaire persistence, zero-out gate

### Phase 3 — Queue and ranking by tier ✅

| Tier | Algorithm | Behavior |
|------|-----------|----------|
| Base | FIFO | Score order; 6/day cap |
| Plus | Enhanced | Preferred-intent boost + recency |
| Prime | Realtime | Strong recency + alignment priority |

### Phase 4 — Profile and connection flow (in progress)

- [x] Match profile API + connect / accept
- [x] Decline / withdraw / pass endpoints
- [x] Compatibility breakdown in UI
- [x] Alignment assessment page restored
- [x] Chat threads fully backed by API (no localStorage pending list)

### Phase 5 — Admin and quality

- [ ] Admin dashboard: match queue health, delivery stats by tier
- [ ] Report / hide profiles from candidate pool
- [ ] Metrics: delivery rate, request rate, mutual rate by tier
- [ ] Deeper ML recommendation layer (embeddings / collaborative filtering)

---

## Deploy checklist

```bash
cd server
npm run migrate:019   # alignment_answers on profiles
npm run migrate:020   # match_feedback (pass / decline / connect)
```

Users must complete the alignment assessment (`alignment.html`) before receiving curated matches.

---

## Key files

| Concern | Server | Client |
|---------|--------|--------|
| Scoring | `server/utils/alignment-scoring.js` | `client/js/alignment-engine.js` |
| Answers | `server/utils/alignment-answers.js` | `client/js/alignment-api.js` |
| Ranking | `server/utils/match-ranking.js` | — |
| Recommendations | `server/utils/match-recommendations.js` | — |
| Match feed | `server/services/match.service.js` | `client/js/matches.js` |
| Entitlements | `server/utils/entitlements.js` | `client/js/membership.js` |
