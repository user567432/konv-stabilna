"use client";

import { useState, useRef } from "react";
import { Image as ImageIcon, X, Loader2, Plus } from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";

interface Props {
  /** Lista postojećih URL-ova slika */
  value: string[];
  /** Pozove se kada se lista promeni (posle uploada ili brisanja) */
  onChange: (urls: string[]) => void;
  /** Folder unutar bucket-a — npr. "feleri", "doc-articles" */
  folder?: string;
  /** Maksimalan broj slika */
  max?: number;
  /** Disabled (npr. kad je modal busy) */
  disabled?: boolean;
}

/**
 * ImageUploader — drag & drop / file picker za slike sa preview-om.
 * Slike idu na Supabase Storage bucket "feler-slike" i URL-ovi se vraćaju
 * kroz onChange. Kompresija nije primenjena (čuvanje koda jednostavnim);
 * Supabase bucket ima limit 10MB po fajlu.
 */
export default function ImageUploader({
  value,
  onChange,
  folder = "general",
  max = 10,
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const newUrls: string[] = [];
      const arr = Array.from(files).slice(0, max - value.length);

      for (const file of arr) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} je veći od 10 MB.`);
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const safeName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}.${ext}`;
        const path = `${folder}/${safeName}`;

        const { error: upErr } = await supabase.storage
          .from("feler-slike")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "image/jpeg",
          });
        if (upErr) throw new Error(upErr.message);

        const { data: urlData } = supabase.storage
          .from("feler-slike")
          .getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }

      onChange([...value, ...newUrls]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška pri uploadu.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeImage(url: string) {
    // Pokušaj da obriše iz bucket-a (best-effort)
    try {
      const supabase = createSupabaseBrowser();
      // Path je posle "/feler-slike/" u publicUrl
      const m = url.match(/\/feler-slike\/(.+)$/);
      if (m) {
        await supabase.storage.from("feler-slike").remove([m[1]]);
      }
    } catch {
      // ignore
    }
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url) => (
            <div
              key={url}
              className="relative aspect-square rounded-lg overflow-hidden border border-ink-200 bg-ink-50 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Slika"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(url)}
                disabled={disabled || busy}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                title="Ukloni"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className={clsx(
            "w-full border-2 border-dashed rounded-xl py-4 px-3 flex items-center justify-center gap-2 text-sm font-semibold transition",
            disabled || busy
              ? "border-ink-200 text-ink-400 cursor-not-allowed"
              : "border-ink-300 hover:border-ink-500 hover:bg-ink-50 text-ink-700"
          )}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Šaljem…
            </>
          ) : value.length === 0 ? (
            <>
              <ImageIcon size={16} /> Dodaj slike (kamera ili galerija)
            </>
          ) : (
            <>
              <Plus size={16} /> Još slika ({value.length}/{max})
            </>
          )}
        </button>
      )}

      {err && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
          {err}
        </div>
      )}
    </div>
  );
}
