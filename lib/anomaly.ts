// Anomaly detekcija: upoređujemo unete cifre sa prosekom radnje (poslednjih 30 dana).
// Ako je neka vrednost 200%+ iznad/ispod proseka (tj. >3x ili <1/3 od proseka),
// to tretiramo kao „moguću grešku u kucanju".

export interface StoreBaseline {
  avg_entries: number;
  avg_buyers: number;
  avg_revenue: number;
  avg_items: number;
  sample_size: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  reasons: string[]; // Human-readable poruke (sr)
}

const MULT_HI = 3.0; // 200%+ iznad = 3x proseka
const MULT_LO = 1 / 3; // 200%+ ispod = 1/3 proseka

function checkField(
  name: string,
  value: number,
  avg: number,
  unit: string = ""
): string | null {
  if (avg <= 0) return null;
  if (value > avg * MULT_HI) {
    return `${name}: ${value}${unit} je više od 3× proseka (${Math.round(
      avg
    )}${unit}). Proveri da nije slučajno dopisana nula.`;
  }
  if (value < avg * MULT_LO && value > 0) {
    return `${name}: ${value}${unit} je manje od trećine proseka (${Math.round(
      avg
    )}${unit}). Da li nedostaje cifra?`;
  }
  return null;
}

export function detectAnomaly(
  current: {
    entries: number;
    buyers: number;
    revenue: number;
    items_sold: number;
  },
  baseline: StoreBaseline
): AnomalyResult {
  const reasons: string[] = [];
  if (baseline.sample_size < 3) {
    // Nemamo dovoljno podataka za pouzdano poređenje
    return { isAnomaly: false, reasons: [] };
  }

  const r1 = checkField("Ulasci", current.entries, baseline.avg_entries);
  const r2 = checkField("Broj računa", current.buyers, baseline.avg_buyers);
  const r3 = checkField(
    "Promet",
    current.revenue,
    baseline.avg_revenue,
    " RSD"
  );
  const r4 = checkField(
    "Broj artikala",
    current.items_sold,
    baseline.avg_items
  );
  [r1, r2, r3, r4].forEach((r) => {
    if (r) reasons.push(r);
  });

  return { isAnomaly: reasons.length > 0, reasons };
}
