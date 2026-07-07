// ===========================================================================
// /api/sitemap  (deploy as api/sitemap.js)
// Replaces the static public/sitemap.xml with a live one: queries every shop
// with a slug and every distinct city, and lists a URL for each, alongside
// the existing static pages. New shops show up automatically — nothing to
// regenerate by hand.
//
// Wired up via a vercel.json rewrite so it's still served at the public
// /sitemap.xml URL (see the rewrites section this ships with).
// ===========================================================================

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
const SITE = 'https://www.getoutpost.net'

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchAllSlugs() {
  const sbHeaders = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  let all = []
  let from = 0
  const batchSize = 1000
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/shops` +
      `?select=city_slug,name_slug&city_slug=not.is.null&name_slug=not.is.null` +
      `&order=id&limit=${batchSize}&offset=${from}`
    const res = await fetch(url, { headers: sbHeaders })
    if (!res.ok) throw new Error(`Supabase read ${res.status}: ${await res.text()}`)
    const rows = await res.json()
    all = all.concat(rows)
    if (rows.length < batchSize) break
    from += batchSize
  }
  return all
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).send('missing Supabase env vars')
  }

  let shops
  try {
    shops = await fetchAllSlugs()
  } catch (e) {
    console.error(e)
    return res.status(500).send('sitemap generation failed')
  }

  const cities = [...new Set(shops.map(s => s.city_slug))].sort()

  const staticUrls = [
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/privacy`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE}/terms`, changefreq: 'monthly', priority: '0.3' },
  ]

  const cityUrls = cities.map(c => ({
    loc: `${SITE}/city/${escapeXml(c)}`,
    changefreq: 'weekly',
    priority: '0.7',
  }))

  const shopUrls = shops.map(s => ({
    loc: `${SITE}/shop/${escapeXml(s.city_slug)}/${escapeXml(s.name_slug)}`,
    changefreq: 'weekly',
    priority: '0.6',
  }))

  const all = [...staticUrls, ...cityUrls, ...shopUrls]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    all.map(u =>
      `  <url>\n` +
      `    <loc>${u.loc}</loc>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
    ).join('\n') +
    `\n</urlset>\n`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  // Cache at the edge for an hour so a crawl storm doesn't hammer Supabase;
  // stale-while-revalidate keeps it fast while a fresh copy is fetched behind the scenes.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  return res.status(200).send(xml)
}
