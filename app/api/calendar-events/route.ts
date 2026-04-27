import { NextResponse } from "next/server";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/calendar-events?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Fali from/to." }, { status: 400 });
  }
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("list_calendar_events", {
    p_from: from,
    p_to: to,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

// POST — MASTER
export async function POST(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    date_from?: string;
    date_to?: string;
    kind?: string;
    scope?: string;
    title?: string;
    note?: string;
  };
  if (
    !body.date_from ||
    !body.date_to ||
    !body.kind ||
    !body.scope ||
    !body.title
  ) {
    return NextResponse.json(
      { error: "Fali obavezno polje." },
      { status: 400 }
    );
  }
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc("create_calendar_event", {
      p_date_from: body.date_from,
      p_date_to: body.date_to,
      p_kind: body.kind,
      p_scope: body.scope,
      p_title: body.title,
      p_note: body.note ?? "",
    })
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ event: data });
}

// DELETE ?id=... — MASTER
export async function DELETE(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Fali id." }, { status: 400 });
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("delete_calendar_event", { p_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
