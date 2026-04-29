"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/login", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm text-ink-700 hover:text-ink-900 hover:bg-ink-50 rounded-lg transition disabled:opacity-60"
    >
      <LogOut size={14} /> Odjava
    </button>
  );
}
