import { createClient } from '@supabase/supabase-js'
import {
  normalizeSerpApiEvent,
  normalizeTicketmasterEvent,
  dedupeEvents,
  makeDedupeKey,
  METROS,
  SERP_QUERIES,
  TM_KEYWORDS,
} from './_lib/events.js'
import { fetchAllLocal, isRelevantEvent, matchShops } from './_lib/local-events.js'
import { NATIONAL_EVENTS } from './_lib/national-events.js'

// Local sources make many requests; give the function room (Vercel caps by plan).
export const config = { maxDuration: 300 }

// ---------------------------------------------------------------------------
// /api/refresh-events  —  triggered by Vercel Cron (see vercel.json) or manually.
// Pulls collectibles events from SerpApi (Google Events) + Ticketmaster Discovery,
// geocodes anything missing coordinates, dedupes, upserts into `events`, and
// soft-expires anything in the past. All secrets come from env vars.
// ---------------------------------------------------------------------------

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  SERPAPI_KEY,
  TICKETMASTER_KEY,
  GOOGLE_GEOCODE_KEY: GEOCODE_KEY_ENV,
  GOOGLE_API_KEY,
  CRON_SECRET,
} = process.env
// Prefer a dedicated geocoding key; fall back to the general Google key.
const GOOGLE_GEOCODE_KEY = GEOCODE_KEY_ENV || GOOGLE_API_KEY

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJSON(url, label) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[${label}] HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.warn(`[${label}] ${e.message}`)
    return null
  }
}

// --- SerpApi: Google Events box, per query x metro --------------------------
async function fetchSerpApi(ref) {
  if (!SERPAPI_KEY) return []
  const out = []
  for (const metro of METROS) {
    for (const q of SERP_QUERIES) {
      const url = `https://serpapi.com/search.json?engine=google_events&q=${encodeURIComponent(`${q} ${metro.name}`)}&hl=en&gl=us&api_key=${SERPAPI_KEY}`
      const data = await fetchJSON(url, `serpapi:${metro.name}:${q}`)
      for (const ev of data?.events_results || []) {
        const n = normalizeSerpApiEvent(ev, ref)
        if (n) out.push(n)
      }
      await sleep(250) // be polite to the API
    }
  }
  return out
}

// --- Ticketmaster Discovery: keyword x metro --------------------------------
async function fetchTicketmaster() {
  if (!TICKETMASTER_KEY) return []
  const out = []
  for (const metro of METROS) {
    for (const kw of TM_KEYWORDS) {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_KEY}&keyword=${encodeURIComponent(kw)}&latlong=${metro.latlong}&radius=75&unit=miles&size=50&sort=date,asc`
      const data = await fetchJSON(url, `tm:${metro.name}:${kw}`)
      for (const ev of data?._embedded?.events || []) {
        const n = normalizeTicketmasterEvent(ev)
        if (n) out.push(n)
      }
      await sleep(250)
    }
  }
  return out
}

// --- Geocode rows missing coordinates (Google Geocoding API) -----------------
async function geocodeMissing(rows) {
  if (!GOOGLE_GEOCODE_KEY) return rows
  const cache = new Map()
  let calls = 0
  for (const r of rows) {
    if (r.lat != null && r.lng != null) continue
    const addr = r.location || `${r.city}, ${r.state}`
    if (!addr.trim()) continue
    if (cache.has(addr)) {
      Object.assign(r, cache.get(addr))
      continue
    }
    if (calls >= 200) break // hard ceiling per run to control cost
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_GEOCODE_KEY}`
    const data = await fetchJSON(url, 'geocode')
    calls++
    const loc = data?.results?.[0]?.geometry?.location
    if (loc) {
      const coords = { lat: loc.lat, lng: loc.lng }
      cache.set(addr, coords)
      Object.assign(r, coords)
    }
    await sleep(60)
  }
  return rows
}

function isAuthorized(req) {
  if (!CRON_SECRET) return true // no secret configured -> allow (set one in prod!)
  const auth = req.headers?.authorization || ''
  if (auth === `Bearer ${CRON_SECRET}`) return true // Vercel Cron sends this
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get('secret') === CRON_SECRET
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'missing Supabase env vars' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const ref = new Date()
  const todayISO = ref.toISOString().slice(0, 10)
  const started = Date.now()

  // 1. Gather from all live sources
  const [serp, tm, local] = await Promise.all([fetchSerpApi(ref), fetchTicketmaster(), fetchAllLocal()])
  const national = NATIONAL_EVENTS.filter((e) => e.confirmed).map((e) => ({
    ...e,
    location: [e.venue, e.city, e.state].filter(Boolean).join(', '),
    ticket_url: '',
    image_url: '',
    source: 'curated',
    external_id: e.source_url,
    description: `${e.description} Source: ${e.source_url}`,
  }))
  const raw = [...national, ...serp, ...tm, ...local.rows].filter(isRelevantEvent)

  // 2. Collapse duplicates (cross-source), preferring rows with coordinates
  const deduped = dedupeEvents(raw)

  // 2b. Link store events to Outpost shops (shop_id) by name + address/proximity
  let shopsMatched = 0
  {
    const shops = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('shops').select('id,name,address,lat,lng').range(from, from + 999)
      if (error || !data?.length) break
      shops.push(...data)
      if (data.length < 1000) break
    }
    shopsMatched = matchShops(deduped, shops)
  }

  // 3. Geocode anything still missing coordinates
  await geocodeMissing(deduped)

  // 4. Upsert. dedupe_key is the conflict target (unique). Keep only future events.
  const nowSeen = new Date().toISOString()
  const upserts = deduped
    .filter((r) => r.date >= todayISO)
    .map((r) => ({
      title: r.title,
      date: r.date,
      location: r.location,
      city: r.city,
      state: r.state,
      description: r.description,
      website: r.website,
      ticket_url: r.ticket_url || '',
      image_url: r.image_url || '',
      categories: r.categories,
      is_national: r.is_national,
      end_date: r.end_date || null,
      shop_id: r.shop_id || null,
      lat: r.lat,
      lng: r.lng,
      source: r.source,
      external_id: r.external_id,
      dedupe_key: r.dedupe_key || makeDedupeKey(r.title, r.date, r.city),
      is_active: true,
      last_seen_at: nowSeen,
    }))

  let upserted = 0
  const errors = []
  // Batch to stay well under payload limits
  for (let i = 0; i < upserts.length; i += 200) {
    const chunk = upserts.slice(i, i + 200)
    const { error, count } = await supabase
      .from('events')
      .upsert(chunk, { onConflict: 'dedupe_key', ignoreDuplicates: false, count: 'exact' })
    if (error) errors.push(error.message)
    else upserted += count ?? chunk.length
  }

  // 4b. Regenerate store events: hide future rows from store platforms that
  //     were not seen this run (cancelled, or a projected week that changed).
  if (!errors.length) {
    const { error: staleErr } = await supabase
      .from('events')
      .update({ is_active: false })
      .in('source', ['wizards', 'ravensburger', 'wizards-recurring', 'ravensburger-recurring'])
      .gte('date', todayISO)
      .lt('last_seen_at', nowSeen)
    if (staleErr) errors.push(`stale: ${staleErr.message}`)
  }

  // 4c. One-time cleanup that is safe to repeat: hide junk the old Ticketmaster
  //     keywords pulled in, and legacy null-dedupe rows the curated list replaces.
  {
    const { error: junkErr } = await supabase.from('events').update({ is_active: false })
      .eq('is_active', true).neq('source', 'curated')
      .or('title.ilike.%comedy%,title.ilike.%open mic%,title.ilike.%rodeo%,title.ilike.%wild card round%,title.ilike.%burlesque%')
    if (junkErr) errors.push(`junk: ${junkErr.message}`)
    const { error: legErr } = await supabase.from('events').update({ is_active: false })
      .is('dedupe_key', null)
      .in('title', ['WonderCon 2027', 'C2E2 2027', 'Yu-Gi-Oh! YCS — Orlando', 'MagicCon: Atlanta 2026 (World Championship)'])
    if (legErr) errors.push(`legacy: ${legErr.message}`)
  }

  // 5. Soft-expire anything whose date has passed (keeps history, hides from UI)
  const { error: expErr, count: expiredCount } = await supabase
    .from('events')
    .update({ is_active: false }, { count: 'exact' })
    .lt('date', todayISO)
    .eq('is_active', true)

  if (expErr) errors.push(`expire: ${expErr.message}`)

  return res.status(200).json({
    ok: errors.length === 0,
    ms: Date.now() - started,
    fetched: { serpapi: serp.length, ticketmaster: tm.length, national: national.length, local: local.stats },
    shopsMatched,
    deduped: deduped.length,
    upserted,
    expired: expiredCount ?? 0,
    errors,
  })
}
