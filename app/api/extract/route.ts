import { NextResponse } from "next/server";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vision pozivi su sporiji

interface ExtractedArticle {
  model?: string;
  tip?: string;
  boja?: string;
  kolicina?: number;
  usd?: number;
  rvel?: number;
}

interface ExtractedInvoice {
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  articles?: ExtractedArticle[];
}

export async function POST(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  if (!files.length) {
    return NextResponse.json(
      { error: "Nema priloženih slika." },
      { status: 400 }
    );
  }

  // Konvertuj u base64
  const images: Array<{ media_type: string; data: string }> = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mt =
      f.type && f.type.startsWith("image/") ? f.type : "image/jpeg";
    images.push({ media_type: mt, data: base64 });
  }

  let extracted: ExtractedInvoice = {};
  let apiCost = 0;

  if (apiKey) {
    // Pozovi Claude Vision API
    try {
      const messages = [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: img.media_type,
                data: img.data,
              },
            })),
            {
              type: "text",
              text: `Pred tobom je faktura tekstilnog dobavljača. Izvuci listu artikala u JSON formatu. Svaki artikal ima: model (string), tip (string, npr. "muška" "ženska" "dečja"), boja (string), kolicina (broj), usd (broj, cena u USD), rvel (broj, veleprodajna cena ako je naveden).

Vrati SAMO JSON, bez objašnjenja:
{
  "supplier": "ime dobavljača",
  "invoiceNumber": "broj fakture ako vidiš",
  "date": "YYYY-MM-DD ako vidiš",
  "articles": [
    {"model": "...", "tip": "...", "boja": "...", "kolicina": 0, "usd": 0, "rvel": 0}
  ]
}`,
            },
          ],
        },
      ];

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages,
        }),
      });

      if (!aiRes.ok) {
        const errBody = await aiRes.text();
        return NextResponse.json(
          { error: `Anthropic API: ${aiRes.status} ${errBody.slice(0, 200)}` },
          { status: 502 }
        );
      }

      const aiJson = (await aiRes.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = aiJson.content?.find((c) => c.type === "text")?.text ?? "";
      // Pokušaj da nađeš JSON blok
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          extracted = JSON.parse(match[0]) as ExtractedInvoice;
        } catch {
          extracted = {};
        }
      }
      // Procena troška: input ~ $0.003/1K tokens, output ~ $0.015/1K tokens
      const inputTokens = aiJson.usage?.input_tokens ?? 0;
      const outputTokens = aiJson.usage?.output_tokens ?? 0;
      apiCost = (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Vision API: ${e.message}`
              : "Vision API greška.",
        },
        { status: 502 }
      );
    }
  } else {
    // Bez API ključa — vrati prazan invoice da korisnik može ručno da popuni
    extracted = {
      supplier: "",
      invoiceNumber: "",
      date: new Date().toISOString().slice(0, 10),
      articles: [],
    };
  }

  // Snimi u bazu
  const supabase = createSupabaseServer();
  const { data: createdInvoice, error: createErr } = await supabase
    .rpc("create_invoice", {
      p_supplier_name: extracted.supplier ?? "",
      p_invoice_number: extracted.invoiceNumber ?? "",
      p_invoice_date: extracted.date ?? null,
      p_raw_extraction: extracted as unknown as Record<string, unknown>,
      p_api_cost: apiCost,
    })
    .single<{ id: string }>();

  if (createErr || !createdInvoice) {
    return NextResponse.json(
      { error: createErr?.message ?? "Greška pri kreiranju fakture." },
      { status: 500 }
    );
  }

  if (extracted.articles && extracted.articles.length > 0) {
    const { error: bulkErr } = await supabase.rpc("bulk_insert_invoice_articles", {
      p_invoice_id: createdInvoice.id,
      p_articles: extracted.articles as unknown as Record<string, unknown>,
    });
    if (bulkErr) {
      return NextResponse.json(
        { error: `Artikli: ${bulkErr.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    invoice_id: createdInvoice.id,
    extracted,
    api_cost: apiCost,
    api_key_present: Boolean(apiKey),
  });
}
