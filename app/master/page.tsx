import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  isMasterAuthed,
  getTimStore,
  getWorkerSession,
} from "@/lib/auth";
import { Users, LineChart, ArrowRight, Settings as SettingsIcon, FileText, AlertOctagon } from "lucide-react";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function MasterLanding() {
  // Auth gate
  if (!(await isMasterAuthed())) {
    if (await getTimStore()) redirect("/unos");
    if (await getWorkerSession()) redirect("/moj-profil");
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-ink-50/40">
      {/* Header */}
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Dušan Stil"
              width={36}
              height={36}
              priority
            />
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-400">
                Dušan Stil
              </div>
              <div className="text-sm font-semibold text-ink-900">MASTER</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-14 space-y-8">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Dobrodošli, MASTER
          </h1>
          <p className="mt-2 text-ink-500">
            Izaberite gde želite da uđete.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <Tile
            href="/master/hr"
            title="HR"
            subtitle="Ljudski resursi"
            description="Raspored, godišnji odmori i mesečne plate."
            icon={<Users className="w-7 h-7" />}
          />
          <Tile
            href="/admin"
            title="Konverzija"
            subtitle="Dnevni dashboard"
            description="Praćenje prodaje uživo — promet, konverzija, izveštaji."
            icon={<LineChart className="w-7 h-7" />}
          />
          <Tile
            href="/master/podesavanja"
            title="Podešavanja"
            subtitle="Konfiguracija"
            description="Šifre, radnice, ciljevi, bonus tier-i, događaji."
            icon={<SettingsIcon className="w-7 h-7" />}
          />
          <Tile
            href="/master/fakture"
            title="Fakture"
            subtitle="AI ekstrakcija"
            description="Slika fakture dobavljača → tabela artikala. Kursevi i export."
            icon={<FileText className="w-7 h-7" />}
          />
          <Tile
            href="/master/feleri"
            title="Feleri"
            subtitle="Reklamacije i defekti"
            description="Prijava defektnih artikala, dokumenti reklamacija, Logik export."
            icon={<AlertOctagon className="w-7 h-7" />}
          />
        </section>
      </div>
    </main>
  );
}

function Tile({
  href,
  title,
  subtitle,
  description,
  icon,
}: {
  href: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-ink-100 rounded-2xl p-7 hover:border-ink-900 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="w-14 h-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight
          size={22}
          className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition"
        />
      </div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-400 mb-1">
        {subtitle}
      </div>
      <h2 className="text-2xl font-bold text-ink-900 mb-2">{title}</h2>
      <p className="text-sm text-ink-500 leading-relaxed">{description}</p>
    </Link>
  );
}
