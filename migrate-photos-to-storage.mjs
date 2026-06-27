// ===========================================================================
// migrate-photos-to-storage.mjs   (no dependencies, fetch only)
//
// Plan C: Vercel's firewall blocks Google photo references in any URL shape, so
// we stop proxying Google entirely. This downloads each shop's Google photo
// ONCE (server-side, with the key) and uploads it to a public Supabase Storage
// bucket, then rewrites shops.image_url to the plain Supabase CDN URL. After
// this runs, no Google key or reference appears anywhere in the app.
//
// Run (one line):
//   SUPABASE_URL=https://ihctysckgobjvyztdfsz.supabase.co \
//   SUPABASE_SERVICE_KEY=sb_secret_... \
//   GOOGLE_API_KEY=AIza... \
//   node migrate-photos-to-storage.mjs
//
// Test first with a small batch:  SHOP_LIMIT=25 in front of the command.
// Resumable: shops already pointing at storage are skipped, so you can re-run.
// The key must allow Places API (New) and NOT be website-restricted during the
// run (Application restriction = None), since this is a server-side call.
// ===========================================================================

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_API_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_API_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and GOOGLE_API_KEY env vars.')
  process.exit(1)
}

const BUCKET = 'shop-photos'
const LIMIT = process.env.SHOP_LIMIT ? parseInt(process.env.SHOP_LIMIT, 10) : null
const PHOTO_WIDTH = 640
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sb = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

// --- ensure the public bucket exists --------------------------------------
async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...sb, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  })
  if (res.ok) { console.log(`Created public bucket "${BUCKET}".`); return }
  const txt = await res.text()
  if (txt.includes('already exists') || res.status === 409) {
    console.log(`Bucket "${BUCKET}" already exists.`)
  } else {
    console.warn(`Bucket create returned ${res.status}: ${txt} (continuing)`)
  }
}

// --- pull the Google photo resource name out of whatever is stored --------
function extractPhotoName(imageUrl) {
  if (!imageUrl) return null
  let m = imageUrl.match(/(?:name=|ref=|pp=|\/img\/)(places~[^&]+)/)
  if (m) return m[1].replace(/~/g, '/')
  m = imageUrl.match(/v1\/(places\/[^/]+\/photos\/[^/?]+)\/media/)
  if (m) return m[1]
  return null
}

// --- page through shops that still need migrating (keyset by id) ----------
async function fetchBatchAfter(lastId, size) {
  const params = new URLSearchParams()
  params.set('select', 'id,image_url')
  params.set('image_url', 'like.*photos*')
  params.append('image_url', 'not.like.*supabase.co/storage*')
  params.set('id', `gt.${lastId}`)
  params.set('order', 'id')
  params.set('limit', String(size))
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shops?${params.toString()}`, { headers: sb })
  if (!res.ok) throw new Error(`fetch shops ${res.status}: ${await res.text()}`)
  return res.json()
}

async function uploadImage(path, buf, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...sb, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buf,
  })
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`)
}

async function setShopImage(id, image_url) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shops?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sb, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ image_url }),
  })
  if (!res.ok) throw new Error(`patch ${res.status}: ${await res.text()}`)
}

async function run() {
  await ensureBucket()

  let migrated = 0, skipped = 0, failed = 0
  let lastId = '00000000-0000-0000-0000-000000000000'
  const PAGE = 100

  while (true) {
    const shops = await fetchBatchAfter(lastId, PAGE)
    if (shops.length === 0) break

    for (const s of shops) {
      lastId = s.id
      if (LIMIT && migrated >= LIMIT) { console.log(`\nHit SHOP_LIMIT=${LIMIT}.`); printSummary(); return }

      const name = extractPhotoName(s.image_url)
      if (!name) { skipped++; continue }

      try {
        const googleUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${PHOTO_WIDTH}&key=${GOOGLE_API_KEY}`
        const img = await fetch(googleUrl)
        if (!img.ok) { failed++; process.stdout.write('x'); await sleep(120); continue }

        const ct = img.headers.get('content-type') || 'image/jpeg'
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
        const buf = Buffer.from(await img.arrayBuffer())
        const path = `${s.id}.${ext}`

        await uploadImage(path, buf, ct)
        await setShopImage(s.id, `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`)
        migrated++
        if (migrated % 25 === 0) process.stdout.write(`\n${migrated} migrated `)
        else process.stdout.write('.')
      } catch (e) {
        failed++
        process.stdout.write('!')
      }
      await sleep(120)
    }
  }

  printSummary()
  function printSummary() {
    console.log(`\n\nDone. migrated=${migrated} skipped(no ref)=${skipped} failed=${failed}`)
  }
}

run().catch((e) => { console.error('\nFatal:', e.message); process.exit(1) })
