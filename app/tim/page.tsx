import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ClipboardList,
  Trophy,
  LogOut,
} from "lucide-react";
import {
  isMasterAuthed,
  getTimStore,
  getWorkerSession,
} from "@/lib/auth";
import { STORE_LABELS_SHORT } from "@/lib/format";
import LogoutButton from "@/app/unos/LogoutButton";

export const dynamic = "force-dynamic";

export default async function TimHomePage() {
  // Auth gate
  if (await isMasterAuthed()) redirect("/master");
  if (await getWorkerSession()) redirect("/moj-profil");
  const store = await getTimStore();
  if (!store) redirect("/login");

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-16">
        {/* Top bar */}
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Dušan Stil"
              width={48}
              height={48}
              priority
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-50 border border-ink-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-ink-700 tracking-wide uppercase">
                Dušan Stil ·{" "}
                <span className="font-bold">
                  {STORE_LABELS_SHORT[store] ?? store}
                </span>
              </span>
            </div>
          </div>
          <LogoutButton />
        </header>

        {/* Slogan */}
        <section className="mb-12">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-ink-900">
            Dnevno praćenje prodaje.
            <br />
            <span className="text-ink-400">Bez papira.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-500 max-w-xl leading-relaxed">
            Upiši smenu, vidi koliko ti fali do dnevnog cilja, prati gde si u
            timskom rangu.
          </p>
        </section>

        {/* Two big tiles */}
        <section className="grid md:grid-cols-2 gap-4">
          <Link
            href="/unos"
            className="group bg-white border border-ink-100 rounded-2xl p-7 hover:border-ink-900 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center">
                <ClipboardList size={26} />
              </div>
              <ArrowRight
                size={22}
                className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition mt-2"
              />
            </div>
            <h2 className="text-2xl font-bold text-ink-900">
              Započni novi dan
            </h2>
            <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
              Pogledaj koliko ti fali do mesečnog cilja, koliko po danu ostaje,
              pa upiši svoju smenu.
            </p>
          </Link>

          <Link
            href="/tim-rang"
            className="group bg-white border border-ink-100 rounded-2xl p-7 hover:border-ink-900 hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy size={26} />
              </div>
              <ArrowRight
                size={22}
                className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition mt-2"
              />
            </div>
            <h2 className="text-2xl font-bold text-ink-900">Tim rang</h2>
            <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
              Rang radnica u tvojoj radnji — ko vodi po konverziji, najbolji
              parovi smena.
            </p>
          </Link>
        </section>

        <footer className="mt-16 pt-8 border-t border-ink-100 text-xs text-ink-400">
          {STORE_LABELS_SHORT[store] ?? store}
        </footer>
      </div>
    </main>
  );
}
