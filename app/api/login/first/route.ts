import { NextResponse } from "next/server";
import { WORKER_COOKIE } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

interface FirstLoginBody {
  worker_id?: string;
  new_pin?: string;
}

/**
 * POST /api/login/first — postavi licnu lozinku radnice prvi put.
 *
 * MASTER vec kontrolise listu radnica u /admin/podesavanja, pa nije potreban
 * dodatni auth bootstrap. Ako inicijali postoje i pin_hash je NULL, prva
 * osoba koja se prijavi sa tim inicijalima postavlja licnu lozinku.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as FirstLoginBody;
  const workerId = String(body.worker_id ?? "").trim();
  const newPin = String(body.new_pin ?? "").trim();

  if (!workerId || !newPin) {
    return NextResponse.json(
      { error: "Fali worker_id ili nova lozinka." },
      { status: 400 }
    );
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    return NextResponse.json(
      { error: "Lozinka mora biti 4–8 cifara." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc("worker_set_first_pin", {
      p_worker_id: workerId,
      p_new_pin: newPin,
    })
    .single<{ ok: boolean; error: string | null }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.ok) {
    const errMap: Record<string, string> = {
      not_found: "Radnica ne postoji u sistemu.",
      not_active: "Vaš nalog nije aktivan. Kontaktirajte šefa.",
      pin_already_set:
        "Lozinka je već postavljena. Vrati se i prijavi se sa tom lozinkom.",
      bad_pin_format: "Lozinka mora biti 4–8 cifara.",
    };
    const msg = data?.error ? errMap[data.error] ?? data.error : "Greška.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Auto-uloguj odmah posle uspesnog setupa
  const res = NextResponse.json({
    ok: true,
    redirect: "/moj-profil",
  });
  res.cookies.set(WORKER_COOKIE, `${workerId}|${newPin}`, COOKIE_OPTS);
  return res;
}
