import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAuthConfig } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  const cfg = await getAuthConfig();

  if (!body.pin) {
    return NextResponse.json({ error: "Unesi PIN." }, { status: 400 });
  }
  if (body.pin !== cfg.master_pin) {
    return NextResponse.json({ error: "Pogrešan PIN." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, cfg.master_pin, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dana
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
