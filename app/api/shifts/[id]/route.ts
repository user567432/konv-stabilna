import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface PatchPayload {
  shift_date?: string;
  shift_type?: "prva" | "druga" | "dvokratna";
  entries?: number;
  buyers?: number;
  revenue?: number;
  items_sold?: number;
  note?: string | null;
  worker_id?: string;
  worker_ids?: string[];
}

function actor(): string {
  const c = cookies().get(ADMIN_COOKIE);
  return c?.value ? "master" : "unknown";
}

// Zapis u shift_edit_log
async function logEdit(
  shift_id: string,
  action: "update" | "delete",
  before: unknown,
  after: unknown
) {
  const supabase = createSupabaseServer();
  await supabase.from("shift_edit_log").insert({
    shift_id,
    action,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    actor: actor(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = params.id;
  const body = (await req.json()) as PatchPayload;
  const supabase = createSupabaseServer();

  // Fetch before
  const { data: before, error: beforeErr } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeErr || !before) {
    return NextResponse.json(
      { error: beforeErr?.message ?? "Smena ne postoji." },
      { status: 404 }
    );
  }

  // Update
  const patch: Record<string, unknown> = {};
  if (body.shift_date !== undefined) patch.shift_date = body.shift_date;
  if (body.shift_type !== undefined) patch.shift_type = body.shift_type;
  if (body.entries !== undefined) patch.entries = body.entries;
  if (body.buyers !== undefined) patch.buyers = body.buyers;
  if (body.revenue !== undefined) patch.revenue = body.revenue;
  if (body.items_sold !== undefined) patch.items_sold = body.items_sold;
  if (body.note !== undefined) patch.note = body.note;
  if (body.worker_id !== undefined) patch.worker_id = body.worker_id;
  if (body.worker_ids !== undefined) patch.worker_ids = body.worker_ids;

  const { data: after, error } = await supabase
    .from("shifts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEdit(id, "update", before, after);
  return NextResponse.json({ ok: true, shift: after });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = params.id;
  const supabase = createSupabaseServer();

  const { data: before, error: beforeErr } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeErr || !before) {
    return NextResponse.json(
      { error: beforeErr?.message ?? "Smena ne postoji." },
      { status: 404 }
    );
  }

  // Log PRE brisanja (ON DELETE CASCADE će obrisati log redove ako sada se šifra menja,
  // ali ovde samo brišemo smenu — log ostaje zato što ne referiše FK sa CASCADE na istorijske zapise.)
  // S obzirom na postavljen ON DELETE CASCADE za shift_id, moramo prvo da upišemo log, pa onda obrišemo.
  // Umesto toga menjamo pristup: ubacimo NULL shift_id u log ali sa before payloadom.
  await supabase.from("shift_edit_log").insert({
    shift_id: null,
    action: "delete",
    before,
    after: null,
    actor: actor(),
  });

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
