import type { Shift, Settings } from "./types";
import { formatPct, formatRSD } from "./format";

export type FeedbackTone = "success" | "warning" | "neutral";

export interface ShiftFeedback {
  tone: FeedbackTone;
  headline: string;
  bullets: string[];
  recommendations: string[];
  stats: {
    conversion: { value: number; target: number; delta: number };
    aov: { value: number; target: number; delta: number };
    historyAvgConv: number;
    historyAvgAov: number;
  };
}

interface BuildArgs {
  current: Pick<Shift, "entries" | "buyers" | "revenue" | "items_sold" | "conversion_pct" | "aov">;
  settings: Pick<Settings, "conversion_target" | "aov_target">;
  historyAvgConv: number; // % - prosek istorije za tu radnju
  historyAvgAov: number;  // RSD
}

export function buildShiftFeedback(args: BuildArgs): ShiftFeedback {
  const { current, settings, historyAvgConv, historyAvgAov } = args;

  const convTarget = Number(settings.conversion_target);
  const aovTarget = Number(settings.aov_target);
  const conv = Number(current.conversion_pct);
  const aov = Number(current.aov);

  const convDelta = conv - convTarget;
  const aovDelta = aov - aovTarget;

  const bullets: string[] = [];
  const recs: string[] = [];

  // --- Konverzija ---
  if (current.entries === 0) {
    bullets.push("Nije bilo nijednog ulaska u radnju tokom ove smene.");
  } else {
    bullets.push(
      `Od ${current.entries} ulazaka, ${current.buyers} računa je izdato. Konverzija iznosi ${formatPct(conv)}.`
    );
  }

  if (conv >= convTarget) {
    bullets.push(`Cilj konverzije (${formatPct(convTarget)}) je dostignut.`);
  } else if (conv >= historyAvgConv && historyAvgConv > 0) {
    bullets.push(
      `Iznad proseka radnje (${formatPct(historyAvgConv)}), ali ispod cilja ${formatPct(convTarget)}.`
    );
  } else if (historyAvgConv > 0) {
    bullets.push(
      `Ispod proseka radnje (${formatPct(historyAvgConv)}) i ispod cilja ${formatPct(convTarget)}.`
    );
  } else {
    bullets.push(`Cilj konverzije je ${formatPct(convTarget)}.`);
  }

  // Preporuke za konverziju
  if (conv < convTarget) {
    const gap = convTarget - conv;
    if (gap >= 7) {
      recs.push("Priđi svakom gostu koji uđe, pozdravi i ponudi pomoć u prvih trideset sekundi.");
      recs.push("Proveri da li izlog i ulazni sto privlače pažnju. Promeni postavku ako nema interesa.");
    } else if (gap >= 3) {
      recs.push("Budi aktivnija na prodajnom prostoru, predlaži kombinacije i pitaj o veličini i meri.");
    } else {
      recs.push("Blizu si cilja. Fokus na završetak prodaje kod neodlučnih kupaca.");
    }
  }

  // --- Prosečna vrednost računa ---
  bullets.push(`Prosečna vrednost računa: ${formatRSD(aov)}.`);
  if (aov >= aovTarget) {
    bullets.push(`Cilj prosečne vrednosti računa (${formatRSD(aovTarget)}) je dostignut.`);
  } else if (aov >= historyAvgAov && historyAvgAov > 0) {
    bullets.push(
      `Iznad proseka radnje (${formatRSD(historyAvgAov)}), ispod cilja ${formatRSD(aovTarget)}.`
    );
  } else if (historyAvgAov > 0) {
    bullets.push(
      `Ispod proseka radnje (${formatRSD(historyAvgAov)}) i ispod cilja ${formatRSD(aovTarget)}.`
    );
  }

  // Preporuke za prosečnu vrednost računa
  if (aov < aovTarget && current.buyers > 0) {
    const itemsPerBuyer = current.items_sold / current.buyers;
    if (itemsPerBuyer < 1.5) {
      recs.push("U proseku manje od 1,5 artikala po računu. Predloži dodatni komad (kaiš, majica uz pantalone).");
    }
    recs.push("Predloži sezonski artikal ili akciju pre kase. Povećava prosečnu vrednost računa.");
  }

  // --- Tone ---
  let tone: FeedbackTone = "neutral";
  let headline = "Smena zavrsena.";

  if (conv >= convTarget && aov >= aovTarget) {
    tone = "success";
    headline = "Odlična smena! Oba cilja su dostignuta.";
  } else if (conv >= convTarget || aov >= aovTarget) {
    tone = "success";
    headline = conv >= convTarget ? "Konverzija je na cilju." : "Prosečna vrednost računa je na cilju.";
  } else if (
    (historyAvgConv > 0 && conv < historyAvgConv) ||
    (historyAvgAov > 0 && aov < historyAvgAov)
  ) {
    tone = "warning";
    headline = "Prodaja je danas ispod proseka. Pažnja za sledeću smenu.";
  } else {
    tone = "neutral";
    headline = "Smena je zabeležena. Ima prostora za rast.";
  }

  if (recs.length === 0) {
    recs.push("Održati kontinuitet. Ovo je solidan rezultat.");
  }

  return {
    tone,
    headline,
    bullets,
    recommendations: recs,
    stats: {
      conversion: { value: conv, target: convTarget, delta: convDelta },
      aov: { value: aov, target: aovTarget, delta: aovDelta },
      historyAvgConv,
      historyAvgAov,
    },
  };
}
