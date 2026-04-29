import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Stari put /admin/podesavanja je preimenovan u /master/podesavanja.
 * Ovaj fajl ostaje kao redirect za bookmark-ove i postojece linkove.
 */
export default function LegacyPodesavanjaPage() {
  redirect("/master/podesavanja");
}
