import { cookies } from "next/headers";
import { createSupabaseServer } from "./supabase";

export const ADMIN_COOKIE = "ds_admin";
export const TIM_COOKIE = "ds_tim";

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

interface AuthConfig {
  master_pin: string;
  tim_pin_d1: string;
  tim_pin_d2: string;
  tim_pin_d4: string;
  tim_pin_d5: string;
  notify_email: string;
}

let cache: { value: AuthConfig; ts: number } | null = null;
const CACHE_MS = 5_000;

export async function getAuthConfig(): Promise<AuthConfig> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) return cache.value;

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .rpc("get_auth_pins")
      .single<AuthConfig>();
    if (!error && data) {
      cache = { value: data, ts: now };
      return data;
    }
  } catch {
    // fallthrough
  }

  const value: AuthConfig = {
    master_pin: process.env.ADMIN_PIN ?? "4986",
    tim_pin_d1: process.env.TIM_PIN_D1 ?? "1205",
    tim_pin_d2: process.env.TIM_PIN_D2 ?? "7501",
    tim_pin_d4: process.env.TIM_PIN_D4 ?? "4332",
    tim_pin_d5: process.env.TIM_PIN_D5 ?? "1172",
    notify_email: process.env.NOTIFY_EMAIL ?? "dusan@dusanstil.rs",
  };
  cache = { value, ts: now };
  return value;
}

export function invalidateAuthCache() {
  cache = null;
}

export async function isMasterAuthed(): Promise<boolean> {
  const c = cookies().get(ADMIN_COOKIE);
  if (!c?.value) return false;
  const cfg = await getAuthConfig();
  return c.value === cfg.master_pin;
}

/**
 * Vraća radnju (D1/D2/D4/D5) iz TIM cookie-ja, ili null ako nije ulogovan.
 * Cookie format: "<pin>|<store>"  (npr. "1205|D1")
 */
export async function getTimStore(): Promise<StoreId | null> {
  const c = cookies().get(TIM_COOKIE);
  if (!c?.value) return null;
  const parts = c.value.split("|");
  if (parts.length !== 2) return null;
  const [pin, store] = parts;
  if (!["D1", "D2", "D4", "D5"].includes(store)) return null;
  const cfg = await getAuthConfig();
  const expected =
    store === "D1" ? cfg.tim_pin_d1
    : store === "D2" ? cfg.tim_pin_d2
    : store === "D4" ? cfg.tim_pin_d4
    : cfg.tim_pin_d5;
  return pin === expected ? (store as StoreId) : null;
}

export async function isTimAuthed(): Promise<boolean> {
  return (await getTimStore()) !== null;
}

/**
 * Pokušaj prepoznavanja PIN-a → vrati radnju kojoj pripada (ili null).
 * Koristi se prilikom login-a: TIM ne bira radnju iz menija, već PIN sam zna.
 */
export async function pinMatchesStore(pin: string): Promise<StoreId | null> {
  const cfg = await getAuthConfig();
  if (pin === cfg.tim_pin_d1) return "D1";
  if (pin === cfg.tim_pin_d2) return "D2";
  if (pin === cfg.tim_pin_d4) return "D4";
  if (pin === cfg.tim_pin_d5) return "D5";
  return null;
}
