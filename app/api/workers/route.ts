import { NextResponse } from "next/server";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/workers — lista svih (aktivnih i neaktivnih)
export async function GET() {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("list_all_workers");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ workers: data ?? [] });
}

// POST /api/workers — dodaj novog
export async function POST(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    initials?: string;
    store_id?: string;
  };
  if (!body.initials || !body.store_id) {
    return NextResponse.json(
      { error: "Fali initials ili store_id." },
      { status: 400 }
    );
  }
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc("create_worker", {
      p_initials: body.initials,
      p_store_id: body.store_id,
    })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ worker: data });
}

// PATCH /api/workers — promeni radnju
export async function PATCH(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    new_store_id?: string;
  };
  if (!body.id || !body.new_store_id) {
    return NextResponse.json(
      { error: "Fali id ili new_store_id." },
      { status: 400 }
    );
  }
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc("update_worker_store", {
      p_worker_id: body.id,
      p_new_store_id: body.new_store_id,
    })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ worker: data });
}

// DELETE /api/workers?id=...&reactivate=1 — soft delete ili reaktivacija
export async function DELETE(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const reactivate = searchParams.get("reactivate") === "1";
  if (!id) {
    return NextResponse.json({ error: "Fali id." }, { status: 400 });
  }
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc(
    reactivate ? "reactivate_worker" : "soft_delete_worker",
    { p_worker_id: id }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
