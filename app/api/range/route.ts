import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { loadRange } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

// GET /api/range?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end required (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const data = await loadRange(start, end);
  return NextResponse.json({ ok: true, start, end, data });
}
