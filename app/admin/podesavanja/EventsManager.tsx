"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  PartyPopper,
  Ban,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  date_from: string;
  date_to: string;
  kind: "holiday" | "event";
  scope: "all" | "delta" | "dusanova" | "D1" | "D2" | "D4" | "D5";
  title: string;
  note: string | null;
}

const SCOPES: { value: CalendarEvent["scope"]; label: string }[] = [
  { value: "all", label: "Sve 4 radnje" },
  { value: "delta", label: "Delta Planet (D4 + D5)" },
  { value: "dusanova", label: "Dušanova (D1 + D2)" },
  { value: "D1", label: "D1 · Ženska Dušanova" },
  { value: "D2", label: "D2 · Muška Dušanova" },
  { value: "D4", label: "D4 · Ženska Delta Planet" },
  { value: "D5", label: "D5 · Muška Delta Planet" },
];

function scopeLabel(scope: CalendarEvent["scope"]): string {
  return SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

function formatRange(from: string, to: string): string {
  const f = new Date(from).toLocaleDateString("sr-RS", {
    day: "numeric",
    month: "short",
  });
  if (from === to) return f;
  const t = new Date(to).toLocaleDateString("sr-RS", {
    day: "numeric",
    month: "short",
  });
  return `${f} — ${t}`;
}

export default function EventsManager() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [kind, setKind] = useState<"holiday" | "event">("event");
  const [scope, setScope] = useState<CalendarEvent["scope"]>("all");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // range: prošlih 30 dana + narednih 180
      const now = new Date();
      const from = new Date(now);
      from.setDate(now.getDate() - 30);
      const to = new Date(now);
      to.setDate(now.getDate() + 180);
      const res = await fetch(
        `/api/calendar-events?from=${from.toISOString().slice(0, 10)}&to=${to
          .toISOString()
          .slice(0, 10)}`,
        { cache: "no-store" }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      setEvents(j.events ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!dateFrom || !dateTo || !title.trim()) {
      setErr("Datum početka, kraja i naslov su obavezni.");
      return;
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
      setErr("Datum kraja mora biti posle početka.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_from: dateFrom,
          date_to: dateTo,
          kind,
          scope,
          title: title.trim(),
          note: note.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      flashSuccess("Događaj dodat.");
      setDateFrom("");
      setDateTo("");
      setTitle("");
      setNote("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Obrisati događaj?")) return;
    try {
      const res = await fetch(`/api/calendar-events?id=${id}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      flashSuccess("Obrisano.");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  // Split into upcoming vs past
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date_to >= today);
  const past = events.filter((e) => e.date_to < today);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0">
          <CalendarDays size={22} />
        </div>
        <div>
          <h2 className="font-bold text-ink-900">Događaji i praznici</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            Neradni dani (crveno) i akcije/eventi (žuto). Biraj scope — celo preduzeće,
            Delta Planet, Dušanova, ili pojedinačna radnja.
          </p>
        </div>
      </div>

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {err}
        </div>
      )}

      {/* Forma */}
      <form onSubmit={submit} className="rounded-xl bg-ink-50 p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Tip
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-white p-1 border border-ink-200">
              <button
                type="button"
                onClick={() => setKind("holiday")}
                className={`text-xs font-semibold py-1.5 rounded ${
                  kind === "holiday"
                    ? "bg-rose-500 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                <Ban size={12} className="inline mr-1" /> Neradni
              </button>
              <button
                type="button"
                onClick={() => setKind("event")}
                className={`text-xs font-semibold py-1.5 rounded ${
                  kind === "event"
                    ? "bg-amber-500 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                <PartyPopper size={12} className="inline mr-1" /> Event
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Radnje
            </label>
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as CalendarEvent["scope"])
              }
              className="input mt-1.5 text-sm"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Od
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                if (!dateTo || dateTo < e.target.value) setDateTo(e.target.value);
              }}
              className="input mt-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Do
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input mt-1.5 text-sm"
              required
            />
          </div>
        </div>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Naslov
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input mt-1.5 text-sm"
              placeholder="npr. Black Friday"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Napomena (opciono)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input mt-1.5 text-sm"
              placeholder="npr. 30% na sve jakne"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            <Plus size={16} /> {submitting ? "..." : "Dodaj"}
          </button>
        </div>
      </form>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-ink-400">Učitavam...</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Nadolazeći i aktuelni ({upcoming.length})
              </div>
              <ul className="space-y-1.5">
                {upcoming.map((e) => (
                  <EventRow key={e.id} e={e} onDelete={deleteEvent} />
                ))}
              </ul>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 mt-4">
                Istorija ({past.length})
              </div>
              <ul className="space-y-1.5 opacity-60">
                {past.slice(0, 10).map((e) => (
                  <EventRow key={e.id} e={e} onDelete={deleteEvent} />
                ))}
              </ul>
            </div>
          )}
          {events.length === 0 && (
            <div className="text-sm text-ink-400 italic">
              Nema događaja. Dodaj Black Friday, praznike, kampanje — pojaviće se kao badge na
              dashboard-u i u dnevnom izveštaju.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventRow({
  e,
  onDelete,
}: {
  e: CalendarEvent;
  onDelete: (id: string) => void;
}) {
  const bg =
    e.kind === "holiday"
      ? "bg-rose-50 border-rose-200"
      : "bg-amber-50 border-amber-200";
  const badgeColor =
    e.kind === "holiday"
      ? "bg-rose-500 text-white"
      : "bg-amber-500 text-white";
  return (
    <li
      className={`rounded-xl border px-3 py-2 flex items-start justify-between gap-3 ${bg}`}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}
        >
          {e.kind === "holiday" ? "Neradni" : "Event"}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">{e.title}</div>
          <div className="text-xs text-ink-600">
            {formatRange(e.date_from, e.date_to)} · {scopeLabel(e.scope)}
          </div>
          {e.note && <div className="text-xs text-ink-500 mt-0.5">{e.note}</div>}
        </div>
      </div>
      <button
        onClick={() => onDelete(e.id)}
        className="text-rose-600 hover:bg-rose-100 p-1.5 rounded"
        title="Obriši"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
