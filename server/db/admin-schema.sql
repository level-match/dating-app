-- ================================================================
-- LEVEL — Admin System Schema
-- Run via: node db/admin-migrate.js
-- ================================================================

-- ─── Admin accounts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('super_admin', 'moderator', 'support')),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Brute-force tracking ────────────────────────────────────────
-- Every login attempt (success or fail) is recorded.
-- Failed attempts within the rolling window determine lockout.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) NOT NULL,
  ip_address   VARCHAR(45)  NOT NULL,
  success      BOOLEAN     NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_email ON admin_login_attempts (email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_ip    ON admin_login_attempts (ip_address, attempted_at DESC);

-- ─── Refresh token store ─────────────────────────────────────────
-- Tokens are stored as SHA-256 hashes, never plain-text.
-- Rotation: the old token is revoked before the new one is issued.
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256 hex of the raw JWT
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  revoked_at  TIMESTAMPTZ,                   -- NULL = active
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_admin ON admin_refresh_tokens (admin_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_admin_tokens_hash  ON admin_refresh_tokens (token_hash);

-- ─── Activity audit log ──────────────────────────────────────────
-- Every admin action is recorded immutably. Records are never deleted.
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID         NOT NULL REFERENCES admin_users(id),
  admin_email   VARCHAR(255) NOT NULL,
  action        VARCHAR(100) NOT NULL,    -- e.g. 'user.tier_changed', 'event.created'
  resource_type VARCHAR(50),              -- e.g. 'user', 'subscription', 'event'
  resource_id   VARCHAR(255),            -- the affected record's ID
  details       JSONB        NOT NULL DEFAULT '{}',
  ip_address    VARCHAR(45),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin     ON admin_activity_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_resource  ON admin_activity_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action    ON admin_activity_logs (action, created_at DESC);

-- ─── App-level extensions needed for admin oversight ─────────────
-- Reports queue (from user reports in the app)
CREATE TABLE IF NOT EXISTS content_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    VARCHAR(255) NOT NULL,
  reporter_name  VARCHAR(255),
  reported_id    VARCHAR(255) NOT NULL,
  reported_name  VARCHAR(255),
  type           VARCHAR(50)  NOT NULL
                   CHECK (type IN ('inappropriate_content','harassment','spam','fake_profile','other')),
  description    TEXT,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  reviewed_by    UUID REFERENCES admin_users(id),
  reviewed_at    TIMESTAMPTZ,
  resolution     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community events
CREATE TABLE IF NOT EXISTS community_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  type         VARCHAR(10)  NOT NULL CHECK (type IN ('mixer','vip')),
  description  TEXT,
  venue        VARCHAR(255),
  event_date   TIMESTAMPTZ NOT NULL,
  capacity     INTEGER     NOT NULL DEFAULT 50,
  rsvp_count   INTEGER     NOT NULL DEFAULT 0,
  eligibility  VARCHAR(10)  NOT NULL CHECK (eligibility IN ('plus','prime')),
  status       VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  created_by   UUID REFERENCES admin_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Concierge bookings
CREATE TABLE IF NOT EXISTS concierge_bookings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  user_name       VARCHAR(255),
  match_name      VARCHAR(255),
  request_type    VARCHAR(50)  NOT NULL
                    CHECK (request_type IN ('restaurant_reservation','experience','personal_assistance')),
  venue           VARCHAR(255),
  requested_date  DATE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes           TEXT,
  assigned_to     UUID REFERENCES admin_users(id),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auto-update updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_admin_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_admin_users_updated    ON admin_users;
DROP TRIGGER IF EXISTS trg_community_events_upd   ON community_events;
DROP TRIGGER IF EXISTS trg_concierge_bookings_upd ON concierge_bookings;

CREATE TRIGGER trg_admin_users_updated
  BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION touch_admin_updated_at();
CREATE TRIGGER trg_community_events_upd
  BEFORE UPDATE ON community_events FOR EACH ROW EXECUTE FUNCTION touch_admin_updated_at();
CREATE TRIGGER trg_concierge_bookings_upd
  BEFORE UPDATE ON concierge_bookings FOR EACH ROW EXECUTE FUNCTION touch_admin_updated_at();
