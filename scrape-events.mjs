import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ihctysckgobjvyztdfsz.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY3R5c2NrZ29ianZ5enRkZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MTgzNiwiZXhwIjoyMDk0ODI3ODM2fQ.Cj64DmACdgDUyZG_izip2a08yVC_AsQt6bd2NShpk3M'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const EVENTS = [
  { title: 'San Diego Comic-Con', location: 'San Diego Convention Center, San Diego, CA', city: 'San Diego', state: 'CA', lat: 32.7066, lng: -117.1619, date: '2026-07-24', categories: ['comics','collectibles'], description: 'The largest comic convention in the world.', website: 'https://www.comic-con.org', is_national: true },
  { title: 'New York Comic Con', location: 'Jacob K. Javits Convention Center, New York, NY', city: 'New York', state: 'NY', lat: 40.7569, lng: -74.0025, date: '2026-10-08', categories: ['comics','collectibles'], description: 'East Coast biggest pop culture convention.', website: 'https://www.newyorkcomiccon.com', is_national: true },
  { title: 'Chicago C2E2', location: 'McCormick Place, Chicago, IL', city: 'Chicago', state: 'IL', lat: 41.8523, lng: -87.6156, date: '2026-04-17', categories: ['comics','collectibles'], description: 'Chicago premier pop culture convention.', website: 'https://www.c2e2.com', is_national: true },
  { title: 'WonderCon Anaheim', location: 'Anaheim Convention Center, Anaheim, CA', city: 'Anaheim', state: 'CA', lat: 33.8003, lng: -117.9189, date: '2026-03-27', categories: ['comics','collectibles'], description: 'Comic-Con International sister convention.', website: 'https://www.comic-con.org/wca', is_national: true },
  { title: 'MegaCon Orlando', location: 'Orange County Convention Center, Orlando, FL', city: 'Orlando', state: 'FL', lat: 28.4232, lng: -81.4687, date: '2026-05-21', categories: ['comics','collectibles','toys'], description: 'Southeast largest pop culture convention.', website: 'https://www.megaconorlando.com', is_national: true },
  { title: 'Denver Pop Culture Con', location: 'Colorado Convention Center, Denver, CO', city: 'Denver', state: 'CO', lat: 39.7434, lng: -104.9961, date: '2026-06-05', categories: ['comics','collectibles'], description: 'Denver biggest pop culture event.', website: 'https://www.denverpopculturecon.com', is_national: false },
  { title: 'National Sports Collectors Convention', location: 'Donald E. Stephens Convention Center, Chicago, IL', city: 'Chicago', state: 'IL', lat: 41.9742, lng: -87.8666, date: '2026-07-29', categories: ['cards'], description: 'The biggest sports card show in the world.', website: 'https://www.nsccshow.com', is_national: true },
  { title: 'Pokemon World Championships', location: 'Honolulu Convention Center, Honolulu, HI', city: 'Honolulu', state: 'HI', lat: 21.2969, lng: -157.8583, date: '2026-08-20', categories: ['cards','collectibles'], description: 'The official Pokemon World Championship tournament.', website: 'https://www.pokemon.com', is_national: true },
  { title: 'Emerald City Comic Con', location: 'Washington State Convention Center, Seattle, WA', city: 'Seattle', state: 'WA', lat: 47.6114, lng: -122.3320, date: '2026-03-12', categories: ['comics','collectibles'], description: 'Pacific Northwest premier pop culture convention.', website: 'https://www.emeraldcitycomiccon.com', is_national: true },
  { title: 'Motor City Comic Con', location: 'Suburban Collection Showplace, Novi, MI', city: 'Detroit', state: 'MI', lat: 42.4770, lng: -83.4742, date: '2026-05-15', categories: ['comics','collectibles'], description: 'Michigan largest comic convention.', website: 'https://www.motorcitycomiccon.com', is_national: false },
  { title: 'Boston Comic Con', location: 'Boston Convention Center, Boston, MA', city: 'Boston', state: 'MA', lat: 42.3467, lng: -71.0447, date: '2026-08-07', categories: ['comics','collectibles'], description: 'New England biggest comic convention.', website: 'https://www.bostoncomiccon.com', is_national: false },
  { title: 'Rose City Comic Con', location: 'Oregon Convention Center, Portland, OR', city: 'Portland', state: 'OR', lat: 45.5280, lng: -122.6587, date: '2026-09-11', categories: ['comics','collectibles'], description: 'Portland annual comics and pop culture celebration.', website: 'https://www.rosecitycomiccon.com', is_national: false },
  { title: 'Phoenix Comic Fest', location: 'Phoenix Convention Center, Phoenix, AZ', city: 'Phoenix', state: 'AZ', lat: 33.4488, lng: -112.0740, date: '2026-05-22', categories: ['comics','collectibles'], description: 'Arizona largest comic convention.', website: 'https://www.phoenixcomicfest.com', is_national: false },
  { title: 'Houston Comicpalooza', location: 'George R. Brown Convention Center, Houston, TX', city: 'Houston', state: 'TX', lat: 29.7523, lng: -95.3677, date: '2026-06-19', categories: ['comics','collectibles','toys'], description: 'Texas biggest pop culture event.', website: 'https://www.comicpalooza.com', is_national: false },
  { title: 'Dallas Fan Expo', location: 'Kay Bailey Hutchison Convention Center, Dallas, TX', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.8025, date: '2026-06-12', categories: ['comics','collectibles'], description: 'Dallas premier fan convention.', website: 'https://fanexpodallas.com', is_national: false },
  { title: 'Anime Expo', location: 'Los Angeles Convention Center, Los Angeles, CA', city: 'Los Angeles', state: 'CA', lat: 34.0403, lng: -118.2698, date: '2026-07-02', categories: ['collectibles','comics'], description: 'North America largest anime convention.', website: 'https://www.anime-expo.org', is_national: true },
  { title: 'GenCon', location: 'Indiana Convention Center, Indianapolis, IN', city: 'Indianapolis', state: 'IN', lat: 39.7686, lng: -86.1570, date: '2026-08-06', categories: ['cards','collectibles'], description: 'The largest tabletop gaming convention.', website: 'https://www.gencon.com', is_national: true },
  { title: 'PAX Unplugged', location: 'Pennsylvania Convention Center, Philadelphia, PA', city: 'Philadelphia', state: 'PA', lat: 39.9548, lng: -75.1590, date: '2026-11-20', categories: ['cards','collectibles'], description: 'Tabletop gaming convention featuring TCGs and collectibles.', website: 'https://unplugged.paxsite.com', is_national: true },
  { title: 'Atlanta Comic Con', location: 'Georgia World Congress Center, Atlanta, GA', city: 'Atlanta', state: 'GA', lat: 33.7601, lng: -84.3956, date: '2026-07-17', categories: ['comics','collectibles'], description: 'Southeast premier comic convention.', website: 'https://www.atlantacomiccon.com', is_national: false },
  { title: 'Las Vegas Comic Con', location: 'Las Vegas Convention Center, Las Vegas, NV', city: 'Las Vegas', state: 'NV', lat: 36.1352, lng: -115.1519, date: '2026-06-26', categories: ['comics','collectibles'], description: 'Las Vegas pop culture convention.', website: '', is_national: false },
  { title: 'Mid-Ohio Con', location: 'Greater Columbus Convention Center, Columbus, OH', city: 'Columbus', state: 'OH', lat: 39.9690, lng: -83.0016, date: '2026-10-30', categories: ['comics','collectibles'], description: 'Ohio premier comic book convention.', website: 'https://www.midohiocon.com', is_national: false },
  { title: 'Pittsburgh Comic Con', location: 'David L. Lawrence Convention Center, Pittsburgh, PA', city: 'Pittsburgh', state: 'PA', lat: 40.4459, lng: -79.9963, date: '2026-04-24', categories: ['comics','collectibles'], description: 'Steel City annual comic show.', website: '', is_national: false },
  { title: 'St. Louis Comic Con', location: 'Americas Center, St. Louis, MO', city: 'St. Louis', state: 'MO', lat: 38.6347, lng: -90.1935, date: '2026-06-05', categories: ['comics','collectibles'], description: 'Gateway City annual pop culture celebration.', website: '', is_national: false },
  { title: 'Midwest Card and Memorabilia Expo', location: 'Donald E. Stephens Convention Center, Chicago, IL', city: 'Chicago', state: 'IL', lat: 41.9742, lng: -87.8666, date: '2026-04-04', categories: ['cards'], description: 'Major Midwest trading card and sports memorabilia show.', website: '', is_national: false },
  { title: 'Amazing Arizona Comic Con', location: 'Phoenix Convention Center, Phoenix, AZ', city: 'Phoenix', state: 'AZ', lat: 33.4488, lng: -112.0740, date: '2026-01-16', categories: ['comics','collectibles'], description: 'Arizona fan-favorite comic convention.', website: 'https://www.amazingcomiccon.com', is_national: false },
  { title: 'Lone Star Comic Con', location: 'Henry B. Gonzalez Convention Center, San Antonio, TX', city: 'San Antonio', state: 'TX', lat: 29.4213, lng: -98.4785, date: '2026-08-28', categories: ['comics','collectibles'], description: 'San Antonio annual comic convention.', website: '', is_national: false },
  { title: 'Nashville Collectibles Show', location: 'Music City Center, Nashville, TN', city: 'Nashville', state: 'TN', lat: 36.1590, lng: -86.7784, date: '2026-09-18', categories: ['cards','collectibles'], description: 'Major Tennessee collectibles and trading card show.', website: '', is_national: false },
  { title: 'East Coast Card Show', location: 'Atlantic City Convention Center, Atlantic City, NJ', city: 'Atlantic City', state: 'NJ', lat: 39.3643, lng: -74.4229, date: '2026-08-01', categories: ['cards'], description: 'Major East Coast sports card and memorabilia show.', website: '', is_national: false },
  { title: 'Beckett Sports Card National', location: 'Dallas Convention Center, Dallas, TX', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, date: '2026-08-15', categories: ['cards'], description: 'Major sports card and memorabilia show.', website: 'https://www.beckett.com', is_national: true },
  { title: 'Minnesota State Card Show', location: 'Minneapolis Convention Center, Minneapolis, MN', city: 'Minneapolis', state: 'MN', lat: 44.9736, lng: -93.2715, date: '2026-07-11', categories: ['cards'], description: 'Upper Midwest largest sports card show.', website: '', is_national: false },
]

async function main() {
  console.log('🎪 Inserting US Comic Cons and Card Shows...\n')
  let inserted = 0
  let failed = 0

  for (const ev of EVENTS) {
    const { error } = await supabase.from('events').insert({
      title: ev.title,
      date: ev.date,
      location: ev.location,
      city: ev.city,
      state: ev.state,
      description: ev.description,
      website: ev.website || '',
      categories: ev.categories,
      is_national: ev.is_national,
      lat: ev.lat,
      lng: ev.lng,
      spots: null,
      shop_id: null,
    })

    if (!error) {
      inserted++
      console.log(`  ✓ ${ev.title}`)
    } else {
      failed++
      console.log(`  ⚠️  ${ev.title}: ${error.message}`)
    }

    await new Promise(r => setTimeout(r, 50))
  }

  console.log(`\n🎉 Done! ${inserted} events inserted, ${failed} failed.`)
  console.log('View at: https://supabase.com/dashboard/project/ihctysckgobjvyztdfsz/editor')
}

main().catch(console.error)
