# PakFinance — backup and restore runbook

What to do when the database is lost, corrupted, or something is deleted that
should not have been. Written to be followed under stress, so it says what to
type, not what to consider.

**An untested backup is a rumour.** Section 5 is the rehearsal, and it is the
part people skip. Do it once now, and once after any schema change.

---

## 1. What actually matters

Not everything here is equally precious. Ranked by what it costs to lose:

| Data | Recoverable? | How |
|---|---|---|
| `auth.users` — passwords, identities | **No** | Only from a Supabase backup or `pg_dump`. Losing this locks every user out permanently, even with all their financial rows intact. |
| `public.*` — accounts, transactions, loans, goals, trades, fund orders, assets, committees, Zakat | **No** | Typed in by hand. Gone is gone. |
| `public.net_worth_daily` | **No** | One row per user per day. Cannot be reconstructed: bank balances and NAVs are only knowable on the day they were true. |
| `market.prices_daily` — 5 years of closes | Slowly | `npm run backfill` refetches from the PSX EOD feed. Takes ~20 minutes and only works while PSX still serves that history. |
| `market.securities`, `funds`, `fund_navs`, `price_latest` | Yes | Next `npm run sync:psx` / `sync:nav` rebuilds them. |
| `market.sectors`, `corporate_actions` | From your CSVs | `npm run seed:sectors`, `npm run seed:actions`. Keep those CSVs somewhere that is itself backed up. |
| Storage — avatar images | No, but cosmetic | Users re-upload. |

The two rows that matter most are the two nobody thinks about: **auth.users**
and **net_worth_daily**.

---

## 2. Taking a backup

### Preferred — `pg_dump` (complete)

Captures everything, `auth` schema included. This is the one that can actually
restore the whole project.

```bash
pg_dump "$DATABASE_URL" --format=custom --file=pakfinance-$(date +%F).dump
```

Use `DATABASE_URL` (session pooler, port 5432), not `DATABASE_POOL_URL` — the
transaction pooler does not support the statements `pg_dump` issues.

If `pg_dump` is missing: it ships with the PostgreSQL client tools. On Windows,
install "PostgreSQL" and add its `bin` to PATH, or use the version bundled with
Docker: `docker run --rm postgres:16 pg_dump "$DATABASE_URL" > out.dump`.

### Fallback — the built-in script (user data only)

Needs nothing but the URL already in `.env.local`:

```bash
npm run backup
```

Writes `backups/<timestamp>/` — one JSON file per table, plus a manifest. Last
verified run: **427,516 rows across 27 tables, 45 MB**.

**It does NOT include `auth.users`.** A restore from this alone gives you every
financial record with no one able to log in. Treat it as a supplement to
`pg_dump`, never a replacement.

### Supabase's own backups

Free tier: daily backups, retained ~7 days, restorable only by Supabase support.
Pro adds point-in-time recovery. Check which tier this project is on before
assuming either exists — on free tier, **you are the backup**.

---

## 3. Verifying a backup

```bash
npm run backup -- --verify backups/2026-08-16T08-13-00
```

Checks every file parses and the row counts match the manifest. Run it every
time; it takes seconds.

For a `pg_dump` archive:

```bash
pg_restore --list pakfinance-2026-08-16.dump | head -40
```

If that prints a table of contents, the archive is readable.

---

## 4. Restoring

### 4a. The whole project is gone

1. Create a new Supabase project. Note the new URL and keys.
2. Restore the dump:
   ```bash
   pg_restore --dbname "$NEW_DATABASE_URL" --clean --if-exists pakfinance-2026-08-16.dump
   ```
3. Update `.env.local` and every GitHub secret with the new URL, anon key and
   service-role key.
4. Re-create the storage bucket — migration `0006` does it:
   ```bash
   npm run db:migrate
   ```
5. Confirm the boundary still holds before letting anyone in:
   ```bash
   npm run audit:security
   npm run test:rls
   ```
6. Re-seed anything derived: `npm run sync:psx`, `npm run seed:sectors -- --file sectors.csv`.

### 4b. One table was wiped, the rest is fine

Restore a single table from a dump without touching anything else:

```bash
pg_restore --dbname "$DATABASE_URL" --data-only --table=transactions pakfinance-2026-08-16.dump
```

### 4c. One user deleted their account by mistake

There is no undo — the delete cascades from `auth.users` through every table by
design. Recovery means extracting that user's rows from a dump and re-inserting
them under a **new** auth user, then repointing `user_id`. Their old id is gone.

Point them at Settings → Your data → Export first, next time. That is what it is
for.

### 4d. A migration went wrong

Migrations are forward-only; there are no down scripts. Restore from the most
recent dump taken **before** the migration, then fix the SQL and re-run. This is
the reason to take a dump before every `db:migrate` against real data.

---

## 5. The rehearsal — do this before trusting any of the above

Restoring for the first time during an outage is how backups are discovered to
be broken.

1. Take a dump (section 2).
2. Create a scratch Supabase project, or a local Postgres:
   ```bash
   docker run --rm -e POSTGRES_PASSWORD=x -p 5433:5432 postgres:16
   ```
3. Restore into it (section 4a, step 2).
4. Point a local `.env.local` at it and run:
   ```bash
   npm run audit:security
   npm test
   npm run dev
   ```
5. Sign in. Check the dashboard shows the right net worth.
6. Delete the scratch project.

Write the date you last did this here: **rehearsal not yet performed.**

---

## 6. Routine

| When | Do |
|---|---|
| Before any `db:migrate` on real data | `pg_dump` |
| Weekly | `npm run backup` and verify |
| Monthly | Full rehearsal (section 5) |
| Before deploying | `npm run audit:security` and `npm run test:rls` |

Keep at least one copy **off** the machine that has the database credentials.
A backup sitting beside the thing it protects is not a backup.

---

## 7. Related checks

| Command | Answers |
|---|---|
| `npm run audit:security` | Is every table still locked down? |
| `npm run test:rls` | Can one user reach another's data? |
| `npm run schedule:report` | Are the scheduled jobs actually firing? |
| `npm run verify:ratelimit` | Does the login throttle still work? |
| `npm run maintenance -- --dry-run` | What is stale or failing? |
