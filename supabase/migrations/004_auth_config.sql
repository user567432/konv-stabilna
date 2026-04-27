-- Migracija 004: Auth config tabela (MASTER i TIM PIN)
-- + pending PIN change sa email kodom i TTL 15 min

CREATE TABLE IF NOT EXISTS auth_config (
  id              int PRIMARY KEY DEFAULT 1,
  master_pin      text NOT NULL,
  tim_pin         text NOT NULL,
  notify_email    text NOT NULL DEFAULT 'dusan@dusanstil.rs',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Inicijalni red (MASTER 4986, TIM 1205, email za potvrde)
INSERT INTO auth_config (id, master_pin, tim_pin, notify_email)
VALUES (1, '4986', '1205', 'dusan@dusanstil.rs')
ON CONFLICT (id) DO NOTHING;

-- Pending promena PIN-a (čeka email potvrdu)
CREATE TABLE IF NOT EXISTS pin_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target          text NOT NULL CHECK (target IN ('master', 'tim')),
  new_pin         text NOT NULL,
  code            text NOT NULL,            -- 6-cifreni email kod
  requested_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  confirmed_at    timestamptz,
  requester_ip    text
);

CREATE INDEX IF NOT EXISTS idx_pin_change_active
  ON pin_change_requests (expires_at)
  WHERE confirmed_at IS NULL;

-- RLS: nikad ne čitati PIN-ove preko public klijenta (anon key).
-- Cela provera PIN-a i promena ide preko server API-ja (service_role ili server-side fetch).
ALTER TABLE auth_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_change_requests ENABLE ROW LEVEL SECURITY;

-- Samo service_role (naš server) može čitati i menjati.
-- Anon/browser klijenti NEMAJU pristup.
-- (Po default-u bez policy-ja = 0 redova za anon.)
