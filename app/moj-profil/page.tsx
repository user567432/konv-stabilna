import { redirect } from "next/navigation";
import { getWorkerSession, isMasterAuthed, getTimStore } from "@/lib/auth";
import { STORE_LABELS_SHORT } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Wallet,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function MojProfilPage() {
  if (await isMasterAuthed()) redirect("/master");
  if (await getTimStore()) redirect("/unos");

  const session = await getWorkerSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-2xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
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
              <div className="text-sm font-semibold text-ink-900">
                Moj profil
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-10 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Zdravo,{" "}
            <span className="font-mono text-ink-900">{session.initials}</span>
          </h1>
          <p className="mt-2 text-ink-500">
            Radnja{" "}
            <span className="font-semibold text-ink-900">
              {STORE_LABELS_SHORT[session.store_id] ?? session.store_id}
            </span>
          </p>
        </section>

        <section className="grid gap-4">
          <ProfileTile
            href="/moj-profil/raspored"
            icon={<CalendarDays className="w-7 h-7" />}
            title="Moj raspored"
            description="Pogledaj koje smene radiš ove nedelje i sa kojim koleginicama."
          />
          <ProfileTile
            href="/moj-profil/odmori"
            icon={<Calendar className="w-7 h-7" />}
            title="Godišnji odmor"
            description="Traži odmor i prati status zahteva. Vidi koliko ti je dana ostalo ove godine."
          />
          <ProfileTile
            href="/moj-profil/plate"
            icon={<Wallet className="w-7 h-7" />}
            title="Moja plata"
            description="Pregled mesečnih plata. Vidi i koliko si daleko od cilja za bonus."
          />
        </section>
      </div>
    </main>
  );
}

function ProfileTile({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-ink-100 rounded-2xl p-6 hover:border-ink-900 hover:-translate-y-0.5 transition-all flex items-start gap-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-ink-900 text-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-ink-900">{title}</h3>
        <p className="text-sm text-ink-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight
        size={20}
        className="text-ink-300 group-hover:text-ink-900 group-hover:translate-x-1 transition mt-2"
      />
    </Link>
  );
}
