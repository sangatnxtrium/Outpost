import { createClient } from '@supabase/supabase-js'

const GOOGLE_API_KEY = 'AIzaSyDsncRLfDRD6SwMh4FpEOS5MKBg8H92V6w'
const SUPABASE_URL = 'https://ihctysckgobjvyztdfsz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY3R5c2NrZ29ianZ5enRkZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MTgzNiwiZXhwIjoyMDk0ODI3ODM2fQ.Cj64DmACdgDUyZG_izip2a08yVC_AsQt6bd2NShpk3M'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CITIES = [
  'New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX', 'Phoenix AZ',
  'Philadelphia PA', 'San Antonio TX', 'San Diego CA', 'Dallas TX', 'Austin TX',
  'Jacksonville FL', 'Seattle WA', 'Portland OR', 'Boston MA', 'Atlanta GA',
  'Miami FL', 'Las Vegas NV', 'Minneapolis MN', 'Detroit MI', 'Denver CO',
  'Nashville TN', 'Oklahoma City OK', 'Baltimore MD', 'Louisville KY', 'Milwaukee WI',
  'Albuquerque NM', 'Tucson AZ', 'Fresno CA', 'Sacramento CA', 'Kansas City MO',
  'Columbus OH', 'Indianapolis IN', 'Charlotte NC', 'Memphis TN', 'Fort Worth TX',
  'El Paso TX', 'Washington DC', 'Boston MA', 'Denver CO', 'Salt Lake City UT',
  'Richmond VA', 'Tampa FL', 'Orlando FL', 'Pittsburgh PA', 'Cincinnati OH',
  'St Louis MO', 'Cleveland OH', 'Raleigh NC', 'Virginia Beach VA', 'New Orleans LA',
  'San Jose CA', 'San Francisco CA', 'Oakland CA', 'Bakersfield CA', 'Riverside CA',
  'Anaheim CA', 'Stockton CA', 'Irvine CA', 'Santa Ana CA', 'Long Beach CA',
  'Honolulu HI', 'Anchorage AK', 'Boise ID', 'Spokane WA', 'Tacoma WA',
  'Fort Collins CO', 'Colorado Springs CO', 'Boulder CO', 'Aurora CO', 'Lakewood CO',
  'Omaha NE', 'Lincoln NE', 'Des Moines IA', 'Madison WI', 'Green Bay WI',
  'Grand Rapids MI', 'Ann Arbor MI', 'Lansing MI', 'Flint MI', 'Sterling Heights MI',
  'Buffalo NY', 'Rochester NY', 'Albany NY', 'Syracuse NY', 'Yonkers NY',
  'Newark NJ', 'Jersey City NJ', 'Paterson NJ', 'Elizabeth NJ', 'Edison NJ',
  'Scottsdale AZ', 'Chandler AZ', 'Tempe AZ', 'Mesa AZ', 'Glendale AZ',
  'Corpus Christi TX', 'Plano TX', 'Laredo TX', 'Lubbock TX', 'Irving TX',
  'Garland TX', 'Frisco TX', 'McKinney TX', 'Amarillo TX', 'Grand Prairie TX',
  'Durham NC', 'Greensboro NC', 'Winston-Salem NC', 'Fayetteville NC', 'Cary NC',
  'Lexington KY', 'Knoxville TN', 'Chattanooga TN', 'Clarksville TN', 'Murfreesboro TN',
  'Augusta GA', 'Columbus GA', 'Savannah GA', 'Athens GA', 'Macon GA',
  'Jackson MS', 'Shreveport LA', 'Baton Rouge LA', 'Lafayette LA', 'Metairie LA',
  'Little Rock AR', 'Fort Smith AR', 'Fayetteville AR',
  'Birmingham AL', 'Montgomery AL', 'Huntsville AL', 'Mobile AL',
  'Charleston SC', 'Columbia SC', 'Greenville SC',
  'Springfield MO', 'Columbia MO', 'Independence MO',
  'Wichita KS', 'Overland Park KS', 'Topeka KS',
  'Sioux Falls SD', 'Rapid City SD', 'Fargo ND', 'Bismarck ND',
  'Billings MT', 'Missoula MT', 'Great Falls MT',
  'Casper WY', 'Cheyenne WY',
  'Providence RI', 'Bridgeport CT', 'Hartford CT', 'New Haven CT',
  'Burlington VT', 'Portland ME', 'Manchester NH', 'Concord NH',
]

const SEARCH_TERMS = [
  'comic book store',
  'trading card shop',
  'collectibles store',
  'pokemon card shop',
  'sports cards shop',
]

function getCategory(term) {
  if (term.includes('comic')) return 'comics'
  if (term.includes('collectible')) return 'collectibles'
  return 'cards'
}

function cleanPhone(phone) {
  if (!phone) return ''
  return phone.replace(/[^\d\s\(\)\-\+]/g, '').trim()
}

async function searchPlaces(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&region=us`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.log(`  Warning: ${data.status}`)
    return []
  }
  return data.results || []
}

async function getPlaceDetails(placeId) {
  const fields = 'name,formatted_address,formatted_phone_number,geometry,opening_hours,rating,types'
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

function getCategoryFromTypes(types, term) {
  if (!types) return getCategory(term)
  const typeStr = types.join(' ')
  if (typeStr.includes('book')) return 'comics'
  return getCategory(term)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('🇺🇸 Starting US collectibles shop scraper...')
  console.log(`📍 ${CITIES.length} cities × ${SEARCH_TERMS.length} terms = ${CITIES.length * SEARCH_TERMS.length} searches\n`)

  const allPlaces = new Map()
  let searchCount = 0
  const totalSearches = CITIES.length * SEARCH_TERMS.length

  for (const city of CITIES) {
    for (const term of SEARCH_TERMS) {
      searchCount++
      const query = `${term} ${city}`
      process.stdout.write(`\r[${searchCount}/${totalSearches}] ${query.substring(0, 60).padEnd(60)}`)

      try {
        const results = await searchPlaces(query)
        const category = getCategory(term)
        for (const place of results) {
          if (!allPlaces.has(place.place_id)) {
            allPlaces.set(place.place_id, { ...place, _category: category })
          }
        }
      } catch (err) {
        console.log(`\n  Error: ${err.message}`)
      }

      await sleep(150)
    }
  }

  console.log(`\n\n✅ Found ${allPlaces.size} unique shops. Fetching details...\n`)

  const shops = []
  let i = 0

  for (const [placeId, place] of allPlaces) {
    i++
    if (i % 50 === 0) console.log(`  [${i}/${allPlaces.size}] Processing...`)

    try {
      const details = await getPlaceDetails(placeId)
      await sleep(150)
      if (!details) continue

      const address = details.formatted_address || place.formatted_address || ''
      // Only US addresses
      if (!address.match(/,\s*[A-Z]{2}\s+\d{5}/)) continue

      const lat = details.geometry?.location?.lat || place.geometry?.location?.lat
      const lng = details.geometry?.location?.lng || place.geometry?.location?.lng
      if (!lat || !lng) continue

      shops.push({
        name: details.name || place.name,
        address,
        phone: cleanPhone(details.formatted_phone_number || ''),
        category: getCategoryFromTypes(details.types, place._category),
        categories: [],
        hot_find: '',
        rating: details.rating || place.rating || 4.5,
        tags: [],
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        hours: formatHours(details.opening_hours),
        description: `${details.name || place.name} — collectibles shop.`,
      })
    } catch (err) {
      // Skip on error
    }
  }

  console.log(`\n✅ ${shops.length} US shops ready to insert.\n`)

  // Insert in batches of 20
  let inserted = 0
  let skipped = 0

  for (let j = 0; j < shops.length; j += 20) {
    const batch = shops.slice(j, j + 20)
    const { error } = await supabase.from('shops').insert(batch)
    if (error) {
      console.log(`  ⚠️  Batch ${Math.floor(j/20)+1} error: ${error.message}`)
      skipped += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r  ✓ Inserted ${inserted} shops...`)
    }
  }

  console.log(`\n\n🎉 Done!`)
  console.log(`✅ Inserted: ${inserted}`)
  console.log(`⚠️  Skipped: ${skipped}`)
  console.log(`\nView at: https://supabase.com/dashboard/project/ihctysckgobjvyztdfsz/editor`)
}

main().catch(console.error)
