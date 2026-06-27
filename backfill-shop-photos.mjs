// ===========================================================================
// backfill-shop-photos.mjs  (Places API NEW — no dependencies, fetch only)
// Matches each shop via Text Search (New) and stores a working keyless photo
// URL in shops.image_url. The new Place Photo media endpoint returns a real
// image without exposing your key in the page.
//
// Run (one line):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... \
//     GOOGLE_API_KEY=AIza... node backfill-shop-photos.mjs
// Test first with:  SHOP_LIMIT=30  in front.
//
// Requires "Places API (New)" enabled + on the key. Key must NOT be
// website-restricted for this server-side run (set Application restriction =
// None or your IP while running, then restore Websites after).
// ===========================================================================

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_API_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_API_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and GOOGLE_API_KEY env vars before running.')
  process.exit(1)
}

const LIMIT = process.env.SHOP_LIMIT ? parseInt(process.env.SHOP_LIMIT, 10) : null
const PHOTO_WIDTH = 640
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

async function fetchNullImageShops(limit = 200) {
  const url = `${SUPABASE_URL}/rest/v1/shops?image_url=is.null&select=id,name,address,lat,lng&limit=${limit}`
  const res = await fetch(url, { headers: sbHeaders })
  if (!res.ok) throw new Error(`Supabase read ${res.status}: ${await res.text()}`)
  return res.json()
}

async function setShopImage(id, image_url) {
  const url = `${SUPABASE_URL}/rest/v1/shops?id=eq.${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ image_url }),
  })
  if (!res.ok) throw new Error(`Supabase update ${res.status}: ${await res.text()}`)
}

// Places API (New): Text Search -> returns places[].photos[].name
async function findPhotoUrl(shop) {
  const body = {
    textQuery: `${shop.name} ${shop.address || ''}`.trim(),
    maxResultCount: 1,
  }
  if (typeof shop.lat === 'number' && typeof shop.lng === 'number') {
    body.locationBias = { circle: { center: { latitude: shop.lat, longitude: shop.lng }, radius: 5000 } }
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.photos',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data)
    if (res.status === 403 || /PERMISSION_DENIED|API key/.test(msg)) {
      throw new Error(`PERMISSION_DENIED: ${msg}`)
    }
    throw new Error(`Places ${res.status}: ${msg}`)
  }

  const photoName = data.places?.[0]?.photos?.[0]?.name // e.g. places/XXX/photos/YYY
  if (!photoName) return null

  // The new media endpoint returns the image. skipHttpRedirect=false makes the
  // URL itself serve the bytes, so it works directly in an <img src>.
  return `/api/photo?ref=${photoName.replace(/\//g, '~')}`
}

async function main() {
  let photos = 0, none = 0, processed = 0
  while (true) {
    let shops
    try { shops = await fetchNullImageShops(200) }
    catch (e) { console.error(e.message); break }
    if (!shops || shops.length === 0) break

    for (const s of shops) {
      let photoUrl = null
      try { photoUrl = await findPhotoUrl(s) }
      catch (e) {
        console.error(`${s.name}: ${e.message}`)
        if (String(e.message).includes('PERMISSION_DENIED')) {
          console.error('\nStopping. Make sure "Places API (New)" is enabled + on the key, and the key is not website-restricted for this run.')
          console.log(`\nProgress: ${photos} photos, ${none} without a match.`)
          return
        }
      }
      try { await setShopImage(s.id, photoUrl || '') }
      catch (e) { console.error(`update ${s.name}: ${e.message}`) }
      photoUrl ? photos++ : none++
      processed++
      if (processed % 50 === 0) console.log(`  ${processed} processed — ${photos} photos, ${none} no match`)
      await sleep(80)
      if (LIMIT && processed >= LIMIT) {
        console.log(`\nReached SHOP_LIMIT=${LIMIT}. Done: ${photos} photos, ${none} without a match.`)
        return
      }
    }
  }
  console.log(`\nDone: ${photos} photos added, ${none} without a match (they keep Street View).`)
}

main()
