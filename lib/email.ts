/**
 * Resend email helper. Koristi REST API bez dodavanja `resend` NPM paketa
 * (manji bundle, nema dodatnih dependencies).
 *
 * Env vars:
 *   RESEND_API_KEY — API ključ (re_*)
 *   FROM_EMAIL     — pošiljalac. Default: onboarding@resend.dev (Resend test domen)
 *                   Kad verifikuješ dusanstil.rs kod Resend-a → promeni na noreply@dusanstil.rs
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY nije postavljen.");
  const from = process.env.FROM_EMAIL ?? "Dušan Stil <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(
      `Resend API error (${res.status}): ${j.message || JSON.stringify(j)}`
    );
  }
}

/**
 * Generiše 6-cifreni numerički kod, npr. "492813".
 * Koristi Web Crypto API (dostupan u Edge i Node runtime-u).
 */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

/**
 * HTML template za email sa kodom.
 */
export function pinChangeEmailHtml({
  code,
  target,
  requestedAt,
}: {
  code: string;
  target: "master" | "tim" | "tim_d1" | "tim_d2" | "tim_d4" | "tim_d5";
  requestedAt: Date;
}): string {
  const who =
    target === "master"
      ? "MASTER"
      : target === "tim"
        ? "TIM"
        : `TIM ${target.replace("tim_", "").toUpperCase()}`;
  const time = requestedAt.toLocaleString("sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `
<!doctype html>
<html lang="sr">
<head><meta charset="utf-8"><title>Promena ${who} šifre</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f6f4;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <tr><td style="padding:32px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9c7f4f;font-weight:700;">Dušan Stil · Dashboard</div>
          <h1 style="margin:12px 0 8px;font-size:24px;color:#1a1a1a;">Potvrdi promenu ${who} šifre</h1>
          <p style="margin:0 0 20px;color:#666;font-size:15px;line-height:1.5;">
            Primili smo zahtev za promenu <b>${who}</b> šifre u ${time}. Ako si to bio ti, unesi kod
            ispod u aplikaciju. Ako nisi, samo ignoriši ovaj email — šifra neće biti promenjena.
          </p>
          <div style="background:#f6f6f4;border:1px solid #e5e5e5;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Kod za potvrdu</div>
            <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:700;color:#1a1a1a;letter-spacing:0.25em;">${code}</div>
          </div>
          <p style="margin:0;color:#888;font-size:13px;line-height:1.5;">
            Kod važi <b>15 minuta</b>. Posle toga moraćeš da ponovo pokreneš promenu iz aplikacije.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;background:#fafafa;font-size:12px;color:#999;">
          Automatski email · Ne odgovaraj na ovu poruku.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}
