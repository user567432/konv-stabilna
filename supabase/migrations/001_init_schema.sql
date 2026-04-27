-- ============================================================
-- DUSAN STIL DASHBOARD - Initial Schema
-- ============================================================

-- Enums
CREATE TYPE shift_type AS ENUM ('prva', 'druga', 'dvokratna');

-- ============================================================
-- STORES (4 radnje)
-- ============================================================
CREATE TABLE stores (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  location    text NOT NULL,
  segment     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKERS (radnice)
-- ============================================================
CREATE TABLE workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  initials    text NOT NULL,
  full_name   text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, initials)
);

CREATE INDEX idx_workers_store ON workers(store_id) WHERE active = true;

-- ============================================================
-- SHIFTS (dnevni unosi)
-- ============================================================
CREATE TABLE shifts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  worker_id      uuid NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  shift_date     date NOT NULL,
  shift_type     shift_type NOT NULL,
  entries        integer NOT NULL CHECK (entries >= 0),
  buyers         integer NOT NULL CHECK (buyers >= 0),
  revenue        numeric(12,2) NOT NULL CHECK (revenue >= 0),
  items_sold     integer NOT NULL CHECK (items_sold >= 0),
  note           text,
  conversion_pct numeric(6,2) GENERATED ALWAYS AS (
    CASE WHEN entries > 0 THEN ROUND((buyers::numeric / entries) * 100, 2) ELSE 0 END
  ) STORED,
  aov            numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN buyers > 0 THEN ROUND(revenue / buyers, 2) ELSE 0 END
  ) STORED,
  items_per_buyer numeric(6,2) GENERATED ALWAYS AS (
    CASE WHEN buyers > 0 THEN ROUND(items_sold::numeric / buyers, 2) ELSE 0 END
  ) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (buyers <= entries)
);

CREATE INDEX idx_shifts_date ON shifts(shift_date DESC);
CREATE INDEX idx_shifts_store_date ON shifts(store_id, shift_date DESC);
CREATE INDEX idx_shifts_worker ON shifts(worker_id);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE settings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          text REFERENCES stores(id) ON DELETE CASCADE,
  conversion_target numeric(5,2) NOT NULL DEFAULT 15.00,
  aov_target        numeric(12,2) NOT NULL DEFAULT 3000.00,
  revenue_target    numeric(12,2),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

-- Dnevni agregat
CREATE VIEW daily_store_summary AS
SELECT
  s.store_id,
  s.shift_date,
  SUM(s.entries)   AS total_entries,
  SUM(s.buyers)    AS total_buyers,
  SUM(s.revenue)   AS total_revenue,
  SUM(s.items_sold) AS total_items,
  CASE WHEN SUM(s.entries) > 0
       THEN ROUND((SUM(s.buyers)::numeric / SUM(s.entries)) * 100, 2)
       ELSE 0 END AS conversion_pct,
  CASE WHEN SUM(s.buyers) > 0
       THEN ROUND(SUM(s.revenue) / SUM(s.buyers), 2)
       ELSE 0 END AS aov,
  COUNT(*) AS shifts_count
FROM shifts s
GROUP BY s.store_id, s.shift_date;

-- RLS
ALTER TABLE stores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_stores"   ON stores   FOR SELECT USING (true);
CREATE POLICY "public_read_workers"  ON workers  FOR SELECT USING (active = true);
CREATE POLICY "public_read_settings" ON settings FOR SELECT USING (true);
CREATE POLICY "public_insert_shifts" ON shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "public_read_shifts"   ON shifts FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE workers;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
