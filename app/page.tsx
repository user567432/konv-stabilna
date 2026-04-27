import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ClipboardList, LineChart, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <header className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/logo.png"
              alt="Dušan Stil"
              width={56}
              height={56}
              priority
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-50 border border-ink-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-ink-700 tracking-wide uppercase">
                Dušan Stil · Dashboard
              </span>
            </div>
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-ink-900">
            Dnevno praćenje prodaje.
            <br />
            <span className="text-ink-400">Bez papira.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-500 max-w-xl">
            TIM upisuje svoju smenu. MASTER vidi sve 4 radnje uživo — promet, konverziju,
            prosečnu korpu — sa preporukama za rast.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/unos"
            className="group card-soft hover:border-ink-900 transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center">
                <ClipboardList size={22} />
              </div>
              <ArrowRight
                size={22}
                className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition"
              />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-ink-900">TIM</h2>
            <p className="mt-1.5 text-ink-500">
              Upiši svoju smenu — ulasci, broj računa, promet. Dobićeš povratnu informaciju
              sa preporukama.
            </p>
          </Link>

          <Link
            href="/admin"
            className="group card-soft hover:border-ink-900 transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center">
                <LineChart size={22} />
              </div>
              <ArrowRight
                size={22}
                className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition"
              />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-ink-900">MASTER</h2>
            <p className="mt-1.5 text-ink-500">
              Dashboard sa svim radnjama uživo, grafici, dnevni izveštaji i podešavanja
              ciljeva.
            </p>
          </Link>
        </div>

        <div className="mt-4">
          <Link
            href="/tim-rang"
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            <Trophy size={16} /> Tim rang (dostupno svima)
            <ArrowRight size={14} />
          </Link>
        </div>

        <footer className="mt-20 pt-8 border-t border-ink-100 text-xs text-ink-400">
          D1 Ženska Dušanova · D2 Muška Dušanova · D4 Ženska Delta Planet · D5 Muška Delta Planet
        </footer>
      </div>
    </main>
  );
}
