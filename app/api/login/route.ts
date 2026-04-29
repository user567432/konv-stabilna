import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  TIM_COOKIE,
  WORKER_COOKIE,
  verifyMasterPin,
  findStoreForTeamPin,
  workerLogin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dana
};

interface LoginBody {
  initials?: string;
  pin?: string;
}

/**
 * POST /api/login — auto-detekcija tipa logovanja po inicijalima
 *
 * Kuca se "MASTER" + master PIN  → ds_admin cookie + redirect /admin
 * Kuca se "D1"-"D5" + team PIN   → ds_tim cookie + redirect /unos
 * Kuca se inicijali radnice + PIN → ds_worker cookie + redirect /moj-profil
 *
 * Ako radnica nema postavljen PIN, vraca first_login_required + worker_id
 * pa klijent pokrece 3-step wizard preko /api/login/first.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  const initials = String(body.initials ?? "").trim().toUpperCase();
  const pin = String(body.pin ?? "").trim();

  if (!initials || !pin) {
    return NextResponse.json(
      { error: "Unesi inicijale i lozinku." },
      { status: 400 }
    );
  }

  // -----------------------
  // 1) MASTER
  // -----------------------
  if (initials === "MASTER") {
    const ok = await verifyMasterPin(pin);
    if (!ok) {
      return NextResponse.json(
        { error: "Pogrešna lozinka." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({
      ok: true,
      role: "master",
      redirect: "/master",
    });
    res.cookies.set(ADMIN_COOKIE, pin, COOKIE_OPTS);
    return res;
  }

  // -----------------------
  // 2) TIM (D1/D2/D4/D5)
  // -----------------------
  if (["D1", "D2", "D4", "D5"].includes(initials)) {
    const matched = await findStoreForTeamPin(pin);
    if (!matched) {
      return NextResponse.json(
        { error: "Pogrešna lozinka tima." },
        { status: 401 }
      );
    }
    if (matched !== initials) {
      // PIN se poklapa sa drugom radnjom — ali korisnik je kucao npr. D5
      return NextResponse.json(
        { error: `Lozinka pripada radnji ${matched}, ne ${initials}.` },
        { status: 401 }
      );
    }
    const res = NextResponse.json({
      ok: true,
      role: "tim",
      store: matched,
      redirect: "/tim",
    });
    res.cookies.set(TIM_COOKIE, `${pin}|${matched}`, COOKIE_OPTS);
    return res;
  }

  // -----------------------
  // 3) Worker (individualno)
  // -----------------------
  const result = await workerLogin(initials, pin);

  if (result.status === "first_login") {
    // Klijent treba da pokrene wizard sa worker_id-em
    return NextResponse.json({
      ok: false,
      first_login_required: true,
      worker_id: result.worker_id,
      store_id: result.store_id,
      message:
        "Prvi put se prijavljujete. Postavićemo vašu ličnu lozinku u 3 koraka.",
    });
  }

  if (result.status === "ok" && result.worker_id) {
    const res = NextResponse.json({
      ok: true,
      role: "worker",
      worker_id: result.worker_id,
      store_id: result.store_id,
      redirect: "/moj-profil",
    });
    res.cookies.set(WORKER_COOKIE, `${result.worker_id}|${pin}`, COOKIE_OPTS);
    return res;
  }

  // not_found ili bad_pin — zajednicki message radi sigurnosti
  return NextResponse.json(
    { error: "Pogrešni inicijali ili lozinka." },
    { status: 401 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete(TIM_COOKIE);
  res.cookies.delete(WORKER_COOKIE);
  return res;
}
