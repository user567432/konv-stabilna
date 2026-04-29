"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Search, FileText } from "lucide-react";
import clsx from "clsx";
import { formatDateSr } from "@/lib/format";
import type { Invoice } from "./page";

export default function FaktureList({ invoices }: { invoices: Invoice[] }) {
  const [query, setQuery] = useState("");
  const [openSuppliers, setOpenSuppliers] = useState<Set<string>>(
    () => new Set(invoices.map((i) => i.supplier_name ?? "Bez dobavljača"))
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return invoices;
    const q = query.toLowerCase();
    return invoices.filter(
      (i) =>
        (i.supplier_name ?? "").toLowerCase().includes(q) ||
        (i.custom_name ?? "").toLowerCase().includes(q) ||
        (i.invoice_number ?? "").toLowerCase().includes(q)
    );
  }, [invoices, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, Invoice[]>();
    filtered.forEach((inv) => {
      const key = inv.supplier_name ?? "Bez dobavljača";
      const arr = m.get(key) ?? [];
      arr.push(inv);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggleSupplier(name: string) {
    setOpenSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="card-soft text-center py-16">
        <FileText className="mx-auto mb-3 text-ink-300" size={40} />
        <p className="text-ink-500">
          Nema faktura još. Klikni „Nova faktura" da dodaš prvu.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          type="text"
          placeholder="Pretraži po dobavljaču, broju fakture…"
          className="w-full h-11 pl-10 pr-3 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900 focus:border-ink-900"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {grouped.map(([supplier, invs]) => {
          const open = openSuppliers.has(supplier);
          return (
            <div
              key={supplier}
              className="bg-white border border-ink-100 rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSupplier(supplier)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-ink-50/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink-900">{supplier}</span>
                  <span className="text-xs text-ink-500">
                    {invs.length} {invs.length === 1 ? "faktura" : "faktura"}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={clsx("text-ink-500 transition-transform", open && "rotate-180")}
                />
              </button>
              {open && (
                <div className="border-t border-ink-100 divide-y divide-ink-100">
                  {invs.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/master/fakture/${inv.id}`}
                      className="block px-5 py-3 hover:bg-ink-50/60 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink-900 truncate">
                            {inv.custom_name || inv.invoice_number || "Bez broja"}
                          </div>
                          <div className="text-xs text-ink-500 mt-0.5">
                            {inv.invoice_date
                              ? formatDateSr(inv.invoice_date)
                              : "Bez datuma"}{" "}
                            · {inv.invoice_number ?? "—"}
                          </div>
                        </div>
                        {inv.api_cost > 0 && (
                          <span className="text-[11px] text-ink-400 font-mono">
                            ${Number(inv.api_cost).toFixed(3)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
