import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import LogoutButton from "../../LogoutButton";
import UploadClient from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!(await isMasterAuthed())) redirect("/login");

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/fakture"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Fakture
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Nova</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <UploadClient />
      </div>
    </main>
  );
}
