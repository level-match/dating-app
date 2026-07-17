-- ================================================================
-- LEVEL — Payment & Subscription Schema
-- All DDL is idempotent (IF NOT EXISTS) so this can be re-run safely.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────
-- Minimal mirror of the frontend user. The source of truth for profile
-- data stays in the app store; this table exists only to anchor
-- payment records and enforce per-user subscription constraints.
CREATE TABLE IF NOT EXISTS users (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          VARCHAR(255) UNIQUE NOT NULL, -- maps to Supabase auth user id
  email                VARCHAR(255) UNIQUE NOT NULL,
  onboarding_complete  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tier                     VARCHAR(10) NOT NULL CHECK (tier IN ('base', 'plus', 'prime')),
  status                   VARCHAR(20) NOT NULL
                             CHECK (status IN ('active', 'pending', 'past_due', 'cancelled', 'expired')),
  current_period_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  grace_period_end         TIMESTAMPTZ,           -- set on first payment failure; cleared on recovery
  retry_count              INTEGER     NOT NULL DEFAULT 0, -- automated retry attempts made
  provider                 VARCHAR(20) NOT NULL DEFAULT 'paymongo'
                             CHECK (provider IN ('paymongo', 'stripe', 'manual')),
  provider_subscription_id VARCHAR(255),          -- gateway-side subscription/link ID
  provider_customer_id     VARCHAR(255),          -- gateway-side customer ID
  cancelled_at             TIMESTAMPTZ,
  scheduled_tier           VARCHAR(10)
                             CHECK (scheduled_tier IS NULL OR scheduled_tier IN ('base', 'plus')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Single Active Subscription Mandate ───────────────────────────
-- The partial unique index is the hard DB-level guarantee that only one
-- active, pending, or past_due record exists per user at any timestamp.
-- Cancelled and expired rows are excluded so history is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_single_active
  ON subscriptions (user_id)
  WHERE status IN ('active', 'pending', 'past_due');

-- ─── Payment Ledger ──────────────────────────────────────────────
-- Immutable, append-only audit trail for every monetary event.
-- Records are never updated in place — status changes are the only exception.
CREATE TABLE IF NOT EXISTS payment_ledger (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id),
  subscription_id     UUID        REFERENCES subscriptions(id),
  type                VARCHAR(30) NOT NULL
                        CHECK (type IN (
                          'initial_charge',
                          'recurring_charge',
                          'upgrade_charge',
                          'prorata_credit',
                          'refund',
                          'retry_charge',
                          'downgrade_credit'
                        )),
  amount_centavos     INTEGER     NOT NULL,          -- PHP in centavos; negative = credit
  description         TEXT,
  provider            VARCHAR(20) NOT NULL DEFAULT 'paymongo',
  provider_payment_id VARCHAR(255),                  -- gateway payment/invoice ID for reconciliation
  idempotency_key     UUID        UNIQUE NOT NULL,   -- enforces exactly-once processing
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Webhook Events ──────────────────────────────────────────────
-- Every inbound webhook is recorded before processing. The UNIQUE constraint
-- on (provider, event_id) is the replay-attack defence — duplicate deliveries
-- are detected at INSERT and skipped without re-processing.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     VARCHAR(20) NOT NULL,
  event_id     VARCHAR(255) NOT NULL,   -- provider's own event identifier
  event_type   VARCHAR(100) NOT NULL,
  payload      JSONB        NOT NULL,
  processed_at TIMESTAMPTZ,             -- NULL while unprocessed
  error        TEXT,                    -- last processing error, if any
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

-- ─── Subscription History ────────────────────────────────────────
-- Append-only log of every tier change, status transition, and their cause.
-- Used for debugging, support, and compliance audits.
CREATE TABLE IF NOT EXISTS subscription_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID        NOT NULL REFERENCES subscriptions(id),
  user_id         UUID        NOT NULL REFERENCES users(id),
  from_tier       VARCHAR(10),
  to_tier         VARCHAR(10),
  from_status     VARCHAR(20),
  to_status       VARCHAR(20),
  reason          VARCHAR(100),          -- e.g. 'payment_confirmed', 'payment_failed_retry_2'
  triggered_by    VARCHAR(50)  NOT NULL DEFAULT 'webhook'
                    CHECK (triggered_by IN ('webhook', 'api', 'system', 'admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id  ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id         ON payment_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_subscription    ON payment_ledger (subscription_id);
CREATE INDEX IF NOT EXISTS idx_ledger_provider_pmt    ON payment_ledger (provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed    ON webhook_events (created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_history_user_id        ON subscription_history (user_id);

-- ─── Auto-update subscriptions.updated_at ────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
