import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isMasterAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ExportRow {
  id: string;
  document_id: string;
  article_id: string;
  sifra: string;
  barkod: string | null;
  naziv: string;
  kolicina: number;
  status: string;
}

interface FelerDocLite {
  id: string;
  naziv: string;
  datum: string;
  napomena: string | null;
}

/**
 * GET /api/feleri/dokumenti/[id]/export-logik
 * Vraća text/plain fajl sa "barkod;količina" linijama za Logik sistem.
 * Koristi šifru iz feler_articles ako barkod fali.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isMasterAuthed())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseServer();
  const [{ data: doc }, { data: artsRaw }] = await Promise.all([
    supabase
      .rpc("get_feler_document", { p_id: params.id })
      .single<FelerDocLite>(),
    supabase.rpc("get_doc_articles_for_export", { p_doc_id: params.id }),
  ]);

  if (!doc) {
    return new NextResponse("Dokument ne postoji.", { status: 404 });
  }

  const arts = (artsRaw ?? []) as ExportRow[];

  // Logik format: "<barkod ili sifra>;<kolicina>"
  const lines = arts.map((a) => {
    const code = a.barkod || a.sifra;
    const qty = Number(a.kolicina) || 0;
    return `${code};${qty}`;
  });

  const body = lines.join("\r\n") + "\r\n";
  const fileName = `feleri-${doc.naziv.replace(/[^a-zA-Z0-9]/g, "_")}-${doc.datum}.txt`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
