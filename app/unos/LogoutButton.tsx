"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/tim-login", { method: "DELETE" });
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      title="Odjavi se"
    >
      <LogOut size={14} /> Odjavi
    </button>
  );
}
