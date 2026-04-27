import { isAdminAuthed } from "@/lib/admin-auth";
import { getAuthConfig } from "@/lib/auth";
import AdminGate from "../AdminGate";
import { createSupabaseServer } from "@/lib/supabase";
import SettingsForm from "./SettingsForm";
import WeeklyGoalsEditor from "./WeeklyGoalsEditor";
import AuthSettings from "./AuthSettings";
import WorkersManager from "./WorkersManager";
import EventsManager from "./EventsManager";
import type { Store, Settings } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const supabase = createSupabaseServer();
  const [{ data: stores }, { data: settings }] = await Promise.all([
    supabase.from("stores").select("*").order("id"),
    supabase.from("settings").select("*"),
  ]);

  const allSettings = (settings ?? []) as Settings[];
  const global = allSettings.find((s) => s.store_id === null);
  const byStore = new Map<string, Settings>();
  allSettings.forEach((s) => {
    if (s.store_id) byStore.set(s.store_id, s);
  });

  const authCfg = await getAuthConfig();
  const emailMasked = maskEmail(authCfg.notify_email);

  return (
    <main className="min-h-screen bg-ink-50/30">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 flex items-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700 font-semibold"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl font-bold tracking-tight">Podešavanja</h1>
          <p className="mt-2 text-ink-500">
            Ciljevi po radnji, mesečni raspored po nedeljama, i promena MASTER/TIM šifara.
          </p>
        </section>

        {/* === PIN-ovi === */}
        <section className="card-soft">
          <AuthSettings notifyEmailMasked={emailMasked} />
        </section>

        {/* === Radnici === */}
        <section className="card-soft">
          <WorkersManager />
        </section>

        {/* === Događaji i praznici === */}
        <section className="card-soft">
          <EventsManager />
        </section>

        <section>
          <h2 className="text-lg font-bold text-ink-900 mt-4">Ciljevi</h2>
          <p className="text-sm text-ink-500 mt-1">
            Globalni cilj važi kao podrazumevani ako radnja nema svoj. Mesečni cilj se automatski
            raspoređuje po nedeljama, a ručne izmene se čuvaju.
          </p>
        </section>

        <section className="card-soft">
          <h2 className="font-bold text-ink-900 mb-4">Globalno</h2>
          <SettingsForm
            store_id={null}
            store_name="Svih radnji"
            settings={global}
          />
        </section>

        {(stores ?? []).map((s: Store) => (
          <section key={s.id} className="card-soft space-y-5">
            <div>
              <h2 className="font-bold text-ink-900 mb-4">
                <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded mr-2">
                  {s.id}
                </span>
                {s.name}
              </h2>
              <SettingsForm
                store_id={s.id}
                store_name={s.name}
                settings={byStore.get(s.id)}
              />
            </div>
            <div className="pt-4 border-t border-ink-100">
              <WeeklyGoalsEditor storeId={s.id} storeName={s.name} />
            </div>
          </section>
        ))}
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
