import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import LogoutButton from "../LogoutButton";
import FaktureList from "./FaktureList";

export const dynamic = "force-dynamic";

export interface Invoice {
  id: string;
  supplier_name: string | null;
  custom_name: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  api_cost: number;
  created_at: string;
  updated_at: string;
}

export default async function FakturePage() {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const { data } = await supabase.rpc("list_invoices");
  const invoices = (data ?? []) as Invoice[];

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Master
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Fakture</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-ink-700" />
              Fakture
            </h1>
            <p className="mt-1 text-ink-500">
              Upload-uj sliku fakture dobavljača — AI vadi artikle u tabelu.
            </p>
          </div>
          <Link
            href="/master/fakture/upload"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold"
          >
            <Plus size={18} /> Nova faktura
          </Link>
        </section>

        <FaktureList invoices={invoices} />
      </div>
    </main>
  );
}
