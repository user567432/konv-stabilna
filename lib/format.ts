// Serbian locale formatting helpers

export function formatRSD(amount: number): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDecimal(n: number, digits: number = 2): string {
  return n.toFixed(digits).replace(".", ",");
}

export function formatPct(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

export function formatDateSr(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export const SHIFT_LABELS: Record<string, string> = {
  prva: "1. smena",
  druga: "2. smena",
  dvokratna: "Dvokratna",
};

export const STORE_LABELS_SHORT: Record<string, string> = {
  D1: "D1 Ž Dušanova",
  D2: "D2 M Dušanova",
  D4: "D4 Ž Delta Planet",
  D5: "D5 M Delta Planet",
};
