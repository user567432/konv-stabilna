"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  X,
  CheckCheck,
  ClipboardList,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase";

interface MasterNotif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * MasterBell — zvonce u headeru MASTER stranica. Pokazuje broj nepročitanih
 * obaveštenja (npr. zahtevi za odmor). Klik otvori dropdown sa listom; klik
 * na stavku označi kao pročitano i (ako ima link) redirektuje.
 */
export default function MasterBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<MasterNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchUnreadCount() {
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("count_unread_master_notifications");
      if (!error && typeof data === "number") {
        setUnread(data);
      }
    } catch {
      // ignore
    }
  }

  async function fetchList() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_master_notifications", {
        p_limit: 30,
      });
      if (error) throw new Error(error.message);
      setItems((data ?? []) as MasterNotif[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Poll-ovanje za novi count na svakih 30s
  useEffect(() => {
    fetchUnreadCount();
    const t = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Pri otvaranju dropdown-a, učitaj listu
  useEffect(() => {
    if (open) fetchList();
  }, [open]);

  // Click outside zatvara dropdown
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    try {
      const supabase = createSupabaseBrowser();
      await supabase.rpc("mark_master_notification_read", { p_id: id });
      setItems((arr) =>
        arr.map((it) =>
          it.id === id ? { ...it, read_at: new Date().toISOString() } : it
        )
      );
      fetchUnreadCount();
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      const supabase = createSupabaseBrowser();
      await supabase.rpc("mark_all_master_notifications_read");
      setItems((arr) =>
        arr.map((it) => ({
          ...it,
          read_at: it.read_at ?? new Date().toISOString(),
        }))
      );
      setUnread(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-700"
        aria-label="Obaveštenja"
        title="Obaveštenja"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-ink-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <h3 className="font-bold text-ink-900 text-sm">Obaveštenja</h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  title="Označi sve kao pročitano"
                  className="text-[11px] text-ink-700 hover:text-ink-900 inline-flex items-center gap-1 px-2 h-7 rounded hover:bg-ink-100 font-semibold"
                >
                  <CheckCheck size={11} /> Pročitaj sve
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-ink-100 text-ink-500"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-12 text-center text-ink-400 text-xs">
                Učitavam…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-12 text-center text-ink-400 text-xs">
                Nema obaveštenja.
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {items.map((it) => (
                  <NotifItem
                    key={it.id}
                    notif={it}
                    onRead={() => markRead(it.id)}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({
  notif,
  onRead,
  onClose,
}: {
  notif: MasterNotif;
  onRead: () => void;
  onClose: () => void;
}) {
  const isUnread = !notif.read_at;
  const Icon = iconForType(notif.type);
  const created = new Date(notif.created_at);
  const ago = relativeAgo(created);

  const inner = (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-ink-50 transition cursor-pointer ${
        isUnread ? "bg-amber-50/40" : ""
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isUnread ? "bg-amber-500 text-white" : "bg-ink-100 text-ink-500"
        }`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className={`text-sm ${isUnread ? "font-bold text-ink-900" : "font-medium text-ink-700"} leading-tight flex-1`}>
            {notif.title}
          </div>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
          )}
        </div>
        {notif.body && (
          <div className="text-xs text-ink-600 mt-0.5 leading-snug">
            {notif.body}
          </div>
        )}
        <div className="text-[10px] text-ink-400 mt-1">{ago}</div>
      </div>
    </div>
  );

  if (notif.link) {
    return (
      <li>
        <Link
          href={notif.link}
          onClick={() => {
            if (isUnread) onRead();
            onClose();
          }}
          className="block"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li onClick={() => isUnread && onRead()}>{inner}</li>
  );
}

function iconForType(type: string) {
  switch (type) {
    case "leave_request":
      return ClipboardList;
    case "shift_published":
      return Calendar;
    default:
      return AlertTriangle;
  }
}

function relativeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "upravo sad";
  const min = Math.floor(sec / 60);
  if (min < 60) return `pre ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `pre ${h} h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `pre ${day} dan(a)`;
  return d.toLocaleDateString("sr-RS");
}
