-- ============================================================
-- DUSAN STIL DASHBOARD - 003: Weekly goals, anomaly flag, edit log
-- ============================================================

-- ------------------------------------------------------------
-- SHIFTS: dodaj worker_ids (multi), anomaly_flag, closed_by
-- ------------------------------------------------------------
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS worker_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anomaly_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES workers(id) ON DELETE SET NULL;

-- Migriraj stare redove: ako je worker_ids prazan niz, postavi ga na [worker_id]
UPDATE shifts
SET worker_ids = ARRAY[worker_id]
WHERE (worker_ids IS NULL OR array_length(worker_ids, 1) IS NULL);

CREATE INDEX IF NOT EXISTS idx_shifts_anomaly ON shifts(anomaly_flag) WHERE anomaly_flag = true;

-- ------------------------------------------------------------
-- SETTINGS: dodaj monthly_revenue_target
-- ------------------------------------------------------------
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS monthly_revenue_target numeric(14,2);

-- ------------------------------------------------------------
-- WEEKLY_GOALS: nedeljni ciljevi (generisani iz mesečnog + ručno prepisani)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  week_start      date NOT NULL,  -- ponedeljak
  week_end        date NOT NULL,  -- nedelja
  goal_rsd        numeric(14,2) NOT NULL DEFAULT 0,
  manual_override boolean NOT NULL DEFAULT false,
  source_month    date,            -- prvi dan izvornog meseca, npr. 2026-04-01
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_goals_store_week ON weekly_goals(store_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_source_month ON weekly_goals(store_id, source_month);

ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_weekly_goals" ON weekly_goals FOR SELECT USING (true);

-- ------------------------------------------------------------
-- SHIFT_EDIT_LOG: istorija izmena i brisanja smena (60-day retention)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_edit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid REFERENCES shifts(id) ON DELETE SET NULL,
  action      text NOT NULL CHECK (action IN ('update','delete')),
  before      jsonb,
  after       jsonb,
  actor       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_edit_log_created ON shift_edit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_edit_log_shift ON shift_edit_log(shift_id);

ALTER TABLE shift_edit_log ENABLE ROW LEVEL SECURITY;
-- Samo serverski (service role) pristup za čitanje i pisanje; nema javne politike

-- ------------------------------------------------------------
-- purge_old_shift_edit_log: briše zapise starije od 60 dana
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_shift_edit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM shift_edit_log WHERE created_at < now() - interval '60 days';
$$;

-- ------------------------------------------------------------
-- Real-time publishovanje novih tabela
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'weekly_goals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE weekly_goals;
  END IF;
END$$;
