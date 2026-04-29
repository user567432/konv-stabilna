"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle, Keyboard } from "lucide-react";

interface Html5QrcodeInstance {
  start: (
    cameraIdOrConfig: string | { facingMode: string },
    configuration: { fps: number; qrbox: { width: number; height: number } },
    qrCodeSuccessCallback: (decodedText: string) => void,
    qrCodeErrorCallback?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  // 1=NOT_STARTED 2=SCANNING 3=PAUSED — postoji samo u nekim verzijama
  getState?: () => number;
}

interface Html5QrcodeLib {
  Html5Qrcode: new (elementId: string) => Html5QrcodeInstance;
}

declare global {
  interface Window {
    Html5Qrcode?: Html5QrcodeLib["Html5Qrcode"];
  }
}

interface Props {
  onClose: () => void;
  onScan: (barkod: string) => void;
}

async function loadHtml5Qrcode(): Promise<void> {
  if (typeof window !== "undefined" && window.Html5Qrcode) return;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-lib="html5-qrcode"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Ne mogu da učitam barcode biblioteku."))
      );
      return;
    }
    const s = document.createElement("script");
    s.src =
      "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    s.dataset.lib = "html5-qrcode";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Ne mogu da učitam barcode biblioteku."));
    document.head.appendChild(s);
  });
}

/**
 * Bezbedan stop — html5-qrcode `stop()` baca sinhrono ako skener nije pokrenut.
 * Pokušaj kao Promise, hvataj i sinhrone i async greške.
 */
async function safeStop(scanner: Html5QrcodeInstance): Promise<void> {
  try {
    // Ako biblioteka ima getState, ne zovi stop ako već nije scanning
    if (typeof scanner.getState === "function") {
      const st = scanner.getState();
      // 2 = SCANNING. U svim drugim stanjima stop puca.
      if (st !== 2) return;
    }
    const p = scanner.stop();
    if (p && typeof p.then === "function") {
      await p.catch(() => undefined);
    }
  } catch {
    // ignore — skener je već stopiran ili u nepoznatom stanju
  }
}

function safeClear(scanner: Html5QrcodeInstance) {
  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

/**
 * BarcodeScanner — modal koji otvara kameru i čita barkod (EAN/Code128).
 * Fallback: dugme „Ukucaj ručno" koje otvara input + Enter.
 */
export default function BarcodeScanner({ onClose, onScan }: Props) {
  const [stage, setStage] = useState<
    "loading" | "scanning" | "manual" | "error"
  >("loading");
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadHtml5Qrcode();
        if (cancelled) return;
        const Html5Qrcode = window.Html5Qrcode;
        if (!Html5Qrcode) throw new Error("Biblioteka nije dostupna.");

        // Uveri se da je div u DOM-u
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;

        const scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 120 } },
          (decoded) => {
            if (scannedRef.current || cancelled) return;
            scannedRef.current = true;
            // Sve dalje radimo asinhrono da ne bi prekinuli html5-qrcode petlju
            // dok smo još u njenom callback-u — to je ono što pravi "Application error".
            queueMicrotask(() => {
              safeStop(scanner).finally(() => {
                if (!cancelled) {
                  try {
                    onScan(decoded);
                  } catch {
                    // parent nas raspakuje, sve OK
                  }
                }
              });
            });
          },
          () => {
            // Per-frame greške ne treba prikazivati
          }
        );
        if (!cancelled) setStage("scanning");
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(
          e instanceof Error
            ? e.message
            : "Kamera nije dostupna. Probaj ručno."
        );
        setStage("manual");
      }
    })();

    return () => {
      cancelled = true;
      const sc = scannerRef.current;
      scannerRef.current = null;
      if (sc) {
        // safeStop je async, ali ne moramo ga čekati u cleanup-u
        safeStop(sc).finally(() => safeClear(sc));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (manual.trim() && !scannedRef.current) {
      scannedRef.current = true;
      onScan(manual.trim());
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between bg-ink-900 text-white">
          <h3 className="font-bold inline-flex items-center gap-2">
            <Camera size={18} /> Skeniraj barkod
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ink-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {stage === "loading" && (
            <div className="text-center py-8 text-ink-500">
              Učitavam kameru…
            </div>
          )}

          {stage !== "manual" && (
            <div
              id="barcode-reader"
              className="rounded-lg overflow-hidden mx-auto"
              style={{ width: "100%", maxWidth: 400 }}
            />
          )}

          {stage === "scanning" && (
            <p className="mt-3 text-xs text-center text-ink-500">
              Drži barkod u centar kvadrata. Auto-detekcija u toku.
            </p>
          )}

          {err && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-ink-100">
            <button
              type="button"
              onClick={() => setStage("manual")}
              className="text-xs text-ink-700 hover:text-ink-900 inline-flex items-center gap-1.5 font-semibold"
            >
              <Keyboard size={12} /> Ukucaj barkod ručno
            </button>
          </div>

          {stage === "manual" && (
            <form onSubmit={submitManual} className="mt-3 space-y-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ukucaj barkod"
                className="input text-base font-mono"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                disabled={!manual.trim()}
                className="btn-primary w-full"
              >
                Pretraži
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
