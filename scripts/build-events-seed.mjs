// Build an idempotent SQL seed (+ CSV) of verified national events and live
// local store events, for pasting into the Supabase SQL editor.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=<public anon/publishable key> \
//     node scripts/build-events-seed.mjs [out.sql] [out.csv]
//
// Only a read-only public key is needed (to read `shops` for shop_id matching).
// Never put the service-role key in this repo.
import { writeFileSync } from 'node:fs'
import { makeDedupeKey } from '../api/_lib/events.js'
import { fetchAllLocal, matchShops } from '../api/_lib/local-events.js'
import { NATIONAL_EVENTS, VERIFIED_AT } from '../api/_lib/national-events.js'

const OUT_SQL = process.argv[2] || 'events-seed.sql'
const OUT_CSV = process.argv[3] || 'events-seed.csv'
const OUT_JSON = process.argv[4] || ''
const { SUPABASE_URL = 'https://ihctysckgobjvyztdfsz.supabase.co', SUPABASE_ANON_KEY } = process.env

async function loadShops() {
  if (!SUPABASE_ANON_KEY) { console.warn('No SUPABASE_ANON_KEY: skipping shop matching'); return [] }
  const out = []
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/shops?select=id,name,address,lat,lng&order=id&offset=${off}&limit=1000`, { headers: { apikey: SUPABASE_ANON_KEY } })
    const d = await r.json()
    if (!Array.isArray(d) || !d.length) break
    out.push(...d)
    if (d.length < 1000) break
  }
  return out
}

const today = new Date().toISOString().slice(0, 10)
const national = NATIONAL_EVENTS.filter((e) => (e.end_date || e.date) >= today).map((e) => ({
  ...e,
  location: [e.venue, e.city, e.state].filter((x) => x && x !== 'TBA').join(', '),
  description: `${e.description} Source: ${e.source_url} (checked ${VERIFIED_AT}).`,
  ticket_url: '', image_url: '', source: 'curated', external_id: `curated:${makeDedupeKey(e.title, e.date, e.city)}`,
  is_active: e.confirmed,
}))
const { rows: local, stats } = await fetchAllLocal()
const shops = await loadShops()
const matched = matchShops(local, shops)
for (const r of local) { r.confirmed = true; r.is_active = true }

const byKey = new Map()
for (const r of [...national, ...local]) {
  if (r.date < today) continue
  r.dedupe_key = makeDedupeKey(r.title, r.date, r.city)
  if (!byKey.has(r.dedupe_key)) byKey.set(r.dedupe_key, r)
}
const rows = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const num = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'null' : String(v))
const arr = (a) => `array[${(a || []).map(q).join(',')}]::text[]`
const COLS = ['title', 'date', 'end_date', 'location', 'city', 'state', 'description', 'website', 'ticket_url', 'image_url', 'categories', 'is_national', 'lat', 'lng', 'source', 'external_id', 'dedupe_key', 'shop_id', 'is_active', 'last_seen_at']
const val = (r) => `(${[q(r.title), q(r.date) + '::date', r.end_date ? q(r.end_date) + '::date' : 'null', q(r.location), q(r.city), q(r.state), q(r.description), q(r.website), q(r.ticket_url), q(r.image_url), arr(r.categories), r.is_national ? 'true' : 'false', num(r.lat), num(r.lng), q(r.source), q(r.external_id), q(r.dedupe_key), r.shop_id ? q(r.shop_id) + '::uuid' : 'null', r.is_active ? 'true' : 'false', 'now()'].join(', ')})`

let sql = `-- Outpost events seed. Generated ${new Date().toISOString()} by scripts/build-events-seed.mjs
-- ${rows.length} rows: ${rows.filter((r) => r.source === 'curated').length} curated (national + regional shows), ${rows.filter((r) => r.source !== 'curated').length} local store events.
-- Idempotent: safe to run more than once (upsert on dedupe_key).
-- Rows with is_active=false are UNCONFIRMED (date or venue not on an official site yet).
begin;

-- Columns/indexes this seed relies on (no-ops if migrations/001 already ran).
alter table public.events add column if not exists source text;
alter table public.events add column if not exists external_id text;
alter table public.events add column if not exists dedupe_key text;
alter table public.events add column if not exists ticket_url text;
alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists is_active boolean not null default true;
alter table public.events add column if not exists last_seen_at timestamptz;
create unique index if not exists events_dedupe_key_uidx on public.events (dedupe_key);

-- Query indexes for the Events tab (same as migrations/002_events_query_indexes.sql).
create index if not exists events_active_state_date_idx on public.events (is_active, state, date, id);
create index if not exists events_active_national_date_idx on public.events (is_active, is_national, date);
create index if not exists events_categories_gin_idx on public.events using gin (categories);
create index if not exists events_lat_lng_idx on public.events (lat, lng) where is_active;

-- Hide legacy rows this seed replaces (null dedupe_key duplicates) and known junk
-- pulled in by the old Ticketmaster keywords (comedy, rodeo, etc).
update public.events set is_active = false
 where is_active and (
   (dedupe_key is null and title in ('WonderCon 2027','C2E2 2027','Yu-Gi-Oh! YCS — Orlando','MagicCon: Atlanta 2026 (World Championship)'))
   or title ~* '(comedy|open mic|rodeo|prorodeo|wild card round|drag |burlesque)'
 );

`
const CHUNK = 500
for (let i = 0; i < rows.length; i += CHUNK) {
  sql += `insert into public.events (${COLS.join(', ')}) values\n${rows.slice(i, i + CHUNK).map(val).join(',\n')}\non conflict (dedupe_key) do update set\n  ${COLS.filter((c) => c !== 'dedupe_key').map((c) => `${c} = excluded.${c}`).join(',\n  ')};\n\n`
}
sql += 'commit;\n'
writeFileSync(OUT_SQL, sql)

const csvq = (v) => { const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('|') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const CCOLS = ['date', 'end_date', 'title', 'city', 'state', 'location', 'is_national', 'confirmed', 'source', 'source_url', 'shop_id', 'categories', 'website', 'ticket_url', 'lat', 'lng', 'dedupe_key']
writeFileSync(OUT_CSV, [CCOLS.join(','), ...rows.map((r) => CCOLS.map((c) => csvq(c === 'source_url' ? (r.source_url || r.ticket_url) : r[c])).join(','))].join('\n') + '\n')

if (OUT_JSON) writeFileSync(OUT_JSON, JSON.stringify(rows.filter((r) => r.is_active).map((r) => Object.fromEntries(COLS.map((c) => [c, r[c] ?? null])))))
const loc = rows.filter((r) => r.source !== 'curated')
const summary = {
  total: rows.length,
  national: rows.filter((r) => r.is_national).length,
  nationalConfirmed: rows.filter((r) => r.is_national && r.confirmed).length,
  unconfirmed: rows.filter((r) => !r.confirmed).length,
  local: rows.filter((r) => !r.is_national).length,
  colorado: rows.filter((r) => r.state === 'CO').length,
  bySource: Object.fromEntries([...new Set(rows.map((r) => r.source))].map((s) => [s, rows.filter((r) => r.source === s).length])),
  localLinkedToShops: loc.filter((r) => r.shop_id).length,
  shopsMatchedCalls: matched,
  fetchStats: stats,
}
console.log(JSON.stringify(summary, null, 2))
