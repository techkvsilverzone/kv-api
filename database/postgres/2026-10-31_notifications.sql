-- Customer notifications: an in-app inbox plus device tokens for FCM push.
-- Additive and idempotent: safe to re-run. Apply with:
--   docker exec -i kvs-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < this-file
BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        varchar(40) NOT NULL,
  title       varchar(200) NOT NULL,
  body        varchar(1000) NOT NULL,
  route       varchar(300),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- One row per device token; a token moving to another account follows the last sign-in.
CREATE TABLE IF NOT EXISTS push_tokens (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    varchar(10) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);

COMMIT;
