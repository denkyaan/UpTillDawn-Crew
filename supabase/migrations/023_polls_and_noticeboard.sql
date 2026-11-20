-- ═══════════════════════════════════════════════════════════════
--  023_polls_and_noticeboard.sql
--  Staff Polls + Notice Board
-- ═══════════════════════════════════════════════════════════════

-- ── POLLS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question     TEXT NOT NULL,
  options      JSONB NOT NULL DEFAULT '[]',   -- array of strings
  created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT NOT NULL DEFAULT '',
  deadline     TIMESTAMPTZ NOT NULL,
  is_archived  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── POLL VOTES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)   -- one vote per person per poll
);

-- ── NOTICE BOARD POSTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notice_board_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content         TEXT NOT NULL,
  link_url        TEXT,
  link_label      TEXT,
  colour          TEXT NOT NULL DEFAULT '#fbbf24',
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT NOT NULL DEFAULT '',
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS polls_created_at_idx ON polls(created_at DESC);
CREATE INDEX IF NOT EXISTS polls_deadline_idx   ON polls(deadline);
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS notice_board_created_at_idx ON notice_board_posts(created_at DESC);

-- ── RLS POLICIES ─────────────────────────────────────────────
ALTER TABLE polls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_posts ENABLE ROW LEVEL SECURITY;

-- polls: everyone can read, any authenticated user can insert
CREATE POLICY "polls_select_all"  ON polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls_insert_auth" ON polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "polls_update_own"  ON polls FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "polls_delete_own"  ON polls FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- poll_votes: everyone can read votes, any authenticated user can insert their own
CREATE POLICY "poll_votes_select_all"  ON poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_insert_auth" ON poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "poll_votes_delete_own"  ON poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notice_board: everyone can read, insert, delete (open board)
CREATE POLICY "notice_select_all"  ON notice_board_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "notice_insert_auth" ON notice_board_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "notice_delete_any"  ON notice_board_posts FOR DELETE TO authenticated USING (true);
