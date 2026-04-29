"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  workerId: string;
  storeId: string;
  initials: string;
  onCancel: () => void;
}

type Step = 1 | 2 | 3; // 3 = success

export default function FirstLoginWizard({
  workerId,
  storeId,
  initials,
  onCancel,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function nextFromStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\d{4,8}$/.test(newPin)) {
      setErr("Lozinka mora biti od 4 do 8 cifara.");
      return;
    }
    setStep(2);
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPin !== confirmPin) {
      setErr("Lozinke se ne podudaraju. Vratite se i pokušajte ponovo.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login/first", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id: workerId,
          new_pin: newPin,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error ?? "Greška.");
      }
      setStep(3);
      // Posle 2.5s automatski redirect
      setTimeout(() => {
        router.push(j.redirect ?? "/moj-profil");
        router.refresh();
      }, 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header — back na login */}
        {step !== 3 && (
          <button
            onClick={onCancel}
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-4"
          >
            <ArrowLeft size={14} /> Nazad na prijavu
          </button>
        )}

        <div className="bg-white rounded-2xl border border-ink-100 p-6 shadow-sm">
          {/* Progress bar (steps 1-2) */}
          {step !== 3 && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                  Postavljanje lozinke
                </div>
                <div className="text-[11px] font-semibold text-ink-700">
                  Korak {step} od 2
                </div>
              </div>
              <div className="h-2 bg-ink-100 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-ink-900 transition-all duration-300"
                  style={{ width: `${(step / 2) * 100}%` }}
                />
              </div>
              <div className="text-[13px] text-ink-500 mb-5">
                Pripremamo nalog za <b className="text-ink-900">{initials}</b>
                {storeId ? <span> · radnja {storeId}</span> : null}
              </div>
            </>
          )}

          {/* === STEP 1: smisli lozinku === */}
          {step === 1 && (
            <form onSubmit={nextFromStep1}>
              <h2 className="text-lg font-bold text-ink-900 mb-1.5">
                Smislite svoju lozinku
              </h2>
              <p className="text-sm text-ink-500 mb-5 leading-relaxed">
                Ovo će biti VAŠA lična lozinka — koristite je svaki put kada
                ulazite u sistem. Niko drugi je neće znati. Birajte 4 do 8
                cifara koje ćete lako da zapamtite.
              </p>

              <label className="block text-sm font-semibold text-ink-900 mb-1.5">
                Vaša nova lozinka
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="4-8 cifara"
                className="w-full h-12 px-3.5 text-base font-mono tracking-wider rounded-xl border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition mb-5"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                maxLength={8}
                autoFocus
              />

              {err && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2.5 mb-4 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full h-14 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold text-base transition"
              >
                Dalje →
              </button>
            </form>
          )}

          {/* === STEP 2: potvrda === */}
          {step === 2 && (
            <form onSubmit={submitStep2}>
              <h2 className="text-lg font-bold text-ink-900 mb-1.5">
                Potvrdite lozinku
              </h2>
              <p className="text-sm text-ink-500 mb-5 leading-relaxed">
                Ukucajte istu lozinku još jednom da budemo sigurni da ste je
                tačno zapamtili.
              </p>

              <label className="block text-sm font-semibold text-ink-900 mb-1.5">
                Ukucajte lozinku ponovo
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Ista lozinka kao gore"
                className="w-full h-12 px-3.5 text-base font-mono tracking-wider rounded-xl border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-ink-900 transition mb-5"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={8}
                autoFocus
              />

              {err && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2.5 mb-4 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-14 px-4 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 font-semibold text-sm transition"
                  disabled={loading}
                >
                  Nazad
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base transition disabled:opacity-60"
                >
                  {loading ? "Snimam…" : "Završi i uđi"}
                </button>
              </div>
            </form>
          )}

          {/* === STEP 3: SUCCESS === */}
          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">
                Lozinka je postavljena!
              </h2>
              <p className="text-sm text-ink-500 leading-relaxed mb-2">
                Sada ste prijavljeni. Sledeći put kada ulazite, kucajte
                inicijale <b className="text-ink-900">{initials}</b> i ovu novu
                lozinku.
              </p>
              <p className="text-sm text-ink-500">
                Vodimo vas u vaš profil…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
