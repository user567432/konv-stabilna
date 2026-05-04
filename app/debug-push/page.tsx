import { redirect } from "next/navigation";
import {
  isMasterAuthed,
  getWorkerSession,
  getTimStore,
} from "@/lib/auth";
import DebugPushClient from "./DebugPushClient";

export const dynamic = "force-dynamic";

export default async function DebugPushPage() {
  const master = await isMasterAuthed();
  const worker = await getWorkerSession();
  const tim = await getTimStore();

  if (!master && !worker) redirect("/login");

  const subject = master ? "master" : worker?.workerId ?? null;
  const label = master
    ? "MASTER"
    : worker
      ? `Radnica ${worker.initials}`
      : tim
        ? `TIM ${tim}`
        : "—";

  return (
    <main className="min-h-screen bg-ink-50/40">
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Push debug</h1>
          <p className="mt-1 text-ink-500">
            Ulogovan kao <b>{label}</b> · subject = <code>{subject ?? "?"}</code>
          </p>
        </header>
        <DebugPushClient subject={subject} />
      </div>
    </main>
  );
}
