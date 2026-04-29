import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import LogoutButton from "../../LogoutButton";
import FeleriClient from "./FeleriClient";

export const dynamic = "force-dynamic";

export default async function FeleriListPage() {
  if (!(await isMasterAuthed())) redirect("/login");

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/feleri"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Feleri
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Lista felera</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TriangleAlert className="w-8 h-8 text-amber-700" />
            Lista felera
          </h1>
          <p className="mt-1 text-ink-500">
            Defektni artikli prijavljeni iz radnji. Grupisano po proizvođaču.
          </p>
        </section>
        <FeleriClient />
      </div>
    </main>
  );
}
