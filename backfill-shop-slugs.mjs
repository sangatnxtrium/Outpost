// ===========================================================================
// backfill-shop-slugs.mjs
// Populates shops.city_slug + shops.name_slug so each shop gets a real URL:
//   /shop/:city_slug/:name_slug
// City is parsed out of the existing free-text `address` field (there's no
// structured city column) — e.g. "123 Main St, Austin, TX 78701" -> "austin".
// Addresses that don't match a recognizable "City, ST" pattern are left null
// and logged so they can be fixed by hand; the script never guesses.
//
// Safe to re-run: shops that already have both slugs are left untouched, so
// existing /shop/... URLs never change or break once assigned. Only shops
// missing a slug get one assigned (deduped against all slugs already in use).
//
// Run (one line):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... \
//     node backfill-shop-slugs.mjs
// Test first with:  SHOP_LIMIT=30  in front (limits how many rows get written).
// ===========================================================================

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars before running.')
  process.exit(1)
}

const LIMIT = process.env.SHOP_LIMIT ? parseInt(process.env.SHOP_LIMIT, 10) : null

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

async function fetchAllShops() {
  let all = []
  let from = 0
  const batchSize = 1000
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/shops?select=id,name,address,city_slug,name_slug&order=id&limit=${batchSize}&offset=${from}`
    const res = await fetch(url, { headers: sbHeaders })
    if (!res.ok) throw new Error(`Supabase read ${res.status}: ${await res.text()}`)
    const rows = await res.json()
    all = all.concat(rows)
    if (rows.length < batchSize) break
    from += batchSize
  }
  return all
}

async function setShopSlugs(id, city_slug, name_slug) {
  const url = `${SUPABASE_URL}/rest/v1/shops?id=eq.${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ city_slug, name_slug }),
  })
  if (!res.ok) throw new Error(`Supabase update ${res.status}: ${await res.text()}`)
}

// "123 Main St, Austin, TX 78701" / "123 Main St, Austin, TX" -> "Austin"
// Looks for a ", <City>, <ST>" segment right before a 2-letter state code.
// Falls back to "<City>, <ST>" when there's no street-address prefix at all.
function parseCity(address) {
  if (!address) return null
  let m = address.match(/,\s*([A-Za-z][A-Za-z .'\-]*?)\s*,\s*[A-Z]{2}\b/)
  if (m && m[1].trim()) return m[1].trim()
  m = address.match(/^\s*([A-Za-z][A-Za-z .'\-]*?)\s*,\s*[A-Z]{2}\b/)
  if (m && m[1].trim()) return m[1].trim()
  return null
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function main() {
  const shops = await fetchAllShops()

  // Slugs already in use (existing + assigned so far this run), keyed
  // "citySlug/nameSlug", so new assignments never collide with them.
  const used = new Set(
    shops.filter(s => s.city_slug && s.name_slug).map(s => `${s.city_slug}/${s.name_slug}`)
  )

  const todo = shops.filter(s => !s.city_slug || !s.name_slug)
  console.log(`${shops.length} shops total, ${todo.length} missing a slug.`)

  let assigned = 0, skippedNoCity = 0, processed = 0
  const unparsed = []

  for (const s of todo) {
    const city = parseCity(s.address)
    if (!city) {
      unparsed.push({ id: s.id, name: s.name, address: s.address })
      skippedNoCity++
      continue
    }

    const citySlug = slugify(city)
    let nameSlug = slugify(s.name)
    if (!nameSlug) nameSlug = 'shop'

    // Dedupe within this city: append -2, -3, ... on collision.
    let candidate = nameSlug
    let n = 2
    while (used.has(`${citySlug}/${candidate}`)) {
      candidate = `${nameSlug}-${n}`
      n++
    }
    nameSlug = candidate
    used.add(`${citySlug}/${nameSlug}`)

    try {
      await setShopSlugs(s.id, citySlug, nameSlug)
      assigned++
    } catch (e) {
      console.error(`${s.name} (${s.id}): ${e.message}`)
    }

    processed++
    if (processed % 50 === 0) console.log(`  ${processed}/${todo.length} processed`)
    if (LIMIT && processed >= LIMIT) {
      console.log(`\nReached SHOP_LIMIT=${LIMIT}. Stopping early.`)
      break
    }
  }

  console.log(`\nDone: ${assigned} shops assigned slugs, ${skippedNoCity} skipped (address didn't parse).`)
  if (unparsed.length) {
    console.log(`\nNeeds manual review (city_slug left null — fix address or set slugs by hand):`)
    for (const u of unparsed) console.log(`  ${u.id}  ${u.name}  —  ${JSON.stringify(u.address)}`)
  }
}

main()
