-- =============================================================
-- Migracija 007 — fix za pgcrypto search_path
-- =============================================================
-- Greska: "function gen_salt(unknown, integer) does not exist"
-- Uzrok: pgcrypto je instaliran u 'extensions' schemi (Supabase default),
-- ali moje funkcije iz 006 imaju search_path = public, pa ne mogu da
-- pronadju crypt/gen_salt.
--
-- Resenje: prosiri search_path na 'public, extensions' za sve funkcije
-- koje koriste crypt/gen_salt. Idempotent je — moze da se pokrene vise puta.
-- =============================================================

-- Osiguraj da je pgcrypto instaliran (na svakom Supabase nalogu jeste,
-- ovo je samo no-op ako vec postoji)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Funkcije iz 006 koje koriste crypt/gen_salt
ALTER FUNCTION worker_login(text, text)
  SET search_path = public, extensions;

ALTER FUNCTION verify_worker_pin(uuid, text)
  SET search_path = public, extensions;

ALTER FUNCTION worker_set_first_pin(uuid, text)
  SET search_path = public, extensions;

ALTER FUNCTION worker_change_pin(uuid, text, text)
  SET search_path = public, extensions;
