"use client";

import { useState } from "react";
import { HelpCircle, X, ArrowRight, ArrowDown } from "lucide-react";

/**
 * LogikUputstvoFAB — plutajuće dugme "?" na TIM ekranima koje otvara uputstvo
 * korak po korak kako da radnica iz Logik programa izvuče dnevne podatke i
 * gde u našoj formi šta da upiše.
 *
 * Slike (logik-1..4.png) idu u /public/uputstvo/. Krugovi se crtaju iznad
 * slike preko CSS overlay-a — koordinate su u procentima (0–100) širine i
 * visine slike, pa rade na svim rezolucijama.
 */
export default function LogikUputstvoFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Kako da uneseš podatke iz Logika"
        className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Pomoć — kako uneti podatke iz Logika"
      >
        <HelpCircle size={28} strokeWidth={2.5} />
      </button>

      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ---------------- Highlight koordinate (procenti slike) ----------------
 *
 * Koordinate je lako podesiti — otvori sliku u browseru sa F12 inspector-om,
 * uzmi xy poziciju u px, podeli sa ukupnom širinom/visinom × 100.
 *
 * x = leva ivica boxa (% širine slike)
 * y = vrh boxa (% visine slike)
 * w = širina boxa (% širine slike)
 * h = visina boxa (% visine slike)
 * label = baloncić sa brojem ili tekstom (opciono)
 * shape = "circle" za elipsu, "rect" za pravougaonik (default rect)
 * labelPos = "tr" (top-right, default), "tl", "tc" (top-center), "bc" (bottom-center)
 */

type LabelPos = "tr" | "tl" | "tc" | "bc";

type Highlight = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  shape?: "circle" | "rect";
  labelPos?: LabelPos;
};

// STEP 1 — Čarobnjak meni i Upiti opcija
const HIGHLIGHTS_1: Highlight[] = [
  { x: 0.5, y: 1.5, w: 7, h: 5.5, label: "1", shape: "circle" },
  { x: 2, y: 27.5, w: 7, h: 4, label: "2" },
];

// STEP 2 — 8.Konverzija u listi i Dalje > dugme
const HIGHLIGHTS_2: Highlight[] = [
  { x: 28, y: 48, w: 14, h: 2.6, label: "1" },
  { x: 44, y: 71.5, w: 7.5, h: 4.5, label: "2" },
];

// STEP 3 — Šifra, Od/Do datuma, Dalje
const HIGHLIGHTS_3: Highlight[] = [
  { x: 26, y: 26.8, w: 50, h: 2.7, label: "1" },
  { x: 26, y: 29.5, w: 50, h: 5.4, label: "2" },
  { x: 44, y: 67.5, w: 7.5, h: 4.5, label: "3" },
];

// STEP 4 — kolone Promet, Broj_Racuna, Ukupno_Artikala
const HIGHLIGHTS_4: Highlight[] = [
  // Broj_Racuna (4. kolona)
  { x: 36.5, y: 23, w: 6, h: 9, label: "Broj rač.", labelPos: "tc" },
  // Promet (5. kolona)
  { x: 42.7, y: 23, w: 7, h: 9, label: "Promet", labelPos: "bc" },
  // Ukupno_Artikala (9. kolona)
  { x: 70, y: 23, w: 6.5, h: 9, label: "Artikli", labelPos: "tc" },
];

/* ---------------------------------------------------------------- */

function Modal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/80 flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between bg-amber-600 text-white md:rounded-t-2xl shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">
              Uputstvo
            </div>
            <h3 className="text-lg font-bold">Kako uneti podatke iz Logika</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-amber-700/50"
            aria-label="Zatvori"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 md:px-7 py-5 space-y-7">
          <p className="text-sm text-ink-700 leading-relaxed">
            Podatke za smenu (promet, broj računa, broj artikala) uzimaš iz{" "}
            <b>Logik</b> programa preko upita <b>8 — Konverzija</b>. Ispod je
            korak po korak. Narandžaste oznake pokazuju gde da klikneš.
          </p>

          <Step
            n={1}
            title="Otvori Čarobnjak → Upiti"
            body={
              <>
                U Logiku, klikni na <b>Čarobnjak</b> u gornjem levom uglu (
                <Pill>1</Pill>), pa onda na opciju <b>Upiti</b> u dropdown
                meniju (<Pill>2</Pill>).
              </>
            }
            image="/uputstvo/logik-1.png"
            highlights={HIGHLIGHTS_1}
          />

          <Step
            n={2}
            title="Izaberi upit broj 8 — Konverzija"
            body={
              <>
                Otvoriće se prozor <b>„Čarobnjak upita"</b>. Pronađi i klikni{" "}
                <b>8.Konverzija</b> u listi (<Pill>1</Pill>). Onda pritisni{" "}
                <b>Dalje &gt;</b> (<Pill>2</Pill>).
              </>
            }
            image="/uputstvo/logik-2.png"
            highlights={HIGHLIGHTS_2}
          />

          <Step
            n={3}
            title="Unesi šifru i datume"
            body={
              <>
                Popunjavaš tri polja:
                <ul className="mt-2 space-y-1.5 list-disc ml-5">
                  <li>
                    <b>Šifra</b> (<Pill>1</Pill>) — kod tvoje maloprodaje
                    (dobila si ga od šefa).
                  </li>
                  <li>
                    <b>Od Datuma</b> i <b>Do Datuma</b> (<Pill>2</Pill>) —
                    isti dan, datum za koji unosiš.
                  </li>
                </ul>
                Onda <b>Dalje &gt;</b> (<Pill>3</Pill>).
              </>
            }
            image="/uputstvo/logik-3.png"
            highlights={HIGHLIGHTS_3}
          />

          <Step
            n={4}
            title="Pročitaj rezultat — red po smeni"
            body={
              <>
                Tabela koja se otvori ima jedan red po smeni i jedan{" "}
                <b>U (zbirni)</b> red za ceo dan. Tebi treba red tvoje smene
                — npr. <i>10:00–16:00</i> ako si bila u prvoj. Iz tog reda
                uzimaš tri kolone (zaokružene narandžasto).
              </>
            }
            image="/uputstvo/logik-4.png"
            highlights={HIGHLIGHTS_4}
          />

          <Step
            n={5}
            title="Upiši brojeve u našu formu"
            body={
              <>
                Otvoriš ekran <b>Novi dan</b> u našoj aplikaciji i pronađeš
                karticu svoje smene (Prva / Druga / Dvokratna). Tu su tri
                polja gde upisuješ brojeve iz Logika:
              </>
            }
            mockup={<UnosFormMockup />}
          />

          {/* Mapping table */}
          <div>
            <h4 className="font-bold text-ink-900 mb-2">
              Brza tabela mapiranja
            </h4>
            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full text-sm">
                <thead className="bg-amber-50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-bold text-ink-900 text-xs uppercase tracking-wider">
                      Iz Logika
                    </th>
                    <th className="px-3 py-2 w-8 text-center text-amber-700">
                      <ArrowRight size={14} className="inline" />
                    </th>
                    <th className="px-3 py-2 font-bold text-ink-900 text-xs uppercase tracking-wider">
                      U našu formu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  <Row
                    from="Promet"
                    to="Promet (RSD)"
                    note="Bruto iznos pre refundacija."
                  />
                  <Row
                    from="Broj_Racuna"
                    to="Kupci"
                    note="Toliko fiskalnih računa je izdato."
                  />
                  <Row
                    from="Ukupno_Artikala"
                    to="Artikli"
                    note="Ukupno komada robe prodato u smeni."
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Posete note */}
          <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-900">
            <b>Posete (ulazi)</b> NE prepisuješ iz Logika. Taj broj uzimaš sa
            brojača na vratima radnje na kraju smene.
          </div>

          {/* Tips */}
          <div className="rounded-xl bg-ink-50 border border-ink-100 px-4 py-3 text-sm text-ink-800">
            <b>Saveti:</b>
            <ul className="mt-1.5 space-y-1 list-disc ml-5">
              <li>
                <b>Refundacije</b> ne unosiš posebno — naš sistem koristi
                bruto <i>Promet</i>, kao u Logiku.
              </li>
              <li>
                Ako si u <b>dvokratnoj smeni</b>, saberi brojeve obe smene iz
                Logika ručno (Logik nema posebnu kategoriju za dvokratnu).
              </li>
              <li>
                Ako imaš nedoumicu, odštampaj rezultat upita iz Logika i
                pokaži šefu.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ink-100 bg-ink-50 md:rounded-b-2xl shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800"
          >
            Razumem
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  image,
  highlights,
  mockup,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  image?: string;
  highlights?: Highlight[];
  mockup?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-base">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-ink-900 leading-tight mb-1">{title}</h4>
        <div className="text-sm text-ink-700 leading-relaxed">{body}</div>
        {image && (
          <ImageWithHighlights
            src={image}
            alt={`Korak ${n}`}
            highlights={highlights ?? []}
          />
        )}
        {mockup && <div className="mt-3">{mockup}</div>}
      </div>
    </div>
  );
}

function ImageWithHighlights({
  src,
  alt,
  highlights,
}: {
  src: string;
  alt: string;
  highlights: Highlight[];
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="mt-3 rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 p-6 text-center text-xs text-ink-400 italic">
        Slika za ovaj korak biće dodata uskoro.
        <div className="mt-1 font-mono text-[10px] text-ink-500">{src}</div>
      </div>
    );
  }

  return (
    <div className="mt-3 relative rounded-lg overflow-hidden border border-ink-200 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full h-auto"
        onError={() => setFailed(true)}
      />
      <div className="absolute inset-0 pointer-events-none">
        {highlights.map((h, i) => (
          <HighlightBox key={i} h={h} />
        ))}
      </div>
    </div>
  );
}

function HighlightBox({ h }: { h: Highlight }) {
  const isCircle = h.shape === "circle";
  const labelPos: LabelPos = h.labelPos ?? "tr";

  const labelStyle = (() => {
    switch (labelPos) {
      case "tl":
        return "absolute -top-3 -left-3";
      case "tc":
        return "absolute -top-3 left-1/2 -translate-x-1/2";
      case "bc":
        return "absolute -bottom-3 left-1/2 -translate-x-1/2";
      case "tr":
      default:
        return "absolute -top-3 -right-3";
    }
  })();

  return (
    <div
      className={
        isCircle
          ? "absolute border-[3px] border-amber-500 rounded-full shadow-[0_0_0_2px_rgba(251,146,60,0.3)]"
          : "absolute border-[3px] border-amber-500 rounded-md shadow-[0_0_0_2px_rgba(251,146,60,0.3)]"
      }
      style={{
        left: `${h.x}%`,
        top: `${h.y}%`,
        width: `${h.w}%`,
        height: `${h.h}%`,
      }}
    >
      {h.label && (
        <span
          className={`${labelStyle} bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 h-6 min-w-[24px] flex items-center justify-center shadow-md border-2 border-white whitespace-nowrap`}
        >
          {h.label}
        </span>
      )}
    </div>
  );
}

/* ---------------- Mockup forme za korak 5 ---------------- */

function UnosFormMockup() {
  return (
    <div className="rounded-xl border-2 border-ink-200 bg-white overflow-hidden shadow-sm">
      {/* Tab header */}
      <div className="bg-ink-50 px-4 py-2.5 border-b border-ink-200 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-bold text-ink-900 uppercase tracking-wider">
          Prva smena (9–17 časova)
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Posete */}
          <FieldMockup
            label="Posete"
            placeholder="240"
            note="Sa brojača na vratima"
            noteColor="sky"
          />
          {/* Kupci */}
          <FieldMockup
            label="Kupci"
            placeholder="33"
            note="Logik kolona Broj_Racuna"
            noteColor="amber"
            arrowLabel="A"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Promet */}
          <FieldMockup
            label="Promet"
            placeholder="396.590"
            note="Logik kolona Promet"
            noteColor="amber"
            arrowLabel="B"
          />
          {/* Artikli */}
          <FieldMockup
            label="Artikli"
            placeholder="67"
            note="Logik kolona Ukupno_Artikala"
            noteColor="amber"
            arrowLabel="C"
          />
        </div>
        <FieldMockup
          label="Napomena (opciono)"
          placeholder="npr. dosta vraćanja, mali ceh"
          note=""
          noteColor="ink"
        />
      </div>

      {/* Legend */}
      <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
        <div className="text-[11px] uppercase tracking-wider font-bold text-amber-900 mb-2">
          Mapiranje iz Logika
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
          <MappingChip letter="A" from="Broj_Racuna" to="Kupci" />
          <MappingChip letter="B" from="Promet" to="Promet" />
          <MappingChip letter="C" from="Ukupno_Artikala" to="Artikli" />
        </div>
      </div>
    </div>
  );
}

function FieldMockup({
  label,
  placeholder,
  note,
  noteColor,
  arrowLabel,
}: {
  label: string;
  placeholder: string;
  note: string;
  noteColor: "amber" | "sky" | "ink";
  arrowLabel?: string;
}) {
  const noteCls =
    noteColor === "amber"
      ? "text-amber-700"
      : noteColor === "sky"
      ? "text-sky-700"
      : "text-ink-500";
  return (
    <div className="relative">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500 mb-1 flex items-center gap-1.5">
        {label}
        {arrowLabel && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
            {arrowLabel}
          </span>
        )}
      </div>
      <div className="h-9 rounded-lg border-2 border-ink-200 bg-ink-50/50 px-3 flex items-center text-sm text-ink-400 italic">
        {placeholder}
      </div>
      {note && (
        <div className={`mt-1 text-[10px] ${noteCls} flex items-center gap-1`}>
          <ArrowDown size={9} />
          {note}
        </div>
      )}
    </div>
  );
}

function MappingChip({
  letter,
  from,
  to,
}: {
  letter: string;
  from: string;
  to: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-md border border-amber-200">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold shrink-0">
        {letter}
      </span>
      <span className="font-mono text-[10px] text-ink-700 truncate">
        {from}
      </span>
      <ArrowRight size={10} className="text-amber-600 shrink-0" />
      <span className="font-bold text-[11px] text-ink-900 truncate">{to}</span>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function Row({
  from,
  to,
  note,
}: {
  from: string;
  to: string;
  note: string;
}) {
  return (
    <tr>
      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-ink-900 align-top whitespace-nowrap">
        {from}
      </td>
      <td className="px-3 py-2.5 text-center text-amber-600 align-top">
        <ArrowRight size={14} className="inline" />
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="font-bold text-ink-900">{to}</div>
        <div className="text-[11px] text-ink-500 mt-0.5">{note}</div>
      </td>
    </tr>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold align-middle mx-0.5">
      {children}
    </span>
  );
}
