import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertOctagon,
  ArrowRight,
  FileBox,
  Package,
  TriangleAlert,
} from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { formatRSD } from "@/lib/format";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";

interface Dashboard {
  documents_count: number;
  articles_count: number;
  feleri_count: number;
  status_counts: Record<string, number>;
  currency_totals: Record<string, number>;
  top_damage: Array<{ tip: string; c: number }>;
  top_proizvodjac: Array<{ proizvodjac: string; c: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  "U procesu": "bg-sky-100 text-sky-900",
  "Vraćeno sa novcem": "bg-emerald-100 text-emerald-900",
  "Vraćeno kao zamjena": "bg-purple-100 text-purple-900",
  "Ostavljeno na popravku": "bg-amber-100 text-amber-900",
  Odbijeno: "bg-rose-100 text-rose-900",
};

export default async function FeleriDashboardPage() {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const { data } = await supabase.rpc("feleri_dashboard").single<Dashboard>();
  const d = data ?? {
    documents_count: 0,
    articles_count: 0,
    feleri_count: 0,
    status_counts: {},
    currency_totals: {},
    top_damage: [],
    top_proizvodjac: [],
  };

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Master
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Feleri</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <AlertOctagon className="w-8 h-8 text-ink-700" />
            Feleri
          </h1>
          <p className="mt-1 text-ink-500">
            Reklamacije i defektni artikli — dokumenti, lista felera, statistike.
          </p>
        </section>

        <section className="grid sm:grid-cols-3 gap-4">
          <NavTile
            href="/master/feleri/artikli"
            title="Artikli"
            count={d.articles_count}
            description="Šifarnik za reklamacije"
            icon={<Package className="w-6 h-6" />}
          />
          <NavTile
            href="/master/feleri/dokumenti"
            title="Dokumenti"
            count={d.documents_count}
            description="Zbirne reklamacije"
            icon={<FileBox className="w-6 h-6" />}
          />
          <NavTile
            href="/master/feleri/feleri"
            title="Feleri"
            count={d.feleri_count}
            description="Lista defekata iz radnji"
            icon={<TriangleAlert className="w-6 h-6" />}
          />
        </section>

        {/* Statistike */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="card-soft">
            <h2 className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              Status pregled
            </h2>
            {Object.keys(d.status_counts).length === 0 ? (
              <div className="text-sm text-ink-400 italic">Bez podataka.</div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(d.status_counts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        STATUS_COLORS[status] ?? "bg-ink-100 text-ink-900"
                      }`}
                    >
                      {status}
                    </span>
                    <span className="font-mono font-bold text-ink-900 tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-soft">
            <h2 className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              Ukupni povraćaji po valuti
            </h2>
            {Object.keys(d.currency_totals).length === 0 ? (
              <div className="text-sm text-ink-400 italic">Bez povraćaja.</div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(d.currency_totals).map(([cur, total]) => (
                  <div key={cur} className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-700">
                      {cur}
                    </span>
                    <span className="font-bold text-ink-900 tabular-nums">
                      {cur === "RSD"
                        ? formatRSD(Number(total))
                        : `${Number(total).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-soft">
            <h2 className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              Top 5 oštećenja
            </h2>
            {d.top_damage.length === 0 ? (
              <div className="text-sm text-ink-400 italic">Bez podataka.</div>
            ) : (
              <ol className="space-y-1.5">
                {d.top_damage.map((row, i) => (
                  <li
                    key={row.tip}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink-700">
                      <span className="text-ink-400 font-mono mr-2">
                        {i + 1}.
                      </span>
                      {row.tip}
                    </span>
                    <span className="font-bold text-ink-900 tabular-nums">
                      {row.c}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card-soft">
            <h2 className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              Top 5 proizvođača sa greškama
            </h2>
            {d.top_proizvodjac.length === 0 ? (
              <div className="text-sm text-ink-400 italic">Bez podataka.</div>
            ) : (
              <ol className="space-y-1.5">
                {d.top_proizvodjac.map((row, i) => (
                  <li
                    key={row.proizvodjac}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink-700">
                      <span className="text-ink-400 font-mono mr-2">
                        {i + 1}.
                      </span>
                      {row.proizvodjac}
                    </span>
                    <span className="font-bold text-ink-900 tabular-nums">
                      {row.c}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function NavTile({
  href,
  title,
  count,
  description,
  icon,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group card-soft hover:border-ink-900 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-ink-900 text-white flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight
          size={18}
          className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition mt-1"
        />
      </div>
      <div className="text-3xl font-bold text-ink-900 tabular-nums">{count}</div>
      <div className="text-sm font-semibold text-ink-700 mt-0.5">{title}</div>
      <div className="text-xs text-ink-500 mt-0.5">{description}</div>
    </Link>
  );
}
