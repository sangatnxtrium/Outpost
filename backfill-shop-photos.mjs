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

async function findPhotoUrl(shop) {
  const input = encodeURIComponent(`${shop.name} ${shop.address || ''}`.trim())
  let url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${input}&inputtype=textquery&fields=place_id,photos`
  if (typeof shop.lat === 'number' && typeof shop.lng === 'number') {
    url += `&locationbias=point:${shop.lat},${shop.lng}`
  }
  url += `&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`REQUEST_DENIED: ${data.error_message || 'key not authorized for server-side Places'}`)
  }
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new Error('OVER_QUERY_LIMIT: slow down or check billing/quota')
  }
  const ref = data.candidates?.[0]?.photos?.[0]?.photo_reference
  if (!ref) return null
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${PHOTO_WIDTH}&photo_reference=${ref}&key=${GOOGLE_API_KEY}`
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
        if (String(e.message).includes('REQUEST_DENIED')) {
          console.error('\nStopping. Set that Google key Application restriction = None (or your IP), then re-run.')
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
