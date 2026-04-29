import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  Target,
  TrendingUp,
  Coins,
} from "lucide-react";
import {
  getWorkerSession,
  isMasterAuthed,
  getTimStore,
} from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { formatRSD, formatPct, STORE_LABELS_SHORT } from "@/lib/format";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

interface MySalary {
  year: number;
  month: number;
  fixed_amount: number;
  variable_amount: number;
  amount: number;
  paid_at: string | null;
  note: string | null;
}

interface BonusProgress {
  store_id: string;
  monthly_target: number | null;
  current_revenue: number;
  progress_pct: number;
  active_workers_count: number;
  current_tier_label: string | null;
  current_tier_total: number;
  current_tier_per_worker: number;
  next_tier_label: string | null;
  next_tier_threshold: number | null;
  next_tier_total: number;
  remaining_to_next: number;
  month_category: number | null;
  base_salary: number | null;
}

export default async function MojaPlataPage() {
  if (await isMasterAuthed()) redirect("/master");
  if (await getTimStore()) redirect("/unos");
  const session = await getWorkerSession();
  if (!session) redirect("/login");

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const supabase = createSupabaseServer();

  const [{ data: salariesData }, { data: progressData }] = await Promise.all([
    supabase.rpc("list_my_salaries", {
      p_worker_id: session.worker_id,
      p_limit: 36, // 3 godine unazad da imamo poredjenje
    }),
    supabase
      .rpc("get_my_bonus_progress", {
        p_worker_id: session.worker_id,
        p_year: currentYear,
        p_month: currentMonth,
      })
      .single<BonusProgress>(),
  ]);

  const allSalaries = (salariesData ?? []) as MySalary[];

  // Mapa (year-month) za brzo year-over-year poredjenje
  const salaryByPeriod = new Map<string, MySalary>();
  allSalaries.forEach((s) => {
    salaryByPeriod.set(`${s.year}-${s.month}`, s);
  });

  // Prikazujemo poslednjih 12 unosa, sa year-over-year poredjenjem
  const salaries = allSalaries.slice(0, 12);
  const progress = progressData;

  const baseSalary = progress?.base_salary ?? null;
  const hasTarget =
    progress &&
    progress.monthly_target != null &&
    Number(progress.monthly_target) > 0;

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/moj-profil"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Profil
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Plata</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-ink-700" />
            Moja plata
          </h1>
          <p className="mt-1 text-ink-500">
            Pregled mesečnih plata i trenutni napredak ka cilju.
          </p>
        </section>

        {/* === FIKSNA PLATA — uvek vidljiva ako je postavljena === */}
        {baseSalary != null && (
          <section className="card-soft bg-ink-900 text-white border-ink-900">
            <div className="flex items-start gap-3">
              <Coins className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-300 mb-0.5">
                  Tvoja fiksna plata
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  {formatRSD(baseSalary)}
                </div>
                <div className="text-xs text-ink-300 mt-1 leading-relaxed">
                  Osnovica koju dobiješ svakog meseca. Bonus se dodaje preko
                  postizanja mesečnog cilja radnje.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === PROGRESS BANNER (uvek se trudi da nešto pokaže) === */}
        {progress && hasTarget ? (
          <section className="card-soft bg-gradient-to-br from-sky-50 to-white border-sky-100">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-sky-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider font-semibold text-sky-700 mb-1">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear} ·{" "}
                  {STORE_LABELS_SHORT[session.store_id] ?? session.store_id}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-ink-900 tabular-nums">
                  {formatPct(Number(progress.progress_pct) * 100)}
                </div>
                <div className="text-sm text-ink-700">
                  ostvareno od cilja{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRSD(Number(progress.monthly_target))}
                  </span>{" "}
                  · trenutno{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRSD(Number(progress.current_revenue))}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-white border border-sky-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 transition-all"
                    style={{
                      width: `${Math.min(100, Number(progress.progress_pct) * 100).toFixed(2)}%`,
                    }}
                  />
                </div>

                {/* Trenutni tier i sledeci */}
                <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
                  {progress.current_tier_label ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <div className="font-semibold text-emerald-700">
                        Trenutni nivo
                      </div>
                      <div className="text-emerald-900 mt-0.5">
                        <b>{progress.current_tier_label}</b>
                        {Number(progress.current_tier_per_worker) > 0 && (
                          <>
                            {" · "}
                            <span className="tabular-nums">
                              {formatRSD(Number(progress.current_tier_per_worker))}{" "}
                              <span className="opacity-70">tvoj bonus</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-ink-50 border border-ink-100 px-3 py-2">
                      <div className="font-semibold text-ink-700">
                        Trenutni nivo
                      </div>
                      <div className="text-ink-500 mt-0.5">
                        Ispod 65% — nema bonusa
                      </div>
                    </div>
                  )}
                  {progress.next_tier_label &&
                  Number(progress.remaining_to_next) > 0 ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <div className="font-semibold text-amber-800 inline-flex items-center gap-1">
                        <TrendingUp size={12} /> Do {progress.next_tier_label}
                      </div>
                      <div className="text-amber-900 mt-0.5 tabular-nums">
                        još {formatRSD(Number(progress.remaining_to_next))}
                      </div>
                      {progress.active_workers_count > 0 &&
                        Number(progress.next_tier_total) > 0 && (
                          <div className="text-amber-800 text-[11px] mt-0.5">
                            tada bi tvoj bonus bio{" "}
                            <b className="tabular-nums">
                              {formatRSD(
                                Number(progress.next_tier_total) /
                                  progress.active_workers_count
                              )}
                            </b>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <div className="font-semibold text-emerald-700">
                        Top nivo!
                      </div>
                      <div className="text-emerald-900 mt-0.5">
                        Već si na najvišem bonus tier-u
                      </div>
                    </div>
                  )}
                </div>

                {progress.month_category == null && (
                  <div className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <b>Napomena:</b> šef još nije dodelio kategoriju ovom
                    mesecu, pa iznosi bonusa nisu prikazani. Sam procenat cilja
                    je tačan.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* Nema target-a, ali bar pokaži nešto */
          <section className="card-soft bg-amber-50 border-amber-100">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider font-semibold text-amber-700 mb-1">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear} ·{" "}
                  {STORE_LABELS_SHORT[session.store_id] ?? session.store_id}
                </div>
                <div className="text-sm text-amber-900">
                  Mesečni cilj za tvoju radnju nije postavljen, pa nema
                  poređenja.{" "}
                  {progress &&
                    Number(progress.current_revenue) > 0 && (
                      <>
                        Trenutni promet radnje ovog meseca:{" "}
                        <b className="tabular-nums">
                          {formatRSD(Number(progress.current_revenue))}
                        </b>
                        .
                      </>
                    )}
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  Kad šef postavi cilj u podešavanjima, ovde će ti se
                  pojaviti tier sistem bonusa.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Lista plata */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Istorija plata
          </h2>

          {salaries.length === 0 ? (
            <div className="card-soft text-center py-10 text-ink-400">
              Još nije unesena nijedna plata. Šef će je dodati za tekući mesec.
            </div>
          ) : (
            <div className="card-soft divide-y divide-ink-100">
              {salaries.map((s) => {
                const lastYear = salaryByPeriod.get(`${s.year - 1}-${s.month}`);
                const change = lastYear
                  ? ((Number(s.amount) - Number(lastYear.amount)) /
                      Number(lastYear.amount)) *
                    100
                  : null;
                return (
                  <div
                    key={`${s.year}-${s.month}`}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-ink-900">
                          {MONTH_NAMES[s.month - 1]} {s.year}
                        </div>
                        {s.paid_at && (
                          <div className="text-[11px] text-ink-500 tabular-nums">
                            Isplaćeno: {s.paid_at}
                          </div>
                        )}
                        {s.note && (
                          <div className="text-xs text-ink-500 italic mt-0.5">
                            {s.note}
                          </div>
                        )}
                      </div>
                      <div className="text-base font-bold text-ink-900 tabular-nums">
                        {formatRSD(Number(s.amount))}
                      </div>
                    </div>
                    {(Number(s.fixed_amount) > 0 ||
                      Number(s.variable_amount) > 0) && (
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-500 tabular-nums">
                        <span>
                          F:{" "}
                          <span className="text-ink-700 font-semibold">
                            {Number(s.fixed_amount) > 0
                              ? formatRSD(Number(s.fixed_amount))
                              : "—"}
                          </span>
                        </span>
                        <span>
                          V:{" "}
                          <span className="text-ink-700 font-semibold">
                            {Number(s.variable_amount) > 0
                              ? formatRSD(Number(s.variable_amount))
                              : "—"}
                          </span>
                        </span>
                      </div>
                    )}
                    {/* Year-over-year poredjenje */}
                    {lastYear && change != null && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <span className="text-ink-500">
                          {MONTH_NAMES[s.month - 1]} {s.year - 1}:{" "}
                          <span className="text-ink-700 font-semibold tabular-nums">
                            {formatRSD(Number(lastYear.amount))}
                          </span>
                        </span>
                        <span
                          className={
                            change > 0
                              ? "px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-900"
                              : change < 0
                                ? "px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-900"
                                : "px-1.5 py-0.5 rounded font-bold bg-ink-100 text-ink-700"
                          }
                        >
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="text-xs text-ink-500 leading-relaxed">
          Plate ulazi šef svakog meseca. Bonus se dodaje na osnovu procenta
          mesečnog cilja koji radnja postigne. Iznos bonusa po radnici =
          ukupni bonus radnje ÷ broj aktivnih radnica.
        </section>
      </div>
    </main>
  );
}
