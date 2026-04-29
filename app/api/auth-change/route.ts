import { NextResponse } from "next/server";
import {
  isMasterAuthed,
  getNotifyEmail,
  invalidateAuthCache,
  ADMIN_COOKIE,
  TIM_COOKIE,
} from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { sendEmail, generateCode, pinChangeEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

type ChangeTarget =
  | "master"
  | "tim"
  | "tim_d1"
  | "tim_d2"
  | "tim_d4"
  | "tim_d5";

const VALID_TARGETS: ReadonlyArray<ChangeTarget> = [
  "master",
  "tim",
  "tim_d1",
  "tim_d2",
  "tim_d4",
  "tim_d5",
];

type RequestBody =
  | {
      action: "request";
      target: ChangeTarget;
      new_pin: string;
    }
  | {
      action: "confirm";
      request_id: string;
      code: string;
    };

function validatePin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

export async function POST(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const supabase = createSupabaseServer();

  // -----------------------
  // Tip 1: REQUEST
  // -----------------------
  if (body.action === "request") {
    const { target, new_pin } = body;
    if (!VALID_TARGETS.includes(target)) {
      return NextResponse.json(
        {
          error:
            "target mora biti 'master', 'tim', ili 'tim_d1'/'tim_d2'/'tim_d4'/'tim_d5'.",
        },
        { status: 400 }
      );
    }
    if (!validatePin(new_pin)) {
      return NextResponse.json(
        { error: "PIN mora biti 4-8 cifara." },
        { status: 400 }
      );
    }

    const notifyEmail = await getNotifyEmail();
    const code = generateCode();
    const requestedAt = new Date();

    // Kreiraj zahtev preko RPC-a
    const { data: created, error: rpcErr } = await supabase
      .rpc("create_pin_change_request", {
        p_target: target,
        p_new_pin: new_pin,
        p_code: code,
      })
      .single<{ id: string; expires_at: string }>();

    if (rpcErr || !created) {
      return NextResponse.json(
        { error: rpcErr?.message ?? "Greška pri kreiranju zahteva." },
        { status: 500 }
      );
    }

    const targetDisplay =
      target === "master"
        ? "MASTER"
        : target === "tim"
          ? "svih TIM"
          : `TIM ${target.replace("tim_", "").toUpperCase()}`;

    try {
      await sendEmail({
        to: notifyEmail,
        subject: `Potvrdi promenu ${targetDisplay} šifre · Dušan Stil`,
        html: pinChangeEmailHtml({ code, target, requestedAt }),
        text: `Kod za potvrdu promene ${targetDisplay} šifre: ${code}. Važi 15 minuta.`,
      });
    } catch (e: unknown) {
      await supabase.rpc("delete_pin_change_request", { p_id: created.id });
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Email nije poslat: ${e.message}`
              : "Email nije poslat.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      request_id: created.id,
      expires_at: created.expires_at,
      notify_email_masked: maskEmail(notifyEmail),
    });
  }

  // -----------------------
  // Tip 2: CONFIRM
  // -----------------------
  if (body.action === "confirm") {
    const { request_id, code } = body;
    if (!request_id || !code) {
      return NextResponse.json(
        { error: "Fali request_id ili code." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .rpc("confirm_pin_change", {
        p_request_id: request_id,
        p_code: code.trim(),
      })
      .single<{ target: string | null; error: string | null }>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || !data.target || data.error) {
      const errMap: Record<string, string> = {
        not_found: "Zahtev ne postoji.",
        already_used: "Zahtev je već potvrđen.",
        expired: "Kod je istekao. Pokreni novu promenu.",
        bad_code: "Pogrešan kod.",
      };
      const msg = data?.error ? errMap[data.error] ?? data.error : "Greška.";
      const status = data?.error === "bad_code" ? 401 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    invalidateAuthCache();

    const res = NextResponse.json({ ok: true, target: data.target });
    if (data.target === "master") res.cookies.delete(ADMIN_COOKIE);
    else res.cookies.delete(TIM_COOKIE);
    return res;
  }

  return NextResponse.json({ error: "Nepoznat action." }, { status: 400 });
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}
