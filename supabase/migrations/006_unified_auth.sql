-- =============================================================
-- Migracija 006 — Unified Auth + Bezbednosna popravka
-- =============================================================
-- 1) Zatvara kriticnu rupu: get_auth_pins() koja je vracala PIN-ove svakome
-- 2) Dodaje individualne lozinke za radnice (workers.pin_hash, bcrypt)
-- 3) Nove RPC funkcije koje vracaju samo true/false (ne raw PIN-ove)
-- 4) Worker login flow sa first-login bootstrap-om preko TIM PIN-a
--
-- Postojeci plain text PIN-ovi u auth_config ostaju za kompatibilnost
-- sa postojecim cookie sistemom (cookie sadrzi PIN za poredjenje preko
-- nove verify_* funkcije). Kasnije ce biti preradjeno u session token.
-- =============================================================

-- pgcrypto za bcrypt hash funkcije (crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------
-- 1) KRITICNA POPRAVKA — drop get_auth_pins
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS get_auth_pins();

-- -------------------------------------------------------------
-- 2) SAFE GETTER za notify_email (jedino sto ostaje da se cita iz auth_config)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_notify_email()
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT notify_email FROM auth_config WHERE id = 1;
$$;

-- -------------------------------------------------------------
-- 3) VERIFY funkcije — vracaju samo boolean (ne raw PIN)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_master_pin(p_candidate text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT master_pin = p_candidate
  FROM auth_config WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION verify_team_pin(p_store_id text, p_candidate text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  expected text;
BEGIN
  SELECT
    CASE p_store_id
      WHEN 'D1' THEN tim_pin_d1
      WHEN 'D2' THEN tim_pin_d2
      WHEN 'D4' THEN tim_pin_d4
      WHEN 'D5' THEN tim_pin_d5
      ELSE NULL
    END INTO expected
  FROM auth_config WHERE id = 1;

  RETURN expected IS NOT NULL AND expected = p_candidate;
END;
$$;

-- Helper za UI: koji store je za dati team PIN (koristi se u /api/tim-login
-- za auto-detekciju radnje iz PIN-a, kao sto vec radi pinMatchesStore u JS-u)
CREATE OR REPLACE FUNCTION find_store_for_team_pin(p_candidate text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  cfg record;
BEGIN
  SELECT tim_pin_d1, tim_pin_d2, tim_pin_d4, tim_pin_d5
  INTO cfg
  FROM auth_config WHERE id = 1;

  IF p_candidate = cfg.tim_pin_d1 THEN RETURN 'D1'; END IF;
  IF p_candidate = cfg.tim_pin_d2 THEN RETURN 'D2'; END IF;
  IF p_candidate = cfg.tim_pin_d4 THEN RETURN 'D4'; END IF;
  IF p_candidate = cfg.tim_pin_d5 THEN RETURN 'D5'; END IF;
  RETURN NULL;
END;
$$;

-- -------------------------------------------------------------
-- 4) WORKERS: individualne lozinke (bcrypt hash)
-- -------------------------------------------------------------
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz;

-- Brzi lookup po inicijalima (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_workers_initials_active
  ON workers (upper(initials)) WHERE active = true;

-- -------------------------------------------------------------
-- 5) WORKER LOGIN — auto-detekcija stanja (first_login | ok | bad_pin | not_found)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION worker_login(p_initials text, p_candidate text)
RETURNS TABLE(worker_id uuid, store_id text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  w_id uuid;
  w_store text;
  w_hash text;
  initials_norm text := upper(btrim(p_initials));
BEGIN
  -- Aktivna radnica po inicijalima — ako ima vise (npr. MM u D4 i D5),
  -- uzimamo prvu po store_id alfabetski. Reci za sada — kada bude problem,
  -- prosirimo na 2-corak (klijent prvo trazi inicijale, server ako ima vise
  -- vraca listu radnji da klijent bira).
  SELECT id, workers.store_id, pin_hash
  INTO w_id, w_store, w_hash
  FROM workers
  WHERE upper(initials) = initials_norm AND active = true
  ORDER BY workers.store_id
  LIMIT 1;

  IF w_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'not_found'::text;
    RETURN;
  END IF;

  IF w_hash IS NULL THEN
    -- Prvi login — vracamo worker_id i store_id da klijent zna ko je
    RETURN QUERY SELECT w_id, w_store, 'first_login'::text;
    RETURN;
  END IF;

  -- bcrypt provera
  IF crypt(p_candidate, w_hash) = w_hash THEN
    RETURN QUERY SELECT w_id, w_store, 'ok'::text;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'bad_pin'::text;
  END IF;
END;
$$;

-- Verifikacija postojeceg PIN-a (za cookie middleware)
CREATE OR REPLACE FUNCTION verify_worker_pin(p_worker_id uuid, p_candidate text)
RETURNS TABLE(ok boolean, store_id text, initials text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  w_hash text;
  w_store text;
  w_init text;
BEGIN
  SELECT pin_hash, workers.store_id, workers.initials
  INTO w_hash, w_store, w_init
  FROM workers WHERE id = p_worker_id AND active = true;

  IF w_hash IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF crypt(p_candidate, w_hash) = w_hash THEN
    RETURN QUERY SELECT true, w_store, w_init;
  ELSE
    RETURN QUERY SELECT false, NULL::text, NULL::text;
  END IF;
END;
$$;

-- -------------------------------------------------------------
-- 6) FIRST LOGIN — radnica postavlja svoju licnu lozinku
-- Nema vise TIM PIN bootstrap-a: MASTER vec kontrolise listu radnica
-- u /admin/podesavanja → ako su inicijali u bazi i pin_hash je NULL,
-- prva osoba koja se prijavi sa tim inicijalima postavlja lozinku.
-- Drop-uje se stara verzija sa 3 parametra (ako postoji) pa se kreira nova.
-- -------------------------------------------------------------
DROP FUNCTION IF EXISTS worker_set_first_pin(uuid, text, text);

CREATE OR REPLACE FUNCTION worker_set_first_pin(
  p_worker_id uuid,
  p_new_pin text
)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  current_hash text;
  w_active boolean;
BEGIN
  SELECT pin_hash, active INTO current_hash, w_active
  FROM workers WHERE id = p_worker_id;

  IF w_active IS NULL THEN
    RETURN QUERY SELECT false, 'not_found'::text;
    RETURN;
  END IF;

  IF NOT w_active THEN
    RETURN QUERY SELECT false, 'not_active'::text;
    RETURN;
  END IF;

  IF current_hash IS NOT NULL THEN
    RETURN QUERY SELECT false, 'pin_already_set'::text;
    RETURN;
  END IF;

  IF p_new_pin !~ '^\d{4,8}$' THEN
    RETURN QUERY SELECT false, 'bad_pin_format'::text;
    RETURN;
  END IF;

  UPDATE workers
  SET pin_hash = crypt(p_new_pin, gen_salt('bf', 8)),
      pin_set_at = now()
  WHERE id = p_worker_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

-- -------------------------------------------------------------
-- 7) CHANGE PIN — radnica menja postojecu lozinku
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION worker_change_pin(
  p_worker_id uuid,
  p_old_pin text,
  p_new_pin text
)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  current_hash text;
BEGIN
  SELECT pin_hash INTO current_hash
  FROM workers WHERE id = p_worker_id AND active = true;

  IF current_hash IS NULL THEN
    RETURN QUERY SELECT false, 'not_found_or_no_pin'::text;
    RETURN;
  END IF;

  IF crypt(p_old_pin, current_hash) <> current_hash THEN
    RETURN QUERY SELECT false, 'bad_old_pin'::text;
    RETURN;
  END IF;

  IF p_new_pin !~ '^\d{4,8}$' THEN
    RETURN QUERY SELECT false, 'bad_pin_format'::text;
    RETURN;
  END IF;

  UPDATE workers
  SET pin_hash = crypt(p_new_pin, gen_salt('bf', 8)),
      pin_set_at = now()
  WHERE id = p_worker_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

-- -------------------------------------------------------------
-- 8) MASTER reset workerov PIN (zaboravljena lozinka)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION master_reset_worker_pin(p_worker_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  UPDATE workers SET pin_hash = NULL, pin_set_at = NULL WHERE id = p_worker_id;
$$;

-- -------------------------------------------------------------
-- 9) GRANT-ovi: revoke od PUBLIC, grant samo gde je sigurno
-- -------------------------------------------------------------
REVOKE ALL ON FUNCTION
  get_notify_email(),
  verify_master_pin(text),
  verify_team_pin(text, text),
  find_store_for_team_pin(text),
  worker_login(text, text),
  verify_worker_pin(uuid, text),
  worker_set_first_pin(uuid, text),
  worker_change_pin(uuid, text, text),
  master_reset_worker_pin(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  get_notify_email(),
  verify_master_pin(text),
  verify_team_pin(text, text),
  find_store_for_team_pin(text),
  worker_login(text, text),
  verify_worker_pin(uuid, text),
  worker_set_first_pin(uuid, text),
  worker_change_pin(uuid, text, text)
TO anon, authenticated;

-- master_reset_worker_pin: za sada anon (jer cela aplikacija jos koristi anon),
-- u Fazi B kad bude pravi MASTER session — prebacicemo na authenticated.
GRANT EXECUTE ON FUNCTION master_reset_worker_pin(uuid) TO anon, authenticated;
