import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isMasterAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface DocArt {
  id: string;
  sifra: string;
  naziv: string;
  kolicina: number;
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
      .from("feler_documents")
      .select("naziv, datum")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("feler_document_articles")
      .select(
        `
        id, kolicina,
        feler_articles!inner ( sifra, barkod, naziv )
      `
      )
      .eq("document_id", params.id),
  ]);

  if (!doc) {
    return new NextResponse("Dokument ne postoji.", { status: 404 });
  }

  type Row = {
    id: string;
    kolicina: number;
    feler_articles: { sifra: string; barkod: string | null; naziv: string };
  };

  const arts = (artsRaw ?? []) as unknown as Row[];

  // Logik format: "<barkod ili sifra>;<kolicina>"
  const lines = arts.map((a) => {
    const code = a.feler_articles.barkod || a.feler_articles.sifra;
    const qty = Number(a.kolicina) || 0;
    return `${code};${qty}`;
  });

  const body = lines.join("\r\n") + "\r\n";
  const fileName =
    `feleri-${(doc.naziv as string).replace(/[^a-zA-Z0-9]/g, "_")}-${doc.datum as string}.txt`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
