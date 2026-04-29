import { redirect } from "next/navigation";
import {
  isMasterAuthed,
  getTimStore,
  getWorkerSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Root / — uvek redirektuje na pravi home prema sesiji:
 *   master    → /master  (HR + Konverzija landing)
 *   tim       → /unos
 *   worker    → /moj-profil
 *   neprijavljen → /login
 */
export default async function HomePage() {
  if (await isMasterAuthed()) redirect("/master");

  const tim = await getTimStore();
  if (tim) redirect("/tim");

  const worker = await getWorkerSession();
  if (worker) redirect("/moj-profil");

  redirect("/login");
}
