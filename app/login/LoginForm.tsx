"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import FirstLoginWizard from "./FirstLoginWizard";

interface FirstLoginContext {
  worker_id: string;
  store_id: string;
  initials: string;
}

export default function LoginForm() {
  const router = useRouter();
  const [initials, setInitials] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [firstLogin, setFirstLogin] = useState<FirstLoginContext | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!initials.trim() || !pin.trim()) {
      setErr("Unesite inicijale i lozinku.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials: initials.trim(), pin: pin.trim() }),
      });
      const j = await res.json();

      // First-login flow za radnice
      if (j.first_login_required && j.worker_id) {
        setFirstLogin({
          worker_id: j.worker_id,
          store_id: j.store_id ?? "",
          initials: initials.trim().toUpperCase(),
        });
        setPin("");
        return;
      }

      if (!res.ok) {
        throw new Error(j.error ?? "Greška pri prijavi.");
      }

      // Uspesna prijava — redirect
      const redirectUrl = j.redirect ?? "/";
      router.push(redirectUrl);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  if (firstLogin) {
    return (
      <FirstLoginWizard
        workerId={firstLogin.worker_id}
        storeId={firstLogin.store_id}
        initials={firstLogin.initials}
        onCancel={() => setFirstLogin(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ink-50/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo + naslov */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-ink-900 text-white flex items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="Dušan Stil"
              width={48}
              height={48}
              priority
            />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-ink-400">
              Dušan Stil
            </div>
            <div className="text-base font-semibold text-ink-900">
              Prijava na sistem
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl border border-ink-100 p-6 shadow-sm"
        >
          {/* Info blok — objasni first-login automatski */}
          <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 mb-5 text-sm text-sky-900 leading-relaxed">
            Ako se prijavljujete prvi put, ukucajte svoje inicijale i bilo
            koje cifre kao lozinku — sistem će vas voditi kroz dva koraka da
            postavite svoju trajnu lozinku.
          </div>

          <label className="block text-sm font-semibold text-ink-900 mb-1.5">
            Vaši inicijali
          </label>
          <input
            type="text"
            placeholder="Npr. IJ ili D5 ili MASTER"
            className="w-full h-12 px-3.5 text-base rounded-xl border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition mb-3.5"
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            autoFocus
            maxLength={12}
          />

          <label className="block text-sm font-semibold text-ink-900 mb-1.5">
            Vaša lozinka
          </label>
          <input
            type="password"
            inputMode="numeric"
            placeholder="4 ili više cifara"
            className="w-full h-12 px-3.5 text-base font-mono tracking-wider rounded-xl border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition mb-5"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
            maxLength={8}
          />

          {err && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2.5 mb-4 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold text-base transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Prijavljivanje…" : "Uđi u sistem"}
          </button>

          <div className="mt-5 pt-4 border-t border-ink-100 text-center text-[13px] text-ink-500 leading-relaxed">
            Zaboravili ste lozinku?
            <br />
            Pitajte šefa da je resetuje.
          </div>
        </form>
      </div>
    </div>
  );
}
