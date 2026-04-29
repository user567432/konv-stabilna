import { cookies } from "next/headers";
import { createSupabaseServer } from "./supabase";

// =============================================================
// Cookie konstante — sve httpOnly, sameSite=lax
// =============================================================
export const ADMIN_COOKIE = "ds_admin";   // MASTER session: vrednost = master PIN
export const TIM_COOKIE = "ds_tim";       // TIM session: vrednost = "<pin>|<store>"
export const WORKER_COOKIE = "ds_worker"; // Worker session: vrednost = "<worker_id>|<pin>"

export type StoreId = "D1" | "D2" | "D4" | "D5";
export type AuthTarget =
  | "master"
  | "tim_d1"
  | "tim_d2"
  | "tim_d4"
  | "tim_d5";

export const TIM_TARGETS: AuthTarget[] = [
  "tim_d1",
  "tim_d2",
  "tim_d4",
  "tim_d5",
];

export function targetToStore(target: AuthTarget): StoreId | null {
  if (target === "tim_d1") return "D1";
  if (target === "tim_d2") return "D2";
  if (target === "tim_d4") return "D4";
  if (target === "tim_d5") return "D5";
  return null;
}

export function storeToTarget(store: StoreId): AuthTarget {
  return `tim_${store.toLowerCase()}` as AuthTarget;
}

// =============================================================
// Notify email cache (jedino sto cache-iramo iz auth_config)
// =============================================================
let notifyEmailCache: { value: string; ts: number } | null = null;
const CACHE_MS = 30_000;

export async function getNotifyEmail(): Promise<string> {
  const now = Date.now();
  if (notifyEmailCache && now - notifyEmailCache.ts < CACHE_MS) {
    return notifyEmailCache.value;
  }
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase.rpc("get_notify_email").single<string>();
    if (typeof data === "string" && data) {
      notifyEmailCache = { value: data, ts: now };
      return data;
    }
  } catch {
    // fallthrough
  }
  const fallback = process.env.NOTIFY_EMAIL ?? "dusan@dusanstil.rs";
  notifyEmailCache = { value: fallback, ts: now };
  return fallback;
}

export function invalidateAuthCache() {
  notifyEmailCache = null;
}

// =============================================================
// Backward-compat alias za stare module koji jos zovu getAuthConfig().
// Vraca samo notify_email i fallback PIN-ove iz env-a (NE iz baze) — kako
// nista u kodu da slucajno ne vrati raw PIN preko RPC-a.
// Ovo se uklanja u Fazi B kad svi pozivi budu prebaceni.
// =============================================================
interface LegacyAuthConfig {
  master_pin: string;
  tim_pin_d1: string;
  tim_pin_d2: string;
  tim_pin_d4: string;
  tim_pin_d5: string;
  notify_email: string;
}

export async function getAuthConfig(): Promise<LegacyAuthConfig> {
  const notify = await getNotifyEmail();
  return {
    master_pin: process.env.ADMIN_PIN ?? "4986",
    tim_pin_d1: process.env.TIM_PIN_D1 ?? "1205",
    tim_pin_d2: process.env.TIM_PIN_D2 ?? "7501",
    tim_pin_d4: process.env.TIM_PIN_D4 ?? "4332",
    tim_pin_d5: process.env.TIM_PIN_D5 ?? "1172",
    notify_email: notify,
  };
}

// =============================================================
// PIN VERIFIKACIJA preko safe RPC-ova (vracaju samo true/false)
// =============================================================
export async function verifyMasterPin(candidate: string): Promise<boolean> {
  if (!candidate) return false;
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .rpc("verify_master_pin", { p_candidate: candidate })
      .single<boolean>();
    return data === true;
  } catch {
    return false;
  }
}

export async function verifyTeamPin(
  store: StoreId,
  candidate: string
): Promise<boolean> {
  if (!candidate) return false;
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .rpc("verify_team_pin", { p_store_id: store, p_candidate: candidate })
      .single<boolean>();
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Iz datog PIN-a probaj da pogodis radnju. Vraca StoreId ili null.
 * Koristi se prilikom login-a kad korisnik kuca samo PIN bez radnje.
 */
export async function findStoreForTeamPin(
  candidate: string
): Promise<StoreId | null> {
  if (!candidate) return null;
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .rpc("find_store_for_team_pin", { p_candidate: candidate })
      .single<string>();
    if (
      typeof data === "string" &&
      ["D1", "D2", "D4", "D5"].includes(data)
    ) {
      return data as StoreId;
    }
  } catch {
    // fallthrough
  }
  return null;
}

// =============================================================
// MASTER session
// =============================================================
export async function isMasterAuthed(): Promise<boolean> {
  const c = cookies().get(ADMIN_COOKIE);
  if (!c?.value) return false;
  return verifyMasterPin(c.value);
}

// =============================================================
// TIM session (po radnji)
// =============================================================

/**
 * Vraca radnju (D1/D2/D4/D5) iz TIM cookie-ja, ili null ako nije ulogovan.
 * Cookie format: "<pin>|<store>"  (npr. "1205|D1")
 */
export async function getTimStore(): Promise<StoreId | null> {
  const c = cookies().get(TIM_COOKIE);
  if (!c?.value) return null;
  const parts = c.value.split("|");
  if (parts.length !== 2) return null;
  const [pin, store] = parts;
  if (!["D1", "D2", "D4", "D5"].includes(store)) return null;
  const ok = await verifyTeamPin(store as StoreId, pin);
  return ok ? (store as StoreId) : null;
}

export async function isTimAuthed(): Promise<boolean> {
  return (await getTimStore()) !== null;
}

/**
 * Pokusaj prepoznavanja PIN-a → vrati radnju kojoj pripada (ili null).
 * Tanki wrapper oko findStoreForTeamPin za backward-compat sa kodom koji
 * jos uvek zove pinMatchesStore.
 */
export async function pinMatchesStore(pin: string): Promise<StoreId | null> {
  return findStoreForTeamPin(pin);
}

// =============================================================
// WORKER session (individualne lozinke)
// =============================================================

export interface WorkerSession {
  worker_id: string;
  store_id: StoreId;
  initials: string;
}

/**
 * Vraca worker session iz cookie-ja, ili null ako nije ulogovan / cookie istekao.
 * Cookie format: "<worker_id>|<pin>"
 */
export async function getWorkerSession(): Promise<WorkerSession | null> {
  const c = cookies().get(WORKER_COOKIE);
  if (!c?.value) return null;
  const parts = c.value.split("|");
  if (parts.length !== 2) return null;
  const [workerId, pin] = parts;
  // Format provera worker_id (uuid)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workerId)) {
    return null;
  }

  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .rpc("verify_worker_pin", { p_worker_id: workerId, p_candidate: pin })
      .single<{ ok: boolean; store_id: string | null; initials: string | null }>();

    if (
      data?.ok &&
      data.store_id &&
      ["D1", "D2", "D4", "D5"].includes(data.store_id) &&
      data.initials
    ) {
      return {
        worker_id: workerId,
        store_id: data.store_id as StoreId,
        initials: data.initials,
      };
    }
  } catch {
    // fallthrough
  }
  return null;
}

export async function isWorkerAuthed(): Promise<boolean> {
  return (await getWorkerSession()) !== null;
}

/**
 * Tip rezultata worker_login RPC poziva.
 */
export interface WorkerLoginResult {
  worker_id: string | null;
  store_id: StoreId | null;
  status: "ok" | "first_login" | "bad_pin" | "not_found";
}

/**
 * Loguj radnicu po inicijalima + PIN-u. Vraca status:
 *  - ok: PIN matche, klijent treba da postavi WORKER_COOKIE
 *  - first_login: PIN nije postavljen, klijent treba pokrene 3-step wizard
 *  - bad_pin: PIN ne matche (NE razlikujemo od not_found radi sigurnosti)
 *  - not_found: inicijali ne postoje
 */
export async function workerLogin(
  initials: string,
  candidate: string
): Promise<WorkerLoginResult> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .rpc("worker_login", {
        p_initials: initials,
        p_candidate: candidate,
      })
      .single<{
        worker_id: string | null;
        store_id: string | null;
        status: string;
      }>();

    if (!data) return { worker_id: null, store_id: null, status: "not_found" };

    return {
      worker_id: data.worker_id,
      store_id:
        data.store_id && ["D1", "D2", "D4", "D5"].includes(data.store_id)
          ? (data.store_id as StoreId)
          : null,
      status: ["ok", "first_login", "bad_pin", "not_found"].includes(data.status)
        ? (data.status as WorkerLoginResult["status"])
        : "not_found",
    };
  } catch {
    return { worker_id: null, store_id: null, status: "not_found" };
  }
}
