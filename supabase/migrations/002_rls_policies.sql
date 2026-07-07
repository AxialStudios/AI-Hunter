-- ============================================================
-- AI Hunter — Row-Level Security Policies
-- ============================================================

-- ── tasks ───────────────────────────────────────────────────
-- Anyone (including anonymous users) can read active cards.
-- Only the service role (admin) can insert/update/delete tasks.
CREATE POLICY "Public can read active tasks"
  ON tasks FOR SELECT
  USING (approval_status = 'active');


-- ── votes ───────────────────────────────────────────────────
-- A user can only insert their own votes.
-- Nobody can update or delete votes — the log is append-only.
CREATE POLICY "Users can insert own votes"
  ON votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own votes"
  ON votes FOR SELECT
  USING (auth.uid() = user_id);


-- ── profiles ────────────────────────────────────────────────
-- A user can only read and write their own profile row.
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
