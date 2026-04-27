"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-ghost !h-9 !px-3 text-sm"
      type="button"
    >
      <Printer size={16} /> Štampaj / PDF
    </button>
  );
}
