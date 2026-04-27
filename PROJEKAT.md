# Dušan Stil Dashboard — Tehnička dokumentacija

Sveobuhvatan vodič kroz arhitekturu, stack, tok rada i operativne procedure. Namenjen vlasniku (MASTER) i bilo kom budućem AI agentu koji nastavi rad na projektu.

---

## 1. Šta ovaj projekat radi

Web aplikacija za dnevno praćenje prodaje u 4 fizičke radnje Dušan Stil brenda. Dve uloge:

- **TIM** — radnice u radnji. Unose smenu: ulasci, broj računa, promet, artikli. Dobijaju trenutnu konverziju i preporuke.
- **MASTER** — vlasnik. Vidi sve 4 radnje uživo, grafike trenda, analitiku, istorijske izmene, rang radnica, dnevne izveštaje, i upravlja ciljevima/šiframa.

4 radnje: **D1** (Ženska Dušanova), **D2** (Muška Dušanova), **D4** (Ženska Delta Planet), **D5** (Muška Delta Planet).

---

## 2. Javni URL i pristup

- **Produkcija**: `https://dusan-stil-dashboard.vercel.app`
- **MASTER PIN (default)**: 4986 — menja se iz `/admin/podesavanja` sa email potvrdom
- **TIM PIN (default)**: 1205 — takođe menja MASTER uz email potvrdu
- **Email za potvrdu**: `dusan@dusanstil.rs`
- **Tim rang** (`/tim-rang`) — dostupno svima, bez PIN-a

---

## 3. Stack (šta je tehnički pod haubom)

| Sloj | Tehnologija | Zašto |
|------|-------------|-------|
| Frontend framework | **Next.js 14** (App Router) | Server Components, real-time refresh, SEO out-of-the-box |
| Jezik | **TypeScript** | Tipska sigurnost u celom code-base-u |
| UI | **Tailwind CSS** + **lucide-react** ikone | Brza iteracija, mali bundle |
| Grafici | **Recharts** | Bar/line chart-ovi za trend i upoređivanje |
| Baza podataka | **Supabase (PostgreSQL)** + Row Level Security | Hostovana Postgres sa real-time kanalima |
| Real-time | **Supabase Realtime** | Dashboard se automatski osvežava kad TIM upiše smenu |
| Auth | **HttpOnly cookie + PIN u bazi** (tabela `auth_config`) | Bez OAuth-a, jednostavno i dovoljno za 4 radnje |
| Email | **Resend** (REST API) | Za kod potvrde kod promene šifara |
| Hosting | **Vercel** | Automatski deploy, bez server-a za održavanje |

---

## 4. Struktura koda

```
project/
├─ app/                       # Next.js App Router — svaka folder = ruta
│  ├─ page.tsx               # Homepage (/)
│  ├─ layout.tsx             # Root layout, font, metadata
│  ├─ icon.png               # Favicon (Next.js auto-detect)
│  ├─ unos/
│  │  ├─ page.tsx           # /unos — TIM ulaz, sa PIN kapijom
│  │  ├─ ShiftForm.tsx      # Forma za unos smene
│  │  └─ TimGate.tsx        # PIN ekran za TIM
│  ├─ tim-rang/page.tsx     # /tim-rang — javna rang lista radnica
│  ├─ admin/
│  │  ├─ page.tsx           # /admin — glavni dashboard
│  │  ├─ AdminGate.tsx      # PIN ekran za MASTER
│  │  ├─ DashboardClient.tsx # Header + realtime logika (client)
│  │  ├─ analitika/         # /admin/analitika
│  │  ├─ istorija/          # /admin/istorija (edit log)
│  │  ├─ izvestaj/[datum]/  # /admin/izvestaj/YYYY-MM-DD
│  │  ├─ podesavanja/       # /admin/podesavanja (ciljevi, PIN-ovi)
│  │  └─ radnja/[id]/       # /admin/radnja/D1
│  └─ api/                  # REST endpointi
│     ├─ admin-login/       # POST/DELETE za MASTER cookie
│     ├─ tim-login/         # POST/DELETE za TIM cookie
│     ├─ auth-change/       # Promena PIN-ova sa email potvrdom
│     ├─ shift/             # Unos/brisanje smene
│     ├─ shifts/[id]/       # Edit/delete jedne smene
│     ├─ shifts/reset-day/  # Brisanje celog dana (MASTER)
│     ├─ settings/          # Ciljevi
│     ├─ weekly-goals/      # Nedeljni ciljevi
│     ├─ worker-progress/   # Progres radnica
│     ├─ range/             # Filter opsega datuma
│     ├─ baseline/          # Referentni brojevi (prethodnih 7 dana)
│     └─ shift-edit-log/    # Istorija izmena
├─ components/              # Deljivi React komponenti
│  ├─ KpiCard.tsx, StoreCards.tsx, RevenueChart.tsx, ...
│  ├─ TeamRankingCard.tsx   # Top 3 po radnji (za admin dashboard)
│  ├─ ResetDayButton.tsx    # Brisanje celog dana sa confirm modal-om
│  └─ ShiftEditModal.tsx, ConfirmShiftModal.tsx
├─ lib/                     # Server-side helper-i
│  ├─ auth.ts               # getAuthConfig(), isMasterAuthed(), isTimAuthed()
│  ├─ admin-auth.ts         # legacy shim za isAdminAuthed
│  ├─ supabase.ts           # browser/server/admin Supabase klijenti
│  ├─ dashboard-data.ts     # loadDashboard() — agregacija za /admin
│  ├─ worker-stats.ts       # Pro-rata atribucija + pair matrix
│  ├─ weekly-goals.ts       # Raspoređivanje mesečnog cilja po nedeljama
│  ├─ anomaly.ts            # 200%+ anomaly detekcija
│  ├─ date-ranges.ts        # Preset raspona (7d, 14d, 30d, 90d)
│  ├─ feedback.ts           # Auto-preporuke iz smene
│  ├─ format.ts             # formatRSD, formatPct, STORE_LABELS_SHORT
│  ├─ email.ts              # Resend helper + HTML template
│  └─ types.ts              # Shift, Worker, Store, Settings TS types
├─ public/
│  ├─ logo.svg              # Glavni logo (SVG)
│  ├─ logo.png, apple-icon.png
├─ supabase/migrations/
│  ├─ 001_init_schema.sql   # Stores, workers, shifts, settings + RLS
│  ├─ 002_seed_data.sql     # Inicijalni podaci (4 radnje, radnice)
│  ├─ 003_weekly_goals_anomaly_edit_log.sql
│  └─ 004_auth_config.sql   # auth_config + pin_change_requests
├─ package.json
├─ tailwind.config.ts, postcss.config.js
├─ next.config.mjs, tsconfig.json
├─ vercel.json              # Vercel konfiguracija
└─ PROJEKAT.md              # Ovaj fajl
```

---

## 5. Database šema (Supabase / Postgres)

Glavne tabele:

- **stores** — `id` (D1/D2/D4/D5), `name`. Statično, 4 reda.
- **workers** — `id`, `initials` (IJ/MIM/...), `store_id`, `active`.
- **shifts** — centralna tabela. `id`, `store_id`, `shift_date`, `shift_type` (prepodne/popodne/cela), `worker_ids uuid[]` (sve radnice u smeni), `worker_id` (legacy single), `entries`, `buyers`, `revenue`, `items_sold`, `conversion_pct` (generated), `aov` (generated), `note`.
- **settings** — globalni i po-radnji ciljevi (`conversion_target`, `aov_target`, `monthly_goal`).
- **weekly_goals** — auto raspored mesečnog cilja po nedeljama, sa manual override-om.
- **shift_edits_log** — istorija izmena smena.
- **auth_config** — jedinstveni red (id=1) sa `master_pin`, `tim_pin`, `notify_email`. RLS zaključan za anon.
- **pin_change_requests** — pending promene PIN-a sa 6-cifrenim kodom, TTL 15 min.

---

## 6. Environment varijable (Vercel)

Postavlja se u Vercel Dashboard → projekat → Settings → Environment Variables. Sve aktivne u Production.

| Naziv | Vrednost | Zašto |
|-------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc.supabase.co` | Public, može u browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public, anon klijent (poštuje RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Tajna!** Samo server. Zaobilazi RLS za admin operacije |
| `ADMIN_PIN` | `4986` | Fallback ako baza ne odgovara (inicijalni PIN) |
| `TIM_PIN` | `1205` | Fallback za TIM |
| `NOTIFY_EMAIL` | `dusan@dusanstil.rs` | Fallback notify adresa |
| `RESEND_API_KEY` | `re_*` | Za email potvrde |
| `FROM_EMAIL` | `Dušan Stil <onboarding@resend.dev>` | Kad verifikuješ domen → promeni u `noreply@dusanstil.rs` |

Važno — `SUPABASE_SERVICE_ROLE_KEY` uzima se iz Supabase Dashboard → Settings → API → `service_role` (tajni ključ). Bez njega, reset dana i promena šifara NE RADE.

---

## 7. Kako deploy-ujem (tok rada od promene do produkcije)

1. **AI agent menja fajlove** direktno u Cowork mount folderu (`~/Desktop/dusan-stil/project/`) — bez git push-a
2. **Ja (korisnik) otvaram Terminal** u tom folderu:
   ```bash
   cd ~/Desktop/dusan-stil/project
   npm run build   # lokalni test: proverava TypeScript i production bundle
   vercel --prod   # pushuje na Vercel, dobijam URL za ~90 sekundi
   ```
3. **Vercel produkcija** — URL ostaje isti (`dusan-stil-dashboard.vercel.app`) jer je `.vercel/` folder već linkovan sa Vercel projektom iz prvog deploy-a.

**Zašto AI agent ne može sam da deploy-uje**: Cowork sandbox je sigurnosno izolovan. Može da menja fajlove preko mount-a, ali ne može da pokreće `npm install` (registry blocked), `vercel` CLI, ni `rm` komande van svog outputs foldera.

---

## 8. GitHub status — da li je projekat tamo?

**Nije**, i to je namerno odabrano — evo razloga i kompromisa:

**Argumenti ZA GitHub**:
- Besplatno backup-ovanje koda
- Istorija izmena (git log)
- Moguća buduća saradnja sa programerima
- CI/CD integracija (npr. automatski deploy na svaki commit)

**Argumenti PROTIV GitHub-a (naš trenutni kontekst)**:
- Jedini developer je AI agent kroz Cowork
- Deploy je već instant preko `vercel --prod`, ne treba CI/CD
- Nema potrebe za branch-evima ili code review-om
- Dodatni setup korak za vlasnika (SSH ključevi, `git push`)

**Preporučujem da se projekat ipak stavi na privatni GitHub repo** kao backup. Deset minuta posla:

```bash
cd ~/Desktop/dusan-stil/project
git init
git add .
git commit -m "Initial commit"
gh repo create dusan-stil-dashboard --private --source=. --push
```

Zatim možeš povezati Vercel projekat sa GitHub repo-om preko Vercel Dashboard-a — od tada svaki `git push` auto-deploy-uje. Ali sve radi i bez toga.

---

## 9. Tok rada sa AI agentom (tehnički)

### Alati koji su korišteni

- **Cowork mode** (Anthropic desktop aplikacija) — AI agent koji ima pristup fajl sistemu tvog Mac-a preko mount-ovanog foldera
- **Claude Opus 4.7 (1M context)** — model koji pokreće agenta
- **Mount folder**: `~/Desktop/dusan-stil/` — AI čita i menja fajlove direktno, ti vidiš u Finder-u
- **Terminal** — ti pokrećeš `npm run build` i `vercel --prod` kada je kod spreman
- **MCPs** (Model Context Protocol): Supabase MCP (ima pristup tvojoj Supabase bazi), Vercel MCP, Gmail, Notion, Calendar, Slack, Chrome — zavisno šta je potrebno

### Ciklus rada za svaki task

1. Ti opisuješ šta hoćeš (u običnom tekstu, srpski ili engleski)
2. AI agent pročita relevantne fajlove preko **Read** tool-a
3. Pita ti pitanja ako nešto nije jasno (preko AskUserQuestion tool-a)
4. Menja fajlove preko **Edit** / **Write** tool-a
5. Za bazu: piše SQL migraciju u `supabase/migrations/` i pokreće preko Supabase MCP-a
6. Prosleđuje ti komande za build + deploy u Terminal
7. Posle deploy-a ti verifikuješ u browseru, šalješ screenshot ako nešto ne radi

### Gde su fajlovi

- **Session sandbox (privremeno)**: `/sessions/<id>/mnt/...` — za testiranje, resetuje se između sesija
- **Mount (persistent, tvoj Mac)**: `/sessions/<id>/mnt/dusan-stil/project/` → `~/Desktop/dusan-stil/project/` na Mac-u
- **Production**: Vercel Edge Network — statičke stranice + server funkcije

---

## 10. Kako nastaviti razgovor u novoj sesiji

Ako otvoriš novi Cowork razgovor i hoćeš da agent nastavi gde smo stali, paste-uj ovo:

```
Nastavljamo rad na Dušan Stil Dashboard projektu.

- Mount folder: ~/Desktop/dusan-stil/project/
- Produkcija: https://dusan-stil-dashboard.vercel.app
- Stack: Next.js 14 + Supabase + Tailwind + Vercel
- Sveobuhvatno uputstvo je u project/PROJEKAT.md — pročitaj prvo njega.
- Za deploy: ja pokrećem `npm run build` pa `vercel --prod` iz Terminala.

Moj sledeći zahtev: [opiši šta hoćeš]
```

Agent će onda pročitati `PROJEKAT.md`, sagledati strukturu, i nastaviti u istoj konvenciji.

---

## 11. Česte operacije — cheat sheet

**Provera šta je u produkciji**:
```bash
vercel ls    # listaj sve deploy-eve
vercel logs  # runtime logovi poslednjeg deploy-a
```

**Rollback ako nešto krene po zlu**:
```bash
vercel rollback   # vraća na prethodni deploy
```

Ili u Vercel Dashboard → Deployments → pronađi stariji → Promote to Production.

**Direktna SQL na Supabase**:
```bash
# Supabase Dashboard → SQL Editor → paste query → Run
# Npr. pregled današnjih smena:
SELECT * FROM shifts WHERE shift_date = CURRENT_DATE ORDER BY store_id, shift_type;
```

**Zaboravljena MASTER šifra** (worst case):
```sql
-- Supabase SQL Editor:
UPDATE auth_config SET master_pin = '4986' WHERE id = 1;
```

**Proveri email da li radi** (sa Mac terminala):
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_TVOJ_KLJUC" \
  -H "Content-Type: application/json" \
  -d '{"from":"onboarding@resend.dev","to":["dusan@dusanstil.rs"],"subject":"test","text":"radi"}'
```

---

## 12. Sigurnost — šta je zaštićeno a šta nije

**Zaštićeno**:
- PIN-ovi su u bazi (tabela `auth_config`) sa Row Level Security — anon ključ ne može da ih čita
- Cookies su `httpOnly` i `sameSite: lax` — JS ne može da ih pročita
- Reset dana, promena PIN-a idu preko `service_role` ključa na serveru
- Email potvrda potrebna za svaku promenu šifre
- `SUPABASE_SERVICE_ROLE_KEY` je tajan (samo Vercel i AI agent tokom razvoja)

**NIJE zaštićeno** (kompromisi za jednostavnost):
- Podaci o smenama su čitljivi anonimno (`public_read_shifts` policy) — treba ti URL za Supabase da ih pročitaš
- Insert smena je dozvoljen anon — svako ko dođe do public URL-a može da unese smenu (ali mora preko TIM PIN-a u UI)
- Nema rate-limiting-a na login endpoint-ima — otporno na brute-force 4-cifrenog PIN-a je 10000 pokušaja što je skriptabilno, ali za naš use-case prihvatljivo

**Kad uradiš otkaz menadžeru**:
1. Uloguj se kao MASTER
2. Idi u Podešavanja → Promena šifara
3. Promeni MASTER i TIM PIN (dva odvojena emaila)
4. Raniji cookie iz njegovog browser-a **automatski prestaje da radi** — keš se invalidira, novi PIN ne poklapa star cookie
5. Javiš novi TIM PIN aktivnim radnicama

---

## 13. Šta se promenilo u v2 (april 2026)

- Dodata ruta `/tim-rang` — transparentna rang lista radnica sa Nivo-1 pro-rata atribucijom i pair matrix analizom
- Dnevni izveštaj sada prikazuje kombinacije radnica i 30-dnevni prosek konverzije tih kombinacija
- TeamRankingCard widget ubačen u admin dashboard
- Header linkovi „Tim rang" na svim glavnim ekranima
- **Dodato u v2.1** (ovaj deploy):
  - Logo (DS monogram) svuda umesto teksta „DS"
  - Reset dana dugme za MASTER-a sa padajućim menijem (sve radnje ili po radnji)
  - TIM PIN zaštita na `/unos` (default 1205)
  - Promena MASTER/TIM šifara iz Podešavanja sa email potvrdom (Resend)
  - Migracija 004 — `auth_config` i `pin_change_requests` tabele
  - Security patch Next.js 14.2.15 → 14.2.35
