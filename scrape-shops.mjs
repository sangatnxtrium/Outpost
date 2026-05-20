import { createClient } from '@supabase/supabase-js'

const GOOGLE_API_KEY = 'AIzaSyDsncRLfDRD6SwMh4FpEOS5MKBg8H92V6w'
const SUPABASE_URL = 'https://ihctysckgobjvyztdfsz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY3R5c2NrZ29ianZ5enRkZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MTgzNiwiZXhwIjoyMDk0ODI3ODM2fQ.Cj64DmACdgDUyZG_izip2a08yVC_AsQt6bd2NShpk3M'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SEARCH_QUERIES = [
  'comic book store Colorado',
  'trading card shop Colorado',
  'pokemon card shop Colorado',
  'sports cards shop Colorado',
  'collectibles store Colorado',
  'comic shop Denver',
  'card shop Denver',
  'comic book store Colorado Springs',
  'trading card shop Boulder',
  'comic shop Fort Collins',
  'collectibles shop Aurora Colorado',
  'card shop Lakewood Colorado',
]

function getCategory(query) {
  if (query.includes('comic')) return 'comics'
  if (query.includes('collectible')) return 'collectibles'
  return 'cards'
}

function cleanPhone(phone) {
  if (!phone) return ''
  return phone.replace(/[^\d\s\(\)\-\+]/g, '').trim()
}

async function searchPlaces(query) {
  console.log(`  Searching: "${query}"...`)
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&region=us`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.log(`  Warning: ${data.status} for "${query}"`)
    return []
  }
  return data.results || []
}

async function getPlaceDetails(placeId) {
  const fields = 'name,formatted_address,formatted_phone_number,geometry,opening_hours,rating,types,website'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') return null
  return data.result
}

function formatHours(openingHours) {
  if (!openingHours?.weekday_text?.length) return 'Call for hours'
  const mon = openingHours.weekday_text.find(h => h.startsWith('Monday'))
  if (mon) return mon.replace('Monday: ', 'Mon: ')
  return openingHours.weekday_text[0] || 'Call for hours'
}

function getCategoryFromTypes(types, query) {
  if (!types) return getCategory(query)
  const typeStr = types.join(' ')
  if (typeStr.includes('book')) return 'comics'
  return getCategory(query)
}

async function main() {
  console.log('🔍 Starting Colorado collectibles shop scraper...\n')

  const allPlaces = new Map()

  for (const query of SEARCH_QUERIES) {
    const results = await searchPlaces(query)
    const category = getCategory(query)
    for (const place of results) {
      if (!allPlaces.has(place.place_id)) {
        allPlaces.set(place.place_id, { ...place, _category: category })
      }
    }
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n✅ Found ${allPlaces.size} unique shops. Fetching details...\n`)

  const shops = []
  let i = 0

  for (const [placeId, place] of allPlaces) {
    i++
    console.log(`  [${i}/${allPlaces.size}] ${place.name}`)
    const details = await getPlaceDetails(placeId)
    await new Promise(r => setTimeout(r, 200))
    if (!details) continue
    const address = details.formatted_address || place.formatted_address || ''
    if (!address.includes(', CO') && !address.includes('Colorado')) continue
    const lat = details.geometry?.location?.lat || place.geometry?.location?.lat
    const lng = details.geometry?.location?.lng || place.geometry?.location?.lng
    if (!lat || !lng) continue
    shops.push({
      name: details.name || place.name,
      address: address,
      phone: cleanPhone(details.formatted_phone_number || ''),
      category: getCategoryFromTypes(details.types, place._category),
      hot_find: '',
      rating: details.rating || place.rating || 4.5,
      tags: [],
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      hours: formatHours(details.opening_hours),
      description: `${details.name} — Colorado collectibles shop.`,
    })
  }

  console.log(`\n✅ ${shops.length} Colorado shops ready to insert.\n`)

  const BATCH = 20
  let inserted = 0

  for (let j = 0; j < shops.length; j += BATCH) {
    const batch = shops.slice(j, j + BATCH)
    const { error } = await supabase
      .from('shops')
      .insert(batch)
    if (error) {
      console.log(`  ⚠️  Batch error: ${error.message}`)
    } else {
      inserted += batch.length
      console.log(`  ✓ Inserted batch ${Math.floor(j/BATCH)+1} (${inserted} total)`)
    }
  }

  console.log(`\n🎉 Done! ${inserted} shops added to Outpost.`)
  console.log('https://supabase.com/dashboard/project/ihctysckgobjvyztdfsz/editor')
}

main().catch(console.error)
