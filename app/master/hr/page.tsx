import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Calendar,
  Wallet,
  Users,
} from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";

export default async function HrHome() {
  if (!(await isMasterAuthed())) redirect("/login");

  return (
    <main className="min-h-screen bg-ink-50/40">
      {/* Header */}
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Master
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">HR</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 space-y-8">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ljudski resursi
          </h1>
          <p className="mt-2 text-ink-500">
            Raspored radnog vremena, godišnji odmori i mesečne plate.
          </p>
        </section>

        <section className="grid gap-4">
          <Tile
            href="/master/hr/raspored"
            title="Raspored"
            description="Planiraj nedeljne smene po radnji. Vidi raspored prošlih nedelja kao referencu."
            icon={<CalendarDays className="w-7 h-7" />}
            active
          />
          <Tile
            href="/master/hr/zaposleni"
            title="Status zaposlenih"
            description="Pregled radnica po radnji — ime, status (junior/medior/senior), datum isteka."
            icon={<Users className="w-7 h-7" />}
            active
          />
          <Tile
            href="/master/hr/odmori"
            title="Godišnji odmor"
            description="Pregled zahteva radnica za odmor. Odobri ili odbij sa razlogom."
            icon={<Calendar className="w-7 h-7" />}
            active
          />
          <Tile
            href="/master/hr/plate"
            title="Plate"
            description="Mesečno upisivanje plata po radnici. Radnice vide samo svoju u svom profilu."
            icon={<Wallet className="w-7 h-7" />}
            active
          />
        </section>
      </div>
    </main>
  );
}

function Tile({
  href,
  title,
  description,
  icon,
  active = false,
  comingSoon = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
  comingSoon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        {active && (
          <ArrowRight
            size={22}
            className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition mt-2"
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold text-ink-900">{title}</h2>
        {comingSoon && (
          <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
            Uskoro
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
        {description}
      </p>
    </>
  );

  if (!active) {
    return (
      <div className="bg-white border border-ink-100 rounded-2xl p-6 opacity-70 cursor-not-allowed">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group bg-white border border-ink-100 rounded-2xl p-6 hover:border-ink-900 hover:-translate-y-0.5 transition-all"
    >
      {inner}
    </Link>
  );
}
