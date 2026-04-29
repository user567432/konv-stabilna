"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Image as ImageIcon,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface PdfJsLib {
  getDocument: (data: ArrayBuffer | { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNum: number) => Promise<{
        getViewport: (opts: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (opts: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
  GlobalWorkerOptions: { workerSrc: string };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

const PDFJS_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs";
const PDFJS_WORKER =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";

async function loadPdfJs(): Promise<PdfJsLib> {
  if (typeof window !== "undefined" && window.pdfjsLib) return window.pdfjsLib;
  // Dinamička ESM importacija
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* webpackIgnore: true */ PDFJS_CDN);
  const pdfjsLib = mod as PdfJsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  if (typeof window !== "undefined") window.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

async function pdfToImages(pdfFile: File): Promise<File[]> {
  const lib = await loadPdfJs();
  const buf = await pdfFile.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const images: File[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context fail.");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) continue;
    images.push(
      new File([blob], `${pdfFile.name.replace(/\.pdf$/i, "")}-page${p}.jpg`, {
        type: "image/jpeg",
      })
    );
  }
  return images;
}

export default function UploadClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  function pickFiles() {
    inputRef.current?.click();
  }

  function onFilesSelected(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) =>
      /\.(jpe?g|png|webp|heic|pdf)$/i.test(f.name)
    );
    setFiles(arr);
    setErr(null);
  }

  function removeFile(idx: number) {
    setFiles((fs) => fs.filter((_, i) => i !== idx));
  }

  async function uploadAndExtract() {
    if (files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      // Konvertuj PDF-ove u slike na klijentu
      const allImages: File[] = [];
      for (const f of files) {
        if (/\.pdf$/i.test(f.name)) {
          setStage(`Konvertujem PDF (${f.name})…`);
          const imgs = await pdfToImages(f);
          allImages.push(...imgs);
        } else {
          allImages.push(f);
        }
      }

      setStage("Šaljem AI-u…");
      const fd = new FormData();
      allImages.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/extract", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Greška.");
      setStage("Snimam…");
      router.push(`/master/fakture/${j.invoice_id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška pri ekstrakciji.");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Upload className="w-8 h-8 text-ink-700" />
          Nova faktura
        </h1>
        <p className="mt-1 text-ink-500">
          Izaberi slike fakture — AI će izvući artikle u tabelu.
        </p>
      </section>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,application/pdf,.pdf"
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <section className="card-soft">
        <button
          type="button"
          onClick={pickFiles}
          disabled={busy}
          className="w-full border-2 border-dashed border-ink-200 hover:border-ink-400 hover:bg-ink-50 rounded-2xl py-12 flex flex-col items-center gap-3 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-2 text-ink-400">
            <ImageIcon size={36} />
            <FileText size={36} />
          </div>
          <div className="text-base font-semibold text-ink-900">
            Klikni da izabereš slike ili PDF
          </div>
          <div className="text-xs text-ink-500">
            JPEG, PNG, WebP, HEIC, PDF · više fajlova odjednom = jedna faktura
          </div>
        </button>
      </section>

      {files.length > 0 && (
        <section className="card-soft">
          <div className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
            Izabrano ({files.length})
          </div>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-3 bg-ink-50 rounded-lg px-3 py-2"
              >
                <ImageIcon size={16} className="text-ink-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {f.name}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {(f.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={busy}
                  className="p-1.5 rounded hover:bg-ink-100 text-ink-500"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      {files.length > 0 && (
        <button
          type="button"
          onClick={uploadAndExtract}
          disabled={busy}
          className="w-full h-14 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" />{" "}
              {stage || "Obrađujem…"}
            </>
          ) : (
            <>
              <CheckCircle2 size={18} /> Pošalji AI-u i izvuci artikle
            </>
          )}
        </button>
      )}

      <section className="text-xs text-ink-500 leading-relaxed">
        <p>
          <b>PDF</b> se na klijentu automatski konvertuje u slike pre slanja
          AI-u. Svaka stranica = posebna slika. Velike PDF-ove (50+ strana)
          može malo da potraje.
        </p>
        <p className="mt-1">
          AI poziv koristi Anthropic Claude Vision i košta oko $0.02 po slici.
          Mora da postoji <code className="bg-ink-100 px-1 rounded">ANTHROPIC_API_KEY</code>{" "}
          env-var na Vercel-u.
        </p>
      </section>
    </div>
  );
}
