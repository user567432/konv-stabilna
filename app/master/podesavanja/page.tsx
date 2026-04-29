import { redirect } from "next/navigation";
import { isMasterAuthed, getNotifyEmail } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import AuthSettings from "@/app/admin/podesavanja/AuthSettings";
import WorkersManager from "@/app/admin/podesavanja/WorkersManager";
import EventsManager from "@/app/admin/podesavanja/EventsManager";
import BonusTiersEditor from "./BonusTiersEditor";
import BaseSalariesEditor from "./BaseSalariesEditor";
import CiljeviManager from "./CiljeviManager";
import Collapsible from "./Collapsible";
import type { Store, Settings } from "@/lib/types";
import Link from "next/link";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  KeyRound,
  Users,
  Wallet,
  TrendingUp,
  Target,
  Calendar,
} from "lucide-react";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";

export default async function PodesavanjaPage() {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const [{ data: stores }, { data: settings }] = await Promise.all([
    supabase.from("stores").select("*").order("id"),
    supabase.from("settings").select("*"),
  ]);

  const allSettings = (settings ?? []) as Settings[];
  const byStore = new Map<string, Settings>();
  allSettings.forEach((s) => {
    if (s.store_id) byStore.set(s.store_id, s);
  });

  const notifyEmail = await getNotifyEmail();
  const emailMasked = maskEmail(notifyEmail);

  return (
    <main className="min-h-screen bg-ink-50/40">
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
            <span className="text-sm font-semibold text-ink-900">
              Podešavanja
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 space-y-3">
        <section className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-ink-700" />
            Podešavanja
          </h1>
          <p className="mt-2 text-ink-500">
            Klikni na strelicu pored sekcije da otvoriš detalje.
          </p>
        </section>

        <Collapsible
          title="Promena šifara"
          description="MASTER + TIM PIN-ovi po radnji, sa email potvrdom"
          icon={<KeyRound size={22} />}
        >
          <div className="mt-4">
            <AuthSettings notifyEmailMasked={emailMasked} />
          </div>
        </Collapsible>

        <Collapsible
          title="Radnice"
          description="Dodaj, premesti, deaktiviraj. Inicijali i pripadnost radnji."
          icon={<Users size={22} />}
        >
          <div className="mt-4">
            <WorkersManager />
          </div>
        </Collapsible>

        <Collapsible
          title="Fiksne plate"
          description="Osnovica plate po radnici, biraš radnju gore"
          icon={<Wallet size={22} />}
        >
          <BaseSalariesEditor />
        </Collapsible>

        <Collapsible
          title="Bonus targeti po kategoriji"
          description="5 templejta po radnji, mesec se dodeljuje kategoriji"
          icon={<TrendingUp size={22} />}
        >
          <BonusTiersEditor />
        </Collapsible>

        <Collapsible
          title="Ciljevi po radnji"
          description="Konverzija, prosečan račun, mesečni promet i nedeljna razrada"
          icon={<Target size={22} />}
        >
          <CiljeviManager
            stores={(stores ?? []) as Store[]}
            settingsByStore={byStore}
          />
        </Collapsible>

        <Collapsible
          title="Događaji i praznici"
          description="Praznici i kampanje koje utiču na promet"
          icon={<Calendar size={22} />}
        >
          <div className="mt-4">
            <EventsManager />
          </div>
        </Collapsible>
      </div>
    </main>
  );
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}
