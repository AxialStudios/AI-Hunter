-- 004_vote_rpc.sql
-- Server-side vote recording RPC.
-- Computes correctness and returns aggregate percentages server-side so
-- the client never needs a second round-trip, and was_correct is always
-- authoritative (not client-supplied).

CREATE OR REPLACE FUNCTION record_vote(
  p_task_id          uuid,
  p_user_id          uuid,
  p_chose_ai         boolean,
  p_response_time_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seed_real  integer;
  v_seed_ai    integer;
  v_real_count bigint;
  v_ai_count   bigint;
  v_total      bigint;
BEGIN
  -- Caller must match the user they're voting as
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Task must exist and be active; pulls seed counts while we're here
  SELECT seed_real_votes, seed_ai_votes
  INTO STRICT v_seed_real, v_seed_ai
  FROM tasks
  WHERE id = p_task_id AND approval_status = 'active';

  -- Insert the vote.
  -- chose_ai = true  → user correctly identified the AI image as AI (tapped real) = correct
  -- chose_ai = false → user thought the real image was AI (tapped AI image)      = incorrect
  -- Therefore: was_correct = chose_ai
  INSERT INTO votes (task_id, user_id, chose_ai, was_correct, response_time_ms)
  VALUES (p_task_id, p_user_id, p_chose_ai, p_chose_ai, p_response_time_ms);

  -- Aggregate across ALL votes for this task (SECURITY DEFINER bypasses RLS here)
  SELECT
    COUNT(*) FILTER (WHERE chose_ai = true),
    COUNT(*) FILTER (WHERE chose_ai = false)
  INTO v_real_count, v_ai_count
  FROM votes
  WHERE task_id = p_task_id;

  v_total := (v_seed_real + v_real_count) + (v_seed_ai + v_ai_count);

  RETURN jsonb_build_object(
    'was_correct', p_chose_ai,
    'real_pct',    ROUND(((v_seed_real + v_real_count)::numeric / NULLIF(v_total, 0)) * 100),
    'ai_pct',      ROUND(((v_seed_ai   + v_ai_count)::numeric  / NULLIF(v_total, 0)) * 100),
    'total_votes', v_total
  );
END;
$$;

-- Grant execute to authenticated users (includes Supabase anonymous sessions)
GRANT EXECUTE ON FUNCTION record_vote(uuid, uuid, boolean, integer) TO authenticated;
