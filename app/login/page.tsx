import { redirect } from "next/navigation";
import {
  isMasterAuthed,
  getTimStore,
  getWorkerSession,
} from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Ako je vec ulogovan u nekoj rolji, redirect na njegov home
  if (await isMasterAuthed()) redirect("/master");

  const tim = await getTimStore();
  if (tim) redirect("/tim");

  const worker = await getWorkerSession();
  if (worker) redirect("/moj-profil");

  return <LoginForm />;
}
