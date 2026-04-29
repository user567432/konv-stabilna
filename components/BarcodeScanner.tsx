"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle, Keyboard } from "lucide-react";

// ---------------- Tipovi html5-qrcode biblioteke (delimicni) ----------------

type StartConfig = {
  fps: number;
  qrbox: { width: number; height: number } | number;
  aspectRatio?: number;
  disableFlip?: boolean;
  experimentalFeatures?: { useBarCodeDetectorIfSupported?: boolean };
};

type CtorConfig = {
  formatsToSupport?: number[];
  verbose?: boolean;
};

type ScannerInstance = {
  start: (
    cameraIdOrConfig: string | { facingMode: string },
    configuration: StartConfig,
    qrCodeSuccessCallback: (decodedText: string) => void,
    qrCodeErrorCallback?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  getState?: () => number;
};

type Html5QrcodeCtor = new (
  elementId: string,
  config?: CtorConfig | boolean
) => ScannerInstance;

declare global {
  interface Window {
    Html5Qrcode?: Html5QrcodeCtor;
  }
}

// ---------------- Format kodovi ----------------

const FMT_EAN_13 = 9;
const FMT_EAN_8 = 10;
const FMT_UPC_A = 14;
const FMT_UPC_E = 15;
const FMT_CODE_128 = 5;
const FMT_CODE_39 = 3;
const FMT_ITF = 8;

const RETAIL_FORMATS: number[] = [
  FMT_EAN_13,
  FMT_EAN_8,
  FMT_UPC_A,
  FMT_UPC_E,
  FMT_CODE_128,
  FMT_CODE_39,
  FMT_ITF,
];

// ---------------- Helpers ----------------

function isValidEanOrUpc(code: string): boolean {
  if (!/^\d+$/.test(code)) return true;
  const len = code.length;
  if (len !== 8 && len !== 12 && len !== 13 && len !== 14) return true;
  const digits = code.split("").map((d) => parseInt(d, 10));
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += i % 2 === 0 ? d * 3 : d;
  });
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

function loadHtml5Qrcode(): Promise<void> {
  if (typeof window !== "undefined" && window.Html5Qrcode) {
    return Promise.resolve();
  }
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

async function safeStop(scanner: ScannerInstance): Promise<void> {
  try {
    if (typeof scanner.getState === "function") {
      const st = scanner.getState();
      if (st !== 2) return;
    }
    const p = scanner.stop();
    if (p && typeof p.then === "function") {
      await p.catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

function safeClear(scanner: ScannerInstance): void {
  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

// ---------------- Component ----------------

type Props = {
  onClose: () => void;
  onScan: (barkod: string) => void;
};

type Stage = "loading" | "scanning" | "manual" | "error";

export default function BarcodeScanner(props: Props) {
  const { onClose, onScan } = props;
  const [stage, setStage] = useState<Stage>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const scannerRef = useRef<ScannerInstance | null>(null);
  const scannedRef = useRef(false);
  const lastReadCodeRef = useRef<string>("");
  const lastReadCountRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    const startScanner = async (): Promise<void> => {
      try {
        await loadHtml5Qrcode();
        if (cancelled) return;
        const Ctor = window.Html5Qrcode;
        if (!Ctor) throw new Error("Biblioteka nije dostupna.");

        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;

        const scanner: ScannerInstance = new Ctor("barcode-reader", {
          formatsToSupport: RETAIL_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;

        const cfg: StartConfig = {
          fps: 12,
          qrbox: { width: 280, height: 140 },
          aspectRatio: 1.7777778,
          disableFlip: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        };

        const onSuccess = (decoded: string): void => {
          if (scannedRef.current || cancelled) return;
          if (!isValidEanOrUpc(decoded)) return;

          if (lastReadCodeRef.current === decoded) {
            lastReadCountRef.current += 1;
          } else {
            lastReadCodeRef.current = decoded;
            lastReadCountRef.current = 1;
            return;
          }
          if (lastReadCountRef.current < 2) return;

          scannedRef.current = true;
          queueMicrotask(() => {
            safeStop(scanner).then(() => {
              if (!cancelled) {
                try {
                  onScan(decoded);
                } catch {
                  // parent ce nas demontirati
                }
              }
            });
          });
        };

        const onError = (): void => {
          // per-frame greske se ignorisu
        };

        await scanner.start(
          { facingMode: "environment" },
          cfg,
          onSuccess,
          onError
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
    };

    void startScanner();

    return () => {
      cancelled = true;
      const sc = scannerRef.current;
      scannerRef.current = null;
      if (sc) {
        safeStop(sc).then(
          () => safeClear(sc),
          () => safeClear(sc)
        );
      }
    };
  }, [onScan]);

  const submitManual = (e: React.FormEvent): void => {
    e.preventDefault();
    const v = manual.trim();
    if (v && !scannedRef.current) {
      scannedRef.current = true;
      onScan(v);
    }
  };

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
