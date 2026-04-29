import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import LogoutButton from "../../LogoutButton";
import InvoiceEditor from "./InvoiceEditor";

export const dynamic = "force-dynamic";

export interface InvoiceFull {
  id: string;
  supplier_name: string | null;
  custom_name: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  rates_json: {
    usdEur?: number;
    eurRsd?: number;
    popust?: number;
    markup?: number;
  } | null;
  api_cost: number;
}

export interface InvoiceArticle {
  id: string;
  invoice_id: string;
  position: number | null;
  model: string | null;
  tip: string | null;
  boja: string | null;
  kolicina: number;
  usd: number;
  rvel: number;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const [{ data: inv }, { data: arts }] = await Promise.all([
    supabase.rpc("get_invoice", { p_id: params.id }).single<InvoiceFull>(),
    supabase.rpc("list_invoice_articles", { p_invoice_id: params.id }),
  ]);

  if (!inv) notFound();

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/fakture"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Fakture
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900 truncate max-w-[260px]">
              {inv.custom_name ||
                inv.invoice_number ||
                inv.supplier_name ||
                "Faktura"}
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        <InvoiceEditor
          invoice={inv}
          initialArticles={(arts ?? []) as InvoiceArticle[]}
        />
      </div>
    </main>
  );
}
