// Local store-event importers (no login required).
//  - Wizards of the Coast Store & Event Locator (public GraphQL used by locator.wizards.com)
//  - Ravensburger Play Hub / Disney Lorcana (public REST used by tcg.ravensburgerplay.com)
//  - Eventbrite public search pages (JSON-LD), heavily filtered for relevance
// Plus: weekly-recurrence expansion and shop matching against the `shops` table.
// Not fetchable without login/bot-challenge (checked 2026-10-16): Pokémon Event
// Locator (Incapsula challenge), Bandai TCG+ API (403), Konami store locator.

import { inferCategories, makeDedupeKey } from './events.js'

// Colorado first (Denver metro leads), then the states with the most shops.
export const LOCAL_METROS = [
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, eb: 'co--denver' },
  { name: 'Aurora', state: 'CO', lat: 39.7294, lng: -104.8319 },
  { name: 'Lakewood', state: 'CO', lat: 39.7047, lng: -105.0814 },
  { name: 'Boulder', state: 'CO', lat: 40.0150, lng: -105.2705 },
  { name: 'Littleton', state: 'CO', lat: 39.6133, lng: -105.0166 },
  { name: 'Thornton', state: 'CO', lat: 39.8680, lng: -104.9719 },
  { name: 'Colorado Springs', state: 'CO', lat: 38.8339, lng: -104.8214, eb: 'co--colorado-springs' },
  { name: 'Fort Collins', state: 'CO', lat: 40.5853, lng: -105.0844, eb: 'co--fort-collins' },
  { name: 'Pueblo', state: 'CO', lat: 38.2544, lng: -104.6091 },
  { name: 'Grand Junction', state: 'CO', lat: 39.0639, lng: -108.5506 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Orlando', state: 'FL', lat: 28.5384, lng: -81.3789 },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'St. Louis', state: 'MO', lat: 38.6270, lng: -90.1994 },
  { name: 'Newark', state: 'NJ', lat: 40.7357, lng: -74.1724 },
  { name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { name: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
]

const UA = 'Mozilla/5.0 (compatible; OutpostEventsBot/1.0; +https://www.getoutpost.net)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJSON(url, opts = {}, label = url) {
  try {
    const res = await fetch(url, { ...opts, headers: { 'user-agent': UA, ...(opts.headers || {}) } })
    if (!res.ok) { console.warn(`[${label}] HTTP ${res.status}`); return null }
    return await res.json()
  } catch (e) { console.warn(`[${label}] ${e.message}`); return null }
}

// Local wall-clock date + time for an ISO instant in a given IANA zone.
export function localParts(iso, tz = 'America/Denver') {
  const d = new Date(iso)
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', weekday: 'short', hour12: true })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute} ${p.dayPeriod}`, weekday: p.weekday }
}

function withStore(title, store) {
  const t = (title || '').trim()
  if (!store) return t
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return norm(t).includes(norm(store).slice(0, 10)) ? t : `${t} @ ${store}`
}

function stateFromAddress(addr) {
  const m = String(addr || '').match(/,\s*([A-Z]{2})[, ]+\d{5}/)
  return m ? m[1] : ''
}

// --- Wizards of the Coast --------------------------------------------------
const WOTC_URL = 'https://api.tabletop.wizards.com/silverbeak-griffin-service/graphql'
const WOTC_QUERY = `query advancedSearchEvents($lat: Float!, $lng: Float!, $maxMeters: Int!, $tags: [AdvancedTag!], $sort: EventSearchSortField, $sortDirection: EventSearchSortDirection, $orgs: [ID!], $startDate: DateTime, $endDate: DateTime, $page: Int, $pageSize: Int) {
  advancedSearchEvents(
    query: {lat: $lat, lng: $lng, maxMeters: $maxMeters, tags: $tags, sort: $sort, sortDirection: $sortDirection, orgs: $orgs, startDate: $startDate, endDate: $endDate, page: $page, pageSize: $pageSize}
  ) {
    events {
      id
      capacity
      playerSaved
      description
      distance
      emailAddress
      hasTop8
      isAdHoc
      isOnline
      latitude
      longitude
      title
      eventTemplateId
      pairingType
      phoneNumber
      requiredTeamSize
      rulesEnforcementLevel
      scheduledStartTime
      startingTableNumber
      status
      tags
      timeZone
      cardSet {
        id
      }
      entryFee {
        amount
        currency
      }
      organization {
        id
        isPremium
        isLegendary
        name
        website
        phoneNumber
        address
        city
        state
        postalCode
      }
      eventFormat {
        id
        name
      }
    }
    pageInfo {
      page
      pageSize
      totalResults
    }
  }
}
    `

export async function fetchWizards(metro, { days = 42, miles = 20, maxPages = 6 } = {}) {
  const start = new Date()
  const end = new Date(Date.now() + days * 864e5)
  const out = []
  for (let page = 0; page < maxPages; page++) {
    const data = await getJSON(WOTC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://locator.wizards.com' },
      body: JSON.stringify({
        operationName: 'advancedSearchEvents',
        query: WOTC_QUERY,
        variables: { lat: metro.lat, lng: metro.lng, maxMeters: Math.round(miles * 1609.34), sort: 'date', sortDirection: 'Asc', startDate: start.toISOString(), endDate: end.toISOString(), page, pageSize: 100 },
      }),
    }, `wotc:${metro.name}`)
    const res = data?.data?.advancedSearchEvents
    const evs = res?.events || []
    for (const e of evs) {
      if (e.isOnline || !e.organization) continue
      const o = e.organization
      const lp = localParts(e.scheduledStartTime, e.timeZone)
      const fmt = e.eventFormat?.name ? ` (${e.eventFormat.name})` : ''
      const fee = e.entryFee?.amount ? ` Entry $${(e.entryFee.amount / 100).toFixed(2).replace(/\.00$/, '')}.` : ' Free entry.'
      out.push({
        title: withStore(e.title, o.name),
        date: lp.date,
        start_time: lp.time,
        weekday: lp.weekday,
        location: [o.name, o.address, o.city, o.state].filter(Boolean).join(', '),
        city: o.city || metro.name,
        state: o.state || metro.state,
        description: `Magic: The Gathering${fmt} at ${o.name}. Starts ${lp.time}.${fee} ${(e.description || '').trim()}`.slice(0, 400),
        website: o.website || `https://locator.wizards.com/events/${e.id}`,
        ticket_url: `https://locator.wizards.com/events/${e.id}`,
        image_url: '',
        categories: ['cards'],
        is_national: false,
        lat: e.latitude ?? null,
        lng: e.longitude ?? null,
        source: 'wizards',
        external_id: `wotc:${e.id}`,
        store_name: o.name,
        store_address: [o.address, o.city, o.state, o.postalCode].filter(Boolean).join(', '),
        tz: e.timeZone,
      })
    }
    const total = res?.pageInfo?.totalResults ?? 0
    if (evs.length < 100 || (page + 1) * 100 >= total) break
    await sleep(200)
  }
  return out
}

// --- Ravensburger / Disney Lorcana -----------------------------------------
export async function fetchRavensburger(metro, { days = 42, miles = 20, maxPages = 5 } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
  const out = []
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.ravensburgerplay.com/api/v2/events/?latitude=${metro.lat}&longitude=${metro.lng}&num_miles=${miles}&display_status=upcoming&start_date_after=${today}&page_size=100&page=${page}`
    const data = await getJSON(url, {}, `rav:${metro.name}`)
    const rs = data?.results || []
    for (const e of rs) {
      if (e.event_is_online) continue
      const s = e.store || {}
      const tz = e.timezone || 'America/Denver'
      const lp = localParts(e.start_datetime, tz)
      if (lp.date > horizon) continue
      const fee = e.cost_in_cents ? ` Entry $${(e.cost_in_cents / 100).toFixed(2).replace(/\.00$/, '')}.` : ''
      const addr = e.full_address || s.full_address || ''
      out.push({
        title: withStore(e.name, s.name),
        date: lp.date,
        start_time: lp.time,
        weekday: lp.weekday,
        location: [s.name, addr].filter(Boolean).join(', '),
        city: s.city || metro.name,
        state: s.state || stateFromAddress(addr) || metro.state,
        description: `Disney Lorcana at ${s.name || 'a local store'}. Starts ${lp.time}.${fee} ${(e.description || '').trim()}`.slice(0, 400),
        website: s.website || `https://tcg.ravensburgerplay.com/events/${e.id}`,
        ticket_url: `https://tcg.ravensburgerplay.com/events/${e.id}`,
        image_url: '',
        categories: ['cards'],
        is_national: false,
        lat: e.latitude ?? s.latitude ?? null,
        lng: e.longitude ?? s.longitude ?? null,
        source: 'ravensburger',
        external_id: `rav:${e.id}`,
        store_name: s.name || '',
        store_address: s.full_address || addr,
        tz,
      })
    }
    if (!data?.next) break
    await sleep(200)
  }
  return out
}

// --- Eventbrite (public search pages, JSON-LD) ------------------------------
const EB_QUERIES = ['card-show', 'trading-card', 'pokemon-tournament', 'comic-con', 'tcg']
export async function fetchEventbrite(metro) {
  if (!metro.eb) return []
  const out = []
  for (const q of EB_QUERIES) {
    let html = ''
    try {
      const res = await fetch(`https://www.eventbrite.com/d/${metro.eb}/${q}/`, { headers: { 'user-agent': UA } })
      if (!res.ok) { console.warn(`[eb:${metro.name}:${q}] HTTP ${res.status}`); continue }
      html = await res.text()
    } catch (e) { console.warn(`[eb] ${e.message}`); continue }
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let d; try { d = JSON.parse(m[1]) } catch { continue }
      for (const it of d?.itemListElement || []) {
        const x = it.item || {}
        if (!x.name || !x.startDate) continue
        const loc = x.location || {}
        const a = loc.address || {}
        out.push({
          title: x.name.trim(),
          date: String(x.startDate).slice(0, 10),
          end_date: x.endDate ? String(x.endDate).slice(0, 10) : null,
          location: [loc.name, a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(', '),
          city: a.addressLocality || metro.name,
          state: (a.addressRegion || metro.state).slice(0, 2).toUpperCase(),
          description: (x.description || '').slice(0, 1000),
          website: x.url || '',
          ticket_url: x.url || '',
          image_url: x.image || '',
          categories: inferCategories(x.name, x.description),
          is_national: false,
          lat: loc.geo?.latitude ? parseFloat(loc.geo.latitude) : null,
          lng: loc.geo?.longitude ? parseFloat(loc.geo.longitude) : null,
          source: 'eventbrite',
          external_id: `eb:${(x.url || '').match(/(\d{9,})/)?.[1] || makeDedupeKey(x.name, x.startDate, a.addressLocality)}`,
          store_name: loc.name || '',
          store_address: [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(', '),
        })
      }
    }
    await sleep(300)
  }
  return out
}

// --- Weekly recurrence expansion -------------------------------------------
// Store events on these platforms are usually created a week or two ahead.
// When a (store, normalized title, weekday, time) series appears at least twice
// exactly 7*n days apart, or once with an explicit "weekly" marker, project it
// forward weekly through the horizon. Projected rows are labeled as such.
const WEEKLY_RE = /\b(weekly|every (mon|tues|wednes|thurs|fri|satur|sun)day|friday night magic|fnm|league|locals?)\b/i
export function expandWeekly(rows, { days = 42 } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
  const norm = (t) => t.toLowerCase().replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '').replace(/[^a-z]/g, '')
  const series = new Map()
  for (const r of rows) {
    if (!r.weekday || !r.store_name) continue
    const k = [r.source, r.store_name, norm(r.title), r.weekday, r.start_time].join('|')
    if (!series.has(k)) series.set(k, [])
    series.get(k).push(r)
  }
  const add = []
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  for (const list of series.values()) {
    const dates = [...new Set(list.map((r) => r.date))].sort()
    const weeklyGap = dates.length >= 2 && dates.slice(1).every((d, i) => ((new Date(d) - new Date(dates[i])) / 864e5) % 7 === 0)
    const marked = WEEKLY_RE.test(list[0].title) || WEEKLY_RE.test(list[0].description || '')
    if (!(weeklyGap || marked)) continue
    const have = new Set(dates)
    const tmpl = list[list.length - 1]
    for (let d = addDays(dates[dates.length - 1], 7); d <= horizon; d = addDays(d, 7)) {
      if (d < today || have.has(d)) continue
      add.push({
        ...tmpl,
        date: d,
        description: `Recurring weekly (projected from the store's schedule; confirm with the store). ${tmpl.description || ''}`.slice(0, 1000),
        external_id: `${tmpl.external_id}:wk:${d}`,
        source: `${tmpl.source}-recurring`,
      })
    }
  }
  return [...rows, ...add]
}

// --- Relevance filter -------------------------------------------------------
const POSITIVE = /(card show|trading cards?|\btcg\b|\bccg\b|pok[eé]mon (tcg|tournament|league|cup|card)|magic:? the gathering|\bmtg\b|lorcana|yu-?gi-?oh|one piece card|digimon card|flesh and blood|star wars unlimited|sports cards?|memorabilia show|collectibles? (show|expo|con)|cards and collectibles|comic[- ]?con|comic book show|fan expo|toy show|funko|prerelease)/i
const NEGATIVE = /\b(rodeo|prorodeo|comedy|comedian|stand-?up|open mic|punchline|drag|burlesque|bingo|bridal|wedding|home show|concert|tribute|symphony|wrestling|monster truck|poker|blackjack|casino|euchre|cornhole|mah ?jongg|roller derby|wild card round|playoffs?|nfl|nba|nhl|mlb|ncaa|soccer|hockey|basketball|football|golf|marathon|speed dating|murder mystery|dinner theater|yoga|wine|crawl|paint and sip|sip and paint|full moon|metaphysical|psychic|gun show|artisan market|craft fair|farmers market|cosplay con|art con|art & cosplay)\b/i
// Store platforms (Wizards/Ravensburger) are TCG-only by construction; keep
// everything except obvious junk. Open-web sources must hit a TCG/collectibles
// keyword and no junk keyword.
export function isRelevantEvent(r) {
  const title = r.title || ''
  if (NEGATIVE.test(title)) return false
  if (/^(wizards|ravensburger|curated)/.test(r.source || '')) return true
  if (NEGATIVE.test(r.description || '') && !POSITIVE.test(title)) return false
  return POSITIVE.test(`${title} ${r.description || ''}`)
}

// --- Shop matching -----------------------------------------------------------
const STOP = new Set(['the', 'and', 'of', 'llc', 'inc', 'co', 'games', 'game', 'gaming', 'cards', 'card', 'comics', 'store', 'shop', 'collectibles', 'tcg', 'hobbies', 'hobby'])
const tokens = (s) => new Set(String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)))
function km(aLat, aLng, bLat, bLng) {
  const R = 6371, toR = Math.PI / 180
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const streetKey = (a) => { const m = String(a || '').toLowerCase().match(/^\s*(\d+)\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)/); return m ? `${m[1]} ${m[2].replace(/^(n|s|e|w|north|south|east|west)\s+/, '')}` : '' }

export function matchShops(rows, shops) {
  const withGeo = shops.filter((s) => s.lat && s.lng)
  const cache = new Map()
  let matched = 0
  for (const r of rows) {
    if (!r.store_name) continue
    const key = `${r.store_name}|${r.store_address}`
    if (!cache.has(key)) {
      let best = null, bestScore = 0
      const tName = tokens(r.store_name)
      const sk = streetKey(r.store_address)
      for (const s of withGeo) {
        const dist = r.lat != null ? km(r.lat, r.lng, s.lat, s.lng) : 99
        if (dist > 1.5) continue
        const tShop = tokens(s.name)
        const inter = [...tName].filter((w) => tShop.has(w)).length
        const jac = inter / Math.max(1, new Set([...tName, ...tShop]).size)
        const sameStreet = sk && streetKey(s.address) === sk
        // Require some name overlap: a shared street address alone can be a
        // different tenant in the same plaza.
        if (jac === 0) continue
        let score = jac
        if (sameStreet) score += 0.5
        if (dist < 0.15) score += 0.3
        if (score > bestScore) { bestScore = score, best = s }
      }
      cache.set(key, bestScore >= 0.6 ? best : null)
    }
    const shop = cache.get(key)
    if (shop) { r.shop_id = shop.id; matched++ }
  }
  return matched
}

export async function fetchAllLocal({ metros = LOCAL_METROS, days = 42 } = {}) {
  const stats = { wizards: 0, ravensburger: 0, eventbrite: 0 }
  const all = []
  const run = async (m) => {
    // Colorado gets the full 6-week window and deeper paging; other states a
    // tighter radius so each run stays well inside the function time limit.
    const co = m.state === 'CO'
    const opts = co ? { days, miles: 20, maxPages: 6 } : { days: Math.min(days, 35), miles: 15, maxPages: 2 }
    const [w, r, e] = await Promise.all([fetchWizards(m, opts), fetchRavensburger(m, opts), fetchEventbrite(m)])
    stats.wizards += w.length; stats.ravensburger += r.length; stats.eventbrite += e.length
    all.push(...w, ...r, ...e)
  }
  // 4 metros at a time.
  for (let i = 0; i < metros.length; i += 4) await Promise.all(metros.slice(i, i + 4).map(run))
  // Drop duplicates from overlapping metro radii by external_id.
  const seen = new Set()
  const uniq = all.filter((x) => (seen.has(x.external_id) ? false : seen.add(x.external_id)))
  const expanded = expandWeekly(uniq, { days })
  for (const x of expanded) { delete x.weekday; delete x.tz }
  const relevant = expanded.filter(isRelevantEvent)
  return { rows: relevant, stats: { ...stats, unique: uniq.length, expanded: expanded.length, relevant: relevant.length } }
}
