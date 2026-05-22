import { createClient } from '@supabase/supabase-js'

const GOOGLE_API_KEY = 'AIzaSyDsncRLfDRD6SwMh4FpEOS5MKBg8H92V6w'
const SUPABASE_URL = 'https://ihctysckgobjvyztdfsz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY3R5c2NrZ29ianZ5enRkZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MTgzNiwiZXhwIjoyMDk0ODI3ODM2fQ.Cj64DmACdgDUyZG_izip2a08yVC_AsQt6bd2NShpk3M'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CITIES = [
  'New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX', 'Phoenix AZ',
  'Philadelphia PA', 'San Diego CA', 'Dallas TX', 'Austin TX', 'Seattle WA',
  'Portland OR', 'Boston MA', 'Atlanta GA', 'Miami FL', 'Las Vegas NV',
  'Minneapolis MN', 'Detroit MI', 'Denver CO', 'Nashville TN', 'Baltimore MD',
  'Milwaukee WI', 'Sacramento CA', 'Kansas City MO', 'Columbus OH', 'Indianapolis IN',
  'Charlotte NC', 'Memphis TN', 'Washington DC', 'Salt Lake City UT', 'Tampa FL',
  'Orlando FL', 'Pittsburgh PA', 'Cincinnati OH', 'St Louis MO', 'Cleveland OH',
  'Raleigh NC', 'New Orleans LA', 'San Jose CA', 'San Francisco CA', 'Oakland CA',
  'Colorado Springs CO', 'Boulder CO', 'Omaha NE', 'Des Moines IA', 'Madison WI',
  'Grand Rapids MI', 'Ann Arbor MI', 'Buffalo NY', 'Rochester NY', 'Albany NY',
  'Scottsdale AZ', 'Mesa AZ', 'Plano TX', 'Durham NC', 'Lexington KY',
]

const SEARCH_TERMS = [
  'sports card show 2026',
  'trading card show 2026',
  'pokemon tournament 2026',
  'magic the gathering tournament 2026',
  'sports memorabilia show 2026',
  'TCG tournament 2026',
  'baseball card show 2026',
  'yugioh tournament 2026',
]

function getCategories(term) {
  if (term.includes('pokemon') || term.includes('yugioh') || term.includes('magic') || term.includes('TCG')) return ['cards', 'collectibles']
  return ['cards']
}

function extractState(address) {
  const match = address.match(/,\s*([A-Z]{2})\s+\d{5}/)
  return match ? match[1] : ''
}

function extractCity(address) {
  const parts = address.split(',')
  return parts.length >= 3 ? parts[parts.length - 3]?.trim() || '' : ''
}

async function searchPlaces(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&region=us`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return []
  return data.results || []
}

async function getPlaceDetails(placeId) {
  const fields = 'name,formatted_address,geometry,website,editorial_summary'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') return null
  return data.result
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function isEvent(name) {
  return name.toLowerCase().match(/show|expo|convention|tournament|championship|fest|card|collect|memorabilia/)
}

async function main() {
  console.log('🃏 Scraping Sports Card & TCG Shows...\n')

  const allPlaces = new Map()
  let searchCount = 0
  const total = CITIES.length * SEARCH_TERMS.length

  for (const city of CITIES) {
    for (const term of SEARCH_TERMS) {
      searchCount++
      process.stdout.write(`\r[${searchCount}/${total}] Searching...`)
      try {
        const results = await searchPlaces(`${term} ${city}`)
        for (const place of results) {
          if (!allPlaces.has(place.place_id)) {
            allPlaces.set(place.place_id, { ...place, _term: term })
          }
        }
      } catch (err) {}
      await sleep(150)
    }
  }

  console.log(`\n\n✅ Found ${allPlaces.size} unique results. Fetching details...\n`)

  const events = []
  let i = 0

  for (const [placeId, place] of allPlaces) {
    i++
    if (i % 50 === 0) process.stdout.write(`\r  Processing ${i}/${allPlaces.size}...`)
    try {
      const details = await getPlaceDetails(placeId)
      await sleep(150)
      if (!details) continue
      const address = details.formatted_address || place.formatted_address || ''
      if (!address.match(/,\s*[A-Z]{2}\s+\d{5}/)) continue
      const lat = details.geometry?.location?.lat || place.geometry?.location?.lat
      const lng = details.geometry?.location?.lng || place.geometry?.location?.lng
      if (!lat || !lng) continue
      const name = details.name || place.name || ''
      if (!isEvent(name)) continue
      events.push({
        title: name,
        date: '2026-12-31',
        location: address,
        city: extractCity(address),
        state: extractState(address),
        description: details.editorial_summary?.overview || `${name} — card and collectibles event.`,
        website: details.website || '',
        categories: getCategories(place._term),
        is_national: false,
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        spots: null,
        shop_id: null,
      })
    } catch (err) {}
  }

  const unique = Array.from(new Map(events.map(e => [e.title.toLowerCase(), e])).values())
  console.log(`\n\n✅ ${unique.length} unique card shows found\n`)

  let inserted = 0
  for (let j = 0; j < unique.length; j += 20) {
    const batch = unique.slice(j, j + 20)
    const { error } = await supabase.from('events').insert(batch)
    if (!error) { inserted += batch.length; process.stdout.write(`\r  ✓ Inserted ${inserted}...`) }
  }

  console.log(`\n\n🎉 Done! ${inserted} card shows inserted.`)
}

main().catch(console.error)
