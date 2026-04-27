import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (client components) - singleton to avoid multiple channels
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return browserClient;
}

// Server client (server components, route handlers)
export function createSupabaseServer(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// createSupabaseAdmin() je uklonjen — sve osetljive operacije idu kroz Postgres RPC
// funkcije (SECURITY DEFINER). Ne zahteva service_role ključ u app env vars.
