import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Server-side xlsx parsiranje je zamenjeno client-side rešenjem
// (XLSX se učitava direktno u browser-u sa SheetJS CDN-a, vidi
// ArticlesClient.tsx ImportModal komponentu).
// Ova ruta ostaje samo kao 410 Gone za stari kod koji bi je možda zvao.
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint izbačen — XLSX se sad parsira u browser-u." },
    { status: 410 }
  );
}
