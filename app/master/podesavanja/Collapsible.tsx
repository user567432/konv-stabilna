"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface Props {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export default function Collapsible({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
  badge,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-ink-50/40 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-ink-900 truncate">{title}</h2>
              {badge && (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-ink-500 mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          size={20}
          className={clsx(
            "text-ink-500 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-100">{children}</div>
      )}
    </section>
  );
}
