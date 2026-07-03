-- ============================================================
-- AI Hunter — Initial Schema
-- ============================================================

-- ── Approval status enum ────────────────────────────────────
CREATE TYPE approval_status AS ENUM ('pending', 'active', 'rejected');


-- ── profiles ────────────────────────────────────────────────
-- One row per user. Linked to Supabase auth.users.
-- We store age RANGE and general region only — never precise
-- location or IP. Consent version + timestamp recorded here.
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age_range           TEXT,          -- e.g. '18-24', '25-34', '13-17'
  region              TEXT,          -- e.g. 'North America', 'Europe'
  self_rated_fluency  TEXT,          -- e.g. 'novice', 'intermediate', 'expert'
  tier_status         TEXT DEFAULT 'free',
  consent_version     TEXT,          -- e.g. '1.0' — bumped when terms change
  consented_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ── tasks (cards) ───────────────────────────────────────────
-- Every card has full provenance: where the real image came
-- from, which model made the AI image, the exact prompt used.
-- tell_annotations is a jsonb array of
-- { x, y, radius, label, description } objects.
-- seed votes give early users non-zero percentages to react to.
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  real_image_url      TEXT NOT NULL,
  ai_image_url        TEXT NOT NULL,
  ai_model_engine     TEXT NOT NULL,    -- e.g. 'gpt-image-2', 'gemini-nano'
  generation_prompt   TEXT,
  source_attribution  TEXT,             -- credit / license for the real image
  tell_annotations    JSONB DEFAULT '[]'::jsonb,
  approval_status     approval_status NOT NULL DEFAULT 'pending',
  seed_real_votes     INTEGER NOT NULL DEFAULT 0,
  seed_ai_votes       INTEGER NOT NULL DEFAULT 0,
  difficulty_tier     TEXT,             -- null until post-MVP ELO stamps it
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ── votes (the event log — the data asset) ──────────────────
-- One row per tap. Never aggregated away — percentages are
-- always recomputed from this log. This is the asset.
CREATE TABLE votes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chose_ai            BOOLEAN NOT NULL,   -- true = user thought the AI image was AI
  was_correct         BOOLEAN NOT NULL,
  response_time_ms    INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ── Indexes ─────────────────────────────────────────────────
-- Fast lookup of active cards and per-user/per-task vote history
CREATE INDEX idx_tasks_approval   ON tasks (approval_status);
CREATE INDEX idx_votes_task_id    ON votes (task_id);
CREATE INDEX idx_votes_user_id    ON votes (user_id);
