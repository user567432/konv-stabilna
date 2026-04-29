import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import LogoutButton from "../../../LogoutButton";
import DocumentEditor from "./DocumentEditor";

export const dynamic = "force-dynamic";

export interface FelerDoc {
  id: string;
  naziv: string;
  datum: string;
  napomena: string | null;
}

export interface DocArticleRow {
  id: string;
  document_id: string;
  article_id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  kolicina: number;
  tip_ostecenja: string;
  status: string;
  napomena: string | null;
  slike: string[] | null;
  iznos_povracaja: number | null;
  valuta_povracaja: string | null;
  zamena_artikal_id: string | null;
  zamena_tekst: string | null;
  cekirano: boolean;
}

export default async function FelerDocPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const [{ data: doc }, { data: arts }] = await Promise.all([
    supabase
      .from("feler_documents")
      .select("*")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.rpc("list_doc_articles", { p_doc_id: params.id }),
  ]);

  if (!doc) notFound();

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/feleri/dokumenti"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Dokumenti
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900 truncate max-w-[260px]">
              {doc.naziv as string}
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8">
        <DocumentEditor
          doc={doc as FelerDoc}
          initialArticles={(arts ?? []) as DocArticleRow[]}
        />
      </div>
    </main>
  );
}
