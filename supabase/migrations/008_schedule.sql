-- =============================================================
-- Migracija 008 — Raspored radnog vremena (shift_schedule)
-- =============================================================
-- Posebno od `shifts` tabele (koja drzi STVARNE odradjene smene sa prometom).
-- Ova tabela drzi PLANIRANE smene — MASTER popunjava unapred ko ce raditi
-- koju smenu kog datuma. Cuva se istorijski (nikad se ne brise) tako da
-- MASTER moze da pogleda raspored prosle nedelje pri planiranju nove.
-- =============================================================

CREATE TABLE IF NOT EXISTS shift_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shift_date    date NOT NULL,
  shift_type    shift_type NOT NULL,
  worker_ids    uuid[] NOT NULL DEFAULT '{}',
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_schedule_unique UNIQUE (store_id, shift_date, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_shift_schedule_date
  ON shift_schedule (shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_shift_schedule_store_date
  ON shift_schedule (store_id, shift_date DESC);

-- Public read da bi i radnice videle svoj raspored bez auth-a (mozemo zaostriti kasnije)
ALTER TABLE shift_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_schedule" ON shift_schedule;
CREATE POLICY "public_read_schedule" ON shift_schedule FOR SELECT USING (true);

-- -------------------------------------------------------------
-- RPC: upsert jednog slota
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_schedule_slot(
  p_store_id text,
  p_shift_date date,
  p_shift_type shift_type,
  p_worker_ids uuid[],
  p_note text DEFAULT NULL
)
RETURNS shift_schedule
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE result shift_schedule;
BEGIN
  -- Ako je niz prazan i nema napomene, brisi red da ne ostavljamo prazne entry-je
  IF (p_worker_ids IS NULL OR array_length(p_worker_ids, 1) IS NULL)
     AND (p_note IS NULL OR btrim(p_note) = '') THEN
    DELETE FROM shift_schedule
    WHERE store_id = p_store_id
      AND shift_date = p_shift_date
      AND shift_type = p_shift_type;
    RETURN NULL;
  END IF;

  INSERT INTO shift_schedule (store_id, shift_date, shift_type, worker_ids, note, updated_at)
  VALUES (p_store_id, p_shift_date, p_shift_type, COALESCE(p_worker_ids, '{}'::uuid[]), NULLIF(btrim(p_note), ''), now())
  ON CONFLICT (store_id, shift_date, shift_type) DO UPDATE SET
    worker_ids = EXCLUDED.worker_ids,
    note = EXCLUDED.note,
    updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- -------------------------------------------------------------
-- RPC: brisanje slota (eksplicitno)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_schedule_slot(
  p_store_id text,
  p_shift_date date,
  p_shift_type shift_type
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM shift_schedule
  WHERE store_id = p_store_id
    AND shift_date = p_shift_date
    AND shift_type = p_shift_type;
$$;

-- -------------------------------------------------------------
-- RPC: dohvati raspored za nedelju (svi store-ovi ili samo jedan)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_week_schedule(
  p_week_start date,
  p_store_id text DEFAULT NULL
)
RETURNS SETOF shift_schedule
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM shift_schedule
  WHERE shift_date >= p_week_start
    AND shift_date < p_week_start + interval '7 days'
    AND (p_store_id IS NULL OR store_id = p_store_id)
  ORDER BY shift_date, store_id, shift_type;
$$;

-- -------------------------------------------------------------
-- RPC: raspored radnice (njena slededja nedelja sa koleginicama)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_worker_schedule(
  p_worker_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE(
  schedule_id uuid,
  shift_date date,
  shift_type shift_type,
  store_id text,
  worker_ids uuid[],
  note text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, shift_date, shift_type, store_id, worker_ids, note
  FROM shift_schedule
  WHERE shift_date BETWEEN p_from AND p_to
    AND p_worker_id = ANY(worker_ids)
  ORDER BY shift_date, shift_type;
$$;

-- -------------------------------------------------------------
-- GRANT-ovi
-- -------------------------------------------------------------
REVOKE ALL ON FUNCTION
  upsert_schedule_slot(text, date, shift_type, uuid[], text),
  delete_schedule_slot(text, date, shift_type),
  get_week_schedule(date, text),
  get_worker_schedule(uuid, date, date)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  upsert_schedule_slot(text, date, shift_type, uuid[], text),
  delete_schedule_slot(text, date, shift_type),
  get_week_schedule(date, text),
  get_worker_schedule(uuid, date, date)
TO anon, authenticated;

-- Realtime publish (da master vidi promene odmah ako vise tab-ova)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shift_schedule'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shift_schedule;
  END IF;
END$$;
