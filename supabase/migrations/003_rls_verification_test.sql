-- ============================================================
-- RLS Verification Test
-- Run this in Supabase SQL Editor to confirm policies block
-- cross-user access. Safe to run — read-only, no data changed.
-- ============================================================

-- Switch to the anon role (what an unauthenticated stranger sees)
SET ROLE anon;

-- ── Test 1: Can a stranger read profiles? ───────────────────
-- Expected result: 0 rows
SELECT 'profiles visible to anon' AS test, count(*) AS rows_visible FROM profiles;

-- ── Test 2: Can a stranger read votes? ──────────────────────
-- Expected result: 0 rows
SELECT 'votes visible to anon' AS test, count(*) AS rows_visible FROM votes;

-- ── Test 3: Can a stranger read tasks? ──────────────────────
-- Expected result: 0 rows (no active tasks in DB yet)
SELECT 'active tasks visible to anon' AS test, count(*) AS rows_visible FROM tasks;

-- Reset back to superuser
RESET ROLE;
