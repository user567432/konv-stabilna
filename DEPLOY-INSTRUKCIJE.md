# Dušan Stil Dashboard — Deploy uputstvo

Generisano: 2026-04-27. Pretpostavlja se: Windows + PowerShell, Node.js 18+ instaliran, Vercel nalog postoji, `vercel login` već urađen.

---

## Korak 1 — Primeni SQL migraciju na Supabase

1. Otvori [supabase.com/dashboard](https://supabase.com/dashboard) → projekat `jdbmmlphyoqyzzvsbrjk`
2. Levo meni → **SQL Editor** → **New query**
3. Otvori fajl `supabase/MIGRATION_BUNDLE.sql` (u root-u projekta), kopiraj CEO sadržaj
4. Nalepi u SQL Editor i klikni **Run** (Ctrl+Enter)
5. Sačekaj ~5–10 sekundi. Treba da vidiš `Success. No rows returned`
6. Verifikuj: levo meni → **Table Editor** — treba da postoje tabele: `stores` (4 reda), `workers` (18 redova), `shifts`, `settings`, `weekly_goals`, `shift_edit_log`, `auth_config`, `pin_change_requests`, `calendar_events` (8 redova), `weather_daily`

> Napomena: u bundle-u je preskočena migracija 004 jer je 005 njen superset. Ako vidiš grešku tipa „relation already exists", baza je već imala pokušaj ranijeg deploy-a — javi mi pa ću pripremiti reset script.

---

## Korak 2 — Lokalna verifikacija build-a

Otvori PowerShell, idi u folder projekta:

```powershell
cd D:\dusan-stil-handoff\dusan-stil-dashboard
npm install
npm run build
```

`npm install` traje ~2–5 minuta prvi put. `npm run build` mora proći bez TypeScript grešaka. Ako vidiš `Compiled successfully`, sve OK.

---

## Korak 3 — Linkuj projekat sa Vercel-om

```powershell
cd D:\dusan-stil-handoff\dusan-stil-dashboard
vercel link
```

Interaktivni prompt:
- **Set up "dusan-stil-dashboard"?** → `Y`
- **Which scope?** → izaberi svoj nalog (`jovanjocic05` ili tim ako ga koristiš)
- **Link to existing project?** → `N` (kreira nov)
- **Project name?** → `dusan-stil-dashboard` (ili po izboru)
- **Directory?** → `./` (default)
- Odbij prompt za auto-detect framework override (Vercel sam detektuje Next.js)

Nakon ovoga imaš `.vercel/` folder sa project ID-om — to više ne dirati.

---

## Korak 4 — Postavi production env-vars na Vercel

Pokreni svaku komandu zasebno u PowerShell-u (kopiraj-zalepi blokove). Vercel će na svaku reći **„production"** je environment.

```powershell
# --- Supabase ---
"https://jdbmmlphyoqyzzvsbrjk.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYm1tbHBoeW9xeXp6dnNicmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTU3NjksImV4cCI6MjA5Mjg3MTc2OX0.d--ty0rPTqiHHrwSBc4IOdG4dZMDbVsHmsb_iHMzSGM" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# --- PIN-ovi ---
"4986" | vercel env add ADMIN_PIN production
"1205" | vercel env add TIM_PIN_D1 production
"7501" | vercel env add TIM_PIN_D2 production
"4332" | vercel env add TIM_PIN_D4 production
"1172" | vercel env add TIM_PIN_D5 production

# --- Resend / email ---
"re_cLdUfeVv_GuFZybzV46jrYdECmgKUZgXk" | vercel env add RESEND_API_KEY production
"jovanjocic05@gmail.com" | vercel env add NOTIFY_EMAIL production
"Dušan Stil <onboarding@resend.dev>" | vercel env add FROM_EMAIL production
```

Ako PowerShell pita „Which environments?" interaktivno, izaberi samo **Production** (može i Preview/Development, neće smetati).

Verifikuj sve postavljene varijable:
```powershell
vercel env ls
```

Treba da vidiš listu od 10 varijabli sa vrednošću `Encrypted` u Production environment-u.

---

## Korak 5 — Deploy na produkciju

```powershell
vercel --prod
```

Build traje ~60–90 sekundi. Na kraju ćeš dobiti URL tipa:
```
https://dusan-stil-dashboard-xxx.vercel.app
```

Sačuvaj taj URL — to ti je production endpoint. Možeš ga skratiti tako što u Vercel Dashboard → projekat → Settings → Domains → Add → uneseš `dusan-stil-dashboard.vercel.app` (ako je slobodan).

---

## Korak 6 — Smoke test (5 minuta)

Otvori produkcioni URL u browseru i prođi kroz:

1. **Homepage** (`/`) — treba da vidi početni ekran sa logom DS i opcijama TIM/MASTER.

2. **TIM unos** (`/unos`) — klikni TIM, unesi PIN `1205`. Treba da otvori formu za unos smene radnje D1.
   - Ako PIN ne radi: provera baze — `auth_config` mora imati red sa `id=1`.

3. **MASTER dashboard** (`/admin`) — klikni MASTER, unesi PIN `4986`. Treba da prikaže dashboard sa 4 kartice (D1, D2, D4, D5).

4. **Tim rang** (`/tim-rang`) — bez PIN-a, javna stranica. Treba da prikaže rang listu radnica.

5. **API test (PowerShell)**:
   ```powershell
   $url = "https://TVOJ-URL.vercel.app"
   # TIM login
   Invoke-WebRequest -Uri "$url/api/tim-login" -Method POST -ContentType "application/json" -Body '{"pin":"1205","store_id":"D1"}'
   # Treba da vrati: 200 OK, sa Set-Cookie zaglavljem
   ```

6. **Email test (Resend)** — idi na `/admin/podesavanja` (uloguj se kao MASTER → Promena šifara → MASTER PIN → unesi novu šifru → klikni „Pošalji kod". Resend treba da pošalje 6-cifreni kod na `jovanjocic05@gmail.com`.
   - Ako email ne stigne: proveri Resend dashboard → **Logs** za grešku. Najčešći problem: nemaš verifikovan domen pa Resend dozvoljava slanje samo na email koji je registrovan za nalog.

7. **Weather cache** (opciono — Vercel cron radi automatski u 04:00 svako jutro):
   ```powershell
   Invoke-WebRequest -Uri "https://TVOJ-URL.vercel.app/api/weather/refresh" -Method POST
   ```
   Posle ovoga, `/admin/izvestaj/2026-04-27` treba da prikaže vremenske podatke.

---

## Default PIN-ovi — ODMAH PROMENI POSLE PRVOG DEPLOY-A

| Šta | PIN | Promena |
|-----|-----|---------|
| MASTER | `4986` | `/admin/podesavanja` → Promena šifara → MASTER |
| TIM D1 (Ž Dušanova) | `1205` | `/admin/podesavanja` → Promena šifara → TIM D1 |
| TIM D2 (M Dušanova) | `7501` | isto, TIM D2 |
| TIM D4 (Ž Delta Planet) | `4332` | isto, TIM D4 |
| TIM D5 (M Delta Planet) | `1172` | isto, TIM D5 |

Posle promene, novi PIN-ovi su sačuvani u Supabase `auth_config` tabeli, ne u `.env.local` (env varijable služe samo kao fallback).

---

## Buduće izmene — kratak workflow

```powershell
cd D:\dusan-stil-handoff\dusan-stil-dashboard
# (Cowork agent ti je već menjao fajlove preko mount-a)
npm run build           # lokalni sanity test
vercel --prod           # deploy
```

URL ostaje isti jer je `.vercel/` folder već linkovan.

---

## Rollback ako nešto pukne

```powershell
vercel rollback         # vraća na prethodni deploy
vercel ls               # listaj sve deploy-eve da nađeš stariji
```

Ili u Vercel Dashboard → **Deployments** → izaberi raniji → **Promote to Production**.
