"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function AdminGate() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Greška.");
      }
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-ink-500 hover:text-ink-900">
          ← Nazad
        </Link>
        <div className="card-soft mt-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Dušan Stil" width={44} height={44} priority />
            <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center">
              <Lock size={20} />
            </div>
          </div>
          <h1 className="mt-5 text-2xl font-bold">MASTER pristup</h1>
          <p className="text-ink-500 mt-1.5">Unesi PIN da bi video dashboard.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              className="input text-center text-2xl tracking-widest"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              required
            />
            {err && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                {err}
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Proveravam..." : "Uđi"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
