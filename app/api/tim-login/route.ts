import { NextResponse } from "next/server";
import { TIM_COOKIE, pinMatchesStore } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!body.pin) {
    return NextResponse.json({ error: "Unesi PIN." }, { status: 400 });
  }

  const store = await pinMatchesStore(body.pin);
  if (!store) {
    return NextResponse.json({ error: "Pogrešan PIN." }, { status: 401 });
  }

  // Cookie format: "<pin>|<store>" — server posle valdira oba dela
  const cookieValue = `${body.pin}|${store}`;
  const res = NextResponse.json({ ok: true, store });
  res.cookies.set(TIM_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(TIM_COOKIE);
  return res;
}
