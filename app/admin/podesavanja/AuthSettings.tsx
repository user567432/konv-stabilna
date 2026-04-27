"use client";

import { useState } from "react";
import {
  KeyRound,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Crown,
  Store as StoreIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  notifyEmailMasked: string;
}

type Target = "master" | "tim_d1" | "tim_d2" | "tim_d4" | "tim_d5";

interface TargetOption {
  value: Target;
  label: string;
  hint: string;
  Icon: typeof KeyRound;
}

const TARGETS: TargetOption[] = [
  { value: "master", label: "MASTER", hint: "Pristup dashboard-u", Icon: Crown },
  { value: "tim_d1", label: "TIM D1", hint: "Ženska Dušanova", Icon: StoreIcon },
  { value: "tim_d2", label: "TIM D2", hint: "Muška Dušanova", Icon: StoreIcon },
  { value: "tim_d4", label: "TIM D4", hint: "Ženska Delta Planet", Icon: StoreIcon },
  { value: "tim_d5", label: "TIM D5", hint: "Muška Delta Planet", Icon: StoreIcon },
];

function targetLabel(t: Target): string {
  return TARGETS.find((x) => x.value === t)?.label ?? t;
}

interface PendingState {
  request_id: string;
  target: Target;
  expires_at: string;
  email_masked: string;
}

export default function AuthSettings({ notifyEmailMasked }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<Target>("master");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState | null>(null);
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState<Target | null>(null);

  async function requestChange(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\d{4,8}$/.test(newPin)) {
      setErr("PIN mora biti 4-8 cifara.");
      return;
    }
    if (newPin !== confirmPin) {
      setErr("PIN-ovi se ne podudaraju.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", target, new_pin: newPin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      setPending({
        request_id: j.request_id,
        target,
        expires_at: j.expires_at,
        email_masked: j.notify_email_masked,
      });
      setNewPin("");
      setConfirmPin("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmChange(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setErr(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setErr("Kod mora biti 6 cifara.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          request_id: pending.request_id,
          code: code.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      const changedTarget = pending.target;
      setSuccess(changedTarget);
      setPending(null);
      setCode("");
      if (changedTarget === "master") {
        setTimeout(() => router.refresh(), 2500);
      } else {
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  function cancelPending() {
    setPending(null);
    setCode("");
    setErr(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0">
          <Shield size={22} />
        </div>
        <div>
          <h2 className="font-bold text-ink-900">Promena šifara</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            5 odvojenih šifara — MASTER i TIM PIN po svakoj radnji. Kod za potvrdu ide na{" "}
            <b>{notifyEmailMasked}</b>. Kod važi 15 minuta.
          </p>
        </div>
      </div>

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div>
            <b>{targetLabel(success)}</b> šifra je uspešno promenjena.
            {success === "master" &&
              " Bićeš odjavljen za par sekundi, uloguj se novom šifrom."}
            {success !== "master" &&
              " Stari ulaz na /unos sa starim PIN-om više ne radi — javi novu šifru radnicama."}
          </div>
        </div>
      )}

      {!pending ? (
        <form onSubmit={requestChange} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Koju šifru menjaš?
            </label>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
              {TARGETS.map((t) => {
                const active = target === t.value;
                const Icon = t.Icon;
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setTarget(t.value)}
                    className={`px-3 py-3 rounded-xl border-2 text-left transition ${
                      active
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-200 bg-white hover:border-ink-400"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} />
                      <span className="font-bold text-sm">{t.label}</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        active ? "text-white/70" : "text-ink-500"
                      }`}
                    >
                      {t.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Nova šifra
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                className="input mt-1.5 font-mono tracking-widest"
                placeholder="4-8 cifara"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                maxLength={8}
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                Potvrdi novu šifru
              </label>
              <input
                type="password"
                inputMode="numeric"
                className="input mt-1.5 font-mono tracking-widest"
                placeholder="Ista cifra"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={8}
                required
              />
            </div>
          </div>

          {err && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            <Mail size={16} /> {loading ? "Šaljem kod..." : "Pošalji kod na email"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmChange} className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <div className="font-bold">
              Kod je poslat na {pending.email_masked}
            </div>
            <div className="mt-1">
              Menjaš: <b>{targetLabel(pending.target)}</b> šifru. Kod važi 15 minuta.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Kod sa emaila (6 cifara)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              className="input mt-1.5 font-mono text-center text-2xl tracking-[0.5em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoFocus
              required
            />
          </div>

          {err && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Potvrđujem..." : "Potvrdi promenu"}
            </button>
            <button
              type="button"
              onClick={cancelPending}
              className="btn-ghost"
              disabled={loading}
            >
              Otkaži
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
