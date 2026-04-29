-- =============================================================
-- Migracija 009 — Godisnji odmor + Mesecne plate
-- =============================================================
-- 1) workers: dodatni HR atributi (full_name vec postoji opciono,
--    dodajemo annual_leave_days, hire_date)
-- 2) leave_requests: zahtev radnice za odmor + status (pending/approved/rejected)
-- 3) monthly_salaries: MASTER unosi platu po radnici po mesecu, radnica vidi svoju
-- 4) RPC-ovi za sve operacije
-- =============================================================

-- -------------------------------------------------------------
-- 1) WORKERS — HR atributi
-- -------------------------------------------------------------
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS annual_leave_days int NOT NULL DEFAULT 20;

-- -------------------------------------------------------------
-- 2) LEAVE_REQUESTS — godisnji odmor
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  days_count      int NOT NULL,           -- broj radnih dana (kalendarski u prvoj verziji)
  reason          text,                   -- opciono "Putujem u Crnu Goru"
  status          text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_at     timestamptz,
  review_note     text,                   -- razlog odbijanja, opciono
  requested_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT date_order CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_worker
  ON leave_requests (worker_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_status
  ON leave_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_dates
  ON leave_requests (start_date, end_date);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
-- Public read za sada (radnice u svom profilu vide svoje, MASTER vidi sve).
-- Filtriranje po worker_id radimo na app sloju.
DROP POLICY IF EXISTS "public_read_leave" ON leave_requests;
CREATE POLICY "public_read_leave" ON leave_requests FOR SELECT USING (true);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;
  END IF;
END$$;

-- -------------------------------------------------------------
-- 3) MONTHLY_SALARIES — MASTER unosi
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_salaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  year            int NOT NULL CHECK (year >= 2024 AND year <= 2100),
  month           int NOT NULL CHECK (month >= 1 AND month <= 12),
  amount          numeric(12, 2) NOT NULL CHECK (amount >= 0),
  paid_at         date,                   -- opciono datum kada je isplaceno
  note            text,                   -- npr. "uvecano zbog Q4 bonusa"
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_salaries_worker_period
  ON monthly_salaries (worker_id, year DESC, month DESC);

ALTER TABLE monthly_salaries ENABLE ROW LEVEL SECURITY;
-- BEZ public policy — plata radnice je privatna.
-- Pristup samo preko SECURITY DEFINER RPC-ova.

-- -------------------------------------------------------------
-- 4) RPC-ovi za leave_requests
-- -------------------------------------------------------------

-- Radnica kreira zahtev (sa svojim worker_id-em)
CREATE OR REPLACE FUNCTION create_leave_request(
  p_worker_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text DEFAULT NULL
)
RETURNS leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result leave_requests;
  days_calc int;
BEGIN
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Datum povratka mora biti posle datuma odlaska.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workers WHERE id = p_worker_id AND active = true) THEN
    RAISE EXCEPTION 'Radnica ne postoji ili je deaktivirana.';
  END IF;

  -- Broj kalendarskih dana (krajnja inkluzivno)
  days_calc := (p_end_date - p_start_date) + 1;

  INSERT INTO leave_requests (worker_id, start_date, end_date, days_count, reason)
  VALUES (p_worker_id, p_start_date, p_end_date, days_calc, NULLIF(btrim(p_reason), ''))
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- MASTER lista zahteva sa filterom statusa
CREATE OR REPLACE FUNCTION list_leave_requests(p_status text DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  worker_id uuid,
  worker_initials text,
  worker_store_id text,
  start_date date,
  end_date date,
  days_count int,
  reason text,
  status text,
  reviewed_at timestamptz,
  review_note text,
  requested_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    lr.id, lr.worker_id, w.initials, w.store_id,
    lr.start_date, lr.end_date, lr.days_count, lr.reason, lr.status,
    lr.reviewed_at, lr.review_note, lr.requested_at
  FROM leave_requests lr
  JOIN workers w ON w.id = lr.worker_id
  WHERE p_status IS NULL OR lr.status = p_status
  ORDER BY
    CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END,
    lr.requested_at DESC;
$$;

-- Radnica lista svojih zahteva
CREATE OR REPLACE FUNCTION list_my_leave_requests(p_worker_id uuid)
RETURNS SETOF leave_requests
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM leave_requests
  WHERE worker_id = p_worker_id
  ORDER BY requested_at DESC;
$$;

-- Master odobrava ili odbacuje
CREATE OR REPLACE FUNCTION review_leave_request(
  p_request_id uuid,
  p_action text,           -- 'approve' | 'reject'
  p_note text DEFAULT NULL
)
RETURNS leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result leave_requests;
  new_status text;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'p_action mora biti approve ili reject.';
  END IF;

  new_status := CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE leave_requests
  SET status = new_status,
      reviewed_at = now(),
      review_note = NULLIF(btrim(p_note), '')
  WHERE id = p_request_id
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Zahtev ne postoji.';
  END IF;

  RETURN result;
END;
$$;

-- Master moze i da obrise (npr. test data)
CREATE OR REPLACE FUNCTION delete_leave_request(p_request_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM leave_requests WHERE id = p_request_id;
$$;

-- Saldo godisnjeg (za prikaz u radnickom profilu)
CREATE OR REPLACE FUNCTION get_leave_balance(p_worker_id uuid, p_year int)
RETURNS TABLE(
  total_days int,
  used_days int,
  pending_days int,
  remaining_days int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_used int;
  v_pending int;
BEGIN
  SELECT annual_leave_days INTO v_total
  FROM workers WHERE id = p_worker_id;

  SELECT COALESCE(SUM(days_count), 0)
  INTO v_used
  FROM leave_requests
  WHERE worker_id = p_worker_id
    AND status = 'approved'
    AND EXTRACT(year FROM start_date)::int = p_year;

  SELECT COALESCE(SUM(days_count), 0)
  INTO v_pending
  FROM leave_requests
  WHERE worker_id = p_worker_id
    AND status = 'pending'
    AND EXTRACT(year FROM start_date)::int = p_year;

  RETURN QUERY SELECT
    v_total,
    v_used,
    v_pending,
    GREATEST(0, COALESCE(v_total, 20) - v_used);
END;
$$;

-- -------------------------------------------------------------
-- 5) RPC-ovi za monthly_salaries
-- -------------------------------------------------------------

-- MASTER upsert plate za jednu radnicu/mesec
CREATE OR REPLACE FUNCTION upsert_monthly_salary(
  p_worker_id uuid,
  p_year int,
  p_month int,
  p_amount numeric,
  p_paid_at date DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS monthly_salaries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result monthly_salaries;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Iznos plate ne moze biti negativan.';
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Mesec mora biti 1-12.';
  END IF;

  INSERT INTO monthly_salaries (worker_id, year, month, amount, paid_at, note, updated_at)
  VALUES (p_worker_id, p_year, p_month, p_amount, p_paid_at, NULLIF(btrim(p_note), ''), now())
  ON CONFLICT (worker_id, year, month) DO UPDATE SET
    amount = EXCLUDED.amount,
    paid_at = EXCLUDED.paid_at,
    note = EXCLUDED.note,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- MASTER vidi sve plate za rang dat
CREATE OR REPLACE FUNCTION list_salaries_for_month(p_year int, p_month int)
RETURNS TABLE(
  worker_id uuid,
  initials text,
  store_id text,
  amount numeric,
  paid_at date,
  note text,
  updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    w.id, w.initials, w.store_id,
    s.amount, s.paid_at, s.note, s.updated_at
  FROM workers w
  LEFT JOIN monthly_salaries s
    ON s.worker_id = w.id AND s.year = p_year AND s.month = p_month
  WHERE w.active = true
  ORDER BY w.store_id, w.initials;
$$;

-- MASTER pregled poslednjih N meseci za sve radnice
CREATE OR REPLACE FUNCTION list_salaries_grid(p_months_back int DEFAULT 6)
RETURNS TABLE(
  worker_id uuid,
  initials text,
  store_id text,
  year int,
  month int,
  amount numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff_year int;
  cutoff_month int;
  cur_y int := EXTRACT(year FROM now())::int;
  cur_m int := EXTRACT(month FROM now())::int;
BEGIN
  cutoff_year := cur_y;
  cutoff_month := cur_m - p_months_back;
  WHILE cutoff_month <= 0 LOOP
    cutoff_year := cutoff_year - 1;
    cutoff_month := cutoff_month + 12;
  END LOOP;

  RETURN QUERY
  SELECT
    w.id, w.initials, w.store_id,
    s.year, s.month, s.amount
  FROM workers w
  LEFT JOIN monthly_salaries s ON s.worker_id = w.id
    AND ((s.year > cutoff_year)
         OR (s.year = cutoff_year AND s.month >= cutoff_month))
  WHERE w.active = true
  ORDER BY w.store_id, w.initials, s.year DESC, s.month DESC;
END;
$$;

-- Radnica vidi svoje plate
CREATE OR REPLACE FUNCTION list_my_salaries(p_worker_id uuid, p_limit int DEFAULT 12)
RETURNS TABLE(
  year int,
  month int,
  amount numeric,
  paid_at date,
  note text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT year, month, amount, paid_at, note
  FROM monthly_salaries
  WHERE worker_id = p_worker_id
  ORDER BY year DESC, month DESC
  LIMIT p_limit;
$$;

-- Brisanje (npr. greska pri unosu)
CREATE OR REPLACE FUNCTION delete_monthly_salary(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM monthly_salaries WHERE id = p_id;
$$;

-- -------------------------------------------------------------
-- 6) GRANT-ovi
-- -------------------------------------------------------------
REVOKE ALL ON FUNCTION
  create_leave_request(uuid, date, date, text),
  list_leave_requests(text),
  list_my_leave_requests(uuid),
  review_leave_request(uuid, text, text),
  delete_leave_request(uuid),
  get_leave_balance(uuid, int),
  upsert_monthly_salary(uuid, int, int, numeric, date, text),
  list_salaries_for_month(int, int),
  list_salaries_grid(int),
  list_my_salaries(uuid, int),
  delete_monthly_salary(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  create_leave_request(uuid, date, date, text),
  list_leave_requests(text),
  list_my_leave_requests(uuid),
  review_leave_request(uuid, text, text),
  delete_leave_request(uuid),
  get_leave_balance(uuid, int),
  upsert_monthly_salary(uuid, int, int, numeric, date, text),
  list_salaries_for_month(int, int),
  list_salaries_grid(int),
  list_my_salaries(uuid, int),
  delete_monthly_salary(uuid)
TO anon, authenticated;
