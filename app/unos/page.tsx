import { createSupabaseServer } from "@/lib/supabase";
import { getTimStore } from "@/lib/auth";
import TimGate from "./TimGate";
import ShiftForm from "./ShiftForm";
import Link from "next/link";
import { ArrowLeft, Trophy, LogOut } from "lucide-react";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

const STORE_LABEL: Record<string, string> = {
  D1: "D1 · Ženska Dušanova",
  D2: "D2 · Muška Dušanova",
  D4: "D4 · Ženska Delta Planet",
  D5: "D5 · Muška Delta Planet",
};

export default async function UnosPage() {
  const myStore = await getTimStore();
  if (!myStore) {
    return <TimGate />;
  }

  const supabase = createSupabaseServer();
  // Fetch SAMO svoje radnje + svoje radnice
  const [{ data: stores }, { data: workers }] = await Promise.all([
    supabase.from("stores").select("*").eq("id", myStore),
    supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .eq("store_id", myStore)
      .order("initials"),
  ]);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 py-8 md:py-14">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} /> Nazad
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/tim-rang"
              className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-semibold"
            >
              <Trophy size={16} /> Tim rang
            </Link>
            <LogoutButton />
          </div>
        </div>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-900 text-white">
            <span className="text-xs font-bold tracking-wider uppercase">
              TIM · {myStore}
            </span>
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-ink-900 tracking-tight">
            Unos smene
          </h1>
          <p className="mt-2 text-ink-500">
            {STORE_LABEL[myStore]} · upiši svoje inicijale i podatke smene.
          </p>
        </header>

        <ShiftForm stores={stores ?? []} workers={workers ?? []} lockedStoreId={myStore} />
      </div>
    </main>
  );
}
