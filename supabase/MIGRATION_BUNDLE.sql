-- =============================================================
-- DUSAN STIL DASHBOARD — kompletna migracija za prazan Supabase projekat
-- Generisano: 2026-04-27
--
-- Sadrzi:
--   001_init_schema.sql       — stores, workers, shifts, settings + RLS
--   002_seed_data.sql         — 4 radnje + 18 radnica + default ciljevi
--   003_weekly_goals_anomaly_edit_log.sql
--   005_v2_complete.sql       — auth_config (per-store PIN), reset RPC,
--                               worker CRUD, calendar, weather cache
--
-- Migracija 004 je preskocena jer je 005 superset koji se primenjuje na cistu bazu.
--
-- Kako primeniti:
--   1) Otvori Supabase Dashboard → SQL Editor → New query
--   2) Nalepi CEO sadrzaj ovog fajla
--   3) Klikni RUN (Ctrl/Cmd + Enter)
--   4) Sacekaj ~5-10 sekundi; trazi "Success. No rows returned"
-- =============================================================


-- ============================================================
-- SECTION 1: 001_init_schema.sql
-- ============================================================

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


-- ============================================================
-- SECTION 2: 002_seed_data.sql
-- ============================================================

INSERT INTO stores (id, name, location, segment) VALUES
  ('D1', 'Zenska radnja Dusanova',     'Dusanova',    'Zenska'),
  ('D2', 'Muska radnja Dusanova',      'Dusanova',    'Muska'),
  ('D4', 'Zenska radnja Delta Planet', 'Delta Planet','Zenska'),
  ('D5', 'Muska radnja Delta Planet',  'Delta Planet','Muska');

INSERT INTO workers (store_id, initials) VALUES
  ('D1', 'JS'), ('D1', 'IJ'), ('D1', 'FD'),
  ('D2', 'SS'), ('D2', 'SE'), ('D2', 'DJM'), ('D2', 'ZI'),
  ('D4', 'AN'), ('D4', 'MIM'), ('D4', 'MS'), ('D4', 'MM'), ('D4', 'JN'),
  ('D5', 'IA'), ('D5', 'VA'), ('D5', 'MM'), ('D5', 'NA'), ('D5', 'MA'), ('D5', 'ST');

INSERT INTO settings (store_id, conversion_target, aov_target)
VALUES (NULL, 15.00, 3000.00);

INSERT INTO settings (store_id, conversion_target, aov_target) VALUES
  ('D1', 15.00, 3000.00),
  ('D2', 15.00, 3000.00),
  ('D4', 15.00, 3000.00),
  ('D5', 15.00, 3000.00);


-- ============================================================
-- SECTION 3: 003_weekly_goals_anomaly_edit_log.sql
-- ============================================================

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


-- ============================================================
-- SECTION 4: 005_v2_complete.sql (preskace se 004 — 005 je superset)
-- ============================================================

-- =============================================================
-- Migracija 005 — Konsolidovani v2 feature-i
-- =============================================================
-- Objedinjuje sve što je dodato kroz v2.0 → v2.4:
--   - auth_config tabela + pin_change_requests + RPC za auth/PIN
--   - TIM PIN po radnji (tim_pin_d1..d5)
--   - reset dana RPC (MASTER only)
--   - upravljanje radnicama (CRUD RPC)
--   - kalendar događaja i praznika
--   - vremenska prognoza cache (Open-Meteo)
-- =============================================================

-- -----------------
-- 1) AUTH CONFIG
-- -----------------
CREATE TABLE IF NOT EXISTS auth_config (
  id              int PRIMARY KEY DEFAULT 1,
  master_pin      text NOT NULL,
  tim_pin         text,           -- legacy, ostaje radi backward-kompat
  tim_pin_d1      text NOT NULL DEFAULT '1205',
  tim_pin_d2      text NOT NULL DEFAULT '7501',
  tim_pin_d4      text NOT NULL DEFAULT '4332',
  tim_pin_d5      text NOT NULL DEFAULT '1172',
  notify_email    text NOT NULL DEFAULT 'dusan@dusanstil.rs',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO auth_config (id, master_pin, tim_pin_d1, tim_pin_d2, tim_pin_d4, tim_pin_d5, notify_email)
VALUES (1, '4986', '1205', '7501', '4332', '1172', 'dusan@dusanstil.rs')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS pin_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target          text NOT NULL CHECK (target IN ('master','tim','tim_d1','tim_d2','tim_d4','tim_d5')),
  new_pin         text NOT NULL,
  code            text NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  confirmed_at    timestamptz,
  requester_ip    text
);
CREATE INDEX IF NOT EXISTS idx_pin_change_active
  ON pin_change_requests (expires_at) WHERE confirmed_at IS NULL;

ALTER TABLE auth_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_change_requests ENABLE ROW LEVEL SECURITY;

-- -----------------
-- 2) AUTH / RESET / PIN-CHANGE RPC (SECURITY DEFINER → server-side anon ne treba service_role)
-- -----------------
CREATE OR REPLACE FUNCTION get_auth_pins()
RETURNS TABLE(master_pin text, tim_pin_d1 text, tim_pin_d2 text, tim_pin_d4 text, tim_pin_d5 text, notify_email text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT master_pin, tim_pin_d1, tim_pin_d2, tim_pin_d4, tim_pin_d5, notify_email
  FROM auth_config WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION reset_shifts_for_day(p_date date, p_store_id text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_store_id IS NULL THEN
    DELETE FROM shifts WHERE shift_date = p_date;
  ELSE
    DELETE FROM shifts WHERE shift_date = p_date AND store_id = p_store_id;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION create_pin_change_request(p_target text, p_new_pin text, p_code text)
RETURNS TABLE(id uuid, expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM pin_change_requests WHERE confirmed_at IS NULL AND expires_at < now();
  INSERT INTO pin_change_requests (target, new_pin, code)
  VALUES (p_target, p_new_pin, p_code)
  RETURNING id, expires_at;
$$;

CREATE OR REPLACE FUNCTION delete_pin_change_request(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM pin_change_requests WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION confirm_pin_change(p_request_id uuid, p_code text)
RETURNS TABLE(target text, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r pin_change_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM pin_change_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::text, 'not_found'::text; RETURN; END IF;
  IF r.confirmed_at IS NOT NULL THEN RETURN QUERY SELECT NULL::text, 'already_used'::text; RETURN; END IF;
  IF r.expires_at < now() THEN RETURN QUERY SELECT NULL::text, 'expired'::text; RETURN; END IF;
  IF r.code <> p_code THEN RETURN QUERY SELECT NULL::text, 'bad_code'::text; RETURN; END IF;

  IF r.target = 'master'  THEN UPDATE auth_config SET master_pin  = r.new_pin, updated_at = now() WHERE id = 1;
  ELSIF r.target = 'tim_d1' THEN UPDATE auth_config SET tim_pin_d1 = r.new_pin, updated_at = now() WHERE id = 1;
  ELSIF r.target = 'tim_d2' THEN UPDATE auth_config SET tim_pin_d2 = r.new_pin, updated_at = now() WHERE id = 1;
  ELSIF r.target = 'tim_d4' THEN UPDATE auth_config SET tim_pin_d4 = r.new_pin, updated_at = now() WHERE id = 1;
  ELSIF r.target = 'tim_d5' THEN UPDATE auth_config SET tim_pin_d5 = r.new_pin, updated_at = now() WHERE id = 1;
  ELSIF r.target = 'tim' THEN UPDATE auth_config SET tim_pin_d1 = r.new_pin, tim_pin_d2 = r.new_pin, tim_pin_d4 = r.new_pin, tim_pin_d5 = r.new_pin, updated_at = now() WHERE id = 1;
  ELSE RETURN QUERY SELECT NULL::text, ('unknown_target:' || r.target); RETURN; END IF;

  UPDATE pin_change_requests SET confirmed_at = now() WHERE id = p_request_id;
  RETURN QUERY SELECT r.target, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION get_auth_pins(), reset_shifts_for_day(date, text),
  create_pin_change_request(text, text, text), delete_pin_change_request(uuid),
  confirm_pin_change(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_auth_pins(), reset_shifts_for_day(date, text),
  create_pin_change_request(text, text, text), delete_pin_change_request(uuid),
  confirm_pin_change(uuid, text) TO anon, authenticated;

-- -----------------
-- 3) UPRAVLJANJE RADNICAMA
-- -----------------
CREATE OR REPLACE FUNCTION create_worker(p_initials text, p_store_id text)
RETURNS TABLE(id uuid, initials text, store_id text, active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := upper(btrim(p_initials));
BEGIN
  IF v = '' OR length(v) > 8 THEN RAISE EXCEPTION 'Inicijali moraju imati 1-8 znakova.'; END IF;
  IF p_store_id NOT IN ('D1','D2','D4','D5') THEN RAISE EXCEPTION 'Nepoznata radnja: %', p_store_id; END IF;
  IF EXISTS (SELECT 1 FROM workers w WHERE w.store_id = p_store_id AND upper(w.initials) = v AND w.active) THEN
    RAISE EXCEPTION 'Radnik % već postoji u radnji %', v, p_store_id;
  END IF;
  RETURN QUERY INSERT INTO workers (initials, store_id, active) VALUES (v, p_store_id, true)
    RETURNING workers.id, workers.initials, workers.store_id, workers.active;
END;
$$;

CREATE OR REPLACE FUNCTION update_worker_store(p_worker_id uuid, p_new_store_id text)
RETURNS TABLE(id uuid, initials text, store_id text, active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_new_store_id NOT IN ('D1','D2','D4','D5') THEN RAISE EXCEPTION 'Nepoznata radnja: %', p_new_store_id; END IF;
  RETURN QUERY UPDATE workers SET store_id = p_new_store_id WHERE workers.id = p_worker_id
    RETURNING workers.id, workers.initials, workers.store_id, workers.active;
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_worker(p_worker_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE workers SET active = false WHERE id = p_worker_id;
$$;

CREATE OR REPLACE FUNCTION reactivate_worker(p_worker_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE workers SET active = true WHERE id = p_worker_id;
$$;

CREATE OR REPLACE FUNCTION list_all_workers()
RETURNS TABLE(id uuid, initials text, store_id text, active boolean, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, initials, store_id, active, created_at FROM workers
  ORDER BY store_id, active DESC, initials;
$$;

REVOKE ALL ON FUNCTION create_worker(text, text), update_worker_store(uuid, text),
  soft_delete_worker(uuid), reactivate_worker(uuid), list_all_workers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_worker(text, text), update_worker_store(uuid, text),
  soft_delete_worker(uuid), reactivate_worker(uuid), list_all_workers() TO anon, authenticated;

-- -----------------
-- 4) KALENDAR DOGAĐAJA
-- -----------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_from     date NOT NULL,
  date_to       date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('holiday', 'event')),
  scope         text NOT NULL CHECK (scope IN ('all','delta','dusanova','D1','D2','D4','D5')),
  title         text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT date_order CHECK (date_from <= date_to)
);
CREATE INDEX IF NOT EXISTS idx_calendar_range ON calendar_events (date_from, date_to);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_calendar" ON calendar_events;
CREATE POLICY "public_read_calendar" ON calendar_events FOR SELECT USING (true);

-- Seed: srpski praznici + Black Friday / Cyber Monday
INSERT INTO calendar_events (date_from, date_to, kind, scope, title, note) VALUES
  ('2026-01-01','2026-01-02','holiday','all','Nova godina','Državni praznik'),
  ('2026-01-07','2026-01-07','holiday','all','Božić','Državni praznik'),
  ('2026-02-15','2026-02-16','holiday','all','Sretenje','Dan državnosti'),
  ('2026-04-10','2026-04-13','holiday','all','Vaskrs','Veliki petak — Uskršnji ponedeljak'),
  ('2026-05-01','2026-05-02','holiday','all','Praznik rada','Državni praznik'),
  ('2026-11-11','2026-11-11','holiday','all','Dan primirja','Državni praznik'),
  ('2026-11-27','2026-11-27','event','all','Black Friday','Glavna Black Friday akcija'),
  ('2026-11-30','2026-11-30','event','all','Cyber Monday','Online/kanal akcija')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION list_calendar_events(p_from date, p_to date)
RETURNS SETOF calendar_events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM calendar_events WHERE date_to >= p_from AND date_from <= p_to ORDER BY date_from;
$$;

CREATE OR REPLACE FUNCTION create_calendar_event(p_date_from date, p_date_to date, p_kind text, p_scope text, p_title text, p_note text)
RETURNS calendar_events LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v calendar_events;
BEGIN
  INSERT INTO calendar_events (date_from, date_to, kind, scope, title, note)
  VALUES (p_date_from, p_date_to, p_kind, p_scope, p_title, NULLIF(btrim(p_note), ''))
  RETURNING * INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION delete_calendar_event(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM calendar_events WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION list_calendar_events(date, date),
  create_calendar_event(date, date, text, text, text, text), delete_calendar_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_calendar_events(date, date),
  create_calendar_event(date, date, text, text, text, text), delete_calendar_event(uuid) TO anon, authenticated;

-- -----------------
-- 5) WEATHER CACHE
-- -----------------
CREATE TABLE IF NOT EXISTS weather_daily (
  date            date PRIMARY KEY,
  temp_max        numeric(4,1),
  temp_min        numeric(4,1),
  precipitation   numeric(5,2),
  weather_code    integer,
  summary         text,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE weather_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_weather" ON weather_daily;
CREATE POLICY "public_read_weather" ON weather_daily FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION upsert_weather_daily(p_date date, p_temp_max numeric, p_temp_min numeric, p_precipitation numeric, p_weather_code integer, p_summary text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO weather_daily (date, temp_max, temp_min, precipitation, weather_code, summary, fetched_at)
  VALUES (p_date, p_temp_max, p_temp_min, p_precipitation, p_weather_code, p_summary, now())
  ON CONFLICT (date) DO UPDATE SET
    temp_max = EXCLUDED.temp_max, temp_min = EXCLUDED.temp_min,
    precipitation = EXCLUDED.precipitation, weather_code = EXCLUDED.weather_code,
    summary = EXCLUDED.summary, fetched_at = now();
$$;

REVOKE ALL ON FUNCTION upsert_weather_daily(date, numeric, numeric, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_weather_daily(date, numeric, numeric, numeric, integer, text) TO anon, authenticated;

