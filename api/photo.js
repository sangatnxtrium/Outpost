// ---------------------------------------------------------------------------
// /api/photo  —  image proxy that keeps the Google API key server-side.
//
// Two modes:
//   /api/photo?name=places/PID/photos/REF   → Places API (New) photo media
//   /api/photo?lat=39.7&lng=-104.9          → Street View Static fallback
//
// The key lives only in the GOOGLE_API_KEY env var on the server, so it never
// reaches the browser or the database. Responses are cached hard at the CDN to
// keep Google billing (and latency) down.
// ---------------------------------------------------------------------------

const { GOOGLE_API_KEY } = process.env

const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/

export default async function handler(req, res) {
  if (!GOOGLE_API_KEY) return res.status(500).end('missing GOOGLE_API_KEY')

  const q = req.query || {}
  // Photo reference can arrive as a path segment (/api/photo/<ref>) via rewrite,
  // or as the `ref` query param. Slashes are encoded as '~'. We avoid the param
  // literally called `name`, which Vercel's WAF blocks.
  const rawRef = q.ref || q.path
  const { lat, lng, w } = q
  let url

  if (rawRef) {
    const decoded = String(rawRef).replace(/~/g, '/')
    if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(decoded)) {
      return res.status(400).end('bad photo ref: ' + decoded.slice(0, 80))
    }
    const width = Math.min(parseInt(w, 10) || 640, 1600)
    url = `https://places.googleapis.com/v1/${decoded}/media?maxWidthPx=${width}&key=${GOOGLE_API_KEY}`
  } else if (lat != null && lng != null) {
    const la = parseFloat(lat)
    const ln = parseFloat(lng)
    if (Number.isNaN(la) || Number.isNaN(ln)) return res.status(400).end('bad coords')
    url = `https://maps.googleapis.com/maps/api/streetview?size=480x360&location=${la},${ln}&fov=80&source=outdoor&key=${GOOGLE_API_KEY}`
  } else {
    return res.status(400).end('name or lat/lng required')
  }

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) {
      // Google returns 404 for "no imagery here" on Street View — pass it through
      return res.status(upstream.status).end()
    }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
    return res.status(200).send(buf)
  } catch {
    return res.status(502).end('upstream fetch failed')
  }
}
