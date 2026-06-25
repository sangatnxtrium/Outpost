// Shared, pure-ish helpers for the event ingest pipeline.
// Files/folders under /api starting with "_" are NOT treated as routes by Vercel,
// but can be imported by route handlers. Keep this dependency-free (except fetch).

export const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const CATEGORY_RULES = [
  { cat: 'cards', re: /\b(card|cards|tcg|pokemon|pokémon|magic|mtg|yugioh|yu-gi-oh|lorcana|one piece|sports card|psa|topps|panini|breaker|break)\b/i },
  { cat: 'comics', re: /\b(comic|comics|comic-con|comicon|comic con|c2e2|fan expo|wondercon|graphic novel|manga)\b/i },
  { cat: 'toys', re: /\b(toy|toys|funko|action figure|figures|lego|diecast|hot wheels)\b/i },
  { cat: 'collectibles', re: /\b(collectible|collectibles|memorabilia|vintage|antique|pop culture|expo)\b/i },
]

// Infer category tags from free text. Always returns at least ['collectibles'].
export function inferCategories(...texts) {
  const hay = texts.filter(Boolean).join(' ')
  const out = new Set()
  for (const { cat, re } of CATEGORY_RULES) {
    if (re.test(hay)) out.add(cat)
  }
  if (out.size === 0) out.add('collectibles')
  return [...out]
}

// Parse a human or ISO date string into 'YYYY-MM-DD'.
// When no year is present, infers the soonest future occurrence (rolls forward
// if the month/day is more than ~45 days in the past relative to `ref`).
export function parseEventDate(raw, ref = new Date()) {
  if (!raw) return null
  const s = String(raw).trim().toLowerCase()

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const m = s.match(/([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/)
  if (!m) return null
  const mon = MONTHS[m[1].slice(0, 3)]
  if (mon === undefined) return null

  const day = parseInt(m[2], 10)
  if (day < 1 || day > 31) return null

  let year = m[3] ? parseInt(m[3], 10) : ref.getFullYear()
  if (!m[3]) {
    const candidate = new Date(year, mon, day)
    const cutoff = new Date(ref)
    cutoff.setDate(cutoff.getDate() - 45)
    if (candidate < cutoff) year += 1
  }

  return `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Stable cross-source dedupe key: normalized title + date + city.
export function makeDedupeKey(title, date, city) {
  const t = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const c = (city || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${t}|${date || ''}|${c}`
}

// Pull "City, ST" out of an address line.
function splitCityState(line) {
  if (!line) return { city: '', state: '' }
  const m = String(line).match(/([A-Za-z.\s]+),\s*([A-Z]{2})\b/)
  if (m) return { city: m[1].trim(), state: m[2].trim() }
  return { city: String(line).trim(), state: '' }
}

// Normalize one SerpApi google_events result into our `events` row shape.
// SerpApi rarely returns coordinates, so lat/lng are left null for geocoding.
export function normalizeSerpApiEvent(ev, ref = new Date()) {
  if (!ev || !ev.title) return null

  const date = parseEventDate(ev.date?.start_date || ev.date?.when, ref)
  if (!date) return null

  const addr = Array.isArray(ev.address) ? ev.address : []
  const venueLine = addr[0] || ev.venue?.name || ''
  const cityLine = addr[addr.length - 1] || ''
  const { city, state } = splitCityState(cityLine)

  const ticket = Array.isArray(ev.ticket_info) && ev.ticket_info.length
    ? (ev.ticket_info.find(t => t.link)?.link || '')
    : ''

  return {
    title: ev.title.trim(),
    date,
    location: addr.join(', ') || venueLine,
    city,
    state,
    description: (ev.description || '').slice(0, 1000),
    website: ev.link || '',
    ticket_url: ticket,
    image_url: ev.image || ev.thumbnail || '',
    categories: inferCategories(ev.title, ev.description, venueLine),
    is_national: false,
    lat: null,
    lng: null,
    source: 'serpapi',
    external_id: ev.event_id || makeDedupeKey(ev.title, date, city),
  }
}

// Normalize one Ticketmaster Discovery event. These come with clean dates + coords.
export function normalizeTicketmasterEvent(ev) {
  if (!ev || !ev.name) return null

  const date = ev.dates?.start?.localDate || null
  if (!date) return null

  const venue = ev._embedded?.venues?.[0] || {}
  const city = venue.city?.name || ''
  const state = venue.state?.stateCode || ''
  const lat = venue.location?.latitude ? parseFloat(venue.location.latitude) : null
  const lng = venue.location?.longitude ? parseFloat(venue.location.longitude) : null

  const img = Array.isArray(ev.images) && ev.images.length
    ? ev.images.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0].url
    : ''

  const locationParts = [venue.name, city, state].filter(Boolean)

  return {
    title: ev.name.trim(),
    date,
    location: locationParts.join(', '),
    city,
    state,
    description: (ev.info || ev.pleaseNote || '').slice(0, 1000),
    website: ev.url || '',
    ticket_url: ev.url || '',
    image_url: img,
    categories: inferCategories(ev.name, ev.info, ev.classifications?.[0]?.segment?.name),
    is_national: false,
    lat,
    lng,
    source: 'ticketmaster',
    external_id: ev.id || makeDedupeKey(ev.name, date, city),
  }
}

// Collapse a list of normalized events to one-per-dedupe-key.
// Prefers the row that already has coordinates (saves a geocode call).
export function dedupeEvents(rows) {
  const byKey = new Map()
  for (const r of rows) {
    if (!r) continue
    const key = makeDedupeKey(r.title, r.date, r.city)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...r, dedupe_key: key })
    } else if (existing.lat == null && r.lat != null) {
      byKey.set(key, { ...r, dedupe_key: key })
    }
  }
  return [...byKey.values()]
}

// Target markets. Denver first (beachhead), then national hubs.
// Each SerpApi query is a {q, location} pair; Ticketmaster uses keyword + latlong.
export const METROS = [
  { name: 'Denver', latlong: '39.7392,-104.9903', priority: true },
  { name: 'Los Angeles', latlong: '34.0522,-118.2437' },
  { name: 'Chicago', latlong: '41.8781,-87.6298' },
  { name: 'Dallas', latlong: '32.7767,-96.7970' },
  { name: 'New York', latlong: '40.7128,-74.0060' },
  { name: 'Phoenix', latlong: '33.4484,-112.0740' },
  { name: 'Atlanta', latlong: '33.7490,-84.3880' },
  { name: 'Seattle', latlong: '47.6062,-122.3321' },
]

export const SERP_QUERIES = [
  'card show',
  'sports card show',
  'pokemon tcg event',
  'comic con',
  'collectibles show',
  'toy show',
]

export const TM_KEYWORDS = ['comic con', 'card show', 'collectibles', 'pop culture expo']
