# Dušan Stil · Dashboard

Sistem za dnevno praćenje prodaje za 4 radnje (D1 Ž Dušanova, D2 M Dušanova, D4 Ž Delta Planet, D5 M Delta Planet). TIM upisuje smenu preko jednostavne forme, MASTER vidi sve uživo na dashboardu.

## Šta sistem radi

**Za TIM (`/unos`):**
- Biraju radnju i inicijale iz liste (može se izabrati više članica tima po smeni)
- Upisuju: datum, smenu (prva / druga / dvokratna), ulaske, broj računa, promet, broj artikala, opcionu napomenu
- Dobijaju poruku odmah po snimanju: konverzija i prosečna korpa u odnosu na cilj i prosek radnje, sa **preporukama** šta da poprave (npr. „priđi svakom gostu", „predloži upsell")

**Za MASTER (`/admin`):**
- PIN zaštita (iz `ADMIN_PIN` env varijable)
- KPI kartice za danas (promet, konverzija, prosečna korpa, ulasci/broj računa)
- Po-radnja kartice (sve 4 radnje jedna pored druge, uživo)
- 7-dnevni trend sa poređenjem vs prethodnih 7 dana
- Grafikoni: promet 30 dana, konverzija 30 dana sa target linijom, poređenje radnji
- Rang lista tima po prometu
- Tabela poslednjih unosa (live real-time preko Supabase)
- Pojedinačan pregled radnje: `/admin/radnja/D1`, `/admin/radnja/D2`, ...
- Dnevni izveštaj sa pripremljenim zaključkom: `/admin/izvestaj/2026-04-23`
- Podešavanja targeta po radnji ili globalno: `/admin/podesavanja`

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres + real-time subscriptions)
- **Tailwind CSS**
- **Recharts** za grafike
- **Lucide** za ikonice

## Supabase projekat je već postavljen

- URL: `https://dcjtaktiifovhdpruuqm.supabase.co`
- Region: `eu-central-1` (Frankfurt — najbliži Srbiji)
- Tabele: `stores`, `workers`, `shifts`, `settings` + view `daily_store_summary`
- 4 radnje i 18 članica tima već sejovano
- Real-time publikacija uključena za `shifts`
- RLS policy: public insert u `shifts`, public read svega ostalog

## Lokalno pokretanje

```bash
npm install
npm run dev
# otvori http://localhost:3000
```

Env varijable su u `.env.local` (već postavljene).

## Deploy na Vercel

1. **Instaliraj Vercel CLI** (ako nemaš):
   ```bash
   npm i -g vercel
   ```

2. **Uloguj se i deploy:**
   ```bash
   cd dusan-stil-dashboard
   vercel
   ```
   Prati prompt: „link to existing project? No" → „project name? dusan-stil" → „directory? ./".

3. **Environment Variables** (u Vercel dashboardu, Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://dcjtaktiifovhdpruuqm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_K1sv2HjGnhJAQVzBgVLQuQ_J-lg10YL
   ADMIN_PIN=4986
   ```

4. **Production deploy:**
   ```bash
   vercel --prod
   ```

Vercel će ti dati URL tipa `https://dusan-stil.vercel.app`.

## Alternativa: Deploy preko GitHub-a

1. Napravi GitHub repo i push kod
2. Na vercel.com klik **New Project** → import repo
3. Tokom setupa unesi gornje 3 env varijable
4. Deploy

## Dodavanje / uklanjanje članica tima

Idi u Supabase Studio (`https://supabase.com/dashboard/project/dcjtaktiifovhdpruuqm/editor`) → tabela `workers` → dodaj red sa `store_id` (D1/D2/D4/D5) i `initials`. Ubuduće može da se doda UI za to.

## Linkovi

| Ruta | Ko pristupa | Namena |
|---|---|---|
| `/` | Svi | Početna — split screen |
| `/unos` | TIM | Forma za unos smene |
| `/admin` | MASTER (PIN) | Glavni dashboard |
| `/admin/radnja/D1` | MASTER | Pregled D1 |
| `/admin/radnja/D2` | MASTER | Pregled D2 |
| `/admin/radnja/D4` | MASTER | Pregled D4 |
| `/admin/radnja/D5` | MASTER | Pregled D5 |
| `/admin/izvestaj/YYYY-MM-DD` | MASTER | Dnevni izveštaj |
| `/admin/podesavanja` | MASTER | Ciljevi/targeti |

## Struktura radnji

| ID | Radnja | Lokacija | TIM |
|---|---|---|---|
| D1 | Ženska | Dušanova | JS, IJ, FD |
| D2 | Muška | Dušanova | SS, SE, DJM, ZI |
| D4 | Ženska | Delta Planet | AN, MIM, MS, MM, JN |
| D5 | Muška | Delta Planet | IA, VA, MM, NA, MA, ST |

## Default targeti

- Konverzija: **15%**
- Prosečna korpa: **3.000 RSD**

Menjaj iz `/admin/podesavanja`.
